# ShuttleBook

ShuttleBook is a geospatial shuttle platform: operators define routes and stops on a map; passengers view routes, request rides between stops, and book fleet vehicles. Built with **React + Vite**, **Leaflet**, and **Supabase**.

## Features

| Area | Capability |
|------|------------|
| **Passenger** | Interactive route map (Leaflet), ride requests between stops, fleet booking, **My rides** (requests + bookings) |
| **Passenger** | Payment choice: **cash on board** or **pay in advance** |
| **Operator** | Route CRUD with ordered stops (LineString geometry); stop names prefilled from OpenStreetMap (Nominatim reverse geocoding) |
| **Operator** | **Passenger queue** — awaiting passengers grouped by origin → destination |
| **Operator** | Fleet management, booking workflow, dashboard stats |
| **Operator** | **Pricing & tax settings** — currency (ISO 4217), tax rate/label, tax-inclusive pricing, per-stop fee; all snapshotted onto each booking |
| **Backend** | Supabase Auth, RLS, `create_booking` + `calculate_booking_price` RPCs (server-side pricing), `get_passenger_queue` RPC |

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
| `VITE_NOMINATIM_EMAIL` | Optional. Contact address sent with each reverse-geocode lookup, as the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) asks |
| `VITE_NOMINATIM_URL` | Optional. Own Nominatim reverse endpoint; defaults to `https://nominatim.openstreetmap.org/reverse` |

## Routes

| Path | Role | Description |
|------|------|-------------|
| `/` | Authenticated | Passenger home (map, fleet, my rides) |
| `/profile` | Authenticated | Your name and mobile number |
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
supabase/functions/
  _shared/        provider adapter, minor-unit conversion, HTTP helpers
  create-checkout-session/
  payment-webhook/
```

## Payments (Edge Functions)

Prepay bookings and ride requests are paid on a provider-hosted checkout page.
**Paystack** is the only adapter today; Stripe drops into
`supabase/functions/_shared/providers/` without changing either function.

| Function | Auth | What it does |
|----------|------|--------------|
| `create-checkout-session` | Passenger JWT | Verifies the caller owns the booking / ride request and still owes money, reads the amount **from the database**, and returns the provider's checkout URL. |
| `payment-webhook` | Provider signature (`verify_jwt = false`) | Verifies HMAC over the raw body, then sets `payment_status = 'paid'`. Idempotent and amount-checked. |

The client never sends an amount: it posts `{ "targetType": "booking" | "ride_request", "targetId": "<uuid>" }`.

### Deploy and configure

```sh
supabase functions deploy create-checkout-session
supabase functions deploy payment-webhook

supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx
supabase secrets set PAYMENT_CALLBACK_URL=https://<user>.github.io/shuttle-sprite/
# optional; defaults to paystack
supabase secrets set PAYMENT_PROVIDER=paystack
```

Then add the webhook URL in the Paystack dashboard (**Settings → API Keys &
Webhooks**): `https://<project-ref>.functions.supabase.co/payment-webhook`.

| Secret | Where | Description |
|--------|-------|-------------|
| `PAYSTACK_SECRET_KEY` | Supabase Edge Function secret | Signs API calls and verifies webhook signatures. Use a `sk_test_` key until go-live. |
| `PAYMENT_CALLBACK_URL` | Supabase Edge Function secret | Where the provider returns the passenger after paying. Server-side only, so a caller cannot redirect elsewhere. |
| `PAYMENT_PROVIDER` | Supabase Edge Function secret (optional) | Which adapter to use; `paystack` by default. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform — do not set them yourself.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server at http://localhost:8080/ |
| `npm run build` | Production build (base `/shuttle-sprite/`) into `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm test` | Vitest unit tests |
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

Then enable **GitHub Pages → Branch: `gh-pages`** in the repository settings.

The `deploy.yml` workflow (push to `main`) reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from **Settings → Secrets and variables → Actions**; add both there or the deployed bundle will have no Supabase connection. The live URL will be `https://<user>.github.io/shuttle-sprite/`.
