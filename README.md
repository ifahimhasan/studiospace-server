# StudioSpace API

Express + MongoDB REST API for **StudioSpace**, a peer-to-peer marketplace where creators book photo studios, sound stages, podcast lounges, music suites and art workshops by the hour.

- Client repo: `studiospace-client` (Next.js App Router)
- Live API: `https://<your-api-domain>` ← replace after deploying

## Features

- Public studio catalogue with category filter, search, max-rate filter, sorting and pagination
- Featured studios endpoint using `.limit(6)` for the home page
- JWT stored in an **HTTPOnly cookie**; protected routes answer `401 Unauthorized` without it
- Owner-only update and delete for studio listings (`403` for anyone else)
- Booking requests saved as `Pending`, with **double-booking prevention** against `Confirmed` bookings
- Host confirm / decline flow; past confirmed bookings become `Completed` automatically
- Wishlist (saved studios) and reviews with an aggregated average rating

## Tech stack

Node.js 20+, Express 4, MongoDB Node driver, jose (JWT verification via JWKS), cookie-parser, cors, dotenv.

## How authentication works

1. The Next.js client signs users in with **BetterAuth** (email/password or Google) and its JWT plugin.
2. The client asks BetterAuth for a JWT and sends it once to `POST /api/auth/jwt`.
3. This API verifies the signature against the client's public keys (`CLIENT_URL/api/auth/jwks`) and stores the token in an HTTPOnly cookie (`ss_token`). JavaScript can never read it.
4. `verifyToken` middleware reads the cookie on protected routes and rejects missing, expired or forged tokens with `401`.

The client proxies `/backend/*` to this API through Next.js rewrites, so the cookie is first-party on the client's domain.

## Double-booking prevention

Before a booking is saved (and again when a host confirms one), the API looks for a `Confirmed` booking for the same studio and date whose time range overlaps the new one:

```js
{ studioId, date, status: "Confirmed", startMin: { $lt: newEndMin }, endMin: { $gt: newStartMin } }
```

A match returns `409 Conflict` with a message naming the taken time range.

## API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/studios` | – | List (`category`, `search`, `maxRate`, `sort`, `page`, `limit`) |
| GET | `/api/studios/featured` | – | Six top-rated / newest studios |
| GET | `/api/studios/:id` | – | Studio details |
| GET | `/api/studios/:id/booked?date=YYYY-MM-DD` | – | Confirmed time ranges that day |
| GET | `/api/studios/:id/reviews` | – | Reviews |
| POST | `/api/studios/:id/reviews` | ✔ | Add / update your review |
| GET | `/api/studios/mine` | ✔ | Studios you host |
| POST | `/api/studios` | ✔ | Create a studio |
| PATCH | `/api/studios/:id` | ✔ owner | Update a studio |
| DELETE | `/api/studios/:id` | ✔ owner | Delete a studio |
| POST | `/api/bookings` | ✔ | Request a booking (status `Pending`) |
| GET | `/api/bookings/mine` | ✔ | Your bookings |
| PATCH | `/api/bookings/:id/cancel` | ✔ | Cancel your pending booking |
| GET | `/api/bookings/host` | ✔ | Requests on your studios |
| PATCH | `/api/bookings/:id/status` | ✔ host | Confirm or decline a request |
| GET | `/api/wishlist` · `/api/wishlist/ids` | ✔ | Saved studios |
| POST | `/api/wishlist/:studioId` | ✔ | Toggle saved |
| POST | `/api/auth/jwt` · `/api/auth/logout` · GET `/api/auth/me` | | Cookie handling |

## Local setup

```bash
git clone <this-repo-url> studiospace-server
cd studiospace-server
npm install
cp .env.example .env      # fill in MONGODB_URI and CLIENT_URL
npm run seed              # optional: demo studios
npm run dev               # http://localhost:5000
```

Run the client at the same time (it serves the JWKS that this API verifies against).

## Deploy

- **Render**: New Web Service → build `npm install`, start `npm start`, add the env vars from `.env.example` with `NODE_ENV=production`.
- **Vercel**: `vercel.json` is included; add the same env vars in the project settings.

Set `CLIENT_URL` to the live client URL in production.
