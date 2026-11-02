import { Router } from "express";
import { collections } from "../db.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { toObjectId } from "../utils/validate.js";
import { earliestBookableDate, formatMinutes, isIsoDate, toDate, toMinutes } from "../utils/time.js";

const router = Router();
router.use(verifyToken);

/**
 * Finds a Confirmed booking for the same studio and date whose time range
 * overlaps [startMin, endMin). Two ranges overlap when each starts before the
 * other ends: existing.start < new.end AND existing.end > new.start.
 */
async function findConflict(bookings, { studioId, date, startMin, endMin, excludeId }) {
  const query = {
    studioId,
    date,
    status: "Confirmed",
    startMin: { $lt: endMin },
    endMin: { $gt: startMin },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return bookings.findOne(query, { projection: { startMin: 1, endMin: 1 } });
}

const conflictMessage = (c) =>
  `This slot overlaps a confirmed booking from ${formatMinutes(c.startMin)} to ${formatMinutes(
    c.endMin
  )}. Please choose another time.`;

/** Confirmed bookings whose end time has passed become Completed. */
async function completePastBookings(bookings, filter) {
  await bookings.updateMany(
    { ...filter, status: "Confirmed", endAt: { $lt: new Date() } },
    { $set: { status: "Completed", updatedAt: new Date() } }
  );
}

/** POST /api/bookings — request a slot. Saved with status "Pending". */
router.post("/", async (req, res, next) => {
  try {
    const { studios, bookings } = await collections();
    const studioId = toObjectId(String(req.body?.studioId || ""));
    const date = String(req.body?.date || "");
    const startMin = toMinutes(req.body?.startTime);
    const endMin = toMinutes(req.body?.endTime);
    const note = String(req.body?.note || "").trim().slice(0, 500);

    if (!studioId) return res.status(400).json({ message: "Choose a studio to book." });
    if (!isIsoDate(date)) return res.status(400).json({ message: "Choose a valid date." });
    if (date < earliestBookableDate()) return res.status(400).json({ message: "That date is in the past." });
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin))
      return res.status(400).json({ message: "Choose a start and end time." });
    if (endMin - startMin < 60) return res.status(400).json({ message: "Bookings must be at least 1 hour long." });
    if (startMin % 30 || endMin % 30)
      return res.status(400).json({ message: "Times must be on the hour or half hour." });

    const studio = await studios.findOne({ _id: studioId });
    if (!studio) return res.status(404).json({ message: "Studio not found." });
    if (studio.ownerEmail === req.user.email)
      return res.status(400).json({ message: "You cannot book your own studio." });

    // Challenge 2: refuse slots that collide with an already Confirmed booking.
    const conflict = await findConflict(bookings, { studioId, date, startMin, endMin });
    if (conflict) return res.status(409).json({ message: conflictMessage(conflict) });

    const hours = (endMin - startMin) / 60;
    const subtotal = Math.round(hours * studio.hourlyRate * 100) / 100;
    const now = new Date();
    const doc = {
      studioId,
      studioTitle: studio.title,
      studioImage: studio.image,
      studioLocation: studio.location,
      studioCategory: studio.category,
      hostEmail: studio.ownerEmail,
      hostName: studio.ownerName,
      userEmail: req.user.email,
      userName: req.user.name,
      date,
      startMin,
      endMin,
      startAt: toDate(date, startMin),
      endAt: toDate(date, endMin),
      hours,
      hourlyRate: studio.hourlyRate,
      subtotal,
      securityDeposit: studio.securityDeposit || 0,
      total: Math.round((subtotal + (studio.securityDeposit || 0)) * 100) / 100,
      note,
      status: "Pending",
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await bookings.insertOne(doc);
    res.status(201).json({ ...doc, _id: insertedId });
  } catch (err) {
    next(err);
  }
});

/** GET /api/bookings/mine — bookings the logged-in creator has made. */
router.get("/mine", async (req, res, next) => {
  try {
    const { bookings } = await collections();
    await completePastBookings(bookings, { userEmail: req.user.email });
    const items = await bookings.find({ userEmail: req.user.email }).sort({ startAt: -1 }).toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** GET /api/bookings/host — requests made on studios the logged-in user hosts. */
router.get("/host", async (req, res, next) => {
  try {
    const { bookings } = await collections();
    await completePastBookings(bookings, { hostEmail: req.user.email });
    const items = await bookings.find({ hostEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/bookings/:id/cancel — the creator cancels one of their own Pending bookings. */
router.patch("/:id/cancel", async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ message: "Booking not found." });
    const { bookings } = await collections();
    const booking = await bookings.findOne({ _id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.userEmail !== req.user.email)
      return res.status(403).json({ message: "Forbidden: this is not your booking." });
    if (booking.status !== "Pending")
      return res.status(400).json({ message: "Only pending bookings can be cancelled." });
    const updated = await bookings.findOneAndUpdate(
      { _id, status: "Pending" },
      { $set: { status: "Cancelled", cancelReason: "Cancelled by creator", updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/bookings/:id/status — the host confirms or declines a Pending request.
 * Confirming re-runs the overlap check so two confirmed bookings can never collide.
 */
router.patch("/:id/status", async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    const status = String(req.body?.status || "");
    if (!_id) return res.status(404).json({ message: "Booking not found." });
    if (!["Confirmed", "Cancelled"].includes(status))
      return res.status(400).json({ message: "Status must be Confirmed or Cancelled." });
    const { bookings } = await collections();
    const booking = await bookings.findOne({ _id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.hostEmail !== req.user.email)
      return res.status(403).json({ message: "Forbidden: only the host can change this booking." });
    if (booking.status !== "Pending")
      return res.status(400).json({ message: `This booking is already ${booking.status.toLowerCase()}.` });

    if (status === "Confirmed") {
      const conflict = await findConflict(bookings, { ...booking, excludeId: _id });
      if (conflict) return res.status(409).json({ message: conflictMessage(conflict) });
    }
    const updated = await bookings.findOneAndUpdate(
      { _id, status: "Pending" },
      {
        $set: {
          status,
          ...(status === "Cancelled" ? { cancelReason: "Declined by host" } : {}),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
