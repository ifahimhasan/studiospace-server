import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getDb } from "./db.js";
import studiosRouter from "./routes/studios.js";
import authRouter from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import wishlistRouter from "./routes/wishlist.js";

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.set("trust proxy", 1);
app.use(
  cors({
    origin: CLIENT_URL.split(",").map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", async (_req, res) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({ name: "StudioSpace API", status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ name: "StudioSpace API", status: "degraded", database: "unreachable" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/studios", studiosRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/wishlist", wishlistRouter);

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.expose ? err.message : "Something went wrong on our side." });
});

app.listen(PORT, () => console.log(`StudioSpace API listening on :${PORT}`));

export default app;
