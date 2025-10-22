// app/api/users/events/[id]/route.ts  (and the /profile one too)
"use server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;          // 👈 await params
    const userId = getDataFromToken(req);
    const eventId = id;

    const attendee = await db.eventAttendee.findFirst({
      where: { eventId, userId },
      select: { profile: true },
    });

    return NextResponse.json({ ok: true, profile: attendee?.profile ?? "" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch profile";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;          // 👈 await params
    const userId = getDataFromToken(req);
    const eventId = id;

    const body = (await req.json()) as { profile?: string };
    const profile = body.profile;
    if (typeof profile !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid profile" }, { status: 400 });
    }

    const existing = await db.eventAttendee.findFirst({
      where: { eventId, userId },
      select: { id: true },
    });

    if (existing) {
      await db.eventAttendee.update({ where: { id: existing.id }, data: { profile } });
    } else {
      await db.eventAttendee.create({ data: { eventId, userId, profile } });
    }

    const attendee = await db.eventAttendee.findFirst({
      where: { eventId, userId },
      select: { profile: true },
    });

    return NextResponse.json({ ok: true, profile: attendee?.profile ?? "" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save profile";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
