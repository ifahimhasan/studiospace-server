import { Router } from "express";
import { collections } from "../db.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { toObjectId } from "../utils/validate.js";

// Mounted at /api/studios/:id/reviews
const router = Router({ mergeParams: true });

/** GET — reviews for a studio, newest first. */
router.get("/", async (req, res, next) => {
  try {
    const studioId = toObjectId(req.params.id);
    if (!studioId) return res.json([]);
    const { reviews } = await collections();
    const items = await reviews.find({ studioId }).sort({ createdAt: -1 }).limit(50).toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** POST — add or update your review, then recompute the studio's average rating. */
router.post("/", verifyToken, async (req, res, next) => {
  try {
    const studioId = toObjectId(req.params.id);
    const rating = Number(req.body?.rating);
    const text = String(req.body?.text || "").trim();
    if (!studioId) return res.status(404).json({ message: "Studio not found." });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ message: "Rating must be 1 to 5 stars." });
    if (text.length < 10 || text.length > 600)
      return res.status(400).json({ message: "Review must be 10 to 600 characters." });

    const { reviews, studios } = await collections();
    const studio = await studios.findOne({ _id: studioId }, { projection: { ownerEmail: 1 } });
    if (!studio) return res.status(404).json({ message: "Studio not found." });
    if (studio.ownerEmail === req.user.email)
      return res.status(400).json({ message: "You cannot review your own studio." });

    const now = new Date();
    await reviews.updateOne(
      { studioId, userEmail: req.user.email },
      {
        $set: { rating, text, userName: req.user.name, userImage: req.user.image, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    const [stats] = await reviews
      .aggregate([
        { $match: { studioId } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
      ])
      .toArray();
    const avg = stats ? Math.round(stats.avg * 10) / 10 : 0;
    await studios.updateOne({ _id: studioId }, { $set: { rating: avg, reviewCount: stats?.count || 0 } });

    res.status(201).json({ rating: avg, reviewCount: stats?.count || 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
