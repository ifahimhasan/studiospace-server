import { ObjectId } from "mongodb";

export const CATEGORIES = ["Photo Studio", "Film Stage", "Podcast Lounge", "Music Suite", "Workshop"];

export function toObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const isUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Validates a studio payload. Returns { value } with clean fields or { error }.
 * Owner fields are never read from the body: they come from the verified JWT.
 */
export function validateStudio(body = {}) {
  const title = String(body.title || "").trim();
  const category = String(body.category || "").trim();
  const location = String(body.location || "").trim();
  const overview = String(body.overview || "").trim();
  const image = String(body.image || "").trim();
  const hourlyRate = Number(body.hourlyRate);
  const securityDeposit = Number(body.securityDeposit ?? 0);
  const maxCapacity = Number(body.maxCapacity);
  const amenities = Array.isArray(body.amenities)
    ? [...new Set(body.amenities.map((a) => String(a).trim()).filter(Boolean))].slice(0, 30)
    : [];
  const gallery = Array.isArray(body.gallery)
    ? body.gallery.map((g) => String(g).trim()).filter(isUrl).slice(0, 8)
    : [];

  if (title.length < 3 || title.length > 80) return { error: "Title must be 3 to 80 characters." };
  if (!CATEGORIES.includes(category)) return { error: "Choose a valid category." };
  if (!Number.isFinite(hourlyRate) || hourlyRate < 1 || hourlyRate > 10000)
    return { error: "Hourly rate must be between $1 and $10,000." };
  if (!Number.isFinite(securityDeposit) || securityDeposit < 0 || securityDeposit > 100000)
    return { error: "Security deposit must be $0 or more." };
  if (!Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 1000)
    return { error: "Max capacity must be a whole number between 1 and 1000." };
  if (location.length < 3) return { error: "Location is required." };
  if (!isUrl(image)) return { error: "A valid image URL is required." };
  if (overview.length < 20) return { error: "Overview must be at least 20 characters." };

  return {
    value: {
      title,
      category,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      securityDeposit: Math.round(securityDeposit * 100) / 100,
      maxCapacity,
      location,
      image,
      gallery,
      amenities,
      overview,
    },
  };
}
