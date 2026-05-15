# ShuttleBook

A two-sided shuttle and private transport booking app. Customers search the fleet and book rides with multi-stop itineraries; vendors manage vehicles and bookings through a dashboard. Data and auth are backed by **Supabase**; the UI is a **React + Vite** SPA with **shadcn/ui** and **Tailwind CSS**.

> **Repo name:** `shuttle-sprite` · **Product name in UI:** ShuttleBook

## What it does

| Role | Capabilities |
|------|----------------|
| **Customer** | Browse available vehicles, filter by capacity/price/location/features, create bookings with pickup, optional intermediate stops, and drop-off |
| **Vendor** | Dashboard metrics, fleet CRUD, confirm/complete/cancel bookings on their vehicles |
| **Admin** | Role exists in the schema; no dedicated admin UI yet |

Bookings use **server-side pricing** (`calculate_booking_price` RPC): hourly rate × duration, plus $15 per stop beyond pickup/drop-off, with an optional recurring multiplier when days-of-week are set (UI for recurring is not wired yet).

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod
- **UI:** shadcn/ui, Radix primitives, Tailwind CSS
- **Backend:** Supabase (Auth, Postgres, Row Level Security)
- **Scaffold origin:** [Lovable](https://lovable.dev) (optional deploy path)

## Prerequisites

- Node.js 18+ and npm
- A Supabase project with migrations applied from `supabase/migrations/`

## Local development

```sh
git clone <YOUR_GIT_URL>
cd shuttle-sprite
npm install
cp .env.example .env   # then fill in your Supabase URL and anon key
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

### Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon (publishable) key |

Never commit `.env`. Use `.env.example` as a template.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run SQL migrations in order from `supabase/migrations/`.
3. Enable Email auth (and any OAuth providers you need) under **Authentication → Providers**.
4. Copy the project URL and anon key into `.env`.

New sign-ups get a `profiles` row and a default role from metadata (`customer` or `vendor` chosen at registration).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

## Routes

| Path | Access | Description |
|------|--------|-------------|
| `/` | Authenticated | Customer home — search and book |
| `/vendor` | Vendor or admin | Vendor dashboard |
| `/auth` | Public | Sign in / sign up |
| `/forgot-password` | Public | Password reset request |
| `/reset-password` | Public | Set new password |

## Project structure

```
src/
  components/
    customer/     # Search, listings, booking modal
    vendor/       # Dashboard, fleet, booking management
    auth/         # ProtectedRoute, RoleRoute
    layout/       # Header
  context/        # AuthContext, AppContext (filters + modal)
  hooks/          # useVehicles, useBookings, useBookingCalculator
  integrations/
    supabase/     # Client + generated types
  pages/          # Route-level pages
  types/          # Shared TypeScript models
supabase/
  migrations/     # Schema, RLS, pricing function
```

## Data model (summary)

- **profiles** — user display info (linked to `auth.users`)
- **user_roles** — `admin` \| `vendor` \| `customer` (separate from profiles for RLS)
- **vehicles** — vendor-owned fleet with pricing, features, availability
- **bookings** — trip metadata, status, server-computed `price_breakdown`
- **booking_stops** — ordered pickup / stop / dropoff addresses

RLS ensures customers only see their bookings, vendors only see bookings on their vehicles, and vendors only mutate their own fleet.

## Deploy

- **Lovable:** Share → Publish from the linked Lovable project.
- **Static host:** `npm run build` and serve the `dist/` folder; set the same `VITE_*` env vars in the host.

## Known gaps & way forward

See the feature inventory below for implemented vs missing items and suggested priorities.
