# Change log

Short summary of what each change added, removed, and why. Newest first.
Full task plan and review: https://claude.ai/artifact/Rcp1nVDs7WbT8Wt2hUFFaz

---

## 2026-09-15 — #17 Server-side booking creation + per-operator currency & tax
branch `Dev` · closes #17 · migration `20260915120000_create_booking_rpc_and_operator_pricing.sql`

**Why:** the client computed a price via RPC and then *inserted `total_price` itself*; the INSERT policy only checked `customer_id`, so any user could book at any amount. While moving pricing server-side, the platform was also made multi-country: currency, tax and the per-stop fee are now per operator instead of a hard-coded `$` and `15`.

### Added
| Item | Why |
|---|---|
| `operator_settings` table — `currency` (ISO 4217), `tax_rate` %, `tax_label` (VAT/GST/…), `prices_include_tax`, `additional_stop_fee` | One platform, many countries. Readable by all signed-in users (passengers need the currency to see prices); writable only by the owning operator. A trigger creates a default row when a user gains the `operator` role; existing operators backfilled. |
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
| `mapVehicle(row, currency?)` signature; `mapBooking` fills currency/tax from row or defaults | Backwards-compatible with rows created before this migration. |
| Operator dashboard "Total earnings" and fleet "Avg. rate/hour" formatted in the operator's currency | Was `$` regardless of country. |

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 11/11 · `vite build` OK. **The migration has not been run locally** (no Postgres/Docker on this machine); the Supabase preview branch on the PR is the live check — watch the bot's "Migrations" row.

### Not changed (deliberately)
- Ride requests have no price yet, so they carry no currency; add when fares land (Phase 4).
- Default currency stays `USD` (matching the previous `$` UI) until an operator sets theirs; the map's Johannesburg default suggests `ZAR` may be the better platform default — a one-line change in the migration if you want it.
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
