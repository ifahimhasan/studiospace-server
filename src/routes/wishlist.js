import { Router } from "express";
import { collections } from "../db.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { toObjectId } from "../utils/validate.js";

const router = Router();
router.use(verifyToken);

/** GET /api/wishlist — the logged-in user's saved studios (full studio documents). */
router.get("/", async (req, res, next) => {
  try {
    const { wishlist } = await collections();
    const items = await wishlist
      .aggregate([
        { $match: { userEmail: req.user.email } },
        { $sort: { createdAt: -1 } },
        { $lookup: { from: "studios", localField: "studioId", foreignField: "_id", as: "studio" } },
        { $unwind: "$studio" },
        { $replaceRoot: { newRoot: "$studio" } },
      ])
      .toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** GET /api/wishlist/ids — just the saved studio ids, for heart icons. */
router.get("/ids", async (req, res, next) => {
  try {
    const { wishlist } = await collections();
    const rows = await wishlist
      .find({ userEmail: req.user.email }, { projection: { _id: 0, studioId: 1 } })
      .toArray();
    res.json(rows.map((r) => String(r.studioId)));
  } catch (err) {
    next(err);
  }
});

/** POST /api/wishlist/:studioId — toggles a studio in or out of the wishlist. */
router.post("/:studioId", async (req, res, next) => {
  try {
    const studioId = toObjectId(req.params.studioId);
    if (!studioId) return res.status(404).json({ message: "Studio not found." });
    const { wishlist, studios } = await collections();
    if (!(await studios.countDocuments({ _id: studioId }, { limit: 1 })))
      return res.status(404).json({ message: "Studio not found." });

    const removed = await wishlist.deleteOne({ userEmail: req.user.email, studioId });
    if (removed.deletedCount) return res.json({ saved: false });
    await wishlist.insertOne({ userEmail: req.user.email, studioId, createdAt: new Date() });
    res.status(201).json({ saved: true });
  } catch (err) {
    next(err);
  }
});

export default router;
