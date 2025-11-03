// app/api/users/meetup/[id]/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";
import type { AttendeeStatus, Event, EventAttendee, User } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

// Generic helper that preserves types instead of using `any`
function ok<T extends Record<string, unknown>>(data: T) {
  return NextResponse.json({ ok: true, ...data });
}

// Prisma join type for the attendee record we return
type AttendeeWithJoins = EventAttendee & {
  user: User | null;
  event: Pick<Event, "userId"> | null;
};

// Shape returned to the client
type AttendeePayload = {
  attendee: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    joinedAt: string;
    location?: string;
    interests?: string[];
    connections?: number;
    bio?: string;
    username?: string;
    isCreator: boolean;
    profile: string;
    status: AttendeeStatus;
    eventId: string;
    userId: string;
    eventCreatorId: string | null;
  };
};

// Normalize Prisma attendee record into the frontend shape
function toAttendeePayload(a: AttendeeWithJoins): AttendeePayload {
  const u = a.user;
  const isCreator = (a.event?.userId ?? null) === a.userId;

  return {
    attendee: {
      id: u?.id ?? a.userId,
      name: u?.name ?? "",
      email: u?.email ?? "",
      avatar: u?.profileImageUrl ?? u?.image ?? undefined,
      joinedAt: a.createdAt.toISOString(),
      location: u?.location ?? undefined,
      interests: u?.interests ?? undefined,
      connections: u?.connections ?? undefined,
      bio: u?.bio ?? undefined,
      username: u?.username ?? undefined,
      isCreator,
      profile: a.profile,
      status: a.status,
      eventId: a.eventId,
      userId: a.userId,
      eventCreatorId: a.event?.userId ?? null,
    },
  };
}

// Safely coerce a string to AttendeeStatus
function parseStatus(s?: string | null): AttendeeStatus | undefined {
  if (!s) return undefined;
  const up = s.toUpperCase().trim();
  if (up === "INVITED") return "INVITED";
  if (up === "ATTENDING") return "ATTENDING";
  return undefined;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const viewerId = getDataFromToken(req);
  if (!viewerId) return bad("Unauthorized", 401);

  const { id } = await ctx.params;
  if (!id) return bad("Missing event id");

  const { searchParams } = new URL(req.url);
  const profileParam = searchParams.get("profile") ?? undefined;
  const statusParam = parseStatus(searchParams.get("status"));

  const event = await db.event.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!event) return bad("Event not found", 404);

  const existing = await db.eventAttendee.findUnique({
    where: { eventId_userId: { eventId: id, userId: viewerId } },
    include: { user: true, event: { select: { userId: true } } },
  });

  if (!existing) {
    const initialStatus: AttendeeStatus = statusParam ?? "INVITED";

    const [created] = await db.$transaction([
      db.eventAttendee.create({
        data: {
          eventId: id,
          userId: viewerId,
          profile: profileParam ?? "",
          status: initialStatus,
        },
        include: { user: true, event: { select: { userId: true } } },
      }),
      ...(initialStatus === "ATTENDING"
        ? [db.event.update({ where: { id }, data: { attendees: { increment: 1 } } })]
        : []),
    ]);

    return ok<AttendeePayload>(toAttendeePayload(created as AttendeeWithJoins));
  }

  if (profileParam === undefined && statusParam === undefined) {
    return ok<AttendeePayload>(toAttendeePayload(existing as AttendeeWithJoins));
  }

  const prevStatus = existing.status;
  const nextStatus: AttendeeStatus = statusParam ?? prevStatus;

  const shouldInc = prevStatus !== "ATTENDING" && nextStatus === "ATTENDING";
  const shouldDec = prevStatus === "ATTENDING" && nextStatus !== "ATTENDING";

  const [updated] = await db.$transaction([
    db.eventAttendee.update({
      where: { eventId_userId: { eventId: id, userId: viewerId } },
      data: {
        profile: profileParam ?? undefined,
        status: statusParam ?? undefined,
      },
      include: { user: true, event: { select: { userId: true } } },
    }),
    ...(shouldInc
      ? [db.event.update({ where: { id }, data: { attendees: { increment: 1 } } })]
      : []),
    ...(shouldDec
      ? [db.event.update({ where: { id }, data: { attendees: { decrement: 1 } } })]
      : []),
  ]);

  return ok<AttendeePayload>(toAttendeePayload(updated as AttendeeWithJoins));
}

type UpsertBody = {
  profile?: string;
  status?: string;
};

export async function POST(req: NextRequest, ctx: Ctx) {
  const viewerId = getDataFromToken(req);
  if (!viewerId) return bad("Unauthorized", 401);

  const { id } = await ctx.params;
  if (!id) return bad("Missing event id");

  const body = (await req.json().catch(() => ({}))) as UpsertBody;
  const profileBody = typeof body.profile === "string" ? body.profile : undefined;
  const statusBody = parseStatus(body.status);

  const event = await db.event.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!event) return bad("Event not found", 404);

  const existing = await db.eventAttendee.findUnique({
    where: { eventId_userId: { eventId: id, userId: viewerId } },
  });

  if (!existing) {
    const initialStatus: AttendeeStatus = statusBody ?? "INVITED";

    const [created] = await db.$transaction([
      db.eventAttendee.create({
        data: {
          eventId: id,
          userId: viewerId,
          profile: profileBody ?? "",
          status: initialStatus,
        },
        include: { user: true, event: { select: { userId: true } } },
      }),
      ...(initialStatus === "ATTENDING"
        ? [db.event.update({ where: { id }, data: { attendees: { increment: 1 } } })]
        : []),
    ]);

    return ok<AttendeePayload>(toAttendeePayload(created as AttendeeWithJoins));
  }

  const prevStatus = existing.status;
  const nextStatus: AttendeeStatus = statusBody ?? prevStatus;

  const shouldInc = prevStatus !== "ATTENDING" && nextStatus === "ATTENDING";
  const shouldDec = prevStatus === "ATTENDING" && nextStatus !== "ATTENDING";

  const [updated] = await db.$transaction([
    db.eventAttendee.update({
      where: { eventId_userId: { eventId: id, userId: viewerId } },
      data: {
        profile: profileBody ?? undefined,
        status: statusBody ?? undefined,
      },
      include: { user: true, event: { select: { userId: true } } },
    }),
    ...(shouldInc
      ? [db.event.update({ where: { id }, data: { attendees: { increment: 1 } } })]
      : []),
    ...(shouldDec
      ? [db.event.update({ where: { id }, data: { attendees: { decrement: 1 } } })]
      : []),
  ]);

  return ok<AttendeePayload>(toAttendeePayload(updated as AttendeeWithJoins));
}
