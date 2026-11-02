/**
 * Seeds demo studios and reviews so the home page and Explore page have content.
 *   npm run seed            -> inserts demo data only if the studios collection is empty
 *   npm run seed -- --fresh -> wipes studios/reviews first (bookings and users are kept)
 *
 * Demo studios belong to SEED_HOST_EMAIL. Register that email on the site to manage them.
 */
import "dotenv/config";
import { collections, getDb } from "./db.js";

const HOST_EMAIL = (process.env.SEED_HOST_EMAIL || "host@studiospace.dev").toLowerCase();
const HOST_NAME = process.env.SEED_HOST_NAME || "StudioSpace Host";
const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

const studios = [
  {
    title: "Northlight Cyc Studio",
    category: "Photo Studio",
    hourlyRate: 65,
    securityDeposit: 150,
    maxCapacity: 12,
    location: "214 Kent Ave, Brooklyn, NY",
    image: img("1726650680145-d441d5882bdb"),
    gallery: [img("1718871784114-7c21103d3212"), img("1586232702178-f044c5f4d4b7"), img("1607570838997-65f270035031")],
    amenities: ["Cyclorama wall", "Lighting kit", "Makeup room", "Wi-Fi", "Loading access"],
    overview:
      "A 1,400 sq ft daylight studio with a white cyclorama wall, blackout blinds on every window and a 3-phase power drop. A strobe kit, C-stands and a seamless paper rack come with the room, and a private hair and makeup space sits off the main floor.",
  },
  {
    title: "Soundstage 7",
    category: "Film Stage",
    hourlyRate: 180,
    securityDeposit: 500,
    maxCapacity: 60,
    location: "3100 W Olive Ave, Burbank, CA",
    image: img("1471341971476-ae15ff5dd4ea"),
    gallery: [img("1632187981988-40f3cbaeef5e"), img("1612544409025-e1f6a56c1152"), img("1485846234645-a62644f84728")],
    amenities: ["Soundproofing", "Lighting kit", "Green screen", "Parking", "Loading access", "Air conditioning"],
    overview:
      "A 6,000 sq ft soundproofed stage with a full lighting grid, drive-in elephant doors and two dressing rooms. Grip and electric packages can be added on request, and there is crew parking on site.",
  },
  {
    title: "The Booth Podcast Lounge",
    category: "Podcast Lounge",
    hourlyRate: 40,
    securityDeposit: 75,
    maxCapacity: 4,
    location: "1105 E 6th St, Austin, TX",
    image: img("1615458317538-72c46d9359d8"),
    gallery: [img("1559523161-0fc0d8b38a7a"), img("1478737270239-2f02b77fc618"), img("1590602847861-f357a9332bbc")],
    amenities: ["Soundproofing", "Wi-Fi", "Air conditioning", "Kitchenette"],
    overview:
      "An acoustically treated room for up to four voices, with dynamic mics, a multitrack recorder and two camera angles for video podcasts. Files are handed over on a drive or by link before you leave.",
  },
  {
    title: "Analog Room Recording Suite",
    category: "Music Suite",
    hourlyRate: 85,
    securityDeposit: 200,
    maxCapacity: 8,
    location: "1600 17th Ave S, Nashville, TN",
    image: img("1598488035139-bdbb2231ce04"),
    gallery: [img("1767474365536-ef81bfa24c8a"), img("1535406208535-1429839cfd13"), img("1511379938547-c1f69419868d")],
    amenities: ["Soundproofing", "Wi-Fi", "Air conditioning", "Parking", "Kitchenette"],
    overview:
      "A tracking room and control room built around an analog console, with a vocal booth, a piano and a wall of guitars and amps you are welcome to plug into. Engineer available on request.",
  },
  {
    title: "Kiln & Canvas Workshop",
    category: "Workshop",
    hourlyRate: 30,
    securityDeposit: 50,
    maxCapacity: 14,
    location: "2045 SE Division St, Portland, OR",
    image: img("1676125105332-608345abe20e"),
    gallery: [img("1723717275425-eb4a16b5d2da"), img("1673436765950-a563ed3c2a0d"), img("1610206349499-c932c3b3aacb")],
    amenities: ["Wi-Fi", "Kitchenette", "Air conditioning", "Loading access"],
    overview:
      "A bright shared studio with six pottery wheels, open work benches, a glazing station and kiln access by arrangement. Ideal for classes, product shoots of handmade work and small craft workshops.",
  },
  {
    title: "Blackbox Green Screen Stage",
    category: "Film Stage",
    hourlyRate: 120,
    securityDeposit: 300,
    maxCapacity: 25,
    location: "675 Metropolitan Pkwy, Atlanta, GA",
    image: img("1632187981988-40f3cbaeef5e"),
    gallery: [img("1515634928627-2a4e0dae3ddf"), img("1471341971476-ae15ff5dd4ea")],
    amenities: ["Green screen", "Soundproofing", "Lighting kit", "Makeup room", "Parking"],
    overview:
      "A black box stage with a three-wall green screen, pre-rigged LED lighting controlled from a tablet and a director's monitor station. Built for music videos, commercials and virtual production tests.",
  },
  {
    title: "Daylight Loft 22",
    category: "Photo Studio",
    hourlyRate: 55,
    securityDeposit: 100,
    maxCapacity: 10,
    location: "1550 N Damen Ave, Chicago, IL",
    image: img("1616498429378-896bcc57c78d"),
    gallery: [img("1607570838997-65f270035031"), img("1586232702178-f044c5f4d4b7")],
    amenities: ["Wi-Fi", "Air conditioning", "Kitchenette"],
    overview:
      "A sunlit loft with tall windows, white walls and stone floors that work for portraits, lookbooks and product flat-lays. Morning light is the best from 8 to 11 AM.",
  },
  {
    title: "Echo Chamber Vocal Booth",
    category: "Music Suite",
    hourlyRate: 45,
    securityDeposit: 80,
    maxCapacity: 3,
    location: "12 Hoxton Square, London, UK",
    image: img("1767474365536-ef81bfa24c8a"),
    gallery: [img("1598653222000-6b7b7a552625"), img("1535406208535-1429839cfd13")],
    amenities: ["Soundproofing", "Wi-Fi", "Air conditioning"],
    overview:
      "A dead-quiet vocal booth with a large-diaphragm condenser mic, headphone mix and a small control desk. Great for vocals, voice-over and audiobook narration.",
  },
  {
    title: "Two Mics Podcast Studio",
    category: "Podcast Lounge",
    hourlyRate: 35,
    securityDeposit: 50,
    maxCapacity: 3,
    location: "401 Richmond St W, Toronto, ON",
    image: img("1760780567530-389d8a3fba75"),
    gallery: [img("1559523161-0fc0d8b38a7a"), img("1590602847861-f357a9332bbc")],
    amenities: ["Soundproofing", "Wi-Fi", "Kitchenette"],
    overview:
      "A cosy two-person podcast set with treated walls, warm practical lighting and a camera on each seat. Walk in, sit down and press record.",
  },
];

const reviewPool = [
  ["Jordan Kim", 5, "Everything was set up when we arrived and load-in took minutes. We will be back for the next campaign."],
  ["Amara Lewis", 5, "The light was exactly as photographed and the host answered every question within minutes."],
  ["Tomás Silva", 4, "Great room and gear. Slightly tight on space for a big crew, but perfect for a small team."],
];

async function run() {
  await getDb();
  const { studios: col, reviews } = await collections();
  const fresh = process.argv.includes("--fresh");
  if (fresh) {
    await col.deleteMany({});
    await reviews.deleteMany({});
  } else if (await col.countDocuments()) {
    console.log("Studios already exist — skipping. Run with --fresh to replace demo data.");
    process.exit(0);
  }

  const now = Date.now();
  for (const [i, s] of studios.entries()) {
    const createdAt = new Date(now - i * 86400000);
    const picked = reviewPool.slice(0, 1 + (i % 3));
    const avg = Math.round((picked.reduce((a, r) => a + r[1], 0) / picked.length) * 10) / 10;
    const { insertedId } = await col.insertOne({
      ...s,
      ownerEmail: HOST_EMAIL,
      ownerName: HOST_NAME,
      ownerImage: "",
      rating: avg,
      reviewCount: picked.length,
      createdAt,
      updatedAt: createdAt,
    });
    await reviews.insertMany(
      picked.map(([userName, rating, text], k) => ({
        studioId: insertedId,
        userEmail: `seed-reviewer-${k}@studiospace.dev`,
        userName,
        userImage: "",
        rating,
        text,
        createdAt: new Date(now - (i + k) * 3600000),
        updatedAt: new Date(now - (i + k) * 3600000),
      }))
    );
  }
  console.log(`Seeded ${studios.length} studios owned by ${HOST_EMAIL}.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
