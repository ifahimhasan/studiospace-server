import { createRemoteJWKSet, jwtVerify } from "jose";

export const COOKIE_NAME = "ss_token";

const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim();

// BetterAuth's JWT plugin publishes its public keys here. jose caches them.
const JWKS = createRemoteJWKSet(new URL("/api/auth/jwks", CLIENT_URL));

/** Verifies a BetterAuth-issued JWT and returns the user it describes. */
export async function verifyJwt(token) {
  const { payload } = await jwtVerify(token, JWKS);
  if (!payload.email) throw new Error("Token has no email claim");
  return {
    id: payload.id || payload.sub,
    email: String(payload.email).toLowerCase(),
    name: payload.name || "",
    image: payload.image || "",
  };
}

/**
 * Express middleware: reads the JWT from the HTTPOnly cookie and rejects
 * the request with 401 Unauthorized when it is missing, expired or forged.
 */
export async function verifyToken(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ message: "Unauthorized: please log in." });
  try {
    req.user = await verifyJwt(token);
    next();
  } catch {
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return res.status(401).json({ message: "Unauthorized: your session has expired." });
  }
}

export function cookieOptions() {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: prod,
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    path: "/",
  };
}
