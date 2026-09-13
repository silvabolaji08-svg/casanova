# Casanova

A property search and viewing-booking platform for London. Search on a map,
draw an area to search inside, and book a viewing against an agent's real
availability.

**Live:** https://casanova-steel-gamma.vercel.app
**API:** https://casanova-fnzw.vercel.app/api/health

---

## What this is

Most portfolio e-commerce and listing sites are the same application with
different nouns: a grid of cards, a detail page, a cart. Casanova was built
around the two things property actually needs and a product catalogue
doesn't — **geospatial search** and **appointment booking** — because those
are where the interesting problems are.

The map is not decoration. Panning it runs a real geospatial query against
MongoDB. The booking calendar is not a form — the server derives each
agent's free slots from their working pattern and existing appointments,
and the database itself makes double-booking impossible.

---

## Screenshots

### Map search

Properties are queried by map viewport, radius, or a hand-drawn area. The
list and the markers stay in sync as you pan.

![Casanova map search](docs/screenshots/search.png)

### Property detail

![A property detail page](docs/screenshots/property.png)

### Booking a viewing

Slots are generated from each agent's working days and hours, with
already-booked times removed.

![Booking a viewing](docs/screenshots/booking.png)

### Agent dashboard

![An agent's schedule](docs/screenshots/agent-schedule.png)

---

## Features

**Search**

- Interactive Leaflet map with price markers, synced to the results list
- Search by map viewport, by radius around a point, or inside a polygon
  you draw by hand
- Full-text search across title, description, area and postcode
- Filters for price, bedrooms, bathrooms, property type, and sale vs rent
- Sorting, pagination, and filter state held in the URL, so any search is
  a shareable link

**Booking**

- Availability derived per agent from working days, working hours and
  slot length
- Booked slots removed from the offered times, computed server-side
- Double-booking prevented by a database constraint, not a code check
- Buyers can view and cancel their bookings; agents see their schedule and
  can confirm or decline

**Accounts**

- JWT authentication with three roles: buyer, agent, admin
- Saved properties
- Agents manage their own listings

**Interface**

- Light and dark themes
- Responsive from phone to desktop
- Focused GSAP animation on page transitions, galleries and hover states
- Keyboard-accessible, with visible focus states and ARIA live regions on
  the search results

---

## Built with

**Frontend** — React 18, Vite, React Router, plain CSS with custom
properties, GSAP, Leaflet.

**Backend** — Node, Express, Mongoose, MongoDB Atlas, JSON Web Tokens,
bcrypt.

**Hosting** — Two Vercel projects from this one repository: the static
frontend, and the Express API as a serverless function.

No CSS framework and no component library. The design system is about
thirty custom properties in `src/index.css`, layered so that dark mode is
a redefinition of roughly thirty lines rather than a second stylesheet.

---

## How the interesting parts work

### Geospatial search

Listings store their position as a GeoJSON `Point` with a `2dsphere`
index. Without that index MongoDB does not run these queries slowly — it
refuses to run them at all.

Area searches use `$geoWithin` with `$centerSphere` rather than `$near`,
which matters for two reasons: `$near` forces its own distance ordering,
which fights the user's chosen sort, and `countDocuments()` refuses to run
alongside it, which breaks pagination. `$centerSphere` takes its radius in
**radians**, so kilometres are divided by the Earth's radius of 6,378.1 km.

Drawn areas become a closed GeoJSON polygon — the last coordinate repeats
the first, so four corners are five points.

One MongoDB limitation shapes the code: a `$text` search cannot be
combined with a geospatial operator in the same query. When a user has
both a search term and an area active, the text index is swapped for an
escaped regular expression so the two can coexist.

### Preventing double-booking

Checking whether a slot is free and then inserting a booking is a race
condition: two requests can both pass the check before either writes.
Under load, two people get the same appointment.

So the rule is enforced by the database:

```js
viewingSchema.index(
  { agent: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['requested', 'confirmed'] } },
  }
)
```

A partial unique index — unique only across bookings that are still
active, so a cancelled viewing frees its slot. The second concurrent
write fails with MongoDB error `11000`, which the error handler translates
into a `409 Conflict` and a human-readable message.

The application still validates before inserting, because a clear message
beats a raw conflict. But validation is for the user; the constraint is
for correctness. Both layers are needed.

### Keeping the map and the list in sync

The map reports its viewport when the user moves it, which drives the
search. But the search also re-frames the map when results arrive — and
that movement fires the same event, which would start another search, and
another. The fix has two parts: the component flags moves it made itself,
and it ignores any viewport change smaller than 1% of the visible span,
so a resize or an animation settling can't masquerade as a user panning.

---

## Project structure


---

## Running it locally

**You'll need** Node 18 or newer and a MongoDB connection string. A free
MongoDB Atlas cluster is fine.

### 1. Install

```bash
git clone https://github.com/YOUR-USERNAME/casanova.git
cd casanova
npm install
cd server
npm install
cd ..
```

### 2. Configure

Create `server/.env` — see `server/.env.example`:


Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then create `.env` in the project root:


Neither `.env` file is committed. Note that `VITE_`-prefixed values are
baked into the frontend bundle at build time and are therefore public —
never put a secret behind one.

### 3. Seed the database

```bash
cd server
npm run seed
```

This creates 24 London listings with real coordinates, six users and a
handful of bookings. It also builds the indexes explicitly and then runs
the real queries back against the data — a radius search, a bounding-box
search and a text search — so a seed that silently produced unqueryable
data fails loudly instead.

`npm run seed:destroy` empties the collections.

### 4. Run

On Windows:

```powershell
.\start.ps1
```

Or run each in its own terminal:

```bash
cd server && npm run dev     # http://localhost:5000
npm run dev                  # http://localhost:5173
```

Two terminals matter. Running the seed in the API's terminal stops the
API, which produces a "could not reach the server" error on the site that
looks like a bug in the code and isn't.

---

## Demo accounts

<!-- Copy the real values out of server/src/data/users.js before publishing. -->

| Role  | Email | Password |
| ----- | ----- | -------- |
| Buyer | `FILL ME IN` | `FILL ME IN` |
| Agent | `FILL ME IN` | `FILL ME IN` |
| Admin | `FILL ME IN` | `FILL ME IN` |

These are demo credentials for a demo database, published deliberately so
the live site can be explored. They are seeded from
`server/src/data/users.js`.

---

## The API

All routes are prefixed `/api`.

| Method | Route | Purpose |
| ------ | ----- | ------- |
| `GET` | `/health` | Liveness check |
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Sign in, returns a JWT |
| `GET` | `/auth/me` | The signed-in user |
| `GET` | `/listings` | Search, filter, sort, paginate |
| `GET` | `/listings/pins` | Lightweight coordinates for the map |
| `GET` | `/listings/meta` | Filter ranges and options |
| `GET` | `/listings/:slug` | One listing |
| `GET` | `/viewings/availability` | Free slots for an agent on a date |
| `POST` | `/viewings` | Book a viewing |

The full set, including the agent and admin routes, is in
`server/src/routes/`.

---

## Deployment

Two Vercel projects, both pointed at this repository, distinguished by
their **Root Directory** setting:

- **Frontend** — root directory blank. `vercel.json` rewrites every path to
  `index.html` so that typing a deep URL directly reaches React Router
  rather than a 404.
- **API** — root directory `server`. `server/vercel.json` uses the legacy
  `builds`/`routes` form; the modern `rewrites` form does not preserve
  `req.url`, which Express needs to route the request.

Environment variables are set in each project's settings.
`CLIENT_ORIGIN` on the API must include the deployed frontend's origin, or
every request is blocked by CORS and the site loads with zero results.

---

## Licence

MIT.