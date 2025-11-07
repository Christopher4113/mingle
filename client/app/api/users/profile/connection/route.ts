// app/api/users/profile/connection/route.ts
"use server";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

/** GET — list my connections (via user_connections) */
export async function GET(req: NextRequest) {
  try {
    const me = getDataFromToken(req);
    if (!me) return bad("Unauthorized", 401);

    const rows = await db.userConnection.findMany({
      where: { userId: me },
      select: { connectedUserId: true },
    });

    if (rows.length === 0) return NextResponse.json({ ok: true, users: [] });

    const otherIds = rows.map((r) => r.connectedUserId);

    const users = await db.user.findMany({
      where: { id: { in: otherIds } },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        location: true,
        connections: true,
        profileImageUrl: true,
      },
    });

    return NextResponse.json({ ok: true, users });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}

/**
 * DELETE — remove a connection
 * Query: /api/users/profile/connection?userId=<otherUserId>
 * - delete both directions in user_connections
 * - decrement both counters (floor at 0)
 * - mark any Connection row between the two users as DECLINED (so status isn't “connected”)
 */
export async function DELETE(req: NextRequest) {
  try {
    const me = getDataFromToken(req);
    if (!me) return bad("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const otherUserId = searchParams.get("userId") || undefined;
    if (!otherUserId) return bad("Missing userId");

    await db.$transaction(async (tx) => {
      // remove both directions (ignore if missing)
      await tx.userConnection.deleteMany({
        where: {
          OR: [
            { userId: me, connectedUserId: otherUserId },
            { userId: otherUserId, connectedUserId: me },
          ],
        },
      });

      // decrement counters safely
      const [meUser, otherUser] = await Promise.all([
        tx.user.findUnique({ where: { id: me }, select: { connections: true } }),
        tx.user.findUnique({ where: { id: otherUserId }, select: { connections: true } }),
      ]);
      const meNext = Math.max(0, (meUser?.connections ?? 0) - 1);
      const otherNext = Math.max(0, (otherUser?.connections ?? 0) - 1);

      await Promise.all([
        tx.user.update({ where: { id: me }, data: { connections: meNext } }),
        tx.user.update({ where: { id: otherUserId }, data: { connections: otherNext } }),
      ]);

      // if there is an ACCEPTED “Connection”, flip it to DECLINED so GET status isn't “connected”
      const conn = await tx.connection.findFirst({
        where: {
          OR: [
            { requesterId: me, recipientId: otherUserId },
            { requesterId: otherUserId, recipientId: me },
          ],
        },
      });
      if (conn && conn.status === "ACCEPTED") {
        await tx.connection.update({ where: { id: conn.id }, data: { status: "DECLINED" } });
      }
    });

    return NextResponse.json({ ok: true, removed: otherUserId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}
