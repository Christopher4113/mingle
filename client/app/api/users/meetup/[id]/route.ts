// app/api/users/meetup/[id]/route.ts
"use server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const viewerId = getDataFromToken(req);
    if (!viewerId) return bad("Unauthorized", 401);

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
        attendees: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            profileImageUrl: true,
            location: true,
            interests: true,
            connections: true,
            bio: true,
          },
        },
        EventAttendee: {
          select: {
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                profileImageUrl: true,
                location: true,
                interests: true,
                connections: true,
                bio: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ev) return bad("Event not found", 404);

    // build attendees (exclude the current viewer)
    const base = ev.EventAttendee
      .filter((row) => row.user.id !== viewerId) // 👈 hide current user
      .map((row) => ({
        id: row.user.id,
        name: row.user.name || row.user.username || "User",
        email: row.user.email ?? "",
        avatar: row.user.profileImageUrl ?? undefined,
        joinedAt: row.createdAt.toISOString(),
        location: row.user.location ?? "",
        interests: row.user.interests ?? [],
        connections: row.user.connections ?? 0,
        bio: row.user.bio ?? "",
        username: row.user.username ?? undefined,
        isCreator: false,
      }));

    // always include the creator (flagged), even if they’re the viewer
    const creator = ev.creator;
    const creatorEntry = creator && {
      id: creator.id,
      name: creator.name || creator.username || "Host",
      email: creator.email ?? "",
      avatar: creator.profileImageUrl ?? undefined,
      joinedAt: ev.startsAt.toISOString(), // or createdAt if you prefer
      location: creator.location ?? "",
      interests: creator.interests ?? [],
      connections: creator.connections ?? 0,
      bio: creator.bio ?? "",
      username: creator.username ?? undefined,
      isCreator: true,
    };

    // If creator is already in base list, replace that entry with flagged one; otherwise unshift.
    const attendees = (() => {
      if (!creatorEntry) return base;
      const idx = base.findIndex((a) => a.id === creatorEntry.id);
      if (idx >= 0) {
        const copy = base.slice();
        copy[idx] = { ...creatorEntry };
        return copy;
      }
      return [creatorEntry, ...base];
    })();

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
      attendees,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}
