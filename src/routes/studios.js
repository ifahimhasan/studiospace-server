import { Router } from "express";
import { collections } from "../db.js";
import { CATEGORIES, escapeRegex, toObjectId, validateStudio } from "../utils/validate.js";
import { verifyToken } from "../middleware/verifyToken.js";

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

/** GET /api/studios/mine — studios owned by the logged-in host (ownerEmail match). */
router.get("/mine", verifyToken, async (req, res, next) => {
  try {
    const { studios } = await collections();
    const items = await studios.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** POST /api/studios — create a listing. Protected: 401 without a valid JWT cookie. */
router.post("/", verifyToken, async (req, res, next) => {
  try {
    const { value, error } = validateStudio(req.body);
    if (error) return res.status(400).json({ message: error });
    const { studios } = await collections();
    const now = new Date();
    const doc = {
      ...value,
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      ownerImage: req.user.image,
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await studios.insertOne(doc);
    res.status(201).json({ ...doc, _id: insertedId });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/studios/:id — update a listing; only its owner may do this. */
router.patch("/:id", verifyToken, async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ message: "Studio not found." });
    const { value, error } = validateStudio(req.body);
    if (error) return res.status(400).json({ message: error });
    const { studios } = await collections();
    const existing = await studios.findOne({ _id }, { projection: { ownerEmail: 1 } });
    if (!existing) return res.status(404).json({ message: "Studio not found." });
    if (existing.ownerEmail !== req.user.email)
      return res.status(403).json({ message: "Forbidden: you can only edit your own studios." });
    const updated = await studios.findOneAndUpdate(
      { _id },
      { $set: { ...value, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/studios/:id — remove a listing (owner only) and tidy related data. */
router.delete("/:id", verifyToken, async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ message: "Studio not found." });
    const { studios, bookings, wishlist, reviews } = await collections();
    const existing = await studios.findOne({ _id }, { projection: { ownerEmail: 1 } });
    if (!existing) return res.status(404).json({ message: "Studio not found." });
    if (existing.ownerEmail !== req.user.email)
      return res.status(403).json({ message: "Forbidden: you can only delete your own studios." });

    await studios.deleteOne({ _id });
    await Promise.all([
      wishlist.deleteMany({ studioId: _id }),
      reviews.deleteMany({ studioId: _id }),
      bookings.updateMany(
        { studioId: _id, status: { $in: ["Pending", "Confirmed"] } },
        { $set: { status: "Cancelled", cancelReason: "Listing removed by host", updatedAt: new Date() } }
      ),
    ]);
    res.json({ success: true, deletedId: _id });
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
