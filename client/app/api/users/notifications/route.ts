"use server";
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
    const onlyUnread = searchParams.get("onlyUnread") === "1";

    const rows = await db.notification.findMany({
      where: { userId, ...(onlyUnread ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const iconFor: Record<string, string> = {
      EVENT_INVITE: "✉️",
      EVENT_UPDATE: "📍",
      EVENT_REMINDER: "🔔",
      EVENT_CANCELLED: "❌",
      NEW_FOLLOWER: "👤",
      EVENT_JOINED: "🎉",
    };

    return NextResponse.json({
      ok: true,
      notifications: rows.map(r => ({
        id: r.id,
        type: r.type,
        title: r.title,
        message: r.message,
        data: r.data ?? null,
        read: r.read,
        createdAt: r.createdAt,
        icon: iconFor[r.type] ?? "🔔",
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}


/**
 * PATCH — actions on a notification
 * body: { id: string, action: "read" | "accept_invite" | "decline_invite" }
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = getDataFromToken(req);
    if (!userId) return bad("Unauthorized", 401);

    const { id, action } = (await req.json()) as { id?: string; action?: string };
    if (!id || !action) return bad("Missing id/action");

    const notif = await db.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) return bad("Not found", 404);

    // read only: mark read, keep
    if (action === "read") {
      await db.notification.update({ where: { id }, data: { read: true } });
      return NextResponse.json({ ok: true });
    }

    // accept / decline only for EVENT_INVITE
    if (notif.type !== "EVENT_INVITE") return bad("Unsupported action for this notification", 400);

    const data = (notif.data ?? {}) as { eventId?: string };
    if (!data.eventId) return bad("Invalid notification payload");

    if (action === "accept_invite") {
      // mark attendee as ATTENDING
      await db.eventAttendee.updateMany({
        where: { eventId: data.eventId, userId },
        data: { status: "ATTENDING" },
      });
      // Optionally bump event.attendees count here if you want to enforce capacity server-side

      // delete the handled notification so it "goes away"
      await db.notification.delete({ where: { id } });

      return NextResponse.json({ ok: true, changed: "accepted" });
    }

    if (action === "decline_invite") {
      // remove attendee row entirely
      await db.eventAttendee.deleteMany({
        where: { eventId: data.eventId, userId },
      });

      await db.notification.delete({ where: { id } });
      return NextResponse.json({ ok: true, changed: "declined" });
    }

    return bad("Unknown action");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}
