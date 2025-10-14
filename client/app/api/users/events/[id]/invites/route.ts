import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";

type Ctx = { params: Promise<{ id: string }> };

function jsonBad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}
async function getCreatorId(eventId: string) {
  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { userId: true },
  });
  return ev?.userId ?? null;
}

/**
 * GET
 * - If `?q=...` present: search users like Instagram (username, name, email, bio, location)
 *   excluding self + already invited.
 * - If `?q` missing: return current invited list with user cards.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const callerId = getDataFromToken(req);
    if (!id || !callerId) return jsonBad("Unauthorized", 401);

    const creatorId = await getCreatorId(id);
    if (!creatorId) return jsonBad("Event not found", 404);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const take = Math.min(parseInt(searchParams.get("take") || "10", 10) || 10, 25);

    // find all invited
    const invited = await db.eventAttendee.findMany({
      where: { eventId: id },
      select: { userId: true },
    });
    const invitedIds = new Set(invited.map(i => i.userId));

    if (q) {
      // SEARCH mode: exclude self, creator, and already-invited
      const like = { contains: q, mode: "insensitive" } as const;

      const users = await db.user.findMany({
        where: {
          AND: [
            { id: { notIn: Array.from(invitedIds) } },
            { id: { not: callerId } },   // cannot invite yourself
            { id: { not: creatorId } },  // cannot invite creator
            {
              OR: [
                { username: like },
                { name: like },
                { email: like },
                { bio: like },
                { location: like },
              ],
            },
          ],
        },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          bio: true,
          location: true,
          profileImageUrl: true,
        },
        orderBy: { createdAt: "desc" },
        take,
      });

      return NextResponse.json({
        ok: true,
        results: users.map(u => ({
          id: u.id,
          username: u.username ?? null,
          name: u.name ?? "",
          email: u.email ?? "",
          bio: u.bio ?? "",
          location: u.location ?? "",
          image: u.profileImageUrl ?? null,
          status: "none" as const,
        })),
      });
    }

    // LIST invited mode: exclude creator here too
    const rows = await db.eventAttendee.findMany({
      where: { eventId: id, userId: { not: creatorId } },
      include: {
        user: { select: {
          id: true, username: true, name: true, email: true,
          bio: true, location: true, profileImageUrl: true,
        }},
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      invited: rows.map(r => ({
        id: r.user.id,
        username: r.user.username ?? null,
        name: r.user.name ?? "",
        email: r.user.email ?? "",
        bio: r.user.bio ?? "",
        location: r.user.location ?? "",
        image: r.user.profileImageUrl ?? null,
        status: r.status === "ATTENDING" ? "attending" : "invited",
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonBad(msg);
  }
}


/**
 * POST
 * Invite a user: body { userId: string }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const callerId = getDataFromToken(req);
    if (!id || !callerId) return jsonBad("Unauthorized", 401);

    const creatorId = await getCreatorId(id);
    if (!creatorId) return jsonBad("Event not found", 404);

    const { userId } = (await req.json()) as { userId?: string };
    if (!userId) return jsonBad("Missing userId");

    if (userId === creatorId) return jsonBad("Cannot invite event creator", 400);
    if (userId === callerId)  return jsonBad("Cannot invite yourself", 400);

    await db.eventAttendee.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      create: { eventId: id, userId, profile: "", status: "INVITED" },
      update: { status: "INVITED" },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonBad(msg);
  }
}

/**
 * DELETE
 * Remove an invited user: ?userId=...
 * Returns updated invited list for instant UI refresh.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const callerId = getDataFromToken(req);
    if (!id || !callerId) return jsonBad("Unauthorized", 401);

    const creatorId = await getCreatorId(id);
    if (!creatorId) return jsonBad("Event not found", 404);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "";
    if (!userId) return jsonBad("Missing userId");

    if (userId === creatorId) return jsonBad("Cannot remove event creator", 400);

    await db.eventAttendee.deleteMany({ where: { eventId: id, userId } });

    // fresh invited list (still excluding creator)
    const rows = await db.eventAttendee.findMany({
      where: { eventId: id, userId: { not: creatorId } },
      include: {
        user: { select: {
          id: true, username: true, name: true, email: true,
          bio: true, location: true, profileImageUrl: true,
        }},
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      invited: rows.map(r => ({
        id: r.user.id,
        username: r.user.username ?? null,
        name: r.user.name ?? "",
        email: r.user.email ?? "",
        bio: r.user.bio ?? "",
        location: r.user.location ?? "",
        image: r.user.profileImageUrl ?? null,
        status: (r.status === "ATTENDING" ? "attending" : "invited") as 'attending' | 'invited',
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonBad(msg);
  }
}
