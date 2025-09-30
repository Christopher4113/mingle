import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";
import { Prisma } from "@prisma/client";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function toStartsAt(date: string, time: string): Date {
  // "2024-01-15" + "18:00" => 2024-01-15T18:00:00
  // rely on server TZ -> converts to UTC in DB (recommended to keep DB in UTC)
  return new Date(`${date}T${time}:00`);
}

/** GET /api/users/create — list current user's events */
export async function GET(req: NextRequest) {
  try {
    const userId = getDataFromToken(req);

    const events = await db.event.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load events";
    return bad(msg, 401);
  }
}

/** POST /api/users/create — create event */
export async function POST(req: NextRequest) {
  try {
    const userId = getDataFromToken(req);
    const body = (await req.json()) as Partial<{
      title: string;
      description: string;
      date: string;
      time: string;
      location: string;
      category: string;
      maxAttendees: number | string;
      inviteOnly: boolean;
    }>;

    const {
      title,
      description,
      date,
      time,
      location,
      category,
      maxAttendees,
      inviteOnly = false,
    } = body;

    if (!title || !description || !date || !time || !location || !category) {
      return bad("Missing required fields");
    }

    const max = Number.parseInt(String(maxAttendees));
    if (!Number.isFinite(max) || max < 1) return bad("Invalid maxAttendees");

    const data: Prisma.EventUncheckedCreateInput = {
      title,
      description,
      startsAt: toStartsAt(date, time),
      location,
      category,
      attendees: 0,
      maxAttendees: max,
      inviteOnly: Boolean(inviteOnly),
      userId, // unchecked create allows direct FK set
    };

    const event = await db.event.create({ data });

    // Optionally return fresh list to avoid an extra GET on the client
    const events = await db.event.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, event, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create event";
    return bad(msg, 401);
  }
}

/** PUT /api/users/create — update event */
export async function PUT(req: NextRequest) {
  try {
    const userId = getDataFromToken(req);
    const body = (await req.json()) as Partial<{
      id: string;
      title: string;
      description: string;
      date: string;
      time: string;
      location: string;
      category: string;
      maxAttendees: number | string;
      inviteOnly: boolean;
    }>;

    const { id } = body;
    if (!id) return bad("Missing event id");

    // Owns the event?
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return bad("Event not found", 404);

    const updateData: Prisma.EventUpdateInput = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.inviteOnly !== undefined) updateData.inviteOnly = Boolean(body.inviteOnly);

    if (body.maxAttendees !== undefined) {
      const max = Number.parseInt(String(body.maxAttendees));
      if (!Number.isFinite(max) || max < 1) return bad("Invalid maxAttendees");
      updateData.maxAttendees = max;
    }

    if (body.date !== undefined || body.time !== undefined) {
      if (!body.date || !body.time) {
        return bad("If updating date/time, provide both date and time");
      }
      updateData.startsAt = toStartsAt(body.date, body.time);
    }

    const updated = await db.event.update({ where: { id }, data: updateData });

    const events = await db.event.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, event: updated, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update event";
    return bad(msg, 401);
  }
}

/** DELETE /api/users/create — delete event */
export async function DELETE(req: NextRequest) {
  try {
    const userId = getDataFromToken(req);
    const { id } = (await req.json()) as Partial<{ id: string }>;
    if (!id) return bad("Missing event id");

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return bad("Event not found", 404);

    await db.event.delete({ where: { id } });

    const events = await db.event.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete event";
    return bad(msg, 401);
  }
}
