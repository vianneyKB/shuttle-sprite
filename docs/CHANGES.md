# Change log

Short summary of what each change added, removed, and why. Newest first.
Full task plan and review: https://claude.ai/artifact/Rcp1nVDs7WbT8Wt2hUFFaz

---

## 2026-09-17 — #19 Supabase advisor findings
branch `fix/advisor-findings` → `Dev` · closes #19 · migration `20260917120000_advisor_fixes_rls_consolidation.sql`

**Why:** the owner exported the Security and Performance advisor reports for the live project (45 findings: 5 security, 40 performance). Two security items needed SQL; the performance items were all RLS-shaped — `auth.uid()` re-evaluated per row in 28 policies, and 11 table/action pairs with 2–3 overlapping permissive policies.

### Changed
| Item | Why |
|---|---|
| **Every RLS policy on the 9 app tables dropped and recreated** — one policy per table/action, named `<table>_<action>`, all using `(select auth.uid())` | Clears all 28 `auth_rls_initplan` and all 11 `multiple_permissive_policies` warnings. Access rules are unchanged: each new policy is the OR of the ones it replaces. Also removes any policy that was added to the live DB outside migrations, so the end state is exactly what the repo says. |
| `has_role(user, role)` only answers about the caller (or about anyone, if the caller is admin) | It was `SECURITY DEFINER` and callable by any signed-in user with any user id — a way to enumerate who is an admin/operator. RLS only ever asks about `auth.uid()`, so nothing else changes. |
| `revoke execute` on `rls_auto_enable()` from anon/authenticated (guarded — only if the function exists) | Flagged as a public `SECURITY DEFINER` function; it isn't in any migration (scaffolding leftover). |

### Accepted, not changed
| Finding | Why |
|---|---|
| `create_booking()` is `SECURITY DEFINER` and callable by `authenticated` | Intentional — it *is* the booking API; it validates everything and computes the price itself. |
| 3 `unused_index` (INFO) on `route_stops.route_id`, `ride_requests.status`, `ride_requests.route_id` | The DB has almost no rows; these back FKs and the queue's status filter. Revisit if still unused with real traffic. |
| **Leaked-password protection disabled** | Dashboard toggle, not SQL — **owner action**: Authentication → Settings → Password → enable *Leaked password protection*. |

### Verification
No client code changed; `npm run lint` / `typecheck` / `test` / `build` unaffected. Migration runs on the Supabase preview branch for the PR. After merge, re-run both advisors — expected remaining: `create_booking` (accepted) and leaked-password (until toggled).

---

## 2026-09-17 — #20 + #21 Dispatch: operators act on ride requests
branch `Dev` · closes #20, #21 · migration `20260917100000_ride_request_dispatch.sql`

**Why:** the Queue tab was view-only. `ride_requests` had a status column but nothing recorded which operator took a request or which vehicle carries it, and status could only be changed by a raw UPDATE with no rules. This is the biggest product gap from the review: the operational loop now closes on the operator side.

### Added
| Item | Why |
|---|---|
| `ride_requests.operator_id`, `vehicle_id`, `assigned_at`, `started_at`, `completed_at` (+ indexes) | Record who took the request, with what, and when each step happened. Timestamps feed the passenger timeline in #23. |
| `dispatch_ride_request(_id, _status?, _vehicle_id?)` RPC (`SECURITY INVOKER`) | The one way operators change a request. Enforces the state machine awaiting → confirmed → in_progress → completed (cancel from any active state), refuses a Start without a vehicle, checks the vehicle is in the caller's fleet, stamps `operator_id`/timestamps, and marks cash rides `paid` on completion. A request taken by one operator can't be changed by another. |
| RLS: operators keep SELECT/UPDATE on requests they've taken, even if the route is deleted; can't take a request another operator already has | Ownership follows the dispatcher, not only the route. |
| `useOperatorRideRequests()` (waiting + confirmed + in-progress rows) and `useDispatchRideRequest()` | Per-request data and the single mutation the UI uses. |
| **Queue tab rebuilt** (`PassengerQueue.tsx`): each origin → destination group expands to its individual requests with **Confirm / Assign vehicle / Start / Complete / Cancel**; **"Confirm all"** with one vehicle for the whole group (warns if passengers exceed seats); an **Active rides** section for confirmed and in-progress rides | Matches how ranks work: fill a direction, assign a taxi, go. |
| `RideRequest` domain type gains `operatorId`, `vehicleId`, `assignedAt`, `startedAt`, `completedAt`; mapper + 1 test (suite now 12) | |

### Removed
| Item | Why |
|---|---|
| `useUpdateRideRequestStatus` (raw `update … set status`) | Replaced by the RPC so transitions can't skip states. |
| The aggregated-only queue cards | Superseded by the expandable groups; `get_passenger_queue` RPC and `usePassengerQueue` are kept for now (still valid, may back a dashboard stat). |

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 12/12 · `vite build` OK. Migration runs on the Supabase preview branch when the PR opens.

### Not changed (deliberately)
- Passengers don't yet see the assigned vehicle or a live timeline — that's #23, and it needs Realtime (#22) to be useful.
- "Departs when full" seat counter is not shown; needs a fare/seat model (see taxi-bus research).

---

## 2026-09-15 — Fix stale Supabase project ref
branch `Dev`

**Why:** `supabase/config.toml` pointed at `syiixyjicrqrohmqasyc`, which is not the project the app's data lives in. The live project — the one the Supabase GitHub integration deploys migrations to and whose publishable key the site uses — is `dyynbzbpitjoyfrxnxux`. Deploying with the old URL + the real key produced "Invalid API key" on sign-in.

### Changed
| Item | Why |
|---|---|
| `supabase/config.toml` project_id → `dyynbzbpitjoyfrxnxux` | Match the real project so the CLI and future readers link to the right database. |
| `.env.example` shows the real project URL | One less thing to get wrong on local setup. |

**Manual:** the `VITE_SUPABASE_URL` repository secret must be `https://dyynbzbpitjoyfrxnxux.supabase.co`.

---

## 2026-09-15 — Deploy: fail loudly when Supabase secrets are missing
branch `Dev` · in PR #43

**Why:** https://vianneykb.github.io/shuttle-sprite/ was a white page. The deploy workflow succeeded every time, but the repo has no `VITE_SUPABASE_*` secrets, so the bundle shipped with an undefined Supabase URL and `createClient()` threw before React rendered. **Adding the two secrets is still a manual step** (Settings → Secrets and variables → Actions).

### Added
| Item | Why |
|---|---|
| `deploy.yml`: a step that fails the run with a clear error if either secret is unset | A green deploy of a broken bundle is worse than a red one. |
| `deploy.yml`: `workflow_dispatch` trigger | Re-deploy from the Actions tab after adding secrets, without a push to `main`. |
| `supabase/client.ts`: readable "not configured" message when env vars are missing | Local dev without `.env`, or any future misconfiguration, shows what's wrong instead of a blank page. |

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 11/11.

---

## 2026-09-15 — #18 Transactional route-stop saving
branch `Dev` · closes #18 · migration `20260915140000_save_route_stops_rpc.sql`

**Why:** saving a route's stops was three separate requests from the browser — delete all stops, insert the new set, update the route's LineString — and the delete's error wasn't even checked. A failure part-way left a route with no stops and stale geometry.

### Added
| Item | Why |
|---|---|
| `save_route_stops(_route_id, _stops jsonb)` RPC (`SECURITY INVOKER`) | One call = one transaction: validates every stop (name, lat −90…90, lng −180…180, ≥ 2 stops) *before* writing, then replaces stops and rebuilds the GeoJSON LineString together. Returns the saved stops. RLS still applies; an explicit ownership check gives a clear error instead of a silent zero-row delete. |
| Unique constraint `route_stops (route_id, stop_order)` | Two stops on one route can't share a position. |
| `RouteManagement`: on a *new* route, if the stops call fails the just-created route row is removed | The route insert and the stops RPC are still two calls; this stops an empty route appearing in the list after a validation error. |

### Removed
| Item | Why |
|---|---|
| Client-side delete → insert → update sequence in `useSaveRouteStops` | Replaced by the RPC. |

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 11/11 · `vite build` OK. Migration runs on the Supabase preview branch when the PR opens.

### Not changed (deliberately)
- Route create + stops are still two round-trips. Folding both into one `create_route(...)` RPC is easy later, and will make more sense once route fares (per the taxi-bus research) land and the payload grows.

---

## 2026-09-15 — #17 Server-side booking creation + per-operator currency & tax
branch `Dev` · closes #17 · migration `20260915120000_create_booking_rpc_and_operator_pricing.sql`

**Why:** the client computed a price via RPC and then *inserted `total_price` itself*; the INSERT policy only checked `customer_id`, so any user could book at any amount. While moving pricing server-side, the platform was also made multi-country: currency, tax and the per-stop fee are now per operator instead of a hard-coded `$` and `15`.

### Added
| Item | Why |
|---|---|
| `operator_settings` table — `currency` (ISO 4217, default `ZAR`), `tax_rate` % (default 15), `tax_label` (VAT/GST/…), `prices_include_tax`, `additional_stop_fee` | One platform, many countries; defaults are South Africa. Readable by all signed-in users (passengers need the currency to see prices); writable only by the owning operator. A trigger creates a default row when a user gains the `operator` role; existing operators backfilled. |
| `bookings.currency`, `subtotal`, `tax_rate`, `tax_amount` | Snapshot at booking time so later changes to an operator's settings never rewrite history. `total_price` = subtotal + tax. Existing rows backfilled as tax-free. |
| `create_booking(...)` RPC (`SECURITY DEFINER`) | The only way to create a booking now. Validates vehicle availability, capacity, date, contact fields and stops; computes the price; inserts booking + stops in **one transaction**; returns the id. Client never sends a price. |
| `calculate_booking_price` now returns `currency`, `taxRate`, `taxLabel`, `taxAmount`, `subtotal`, `pricesIncludeTax`, `additionalStopFee` | Same function feeds the live preview and the real insert, so the two can never disagree. Handles tax-inclusive pricing (backs tax out) and tax-exclusive (adds on top), rounded to 2 dp. |
| `src/lib/money.ts` — `formatMoney(amount, currency)` via `Intl.NumberFormat` | Correct symbol, placement and minor units per currency (JPY has none); never throws on an unknown code. |
| `src/hooks/useOperatorSettings.ts` | Read/upsert the operator's pricing settings. |
| Operator **Pricing** tab (`PricingSettings.tsx`) | Form for currency (list + free ISO code), tax rate/name, tax-inclusive toggle, stop fee, with a live worked example. |
| Booking modal: tax line, subtotal, recurring multiplier, per-stop fee shown in the operator's currency | Passengers see exactly what they'll be charged and why. |
| `Vehicle.currency` (from the operator's settings, one extra query per list) | Vehicle cards/prices render in the right currency. |
| Tests: `money.test.ts` (4) and pricing-snapshot cases in `mappers.test.ts` — suite now 11 | Cover formatting across currencies and legacy-row defaults. |
| Supabase types hand-updated for the new table, columns and RPC | No CLI/MCP access to regenerate; shapes match the migration. |

### Removed
| Item | Why |
|---|---|
| RLS policy "Customers create their own bookings" (INSERT) | Direct inserts bypassed server-side pricing. `create_booking` is definer-owned. |
| RLS policy "Customers manage stops on their bookings" (ALL) | Adding/removing stops after booking changed the priced stop count. Reads remain via "View stops for accessible bookings". |
| Client-side insert in `useCreateBooking`; `useBookingCalculator.ts`; `ADDITIONAL_STOP_COST` constant | All pricing lives in Postgres now; the client copy was already drifting. |
| Every hard-coded `$` in VehicleCard, MyRides, BookingManagement, OperatorDashboard, VehicleManagement, BookingModal | Replaced by `formatMoney(amount, currency)`. Price-filter labels in VehicleSearch are now symbol-free ("Up to 50 / hr") because a cross-operator list can hold several currencies. |

### Changed
| Item | Why |
|---|---|
| Platform defaults: currency `ZAR`, tax 15% `VAT` (DB defaults, `calculate_booking_price` fallbacks, `DEFAULT_CURRENCY` / `DEFAULT_TAX_RATE` in `src/lib/money.ts`) | Home market is South Africa. Operators elsewhere override in the Pricing tab. |
| `mapVehicle(row, currency?)` signature; `mapBooking` fills currency/tax from row or defaults | Backwards-compatible with rows created before this migration. |
| Operator dashboard "Total earnings" and fleet "Avg. rate/hour" formatted in the operator's currency | Was `$` regardless of country. |

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 11/11 · `vite build` OK. **The migration has not been run locally** (no Postgres/Docker on this machine); the Supabase preview branch on the PR is the live check — watch the bot's "Migrations" row.

### Not changed (deliberately)
- Ride requests have no price yet, so they carry no currency; add when fares land (Phase 4).
- Platform defaults are **ZAR and 15% VAT** (South Africa is the home market); operators elsewhere change theirs in the Pricing tab. Existing bookings from before this migration are backfilled as ZAR, tax-free.
- Tax is a single flat rate per operator. Multi-rate (e.g. different rate per service class) or per-region tax within one operator is out of scope.

---

## 2026-09-15 — Phase 0: stabilise build, CI, deploy, tests
PR [#15](https://github.com/vianneyKB/shuttle-sprite/pull/15) · branch `Dev` → `main` · tracking issue #16

### Added
| Item | Why |
|---|---|
| `.github/workflows/ci.yml` — runs lint, typecheck, test, build on pushes/PRs to `main` and `Dev` | There was no CI; nothing verified a change before merge. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` passed into the build step of `deploy.yml` | The Pages build had no Supabase env, so the deployed app started with an undefined URL (white screen). Secrets must still be added in repo settings. |
| `.env.example` | README told users to copy it, but it was gitignored and missing. |
| `npm run typecheck`, `npm test`, `npm run test:watch` scripts | Give CI and developers one command each for verification. |
| Vitest + Testing Library + jsdom config in `vite.config.ts`; `src/test/setup.ts` | First test harness in the project. |
| `src/hooks/__tests__/mappers.test.ts` — 6 tests | Cover the DB-row → domain mappers: numeric coercion, stop ordering, nullable fields, legacy-row defaults. |
| `mapBooking`, `mapRoute`, `mapRideRequest`, `mapVehicle` and their `Db*` types are now exported from the hook files | Needed so the mappers can be unit-tested; no behaviour change. |
| `scripts/create-issues.sh` | Creates the 26 tracking issues (#16–#41) for phases 0–6. Idempotent. |
| `docs/CHANGES.md` (this file) | Running summary of changes for reviewers. |
| README: `typecheck`/`test` in the scripts table; note on the two deploy secrets | Keep docs in step with the above. |

### Removed
| Item | Why |
|---|---|
| `.github/workflows/deployment` | GitHub's hello-world template; did nothing and had no `.yml` extension. |
| `supabase/migrations/20260621184641_…sql` | Duplicate of `20260515120000_shuttle_routes_and_operator.sql`; failed on any fresh database. `main` (PR #14) had already deleted it and reconciled history with the live project, so the merge kept the deletion. |
| Dependencies: `recharts`, `embla-carousel-react`, `vaul`, `cmdk`, `input-otp`, `react-resizable-panels`, `react-day-picker`, `next-themes` | Not used by any application code — only by shadcn stubs that were themselves unused. |
| shadcn stubs: `ui/chart`, `ui/carousel`, `ui/drawer`, `ui/command`, `ui/input-otp`, `ui/resizable`, `ui/calendar` | Sole consumers of the removed dependencies. |
| `useTheme` (next-themes) from `ui/sonner.tsx` | The app has no theme switcher; toaster now uses the light theme directly. |
| `.env.example` line in `.gitignore` | So the example file can be committed. |

### Changed
| Item | Why |
|---|---|
| `@types/react`, `@types/react-dom` 18 → 19 | Match the installed React 19; the mismatch was masking type differences. |
| `ui/command.tsx`, `ui/textarea.tsx`: empty `interface … extends X {}` → `type … = X` | ESLint `no-empty-object-type` errors. |
| `tailwind.config.ts`: `require("tailwindcss-animate")` → ES import | ESLint `no-require-imports` error; file is already an ES module. |
| `BookingModal.tsx`: `catch (e: any)` → `catch (e: unknown)` with `instanceof Error` check | ESLint `no-explicit-any` error; matches the pattern used elsewhere. |
| Merged `origin/main` into `Dev` | Picked up PR #14's security hardening (role escalation, queue leak, `WITH CHECK` gaps) and the migration-history reconciliation. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn fast-refresh warnings) · `npm run typecheck` clean · `npm test` 6/6 · `vite build` OK.

### Not changed (deliberately)
- No application behaviour changed; every user-facing screen renders as before.
- Bundle is still one ~976 kB chunk — code-splitting is issue #35, not this PR.
- Remaining shadcn stubs (sidebar, menubar, etc.) are unused but kept: they depend on Radix packages that are cheap and may be used soon.
