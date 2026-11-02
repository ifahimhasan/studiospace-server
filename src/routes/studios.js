import { Router } from "express";
import { collections } from "../db.js";
import { CATEGORIES, escapeRegex, toObjectId } from "../utils/validate.js";

const router = Router();

const SORTS = {
  rating: { rating: -1, reviewCount: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  price_asc: { hourlyRate: 1 },
  price_desc: { hourlyRate: -1 },
};

/** GET /api/studios — public list with category, search, max price, sort and pagination. */
router.get("/", async (req, res, next) => {
  try {
    const { studios } = await collections();
    const { category, search, maxRate, sort = "rating" } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit, 10) || 9));

    const filter = {};
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim()), "i");
      filter.$or = [{ title: rx }, { location: rx }, { category: rx }];
    }
    const max = Number(maxRate);
    if (Number.isFinite(max) && max > 0) filter.hourlyRate = { $lte: max };

    const [items, total] = await Promise.all([
      studios
        .find(filter)
        .sort(SORTS[sort] || SORTS.rating)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      studios.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    next(err);
  }
});

/** GET /api/studios/featured — six top-rated / newest studios for the home page. */
router.get("/featured", async (_req, res, next) => {
  try {
    const { studios } = await collections();
    const items = await studios
      .find({})
      .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
      .limit(6)
      .toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** GET /api/studios/:id — full studio document. */
router.get("/:id", async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ message: "Studio not found." });
    const { studios } = await collections();
    const studio = await studios.findOne({ _id });
    if (!studio) return res.status(404).json({ message: "Studio not found." });
    res.json(studio);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/studios/:id/booked?date=YYYY-MM-DD — confirmed time ranges on that date,
 * so the booking modal can grey them out. Returns times only, no personal data.
 */
router.get("/:id/booked", async (req, res, next) => {
  try {
    const studioId = toObjectId(req.params.id);
    const date = String(req.query.date || "");
    if (!studioId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.json([]);
    const { bookings } = await collections();
    const taken = await bookings
      .find({ studioId, date, status: "Confirmed" }, { projection: { _id: 0, startMin: 1, endMin: 1 } })
      .sort({ startMin: 1 })
      .toArray();
    res.json(taken);
  } catch (err) {
    next(err);
  }
});

export default router;
