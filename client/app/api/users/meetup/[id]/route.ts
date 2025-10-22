"use server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

// If your app directory uses the "params as Promise" pattern elsewhere, keep it consistent:
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const userId = getDataFromToken(req);
    if (!userId) return bad("Unauthorized", 401);

    const { id } = await ctx.params;
    if (!id) return bad("Missing event id");

    const ev = await db.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        location: true,
        category: true,
        inviteOnly: true,
        maxAttendees: true,
        attendees: true, // current count (maintained by your code)
        creator: { select: { id: true, username: true, name: true } },
        EventAttendee: {
          select: {
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImageUrl: true,
                username: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ev) return bad("Event not found", 404);

    return NextResponse.json({
      ok: true,
      event: {
        id: ev.id,
        title: ev.title,
        description: ev.description,
        startsAt: ev.startsAt.toISOString(),
        endsAt: ev.endsAt.toISOString(),
        location: ev.location,
        category: ev.category,
        inviteOnly: ev.inviteOnly,
        maxAttendees: ev.maxAttendees,
        attendees: ev.attendees,
        hostName: ev.creator?.username || ev.creator?.name || "Host",
      },
      attendees: ev.EventAttendee.map((row) => ({
        id: row.user.id,
        name: row.user.name || row.user.username || "User",
        email: row.user.email ?? "",
        avatar: row.user.profileImageUrl ?? undefined,
        joinedAt: row.createdAt.toISOString(),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}
