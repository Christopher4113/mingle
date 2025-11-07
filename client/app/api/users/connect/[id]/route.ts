// app/api/users/connect/[id]/route.ts
"use server";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";
import { sendNotificationEmail } from "@/lib/mailer";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

// IMPORTANT for Next.js dynamic API routes:
type Ctx = { params: Promise<{ id: string }> };

// find a connection in either direction
async function findAnyConnection(a: string, b: string) {
  return db.connection.findFirst({
    where: { OR: [{ requesterId: a, recipientId: b }, { requesterId: b, recipientId: a }] },
  });
}

function statusPayload(
  s: "none" | "pending_outgoing" | "pending_incoming" | "connected" | "declined"
) {
  return NextResponse.json({ ok: true, status: s });
}

/** GET — relationship status between caller and target [id] */
export async function GET(req: NextRequest, ctx: Ctx) {
  const callerId = getDataFromToken(req);
  if (!callerId) return bad("Unauthorized", 401);

  const { id: targetId } = await ctx.params;
  if (!targetId) return bad("Missing user id");
  if (targetId === callerId) return statusPayload("connected");

  const conn = await findAnyConnection(callerId, targetId);
  if (!conn) return statusPayload("none");

  if (conn.status === "ACCEPTED") return statusPayload("connected");
  if (conn.status === "DECLINED") return statusPayload("declined");

  // PENDING — determine direction
  if (conn.requesterId === callerId) return statusPayload("pending_outgoing");
  return statusPayload("pending_incoming");
}

/** POST — send a connect request to [id] */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const callerId = getDataFromToken(req);
    if (!callerId) return bad("Unauthorized", 401);

    const { id: targetId } = await ctx.params;
    if (!targetId) return bad("Missing user id");
    if (targetId === callerId) return bad("You cannot connect with yourself", 400);

    const existing = await findAnyConnection(callerId, targetId);
    if (existing) {
      if (existing.status === "ACCEPTED") return bad("You are already connected", 409);
      if (existing.status === "PENDING") {
        if (existing.requesterId === callerId) return bad("Request already sent", 409);
        return bad("User already requested to connect with you. Check your pending requests.", 409);
      }
      if (existing.status === "DECLINED") {
        if (existing.requesterId === callerId) {
          await db.connection.update({ where: { id: existing.id }, data: { status: "PENDING" } });
        } else {
          await db.connection.create({
            data: { requesterId: callerId, recipientId: targetId, status: "PENDING" },
          });
        }
      }
    } else {
      await db.connection.create({
        data: { requesterId: callerId, recipientId: targetId, status: "PENDING" },
      });
    }

    const caller = await db.user.findUnique({
      where: { id: callerId },
      select: { username: true, name: true, email: true },
    });
    const recipient = await db.user.findUnique({ where: { id: targetId }, select: { email: true } });
    const actorUsername = caller?.username ?? caller?.name ?? "Someone";

    const notif = await db.notification.create({
      data: {
        userId: targetId,
        type: "EVENT_UPDATE",
        title: "Connection Request",
        message: `${actorUsername} wants to connect with you.`,
        data: { actorId: callerId, actorUsername, kind: "CONNECT_REQUEST" },
      },
    });

    if (recipient?.email) {
      sendNotificationEmail({
        to: recipient.email,
        notificationId: notif.id,
        title: "Connection Request",
        message: `${actorUsername} wants to connect with you.`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}

/**
 * PATCH — respond to a request (only the RECIPIENT can accept/decline)
 * body: { action: "accept" | "decline" }
 * On "accept": also populate user_connections (bidirectional) and increment counters.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const recipientId = getDataFromToken(req);
    if (!recipientId) return bad("Unauthorized", 401);

    const { id: requesterId } = await ctx.params;
    if (!requesterId) return bad("Missing user id");

    const { action } = (await req.json()) as { action?: "accept" | "decline" };
    if (action !== "accept" && action !== "decline") return bad("Invalid action");

    const conn = await db.connection.findUnique({
      where: { requesterId_recipientId: { requesterId, recipientId } },
    });
    if (!conn || conn.status !== "PENDING") return bad("No pending request found", 404);

    if (action === "decline") {
      await db.connection.update({ where: { id: conn.id }, data: { status: "DECLINED" } });

      const recip = await db.user.findUnique({
        where: { id: recipientId },
        select: { username: true, name: true },
      });
      const recipientName = recip?.username ?? recip?.name ?? "User";

      const notif = await db.notification.create({
        data: {
          userId: requesterId,
          type: "EVENT_UPDATE",
          title: "Connection Declined",
          message: `${recipientName} declined your connection request.`,
          data: { actorId: recipientId, actorUsername: recipientName, kind: "CONNECT_DECLINED" },
        },
      });

      const requester = await db.user.findUnique({ where: { id: requesterId }, select: { email: true } });
      if (requester?.email) {
        sendNotificationEmail({
          to: requester.email,
          notificationId: notif.id,
          title: "Connection Declined",
          message: `${recipientName} declined your connection request.`,
        }).catch(console.error);
      }

      return NextResponse.json({ ok: true, changed: "declined" });
    }

    // ACCEPT
    const result = await db.$transaction(async (tx) => {
      // 1) Mark accepted
      await tx.connection.update({ where: { id: conn.id }, data: { status: "ACCEPTED" } });

      // 2) Upsert both directions into user_connections
      await tx.userConnection.upsert({
        where: { userId_connectedUserId: { userId: requesterId, connectedUserId: recipientId } },
        create: { userId: requesterId, connectedUserId: recipientId },
        update: {},
      });
      await tx.userConnection.upsert({
        where: { userId_connectedUserId: { userId: recipientId, connectedUserId: requesterId } },
        create: { userId: recipientId, connectedUserId: requesterId },
        update: {},
      });

      // 3) Increment counters
      await tx.user.update({ where: { id: requesterId }, data: { connections: { increment: 1 } } });
      await tx.user.update({ where: { id: recipientId }, data: { connections: { increment: 1 } } });

      // 4) Notifications + emails
      const recip = await tx.user.findUnique({
        where: { id: recipientId },
        select: { username: true, name: true, email: true },
      });
      const reqr = await tx.user.findUnique({
        where: { id: requesterId },
        select: { username: true, name: true, email: true },
      });
      const recipName = recip?.username ?? recip?.name ?? "User";
      const reqrName = reqr?.username ?? reqr?.name ?? "User";

      const notifToRequester = await tx.notification.create({
        data: {
          userId: requesterId,
          type: "EVENT_UPDATE",
          title: "Connection Accepted",
          message: `${recipName} accepted your connection request.`,
          data: { actorId: recipientId, actorUsername: recipName, kind: "CONNECT_ACCEPTED" },
        },
      });
      const notifToRecipient = await tx.notification.create({
        data: {
          userId: recipientId,
          type: "EVENT_UPDATE",
          title: "You're Connected",
          message: `You are now connected with ${reqrName}.`,
          data: { actorId: requesterId, actorUsername: reqrName, kind: "CONNECT_ACCEPTED_CONFIRM" },
        },
      });

      if (reqr?.email) {
        sendNotificationEmail({
          to: reqr.email,
          notificationId: notifToRequester.id,
          title: "Connection Accepted",
          message: `${recipName} accepted your connection request.`,
        }).catch(console.error);
      }
      if (recip?.email) {
        sendNotificationEmail({
          to: recip.email,
          notificationId: notifToRecipient.id,
          title: "You're Connected",
          message: `You are now connected with ${reqrName}.`,
        }).catch(console.error);
      }

      return { ok: true, changed: "accepted" as const };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return bad(msg);
  }
}
