import { Router } from "express";
import { COOKIE_NAME, cookieOptions, verifyJwt, verifyToken } from "../middleware/verifyToken.js";

const router = Router();
const days = Number(process.env.COOKIE_DAYS) || 7;

/**
 * POST /api/auth/jwt — the client sends the JWT it got from BetterAuth once,
 * we verify its signature and store it in an HTTPOnly cookie. From then on the
 * browser sends it automatically and JavaScript can never read it.
 */
router.post("/jwt", async (req, res) => {
  const token = String(req.body?.token || "");
  if (!token) return res.status(400).json({ message: "Token is required." });
  try {
    const user = await verifyJwt(token);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: days * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user });
  } catch {
    res.status(401).json({ message: "Unauthorized: invalid token." });
  }
});

/** POST /api/auth/logout — removes the HTTPOnly cookie. */
router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ success: true });
});

/** GET /api/auth/me — who the cookie belongs to. */
router.get("/me", verifyToken, (req, res) => res.json(req.user));

export default router;
