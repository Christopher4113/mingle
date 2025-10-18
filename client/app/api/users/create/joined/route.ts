// app/api/users/create/joined/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function GET(req: NextRequest) {
  try {
    const userId = getDataFromToken(req);
    if (!userId) return bad("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const onlyAttending = searchParams.get("onlyAttending") === "1";

    const rows = await db.eventAttendee.findMany({
      where: {
        userId,
        ...(onlyAttending ? { status: "ATTENDING" } : {}),
      },
      include: {
        event: {
          include: { creator: { select: { name: true, username: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const events = rows.map((r) => ({
      id: r.event.id,
      title: r.event.title,
      description: r.event.description,
      startsAt: r.event.startsAt.toISOString(),
      endsAt: r.event.endsAt?.toISOString?.() ?? null,
      location: r.event.location,
      category: r.event.category,
      attendees: r.event.attendees,
      maxAttendees: r.event.maxAttendees,
      inviteOnly: r.event.inviteOnly,
      hostName: r.event.creator.name ?? r.event.creator.username ?? "Host",
      status: r.status, // "INVITED" | "ATTENDING"
    }));

    return NextResponse.json({ ok: true, events });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = getDataFromToken(req);
    if (!userId) return bad("Unauthorized", 401);

    const { eventId } = await req.json();
    if (!eventId) return bad("Missing eventId");

    const result = await db.$transaction(async (tx) => {
      // Find attendee row
      const attendee = await tx.eventAttendee.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { status: true, eventId: true },
      });
      if (!attendee) return { changed: false };

      // If they were counted as ATTENDING, decrement attendees (clamp at 0)
      if (attendee.status === "ATTENDING") {
        const ev = await tx.event.findUnique({
          where: { id: eventId },
          select: { attendees: true },
        });
        if (ev) {
          const newCount = Math.max(0, ev.attendees - 1);
          await tx.event.update({
            where: { id: eventId },
            data: { attendees: newCount },
          });
        }
      }

      // Remove attendee link
      await tx.eventAttendee.delete({
        where: { eventId_userId: { eventId, userId } },
      });

      return { changed: true };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}