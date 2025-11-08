// app/api/users/menu/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000/eventRecommendations";
const EVENT_RECS_URL = new URL("/eventRecommendations", FASTAPI_URL).toString();

export async function POST(req: NextRequest) {
  try {
    const token = (await cookies()).get("token")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
    }

    const body = await req.json();

    const res = await fetch(EVENT_RECS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
