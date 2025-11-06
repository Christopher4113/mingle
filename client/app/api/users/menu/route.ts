import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db" // or "@/lib/prisma" if you used that singleton
import { getDataFromToken } from "@/helpers/getDataFromToken"

export async function GET(req: NextRequest) {
  try {
    const userId = getDataFromToken(req)
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // Current time for filtering (UTC)
    const now = new Date()

    // Get upcoming events NOT created by the user
    const events = await db.event.findMany({
      where: {
        AND: [
          { NOT: { userId } },          // exclude user’s own events
          { startsAt: { gte: now } },   // exclude events that already started
        ],
      },
      include: {
        creator: {
          select: { name: true, username: true },
        },
      },
      orderBy: { startsAt: "asc" },
    })

    const payload = events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      location: e.location,
      category: e.category,
      attendees: e.attendees,
      maxAttendees: e.maxAttendees,
      inviteOnly: e.inviteOnly,
      hostName: e.creator?.username || e.creator?.name || "Host",
      isFull: e.attendees >= e.maxAttendees,
    }))

    return NextResponse.json({ ok: true, events: payload })
  } catch (err) {
    console.error("[GET /api/users/menu/events] failed:", err)
    return NextResponse.json(
      { ok: false, error: "Failed to load events" },
      { status: 500 }
    )
  }
}
