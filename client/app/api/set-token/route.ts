import { NextResponse, NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import jwt from "jsonwebtoken"

export async function GET(req: NextRequest) {
  // Read the NextAuth JWT (the one NextAuth sets), not your custom cookie
  const nextAuthToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET, // must match your authOptions.secret
  })

  // In your callbacks, you ensured token.sub is always the userId
  const userId = nextAuthToken?.sub
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 })
  }

  // Create your own JWT cookie signed with TOKEN_SECRET, containing { id }
  const custom = jwt.sign({ id: userId }, process.env.TOKEN_SECRET!, { expiresIn: "30d" })

  const res = NextResponse.json({ ok: true })
  res.cookies.set("token", custom, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
