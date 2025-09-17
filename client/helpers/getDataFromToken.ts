import { NextRequest } from "next/server";
import jwt, { JwtPayload } from "jsonwebtoken";

interface Decoded extends JwtPayload { id: string }

export const getDataFromToken = (req: NextRequest) => {
  const secret = process.env.TOKEN_SECRET!;
  // Cookie first
  const cookieToken = req.cookies.get("token")?.value;
  // Authorization: Bearer <token>
  const auth = req.headers.get("authorization") || "";
  const headerToken = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : undefined;

  const token = cookieToken || headerToken;
  if (!token) throw new Error("JWT token missing");

  const decoded = jwt.verify(token, secret) as Decoded;
  if (!decoded?.id) throw new Error("JWT missing user id");

  return decoded.id;
};