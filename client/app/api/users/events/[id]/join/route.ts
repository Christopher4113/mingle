import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";
import { sendNotificationEmail } from "@/lib/mailer";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

async function getEvent(id: string) {
  return db.event.findUnique({
    where: { id },
    select: {
      id: true, title: true, userId: true, inviteOnly: true,
      attendees: true, maxAttendees: true,
      creator: { select: { email: true, id: true } },
    },
  });
}

/**
 * POST /api/users/events/[id]/join
 * For open events: immediately ATTENDING, increments count, notifies creator
 * For inviteOnly: creates/sets INVITED as a join request, notifies creator
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = getDataFromToken(req);
    if (!userId) return bad("Unauthorized", 401);

    const id = params.id;
    const ev = await getEvent(id);
    if (!ev) return bad("Event not found", 404);
    if (ev.userId === userId) return bad("Creators cannot join their own event", 400);

    return NextResponse.json(await db.$transaction(async (tx) => {
      // Are they already linked?
      const existing = await tx.eventAttendee.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
        select: { status: true },
      });

      if (ev.inviteOnly) {
        // Join request: create or set status to INVITED
        await tx.eventAttendee.upsert({
          where: { eventId_userId: { eventId: id, userId } },
          create: { eventId: id, userId, profile: "", status: "INVITED" },
          update: { status: "INVITED" },
        });

        // Notify creator that user requested to join
        const notif = await tx.notification.create({
          data: {
            userId: ev.userId,
            type: "EVENT_UPDATE",
            title: "Join Request",
            message: "Someone requested to join your invite only event.",
            data: { eventId: id, eventTitle: ev.title },
          },
        });

        if (ev.creator.email) {
          sendNotificationEmail({
            to: ev.creator.email,
            notificationId: notif.id,
            title: "Join Request",
            message: `A user requested to join "${ev.title}".`,
          }).catch(console.error);
        }

        return { ok: true, status: "INVITED" as const };
      }

      // Open to everyone: auto-join as ATTENDING
      if (ev.attendees >= ev.maxAttendees) return { ok: false, error: "Event is full" };

      // If not attending already, set ATTENDING and increment attendees safely
      if (!existing || existing.status !== "ATTENDING") {
        await tx.eventAttendee.upsert({
          where: { eventId_userId: { eventId: id, userId } },
          create: { eventId: id, userId, profile: "", status: "ATTENDING" },
          update: { status: "ATTENDING" },
        });

        await tx.event.update({
          where: { id },
          data: { attendees: Math.min(ev.maxAttendees, ev.attendees + 1) },
        });

        // Notify creator that a user joined
        const notif = await tx.notification.create({
          data: {
            userId: ev.userId,
            type: "EVENT_JOINED",
            title: "New Attendee",
            message: "Someone joined your event.",
            data: { eventId: id, eventTitle: ev.title },
          },
        });

        if (ev.creator.email) {
          sendNotificationEmail({
            to: ev.creator.email,
            notificationId: notif.id,
            title: "New Attendee",
            message: `Someone joined "${ev.title}".`,
          }).catch(console.error);
        }
      }

      return { ok: true, status: "ATTENDING" as const };
    }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}

/**
 * PATCH /api/users/events/[id]/join
 * Only event creator can approve or decline requests
 * body: { userId: string, action: "approve" | "decline" }
 * approve -> status ATTENDING (+1 attendees, cap safe) + notify user
 * decline -> delete attendee row + notify user
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const callerId = getDataFromToken(req);
    if (!callerId) return bad("Unauthorized", 401);

    const id = params.id;
    const { userId, action } = (await req.json()) as { userId?: string; action?: "approve" | "decline" };
    if (!userId || !action) return bad("Missing userId or action");

    const ev = await getEvent(id);
    if (!ev) return bad("Event not found", 404);
    if (ev.userId !== callerId) return bad("Only the creator can manage requests", 403);

    return NextResponse.json(await db.$transaction(async (tx) => {
      const attendee = await tx.eventAttendee.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
        select: { status: true },
      });
      if (!attendee) return { ok: false, error: "No request found" };

      if (action === "approve") {
        if (ev.attendees >= ev.maxAttendees) return { ok: false, error: "Event is full" };

        if (attendee.status !== "ATTENDING") {
          await tx.eventAttendee.update({
            where: { eventId_userId: { eventId: id, userId } },
            data: { status: "ATTENDING" },
          });
          await tx.event.update({
            where: { id },
            data: { attendees: Math.min(ev.maxAttendees, ev.attendees + 1) },
          });
        }

        const notif = await tx.notification.create({
          data: {
            userId,
            type: "EVENT_UPDATE",
            title: "Request Approved",
            message: `You have been accepted to "${ev.title}".`,
            data: { eventId: id, eventTitle: ev.title },
          },
        });

        const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user?.email) {
          sendNotificationEmail({
            to: user.email,
            notificationId: notif.id,
            title: "Request Approved",
            message: `You have been accepted to "${ev.title}".`,
          }).catch(console.error);
        }

        return { ok: true };
      }

      // decline
      await tx.eventAttendee.delete({
        where: { eventId_userId: { eventId: id, userId } },
      });

      const notif = await tx.notification.create({
        data: {
          userId,
          type: "EVENT_UPDATE",
          title: "Request Declined",
          message: `Your request to join "${ev.title}" was declined.`,
          data: { eventId: id, eventTitle: ev.title },
        },
      });

      const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        sendNotificationEmail({
          to: user.email,
          notificationId: notif.id,
          title: "Request Declined",
          message: `Your request to join "${ev.title}" was declined.`,
        }).catch(console.error);
      }

      return { ok: true };
    }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}
