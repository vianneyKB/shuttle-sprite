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

Apply SQL migrations in `supabase/migrations/` to your Supabase project (including `20260515120000_shuttle_routes_and_operator.sql`).

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
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## Deploy

Run `npm run build` and host `dist/`, or publish via Lovable. Set the same `VITE_*` variables on the host.
