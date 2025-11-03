// app/api/users/meetup/[id]/names/route.ts
"use server";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

type Ctx = { params: Promise<{ id: string }> };

type NameProfileItem = {
  userId: string;
  name: string | null;
  username: string | null;
  text: string; // event-profile -> bio -> displayName
};

type NameProfileResp = {
  ok: true;
  eventId: string;
  people: NameProfileItem[];
};

function pickText({
  eventProfile,
  bio,
  name,
  username,
}: {
  eventProfile?: string | null;
  bio?: string | null;
  name?: string | null;
  username?: string | null;
}) {
  const p = (eventProfile ?? "").trim();
  if (p) return p;
  const b = (bio ?? "").trim();
  if (b) return b;
  const disp = (name && name.trim()) || (username && username.trim()) || "User";
  return disp;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const viewerId = getDataFromToken(req);
    if (!viewerId) return bad("Unauthorized", 401);

    const { id } = await ctx.params;
    if (!id) return bad("Missing event id");

    // Pull event, creator, and attendees
    const ev = await db.event.findUnique({
      where: { id },
      select: {
        id: true,
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            bio: true,
          },
        },
        EventAttendee: {
          select: {
            userId: true,
            profile: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                bio: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ev) return bad("Event not found", 404);

    // Build attendees except the viewer
    const peopleFromEA: NameProfileItem[] = ev.EventAttendee
      .filter((row) => row.userId !== viewerId) // exclude current user
      .map((row) => {
        const u = row.user;
        const name = u?.name ?? null;
        const username = u?.username ?? null;
        const userId = u?.id ?? row.userId;

        return {
          userId,
          name,
          username,
          text: pickText({
            eventProfile: row.profile,
            bio: u?.bio ?? null,
            name,
            username,
          }),
        };
      });

    // Include the creator (if they aren't the current viewer)
    const creator = ev.creator;
    const alreadyHasCreator =
      creator && peopleFromEA.some((p) => p.userId === creator.id);

    const people: NameProfileItem[] =
      creator && !alreadyHasCreator && creator.id !== viewerId
        ? [
            {
              userId: creator.id,
              name: creator.name ?? null,
              username: creator.username ?? null,
              text: pickText({
                bio: creator.bio ?? null,
                name: creator.name ?? null,
                username: creator.username ?? null,
              }),
            },
            ...peopleFromEA,
          ]
        : peopleFromEA;

    const payload: NameProfileResp = {
      ok: true,
      eventId: ev.id,
      people,
    };

    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}
