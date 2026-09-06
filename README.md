# ShuttleBook

ShuttleBook is a geospatial shuttle platform: operators define routes and stops on a map; passengers view routes, request rides between stops, and book fleet vehicles. Built with **React + Vite**, **Leaflet**, and **Supabase**.

## Features

| Area | Capability |
|------|------------|
| **Passenger** | Interactive route map (Leaflet), ride requests between stops, fleet booking, **My rides** (requests + bookings) |
| **Passenger** | Payment choice: **cash on board** or **pay in advance** |
| **Operator** | Route CRUD with ordered stops (LineString geometry) |
| **Operator** | **Passenger queue** — awaiting passengers grouped by origin → destination |
| **Operator** | Fleet management, booking workflow, dashboard stats |
| **Backend** | Supabase Auth, RLS, `calculate_booking_price` RPC, `get_passenger_queue` RPC |

## Tech stack

- React 18+, TypeScript, Vite, TanStack Query, React Hook Form, Zod
- react-leaflet + OpenStreetMap tiles
- shadcn/ui, Tailwind CSS
- Supabase (Postgres, Auth)

## Local setup

```sh
npm install
cp .env.example .env   # add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Then open **http://localhost:8080/**. In development the app is served from the root path (`base: '/'`), so no `/shuttle-sprite/` prefix is needed locally.

Apply **all** SQL migrations in `supabase/migrations/` to your Supabase project (in filename order), including `20260515120000_shuttle_routes_and_operator.sql`. Missing migrations will break the routes map, pricing, and the passenger queue RPCs.

### Environment

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |

## Routes

| Path | Role | Description |
|------|------|-------------|
| `/` | Authenticated | Passenger home (map, fleet, my rides) |
| `/operator` | Operator or admin | Operator dashboard |
| `/vendor` | — | Redirects to `/operator` |
| `/auth` | Public | Sign in / sign up |

Sign up as **Passenger** or **Operator**. Operators manage routes, fleet, bookings, and the passenger queue.

## Project layout

```
src/
  components/
    map/          RouteMap, RideRequestModal
    customer/     RoutesMapPanel, MyRides, fleet booking
    operator/     RouteManagement, PassengerQueue, dashboard
  hooks/          useRoutes, useRideRequests, useBookings, useVehicles
supabase/migrations/
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server at http://localhost:8080/ |
| `npm run build` | Production build (base `/shuttle-sprite/`) into `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Build and publish `dist/` to the `gh-pages` branch |

## Deploy

Run `npm run build` and host `dist/`, or publish via Lovable. Set the same `VITE_*` variables on the host.

### GitHub Pages

The production build is configured to be served from a subpath. Key pieces:

- **Base path** — `vite.config.ts` sets `base: '/shuttle-sprite/'` for production builds and `base: '/'` for local dev. If your repo/site name differs, update this value (and the redirect URL below) to match.
- **SPA deep-link fix** — GitHub Pages has no server-side routing, so `public/404.html` stores the requested URL in `sessionStorage.redirect` and bounces to `/shuttle-sprite/`. On load, `src/main.tsx` restores that URL with `history.replaceState`, so deep links (e.g. `/operator`) work on refresh.
- **Environment variables** — GitHub Pages serves static files only, so `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be present at **build time** (in your local `.env` or as CI secrets). They are inlined into the bundle during `npm run build`.

To publish:

```sh
npm run deploy   # runs the build, then pushes dist/ to the gh-pages branch via gh-pages
```

Then enable **GitHub Pages → Branch: `gh-pages`** in the repository settings. The live URL will be `https://<user>.github.io/shuttle-sprite/`.
