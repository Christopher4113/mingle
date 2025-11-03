// app/api/users/meetup/[id]/interest/route.ts
"use server";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDataFromToken } from "@/helpers/getDataFromToken";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

type Ctx = { params: Promise<{ id: string }> };

type InterestResp = {
  ok: true;
  eventId: string;
  category: string; // the event's category (saved for “interest”-based logic)
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const viewerId = getDataFromToken(req);
  if (!viewerId) return bad("Unauthorized", 401);

  const { id } = await ctx.params;
  if (!id) return bad("Missing event id");

  const ev = await db.event.findUnique({
    where: { id },
    select: { id: true, category: true },
  });

  if (!ev) return bad("Event not found", 404);

  const payload: InterestResp = {
    ok: true,
    eventId: ev.id,
    category: ev.category,
  };
  return NextResponse.json(payload);
}
