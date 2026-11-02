import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is missing. Copy .env.example to .env and fill it in.");
}

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
});

let db;
let connecting;

/** Connects once and reuses the same client (also safe for serverless cold starts). */
export async function getDb() {
  if (db) return db;
  if (!connecting) {
    connecting = client.connect().then(async () => {
      db = client.db(process.env.DB_NAME || "studiospace");
      await ensureIndexes(db);
      return db;
    });
  }
  return connecting;
}

export async function collections() {
  const d = await getDb();
  return {
    studios: d.collection("studios"),
    bookings: d.collection("bookings"),
    wishlist: d.collection("wishlist"),
    reviews: d.collection("reviews"),
  };
}

async function ensureIndexes(d) {
  await Promise.all([
    d.collection("studios").createIndex({ ownerEmail: 1 }),
    d.collection("studios").createIndex({ category: 1, rating: -1 }),
    d.collection("studios").createIndex({ title: "text", location: "text", overview: "text" }),
    d.collection("bookings").createIndex({ studioId: 1, date: 1, status: 1 }),
    d.collection("bookings").createIndex({ userEmail: 1, createdAt: -1 }),
    d.collection("bookings").createIndex({ hostEmail: 1, createdAt: -1 }),
    d.collection("wishlist").createIndex({ userEmail: 1, studioId: 1 }, { unique: true }),
    d.collection("reviews").createIndex({ studioId: 1, createdAt: -1 }),
  ]);
}
