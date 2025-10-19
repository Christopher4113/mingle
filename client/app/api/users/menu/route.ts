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

    // All events user did not create and is not already linked to
    const rows = await db.event.findMany({
      where: {
        userId: { not: userId },
        EventAttendee: { none: { userId } },
      },
      select: {
        id: true, title: true, description: true,
        startsAt: true, endsAt: true, location: true, category: true,
        attendees: true, maxAttendees: true, inviteOnly: true,
        creator: { select: { id: true, name: true, username: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    const events = rows.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      location: e.location,
      category: e.category,
      attendees: e.attendees,
      maxAttendees: e.maxAttendees,
      inviteOnly: e.inviteOnly,
      hostName: e.creator.name ?? e.creator.username ?? "Host",
      isFull: e.attendees >= e.maxAttendees,
    }));

    return NextResponse.json({ ok: true, events });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}
