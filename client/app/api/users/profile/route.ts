"use server";
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getDataFromToken } from "@/helpers/getDataFromToken"
import type { Prisma } from "@prisma/client"

type Body = {
  bio?: string
  location?: string
  interests?: string[]
  profileImageUrl?: string
}

export async function PUT(req: NextRequest) {
  try {
    const userId = getDataFromToken(req)
    const body = (await req.json()) as Body

    const data: Prisma.UserUpdateInput = {}
    if (typeof body.bio === "string") data.bio = body.bio
    if (typeof body.location === "string") data.location = body.location
    if (Array.isArray(body.interests)) {
      // Postgres scalar list update
      data.interests = { set: body.interests }
    }
    if (typeof body.profileImageUrl === "string") data.profileImageUrl = body.profileImageUrl

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        bio: true,
        location: true,
        interests: true,
        profileImageUrl: true,
        connections: true,
        events: true,
      },
    })

    return NextResponse.json({ ok: true, user: updated }, { status: 200 })
  } catch (err) {
    console.error("PUT /api/users/profile error:", err) // 👈 add this line
    const message = err instanceof Error ? err.message : "Failed to update profile"
    const status = /token|jwt/i.test(message) ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}


export async function GET(req: NextRequest) {
  try {
    const userId = getDataFromToken(req);

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        createdAt: true,
        bio: true,
        location: true,
        interests: true,
        profileImageUrl: true,
        connections: true,
        events: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user }, { status: 200 });
  } catch (err) {
    console.error("GET /api/users/profile error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch profile";
    const status = /token|jwt/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}