# Casanova

Map-driven property search for London, with viewing bookings. Built from
scratch — no UI framework, no component library, no CSS framework, no map
wrapper.

**Live:** TODO — add after deploying
**API:** TODO — add after deploying

---

## What it is

Search London homes on a map rather than by postcode district. Pan and the
results follow the viewport; draw a shape and the search happens inside it;
filter by price, bedrooms, type and features. Then book a viewing against an
agent's real availability, and they confirm or decline it from their own
dashboard.

Twenty-four properties with genuine coordinates, three agents with different
working patterns, and a booking system that cannot double-book.

---

## Stack

**Frontend** — Vite 5, React 18, React Router 6, Leaflet 1.9, GSAP 3,
hand-written CSS

**Backend** — Node, Express 4, Mongoose 8, JSON Web Tokens, bcryptjs

**Data** — MongoDB Atlas, using its native geospatial indexing

**Maps** — Leaflet with CARTO basemaps over OpenStreetMap data. No API key,
no billing account.

Eleven direct dependencies across both halves.

---

## Demo accounts

| Role | Email | Password | Lands on |
|---|---|---|---|
| Buyer | `demo@casanova.homes` | `demo1234` | `/account` |
| Agent | `amara@casanova.homes` | `agent1234` | `/agent` |
| Agent | `tom@casanova.homes` | `agent1234` | `/agent` |
| Agent | `priya@casanova.homes` | `agent1234` | `/agent` |
| Admin | `admin@casanova.homes` | `admin1234` | `/agent` |

Buttons on the sign-in page fill these in. The three agents have deliberately
different diaries — Amara works Monday to Friday on the half hour, Tom works
Tuesday to Saturday in hour-long slots — so availability genuinely differs
between properties.

---

## Running locally

Requires Node 18+ and a MongoDB connection string. The Atlas free tier is
enough; geospatial indexing is available on it.

### 1. The API

```bash
cd server
npm install
cp .env.example .env      # then fill it in — see below
npm run seed              # 24 listings, 6 users, 6 viewings, plus indexes
npm run dev               # http://localhost:5000
```

`server/.env`:

| Variable | Example | Notes |
|---|---|---|
| `PORT` | `5000` | |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/casanova` | Include `/casanova` before the `?` |
| `JWT_SECRET` | any long random string | Changing it invalidates every issued token |
| `JWT_EXPIRES_IN` | `7d` | |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated for more than one |

### 2. The frontend

From the repository root, in a second terminal:

```bash
npm install
npm run dev               # http://localhost:5173
```

Root `.env`:

```
VITE_API_URL=http://localhost:5000/api
```

Anything prefixed `VITE_` is substituted into the browser bundle at build
time, so it is public. Secrets belong in `server/.env`, which never reaches
the client.

### Both at once

`start.ps1` (Windows) opens each dev server in its own window, so a one-off
command in your main terminal cannot stop either of them:

```powershell
.\start.ps1
```

### Other scripts

```bash
npm run build             # production build into dist/
npm run preview           # serve that build locally

cd server
npm run seed              # wipe and reload, then verify
npm run seed:destroy      # empty every collection
```

`npm run seed` ends with a verification block that runs the same queries the
app runs — a 3 km radius search around Camden, a bounding-box query, a text
search — and prints which indexes actually exist in MongoDB. A count of rows
proves nothing; those queries prove the coordinates and indexes are right.

---

## API

Base path `/api`. All responses are JSON. Every model's `toJSON` renames
`_id` to `id` and strips `__v` and `password`.

### Listings

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/listings` | — | Filtered, sorted, paginated |
| GET | `/listings/pins` | — | Every match, five fields each, for map markers |
| GET | `/listings/meta` | — | Cities, types, features, price bounds for the filter panel |
| GET | `/listings/nearby/:slug` | — | Similar properties within a radius |
| GET | `/listings/:slug` | optional | Adds a `saved` flag when signed in |
| GET | `/listings/mine` | agent | Including sold and let |
| POST | `/listings` | agent | |
| PUT | `/listings/:id` | agent | Own listings only |
| DELETE | `/listings/:id` | agent | Own listings only |

`GET /listings` accepts `q`, `listingType`, `propertyType`, `minPrice`,
`maxPrice`, `minBeds`, `maxBeds`, `minBaths`, `city`, `features`, `status`,
`page`, `limit`, and `sort` — one of `featured`, `newest`, `price-asc`,
`price-desc`, `beds-desc`.

Plus three geospatial parameters, in precedence order:

| Parameter | Format | Meaning |
|---|---|---|
| `polygon` | `lng,lat;lng,lat;…` | Inside a hand-drawn shape |
| `bounds` | `swLng,swLat,neLng,neLat` | Inside a map viewport |
| `near` + `radiusKm` | `lng,lat` + a number | Within N km of a point |

Returns `{ items, total, page, pages }`.

### Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Returns a token |
| POST | `/auth/login` | — | Returns a token |
| GET | `/auth/me` | user | Restores a session |
| PUT | `/auth/me` | user | Profile, and an agent's working hours |
| GET | `/auth/saved` | user | Shortlist, populated |
| POST | `/auth/saved/:id` | user | Toggles |

### Viewings

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/viewings/availability` | — | Free slots for one day |
| GET | `/viewings/availability/range` | — | Slot counts per day, for a date picker |
| POST | `/viewings` | user | |
| GET | `/viewings/mine` | user | |
| GET | `/viewings/schedule` | agent | The agent's diary |
| GET | `/viewings/:reference` | user | Owner, agent or admin only |
| PATCH | `/viewings/:reference/cancel` | user | Either side may cancel |
| PATCH | `/viewings/:reference/status` | agent | Confirm, decline, complete |

### Health

`GET /api/health` returns `{ ok: true, uptime, service }`. Registered
*before* the database middleware, so it answers even when MongoDB is
unreachable — which distinguishes "server down" from "database down".

---

## Structure

```
src/                      frontend
  components/
    Icon.jsx              37 inline SVG icons, one file
    MapView.jsx           Leaflet, driven directly
    PropertyCard.jsx
    Filters.jsx           filter panel + active-filter chips
    Gallery.jsx           gallery with a keyboard-driven lightbox
    BookingPanel.jsx      dates, slots, submission
    Header.jsx  Footer.jsx  Layout.jsx  ProtectedRoute.jsx
  context/StoreContext.jsx  auth, shortlist, theme, filter metadata
  hooks/                  useLocalStorage, useDebounce
  lib/api.js              the single fetch boundary
  lib/format.js           prices, dates, areas
  motion/gsap.js          plugin setup, scoped contexts, reduced motion
  pages/                  Home, Search, Property, Login, Register, StyleGuide
  pages/account/          viewings, saved, profile
  pages/agent/            schedule, listings manager
  index.css               the whole design system

server/src/               API
  config/db.js            cached connection + explicit index sync
  models/                 Listing (2dsphere), User, Viewing (booking guard)
  controllers/            listing, auth, viewing
  routes/                 three routers
  middleware/             auth, errors
  data/                   seed listings, users, photo mapping
  app.js  index.js  seed.js
```

---

## Decisions worth knowing

**`$geoWithin`, not `$near`.** `$near` is the obvious operator for "within
N km" and the wrong choice for a search page: it returns results sorted by
distance, which fights the user's chosen sort order, and `countDocuments()`
refuses to run with it at all — so pagination becomes impossible.
`$geoWithin` with `$centerSphere` is a pure filter that composes with
`sort`, `skip`, `limit` and `count` like any other condition.

**The radius is in radians.** `$centerSphere` takes `[[lng, lat], radius]`
where the radius is radians, so 5 km is `0.00078393`, not `5`. Pass `5` and
you have asked for a circle five Earth-radii wide. The conversion lives in
one named function.

**Coordinates are `[longitude, latitude]` and cross that boundary exactly
three times.** GeoJSON and MongoDB put longitude first; Leaflet puts latitude
first. Both conventions are in this project, so the flip happens in three
named places — `pt()` in the seed data, `boundsToParam()` in the API client,
and the agent's listing form — and everything else reads `.latitude` and
`.longitude` by name. A swapped pair does not throw; it moves a London flat
7,500 km into the Indian Ocean and returns nothing.

**Double-booking is prevented by the database, not by a check.** The obvious
implementation looks for a clash and inserts if there isn't one — which is a
race condition, because two requests can both look, both find nothing, and
both write. There is a partial unique index on `(agent, startAt)` covering
only `requested` and `confirmed` viewings, so MongoDB itself rejects the
second write with error 11000, and the error handler turns that into a 409.
The partial filter is what makes it workable: a cancelled viewing falls out
of the index, freeing the slot without deleting any history.

**The frontend is not a security boundary.** The booking panel only offers
valid slots, but `POST /viewings` re-derives the agent's availability
server-side and rejects anything that isn't on it. Same principle as taking
prices from the database rather than the request.

**Registration cannot grant a role.** `register` destructures only `name`,
`email`, `password` and `phone`. `role` is never read from a request body.

**`$text` cannot be combined with a geospatial operator**, so when a search
term and a map area are both active the controller falls back to a regex
across title, city and postcode. User input is escaped before it reaches a
`RegExp`.

**The map's markers are never paginated.** The list shows twenty per page;
the map shows every match, because hiding markers would misrepresent what is
for sale. That is why `/listings/pins` exists — the same query, projected
down to seven fields and returned `.lean()`.

**One query for a fortnight of availability.** The date picker needs a count
per day for fourteen days. Fetching each day separately would be fourteen
round trips for data one query already has.

**Everything is UTC, and the limitation is documented rather than hidden.**
Slots are built with `Date.UTC`, so an agent's "09:00" is 09:00 UTC rather
than 09:00 where they are. For a London-only demo that is very nearly right
and wrong by an hour in summer. Doing it properly means storing an IANA
timezone per agent.

**Viewing status changes follow a state machine.** `requested → confirmed |
declined`, `confirmed → completed`. Enforced on the API, and the dashboard
only renders the buttons that machine allows, so the UI cannot offer an
action the server would reject.

**Leaflet is used directly, not through a wrapper.** Six separate effects
with six dependency lists — create the map, swap tiles with the theme, sync
markers, highlight the active pin, fit the view, handle drawing. Three
specific traps are handled: the container needs an explicit height or
Leaflet silently renders nothing; the default marker is a PNG that bundlers
break, so markers are `divIcon`s showing prices; and a `ResizeObserver`
tells Leaflet to re-measure when its box changes, which matters because
`display: none` gives it a size of zero and a degenerate bounding box.

**Filters live in the URL, the map viewport does not.** Filters are worth
sharing, bookmarking and going back through. Panning fires dozens of times
per drag and would thrash the history stack. Different lifetimes, different
homes.

**Two-layer CSS tokens.** Raw colours, then semantic names pointing at them.
Components only reference the semantic layer, so the entire dark theme is one
block redefining about fifteen values, with no component CSS to audit.

**Reduced motion means no animation is created.** Not built and skipped —
`motionContext` returns before making a single tween, so there is nothing to
play and no inline styles written.

---

## Not included

No payment processing — nothing is for sale here, so there is nothing to
charge for.

No marker clustering. With twenty-four properties it would cluster nothing
and cost a dependency plus its stylesheet. It becomes worth adding at a few
hundred listings.

No email or SMS notifications. A confirmed viewing changes status in the
database; a real deployment would send a message.

No image uploads — photography is hotlinked from Unsplash and mapped onto
listings by property type. Uploads would mean object storage and a signing
flow.

No per-agent timezones, as above.

No TypeScript, no state management library, no CSS framework, no component
library. All deliberate.

Photography from [Unsplash](https://unsplash.com).