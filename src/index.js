import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

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

app.get("/", (_req, res) => {
  res.json({ name: "StudioSpace API", status: "ok" });
});

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

app.listen(PORT, () => console.log(`StudioSpace API listening on :${PORT}`));

export default app;
