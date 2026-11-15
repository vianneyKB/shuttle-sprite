# Change log

Short summary of what each change added, removed, and why. Newest first.
Full task plan and review: https://claude.ai/artifact/Rcp1nVDs7WbT8Wt2hUFFaz

---

## 2026-11-09 — #38 Admin view: approve operators, see all bookings and requests
branch `routine/issue-38` → `Dev` · closes #38 · migration `20261109040509_admin_operator_applications.sql`

**Why:** the `admin` role and its policies have existed since the first migration and nothing used them, which hid a real problem: being an operator was self-granted. The sign-up form sent `role: 'operator'` and `handle_new_user` honoured it, so anyone who picked "Operator" could immediately publish routes, set fares and take passengers' money — 20260906135126 left that in place with a note to move it behind an admin flow. This is that flow. A claim of 'operator' now files an application, the account starts as a working passenger account, and an admin decides. The second half is read access: `bookings_select` and `booking_stops_select` were the only read policies without an admin branch, so an admin could see every ride request and not a single booking.
## 2026-10-06 — #36 Error boundary and error reporting
branch `routine/issue-36` → `Dev` · closes #36 · no migration

**Why:** a thrown render error took the whole page to white, and nobody found out. There was no boundary, so one bad row in a list ended the session; and no reporting, so every crash a passenger hit was invisible unless they said something. Both are now covered, and reporting stays completely inert until a DSN is set — the repo, CI and a developer with no Sentry account behave exactly as before.
## 2026-10-05 — #35 Code-split by route; target < 300 kB initial JS
branch `routine/issue-35` → `Dev` · closes #35 · no migration (build and client only)

**Why:** the whole app arrived as one 1,034 kB script (302 kB gzipped) before anything appeared on screen. A passenger tapping a link on a phone paid for the operator dashboard, both maps and every form before the sign-in box could render — and Leaflet, a third of that weight, is needed by exactly two screens. Every page is now its own chunk, both maps are loaded when they are first shown, and the first load is **165 kB gzipped across six chunks instead of 302 kB in one**. A budget check in CI keeps it that way, because a bundle only has to be split once to be un-split by the next stray import.

### Added
| Item | Why |
|---|---|
| `src/components/layout/ErrorBoundary.tsx` wrapping `<App />` in `main.tsx` | A render error now shows "Something went wrong", a **Reload the page** button and a link home instead of a blank screen. Deliberately built from `Card` and `Button` only, with no router, query-client or auth dependency: one of those failing is exactly how we get here, so the fallback must not need them. |
| `src/lib/errorReporting.ts` — crash reporting to Sentry's **envelope endpoint** over plain `fetch` | The DSN is all Sentry needs to accept an event, so there is no SDK in the bundle: 0 kB added to an initial payload that #35 is trying to get under 300 kB. `parseDsn` turns the DSN into the ingest URL (self-hosted path prefixes included) and returns null for anything unusable, which leaves reporting off rather than throwing at start-up. |
| Global `error` and `unhandledrejection` handlers, registered by `initErrorReporting()` | The boundary only sees render errors. An event handler that throws or a promise nobody awaited were the other two silent failures, and they are tagged by mechanism so they can be told apart in Sentry. |
| A stack parser (Chrome and Firefox formats) producing Sentry frames, dependencies marked `in_app: false` | A report whose stack is one opaque string is barely worth having. Frames arrive oldest-first, which is the order Sentry wants and the reverse of how engines print them. |
| Reference id on the fallback card when an event was sent | The person looking at the broken page can quote the exact event, instead of "it broke this morning". |
| `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE` — in `.env.example`, the README environment table, an **Error reporting** section and `vite-env.d.ts` | All three optional. Without the DSN nothing is sent and no request is made. |
| 22 tests (`errorReporting.test.ts`, `ErrorBoundary.test.tsx`); suite 106 → 128 | Cover DSN parsing, URL scrubbing, event and envelope shape, dedupe, the cap, a failing transport, and the boundary rendering its fallback and reporting the crash. |
| `src/components/layout/LazyFallback.tsx` — `PageFallback` and `PanelFallback` | A `Suspense` boundary that renders nothing collapses the layout and the page jumps when the chunk lands. `PanelFallback` takes the box the real component will fill (the map's own `h-[min(420px,55dvh)] sm:h-[480px]`), so the map tab looks the same before and after. Both announce themselves with `role="status"` and an `sr-only` label, since a spinner alone says nothing to a screen reader. |
| `src/lib/mapDefaults.ts` — `DEFAULT_MAP_CENTER`, `DEFAULT_MAP_ZOOM` | These two constants lived in `src/lib/leaflet.ts`, next to its `import L from "leaflet"`. `src/lib/routeStops.ts` — whose own header says it exists so the rules are testable "without a map" — imported one of them, which pulled Leaflet into every chunk that touched those pure helpers. Splitting the file is what makes the lazy map boundary actually hold. |
| `scripts/bundle-budget.mjs` and `npm run check:bundle`, run in CI after `Build` | Reads `dist/index.html`, adds up the entry script and every `modulepreload` next to it, prints each chunk, and exits non-zero over **200 kB gzipped**. The split is only worth having if it is enforced: one top-level `import` of a page in a shared module silently restores the single bundle, and nothing else would notice. |
| `scripts/__tests__/bundleBudget.test.mjs` — 11 tests | The script decides whether CI passes, so its rule is tested: entry first then preloads, stylesheets and `prefetch` links excluded, a chunk listed twice counted once, an un-built HTML file reporting nothing, the base path stripped, raw and gzip totals, and OK/EXCEEDED exactly at the budget. A parser that matched nothing would report 0 kB and always pass. |
| `build.rolldownOptions.output.codeSplitting` groups in `vite.config.ts` — `react`, `supabase`, `vendor` | Vendor chunks as the issue suggested: the dependencies that change on a dependency bump are separated from the app code that changes every deploy, so a release no longer invalidates 1 MB of cache. Each group is tagged **`$initial`** — without that, a `node_modules` group sweeps Leaflet out of the lazy map chunk and into a chunk the entry has to preload, quietly undoing the split. |
| `build.chunkSizeWarningLimit: 300` | Set **after** the split, as the issue asked, not instead of it: the build is clean at 300 kB today, so the warning now means something. The largest chunk is 197 kB. |

### Changed
| Item | Why |
|---|---|
| `src/App.tsx` — all seven pages are `React.lazy`, under one `Suspense` inside `AuthProvider` | The entry now holds the shell, the session and the toasters and nothing else. The boundary sits inside `AuthProvider` so the session is still resolved while a page downloads, and `ProtectedRoute` / `RoleRoute` still decide before a chunk is fetched — an operator-only chunk is not requested by someone without the role. |
| `src/components/customer/CustomerView.tsx` — `RoutesMapPanel` is lazy | Leaflet lands when the Routes tab is first shown. It is the default tab, so this is a second request rather than a saving for a passenger who opens the map — but the sign-in page, My rides and fleet booking no longer pay for it. |
| `src/components/operator/RouteManagement.tsx` — `RouteStopsMap` is lazy | The stop editor is inside a dialog. The dashboard chunk no longer carries a map that only opens when an operator edits a route. |
| `src/lib/leaflet.ts` now also owns `leaflet/dist/leaflet.css`, moved out of `src/main.tsx` | The stylesheet was global, so it shipped in the initial CSS for every page. It now travels with the chunk that draws a map: initial CSS 80.7 kB → 65.9 kB, with the remaining 14.8 kB alongside the map. |
| `README.md` — new **Bundle size** section, `check:bundle` in Scripts, `layout/` in the project layout | Says where the boundaries are and what to do when the next heavy dependency arrives: lazy-load it, do not raise the budget. |

### Verification
| Command | Result |
|---|---|
| `npm ci --legacy-peer-deps` | OK |
| `npm run lint` | 0 errors, 8 pre-existing shadcn warnings |
| `npm run typecheck` | clean |
| `npm test` | **117/117** (12 files); 11 new in `scripts/__tests__/bundleBudget.test.mjs`, suite 106 → 117 |
| `npm run build` | OK, **no chunk-size warning at a 300 kB limit** |
| `npm run check:bundle` | 165.26 kB gzipped (560.69 kB raw) over 6 chunks — under the 200 kB budget |

Before and after, as the build reports them:

| | Initial JS, raw | Initial JS, gzipped | JS chunks built | Initial CSS |
|---|---|---|---|---|
| Before | 1,034.14 kB in one chunk | 301.97 kB | 1 | 80.73 kB |
| After | 560.69 kB over 6 chunks | **165.26 kB** | 25 | 65.92 kB |

Largest chunks after the split: `supabase` 196.7 kB, `react` 189.6 kB, `vendor` 174.8 kB (all initial); `RoutePolyline` 160.4 kB — Leaflet and `react-leaflet` — and `Operator` 65.3 kB, both lazy.

The built app was then driven in headless Chromium against `npm run preview`, since a lazy route that fails only fails at runtime: `/` redirects to `/auth` and renders the sign-in form, `/forgot-password` and an unknown path render their own pages, each fetching its own chunk, **no Leaflet chunk is requested on any of them**, and the console is clean. The signed-in surfaces — the map tab and `/operator` — were not driven: both need a real Supabase session, which this environment has no key for. Their chunks are the same `React.lazy` boundary as the three that were exercised.

### Not changed (deliberately)
- **The target reads as "no chunk over 300 kB", which is met; under 300 kB *raw* for the whole first load is not reachable** and is not attempted. React and `react-dom` are 189.6 kB and `@supabase/supabase-js` 196.7 kB, and both are needed before the first paint: the router needs React, and `AuthProvider` asks Supabase for the session to decide whether to show a page or the sign-in box. That is 386 kB raw before a line of our own code. The gzipped figure the issue quotes alongside its target — 285 kB then, 302 kB when this started — is now 165 kB.
- **The budget is set at 200 kB gzipped, not the issue's 300 kB.** A budget above where the build already sits can never fail; 200 kB leaves room for a feature without leaving room for the single-bundle regression. Raising it should be a deliberate edit to `scripts/bundle-budget.mjs`, visible in a diff.
- **No lazy loading of the toasters, the tooltip provider or `QueryClientProvider`.** They are mounted at the root and a toast can fire during the first render, so a boundary around them buys a few kB for a real risk of a dropped message.
- **`@supabase/supabase-js` is not trimmed.** Importing `@supabase/postgrest-js` and the auth client separately rather than the umbrella package would cut the largest initial chunk, but it changes how every hook in the app reaches the database and deserves its own issue.
- **No route prefetching.** Hinting the next likely chunk on hover or after idle would hide the second request, but it also spends a passenger's data on a page they may not open. Worth measuring before adding.
- Noticed while in these files, left alone: the initial `vendor` chunk is 174.8 kB and nothing here says what is in it — splitting `react-router`, `@tanstack/react-query` and the Radix primitives apart would make a regression in any one of them legible, but it adds requests and is a tuning question, not this issue's.

---

## 2026-10-02 — #34 Vehicle image upload to Supabase Storage

branch `routine/issue-34` → `Dev` · closes #34 · migration `20261002041042_vehicle_images_storage.sql`

**Why:** the vehicle form asked an operator to paste an "Image URL", so every photo in the fleet lived on somebody else's host — a Facebook CDN link, a WhatsApp image, a free image host — and broke when that host did, with nobody to notice but the passenger looking at a blank card. Photos now go into a `vehicle-images` bucket this project owns. The bucket is public to read, because the listing is public and a passenger browsing shuttles is often not signed in yet; writing is confined to operators, each under a folder named after their own user id, so one operator cannot overwrite or delete another's photos. Size and type are capped on the bucket itself — the check in the browser is a courtesy, not the control.

### Added
| Item | Why |
|---|---|
| `operator_applications` — one row per account that asked to operate, with `requested_at`, the decision, who made it and the reason | `user_id` is unique, which is what makes the sign-up insert and the backfill idempotent. Two check constraints keep the row honest: a pending row carries no decision, and a rejection must carry a note, because a refusal the applicant cannot read a reason for is not a decision. |
| `review_operator_application(_user_id, _approve, _note)` | SECURITY DEFINER for the same reason `create_booking` is: it is the single path, and it stamps the application and inserts into `user_roles` as one unit, so an approved application and a granted role cannot drift apart. The admin check is explicit and first. Refuses a rejection without a reason, and refuses to re-decide an application that was already decided. |
| `/admin`, behind `RoleRoute allow={['admin']}` — tabs for **Operators**, **Bookings** and **Ride requests** | The applications tab splits waiting (oldest first, so the longest wait is at the top) from approved and rejected, with approve and a reject dialog. The other two are read-only tables of every booking and every ride request, newest first. |
| `src/lib/operatorApplications.ts` — `rejectionNoteError`, `groupApplications`, `accountLabel`, `daysWaiting` (+9 tests) | `rejectionNoteError` mirrors the `decision_note` constraint and the RPC's refusal, so the form says no before the round trip does. `accountLabel` falls back to a short id, because a display name is nullable. |
| `useOperatorApplications`, `useMyOperatorApplication`, `useReviewOperatorApplication`, `useAllBookings`, `useAllRideRequests`, `useProfileSummaries` (+2 mapper tests, suite 106 → 117) | The three admin-wide queries are gated on `isAdmin` as well as RLS, so a passenger's client never issues a query that can only come back empty. |
| **Your operator application is being reviewed** notice on the passenger home, and the same warning at sign-up | Signing up as an operator no longer grants the role, so without this the applicant lands on a passenger view with no explanation. A rejected applicant is shown the recorded reason. |
| 11 RLS assertions for the new table and the admin booking read | An applicant cannot approve themselves (no UPDATE policy — asserted as a zero-row no-op, which is what Postgres does), cannot insert their own `user_roles` row, and cannot call the RPC; an operator is not an admin; an admin sees every booking and its stops where an operator sees neither. |
| `supabase/migrations/20261002041042_vehicle_images_storage.sql` — the `vehicle-images` bucket (public, 5 MB, JPEG/PNG/WebP/AVIF) and four policies on `storage.objects` | Public SELECT; INSERT/UPDATE/DELETE only for a caller who holds the `operator` role and only where the first path segment is their own `auth.uid()`. UPDATE carries the same test in `WITH CHECK` as in `USING`, so an operator cannot move an object into their own folder to claim it. |
| `src/lib/vehicleImage.ts` — bucket name, limits, `imageFileError`, `slugifyFileName`, `vehicleImagePath`, `storagePathFromPublicUrl`, `orphanedImages` | Pure rules, so the path the policy checks and the URL parsing are testable without a session. The upload path is built from the signed-in user id, never from anything the form supplies. |
| `src/hooks/useVehicleImage.ts` — `useUploadVehicleImage` and `discardVehicleImages` | Upload returns the public URL that goes into `vehicles.image`. The discard is best-effort and silent: a leftover object is not worth an error toast, and URLs hosted elsewhere are never touched. |
| `src/components/operator/VehicleImageField.tsx` | Pick, preview, replace, remove — with the accepted formats and size limit stated next to the button rather than discovered by a rejected upload. |
| `src/lib/__tests__/vehicleImage.test.ts` — 16 cases | The limits match the bucket, the extension follows the real MIME type and not the name the operator gave, a re-upload of the same filename cannot collide, and a third-party URL is never offered up for deletion. |
| Storage assertions in `supabase/tests/20_rls.sql`, and a `storage` schema in `supabase/tests/00_shim.sql` | The new policies are only as good as the replay that exercises them: an operator writes under their own prefix and nowhere else, a passenger cannot write at all even under their own id, an operator cannot create a bucket, operator B can read A's photo but deleting or renaming it moves zero rows, and anon can read. |

### Removed
| Item | Why |
|---|---|
| `console.log('Opening booking modal for vehicle:', …)` in `src/components/customer/VehicleCard.tsx` | The debug log the issue asks to clear. `src/hooks/useBookingCalculator.ts`, which the issue names, no longer exists — pricing moved into Postgres, and the hook went with it. |
| The "Image URL (optional)" text field and its `z.string().url()` rule | Replaced by the upload. A pasted link cannot be size- or type-checked, cannot be kept alive, and was the only field in the form whose value the app did not control. |

### Changed
| Item | Why |
|---|---|
| `handle_new_user` inserts `customer` always, and files an application when 'operator' was claimed | `raw_user_meta_data` is client-supplied and was already untrusted input — it stopped granting 'admin' in September and no longer grants 'operator' either. The customer role goes in regardless of what was claimed so the account is immediately usable while it waits. |
| `bookings_select` and `booking_stops_select` gained an admin branch | Required for "see all bookings". Both policies are recreated whole so the end state reads in one place; everything else is unchanged from 20260917120000. |
| `supabase/tests/10_seed.sql` grants `operator` to both test operators out of band, approves their applications, and adds one account still waiting | The seed relied on `handle_new_user` granting the role from metadata, which was the behaviour this change removes. Operators A and B are approved so the pending list contains only the account that is genuinely waiting. |
| Header shows an **Admin** link to admins, on desktop and in the mobile sheet | `/admin` is otherwise only reachable by typing the URL. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 117/117 · `npm run build` OK · **database suite green locally**: all 20 migrations replayed from an empty Postgres 16, seed and every RLS assertion passed (`scripts/test-db.sh`).

### Not changed (deliberately)
- **Existing operators keep working.** The migration backfills an approved application for every account that already holds the `operator` role, noting in `decision_note` that it predates approval rather than inventing an approver. The pending list therefore starts empty and nobody loses work they already have.
- **The first admin is still a manual grant.** Nothing in the product can create an admin — by design, since `handle_new_user` refuses the claim. Granting it is one `insert into public.user_roles`, now written down in the README. On a project with no admin row, operator applications will queue until someone runs it; that is the one deployment step this change adds.
- **No revoke path.** An application moves `pending → approved | rejected` and no further, so an approved operator cannot be demoted from this screen. Suspending a live operator has to deal with their routes, fares and rides in flight, which is its own piece of work.
- **A passenger cannot apply later.** Applications are filed at sign-up only; there is deliberately no INSERT policy on the table, so nothing can be written from a client. "Become an operator" from an existing passenger account is a separate change.
- **The admin tabs are read-only.** No cancelling a booking or redispatching a ride from `/admin`; the policies allow an admin to do both, but acting on another operator's work needs its own audit trail, as fare corrections got in #57.
| `VehicleManagement` holds `image` in state (like `features`) rather than in the form schema | The value now comes from an upload, not from typing, so it is not something the resolver validates. |
| Closing the vehicle dialog cleans up | Photos uploaded during the edit that the saved row does not reference — a replacement, or an upload then Cancel — are deleted from the bucket, as is the photo a saved vehicle has moved off. Deleting a vehicle deletes its photo. Without this, every replaced photo would stay in the bucket forever with no screen that could find it. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` **177/177** (16 of them new here) · `npm run build` OK · migration replay + RLS suite green against a throwaway `postgres:16`: 22 migrations applied from an empty database, every assertion passed, and the bucket row and all four policies verified present afterwards.

### Not changed (deliberately)
- **`src/integrations/supabase/types.ts` is untouched.** The generated types cover the `public` schema; this change adds no table, column or function there — Storage is reached through `supabase.storage`, which is typed by the client library.
- **No image resizing or transformation.** Supabase's image transformation is a paid add-on; the 5 MB cap keeps the listing usable without it. Worth revisiting if operators start uploading phone-camera originals.
- **Existing third-party image URLs are left as they are.** They still render, and the field lets an operator replace one with an upload when they next edit the vehicle. Nothing deletes a URL this app does not host.
- Noticed while in the file, left alone: the operator fleet card prints `${v.pricePerHour}` with a hard-coded `$` instead of `formatMoney`, and the availability badge only renders when a vehicle has a photo. Neither is this issue.

---

## 2026-09-30 — #32 Operator: block Complete on unpaid prepay; mark cash collected
branch `routine/issue-32` → `Dev` · closes #32 · migration `20260930041122_block_complete_on_unpaid_prepay.sql`

**Why:** completing a ride is what tells the operator the fare is earned, and there is no refund or chase-up path in the product — so a **prepay** row that reached `completed` while `payment_status` was still `pending` was a fare nobody would ever collect, and nothing anywhere refused it. The mirror of that rule is **cash**: it is handed over on board, so completing is precisely the moment the money is recorded. `dispatch_ride_request()` already did the cash half for ride requests, but bookings had neither half and the operator UPDATE policy on `bookings` lets the vehicle's owner write any status they like. Both rules now live in a trigger on both tables, so a raw PostgREST `UPDATE` obeys them too — not only the RPC and not only the UI.

### Added
| Item | Why |
|---|---|
| `settle_payment_on_complete()` + `trg_bookings_settle_payment` / `trg_ride_requests_settle_payment` (BEFORE UPDATE) | One function, two tables, keyed off `tg_table_name` for the wording. Refuses the transition into `completed` when `payment_method = 'prepay'` and `payment_status <> 'paid'`; sets `payment_status = 'paid'` on completing a cash row. Only the transition matters, so re-saving an already-completed row re-runs neither rule. Both fire after the per-table customer guard (trigger order is alphabetical, `s` follows `g`), so the guard still judges the caller's own diff rather than the `payment_status` this one writes. |
| `src/lib/settlement.ts` — `isPrepayUnpaid`, `collectsCashOnComplete`, `completeBlockedReason`, `completeBlockedHint`, `cashCollectedPrompt` (+14 tests, suite 106 → 120) | The refusal text is copied from the SQL exception, so a stale page and the database give the operator the same answer instead of two different ones. |
| `CompleteRideButton` — shared by the passenger queue and booking management | Disabled with the reason as its title and an `awaiting payment` hint beside it when prepay is unpaid; otherwise a **Cash collected?** dialog naming the amount, whose action reads **Cash collected · Complete**. The operator is asserting they hold the money, because completing records it. |

### Changed
| Item | Why |
|---|---|
| `PassengerQueue` and `BookingManagement` **Complete** buttons → `CompleteRideButton` | Both surfaces had a bare Complete that fired immediately. Bookings had no payment gating of any kind. |
| `README.md` — feature-table row, and a paragraph under **Payments** | The two rules are now part of what the platform promises, and the paragraph says which function enforces them. |

### Verification
`npm ci --legacy-peer-deps` OK · `npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 120/120 (12 files) · `npm run build` OK.

Also replayed all 18 migrations from an empty Postgres 16 against a Supabase shim, then asserted the behaviour directly: an unpaid prepay booking and an unpaid prepay ride are both refused (through a raw `UPDATE` *and* through `dispatch_ride_request`); the same rows complete once paid; completing a cash booking and a cash ride sets `payment_status = 'paid'`; cancelling an unpaid prepay row still works and leaves `payment_status` alone; and re-saving a completed row is a no-op for both rules. Eight assertions, all passed. The scratch cluster was local only — no migration, shim or script is committed here, since CI's `database` job is #41's work.

### Not changed (deliberately)
- **No `types.ts` change.** The trigger function is revoked from `anon`/`authenticated` and exposes no new table, column or RPC, so the hand-written types are already correct.
- **Admins and `service_role` are not exempt.** The money either arrived or it did not, and neither role can make it arrive by asking. To close an unpaid prepay row: cancel it, or mark the payment paid first — which for a real payment is the webhook's job.
- **A prepay row that is `not_required` is treated as unpaid, not waived.** On a prepay row that value is a data fault; reading it as a waiver would turn the fault into a free ride.
- **No operator-side "mark prepay as paid".** Letting an operator declare a provider payment received is exactly the hole this closes. The passenger's own way to pay is #31.
- **No `Complete` for a prepay booking whose passenger never pays.** The operator's only exit is Cancel. A partial-settlement or write-off path is a real gap but it is an owner decision, not this issue.

---

## 2026-09-29 — #31 Passenger: "Pay now" for pending prepay rides and bookings
branch `routine/issue-31` → `Dev` · closes #31 · no migration (the SQL and both Edge Functions landed with #30)

**Why:** the server half of prepay has been finished since #30 — `create-checkout-session` reads the amount from the row, `payment-webhook` flips `payment_status` — but a passenger who chose **pay in advance** had no way to reach it. The ride sat `prepay · pending` forever. This is the passenger's half: a **Pay now** button on anything that still owes money, and honest handling of the page they land back on. The client still never names a price; it posts only what it wants to pay for.

### Added
| Item | Why |
|---|---|
| `src/lib/payments.ts` — `canPayNow`, `payNowLabel`, `readPaymentReturn`, `stripPaymentReturn`, `paymentReturnMessage`, `checkoutErrorMessage` (+13 tests, suite 106 → 119) | `canPayNow` mirrors `start_payment()`'s refusals exactly — prepay, `pending`, an amount above zero, not cancelled — so the button is never shown for something the RPC would reject. The return URL is parsed here, not in a component, because providers disagree about its shape (Paystack sends `reference` *and* `trxref`). |
| `src/hooks/usePayments.ts` — `useStartCheckout`, `usePaymentByReference`, `usePaymentReturn` | `useStartCheckout` posts `{ targetType, targetId }` and nothing else; the amount and the provider stay server-side. `usePaymentByReference` resolves a reference against the passenger's **own** rows (RLS, plus an explicit `customer_id` filter) and re-checks five times over ~12 s, because the webhook can land after the redirect. |
| `PayNowButton` on every unpaid prepay ride and fleet booking in **My rides** | The label carries the amount (`formatMoney`, the row's own currency) so the passenger sees the figure before leaving the app, and the spinner stays up through the redirect. A failure surfaces the Edge Function's own message ("This booking is already paid"), not an HTTP code. |
| Return-URL handling in `CustomerView`: toast, tab switch to **My rides**, refetch | The passenger comes back to the ride they just paid for rather than the map. Paid → success toast and both lists refetch. |
| README: **Pay now** in the feature table, and what `PAYMENT_CALLBACK_URL` has to point at | The callback must land on the passenger home page, because that is where the reference is read. Getting it wrong is silent otherwise. |

### Changed
| Item | Why |
|---|---|
| Reported URLs are stripped of query string, hash and credentials | **Privacy.** Supabase recovery links carry `access_token` in the hash, and `/reset-password` is a page that can crash. A crash report is not a place to leak a session token. Only the path, the error and the component stack are sent; no user id, email or mobile number. |
| At most 20 events per page load, and the same error from the same frame only once | A render loop would otherwise send thousands of identical events. Dedupe is on message plus the first stack frame. |
| Every send failure is swallowed (`fetch` is fire-and-forget with `keepalive`) | A reporter that throws into the page it is reporting on is worse than no reporter. `keepalive` so the last event still leaves a tab that is closing. |

### Verification
`npm ci --legacy-peer-deps` OK · `npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` **128/128** · `npm run build` OK (bundle unchanged at 1,039.13 kB / 304 kB gzip — no dependency added).

### Not changed (deliberately)
- **No `@sentry/react` dependency.** The SDK adds roughly 30–40 kB gzipped to the initial bundle for session replay, tracing and breadcrumbs we are not using, while #35 is actively trying to get initial JS under 300 kB. The envelope endpoint is Sentry's documented public ingest API; events land in the same project, with stack frames and mechanism. If breadcrumbs or tracing are wanted later, swapping `reportError` for the SDK touches one module.
- **No per-route boundaries.** One top-level boundary was what the issue asked for. Per-route boundaries would keep the header and navigation alive around a broken panel, which is nicer but a separate change.
- `console.error` in `src/pages/NotFound.tsx` and `src/context/AuthContext.tsx` left alone — a 404 and a failed role load are handled conditions that log deliberately, not the debug noise the issue is about.
- **No user context on events.** Attaching the signed-in user id would make triage easier and is a privacy decision for the owner, not a side effect of this issue.
| `CustomerView`'s tabs are now controlled (`value`/`onValueChange`) instead of `defaultValue` | The only way to open **My rides** on a payment return without remounting the panel. |
| The ride and booking cards' single action button became a `flex-wrap` row | **Pay now** and **Cancel** can both apply to the same ride; they wrap on a phone instead of overflowing. |
| The payment keys are stripped from the address bar with `history.replaceState` as soon as they are read | A refresh would otherwise replay the toast, and the reference would sit in the URL bar and in the browser history. |

### Verification
`npm ci --legacy-peer-deps` · `npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 119/119 (12 files) · `npm run build` OK.

### Not changed (deliberately)
- **No SQL, and no `types.ts` edit.** No new table, column or function: `start_payment`, `mark_payment_paid` and the provider-reference columns all exist from #30, and the hand-written types already cover them.
- **The provider is still chosen server-side** from the `PAYMENT_PROVIDER` secret, not per operator. The issue's comment suggests reading `payment_provider` from `operator_settings`, but that column does not exist and adding it is the per-operator-provider decision in #29 (owner's call, plus #45 for the second adapter). The Edge Function echoes `provider` back, so a per-operator choice later changes no client code.
- **A cancelled checkout and a webhook still in flight are reported the same way**, because the browser genuinely cannot tell them apart: Paystack returns the passenger to the same URL either way, and verifying the transaction means a server call. The message is true of both and invites another attempt. An explicit `?payment=cancelled` is honoured for a future adapter that sends one.
- **No "Pay now" on a prepay ride with no fare yet** (`total_price` null — the route had no fare configured). The RPC refuses it and tells them to pay the driver, which the card already says.
- **No receipt, and no refund.** Both belong with #32 and a provider refund call.

---

## 2026-09-28 — #41 Database tests: migration replay + RLS rules in CI
branch `test/rls-db-tests` → `Dev` · closes #41 · migration `20260928170000_fix_fare_adjustment_insert_policy.sql`

**Why:** the security model is the part of this app that has actually broken — twice. Both times a person found it by reading the SQL. Nothing verified that a passenger cannot read another passenger's ride, or set their own price, or that an operator is confined to their own routes. These rules now run on every pull request.

### Added
| Item | Why |
|---|---|
| `supabase/tests/00_shim.sql` — the roles, `auth` schema, `auth.uid()`, Realtime publication and **default privileges** a Supabase project provides | Lets the real migration files run unmodified against a bare Postgres. The default privileges matter: Supabase grants the API roles broad table access and relies on RLS plus explicit `REVOKE`s, so without them the tests would exercise a stricter grant surface than production has. |
| `supabase/tests/10_seed.sql` — two operators, two passengers, an admin, a route with stops and a fare | Users go in through `auth.users` so `handle_new_user` assigns roles exactly as a real sign-up does. Operator B exists so "not mine" is a real row, not an empty table. |
| `supabase/tests/20_rls.sql` — **25 refusal assertions plus positive controls** | Passenger isolation (rides, profiles, the aggregated queue); cancel-only for passengers; the money columns are immutable to them; rides and bookings only through their RPCs; `create_booking` prices itself; operators scoped to their own routes, fares and requests; the dispatch state machine; fare corrections recorded and unforgeable; `has_role` does not reveal who the admins are; anonymous readers see nothing; admins see across operators. |
| `tests.denied(stmt)` helper | Insists a statement failed **for a policy or guard reason** (42501 / P0001 / 23514 / 23505). A typo in a test raises `undefined_column` and fails loudly rather than looking like a pass — a test that passes for the wrong reason is worse than no test. |
| `scripts/test-db.sh` and a `database` CI job on a `postgres:16` service | Applies the shim, then **every migration in filename order**, then the seed and tests. The replay is itself a test: the migration chain has to build the schema from nothing on every PR. |

### Fixed
| Item | Why |
|---|---|
| An operator could not correct the fare on a request nobody had confirmed yet (`20260928170000`) | **Found by these tests.** The INSERT policy on `ride_request_fare_adjustments` required `ride_requests.operator_id` to be the caller, but `dispatch_ride_request` writes that row once, at the end — so during the audit insert it is still NULL for an `awaiting` request, and the whole correction failed with "new row violates row-level security policy". That is the common case: an association increase is applied to rides that are still waiting. The policy now matches who may dispatch the request — the operator who has taken it, or the operator whose route it is. Shipped yesterday in #57; live for about a day. |

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 106/106 · `npm run build` OK · **`database` job green**: 17 migrations replayed from an empty database and all RLS assertions passed ([run 36447927622](https://github.com/vianneyKB/shuttle-sprite/actions/runs/36447927622)).

### Not changed (deliberately)
- **Plain plpgsql `ASSERT`, not pgTAP** as the issue title suggested. pgTAP needs an extension installed in the test database for no gain here; `ASSERT` fails with the assertion text and needs nothing. Noted so the deviation is explicit.
- One case is asserted as a **no-op rather than a refusal**: an UPDATE whose `USING` clause hides the row changes zero rows instead of raising. That is correct Postgres behaviour and safe; the test asserts `row_count = 0` rather than pretending an error occurs.
- Storage policies, Edge Function auth and the payment RPCs' own rules are not covered here — the Edge Functions have their own unit tests, and #40 (Playwright) covers the flows end to end.

---

## 2026-09-28 — #57 Operator can correct the fare on a ride request (audited)
branch `feat/fare-adjustments` → `Dev` · closes #57 · migration `20260928150000_ride_request_fare_adjustments.sql`

**Why:** fares are quoted and snapshotted when a request is created (#56), which is right — but operations need a correction path: an association increase that landed this morning, a discount, a mistake. What they must not have is a silent edit, because the passenger was shown a price. Every correction is now recorded, attributable and visible to the passenger.

### Added
| Item | Why |
|---|---|
| `ride_request_fare_adjustments` — old/new fare per seat, old/new total, currency, who, when, reason (3–500 chars) | Append-only: there is a SELECT and an INSERT policy and deliberately no UPDATE or DELETE, so the history cannot be rewritten. The passenger sees corrections to their own ride; the operator sees the ones on requests they already see. |
| `dispatch_ride_request` gains `_fare_per_seat` and `_fare_reason` | The fare moves through the same function as every other operator action, so the same ownership and "taken by another operator" checks apply. Recomputes subtotal and tax from the request's own snapshotted rate and currency, honouring the operator's tax-inclusive setting. Refused once the ride is completed, cancelled, **or paid for**, and refused without a reason. |
| **Adjust fare** on each queue row → dialog with a live preview of the new total, the reason field, and the correction history | The operator sees the exact number the database will store before committing to it. |
| **Fare adjusted** note on the passenger's ride card: old total struck through, new total, and the reason | The passenger was quoted a price; they are told when and why it changed. |
| `src/lib/fareAdjust.ts` — `previewFare`, `canAdjustFare`, `fareChangeError` (+10 tests, suite 86 → 96) | The arithmetic mirrors the SQL exactly, so the preview and the stored amount cannot disagree; the validation messages match the RPC's errors for the same reason. |

### Fixed
| Item | Why |
|---|---|
| `ride_requests_guard_customer_update` now also freezes `fare_per_seat`, `subtotal`, `tax_rate`, `tax_amount`, `total_price`, `currency` and the stop ids | **Security.** The guard was written in September before fares existed, so it froze payment and ownership columns but not the money ones — and the customer UPDATE policy lets a passenger edit their own request while it is `awaiting`. Since #56 that meant a passenger could set their own `total_price` to 0. Found while adding the correction path. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 96/96 · `npm run build` OK.

### Not changed (deliberately)
- **No refund path.** A ride already paid for cannot be re-priced at all; that needs the payments work (#31/#32) and a provider refund call.
- The INSERT policy lets an operator write an audit row for their own request, so a determined operator could log a misleading old value. Closing that means moving the write into a `SECURITY DEFINER` helper, which would cost the RLS gating `dispatch_ride_request` currently gets for free. The record exists to inform the passenger and the platform, not to defend against the operator who already sets the price.
- No notification beyond the card and the existing Realtime refresh — a push/SMS on a fare change belongs with #37.

---

## 2026-09-28 — Repair: change-log entries lost and interleaved by branch merges

**Why:** five routine branches each inserted their entry at the top of this file. Git merged those inserts by interleaving one pair and dropping three outright, so the log — the thing that is meant to explain what changed — was the least reliable document in the repo.

### Fixed
| Item | Why |
|---|---|
| #30 and #25 de-interleaved into two entries | Their headings, tables and verification lines had been spliced together: #30's Added rows sat under #25's heading, and #25's Changed rows sat under #30's "Not changed" list. Recovered by line range from the tangled block; no wording invented. |
| #33, #26 and #28 entries restored | They were absent entirely. Recovered verbatim from the diffs of commits `a2803c6`, `5dfd275` and `9323f59`. |
| All five re-ordered newest-first with one `---` between them | Matches the rest of the file. |

### Not changed (deliberately)
- No code, tests or migrations touched — documentation only.
- The routine's prompt is being amended separately so new entries are appended at a fixed anchor instead of racing for the top of the file.

---

## 2026-09-25 — #33 Profile page (display name, phone)
branch `routine/issue-33` → `Dev` · closes #33 · no migration (the columns and `profiles_update` RLS already exist)

**Why:** `profiles` has held `display_name` and `phone` since the first migration, but nothing in the app could edit them — a passenger whose number changed, or who signed in with Google and never had one, had no way to fix it, and every booking needs a phone number. This adds the missing page and makes one phone rule serve sign-up, the profile page and the ride sheet.

### Added
| Item | Why |
|---|---|
| `/profile` page (protected): full name, mobile number, read-only email | The form resets to the stored row once it loads, so **Save changes** stays disabled until something actually differs. |
| **Profile** link in the header — icon button on desktop, an entry in the mobile menu | The page needs a way in on a phone, where the header collapses to a sheet. |
| `src/lib/profile.ts` — `PHONE_PATTERN`, `isValidPhone`, `profileFormSchema`, `profileChanges` | `profileChanges` returns only the fields that differ: `profiles` has an `updated_at` trigger, so an untouched Save would otherwise still write a row. |
| 10 tests for the above (suite 29 → 39) | Pins the number formats a South African passenger actually types, and that whitespace-only edits count as no change. |

### Changed
| Item | Why |
|---|---|
| Sign-up and the ride sheet now use `PHONE_PATTERN` / `isValidPhone` instead of their own copies of the same regex | Three places validated the same thing; the profile page would have been a fourth. |
| Request-a-ride sheet shows the number the driver will call when the profile has one | The sheet only asks for a number when it is missing (2026-09-18), so the passenger could not see which one was on file. |
| Header: on `/profile` neither Passenger nor Operator is highlighted in the role switch | `!isOperatorRoute` made Passenger look like the current view on any non-operator page. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 39/39 · `npm run build` OK.

### Not changed (deliberately)
- `avatar_url` and `location` stay unedited: an avatar needs the Storage bucket from #34, and nothing in the app reads `location` yet.
- Email is read-only — changing it is a Supabase Auth flow (re-confirmation), not a `profiles` write.
- `BookingModal` already prefilled name / mobile / email from the profile (2026-09-18), so it is untouched here.

---

## 2026-09-24 — #30 Edge Functions: Paystack checkout + webhook (provider-abstracted)
branch `routine/issue-30` → `Dev` · closes #30 · migration `20260924041653_payment_provider_refs.sql`

**Why:** "Pay in advance" has been selectable since the first shuttle migration, but nothing ever took the money — a prepay booking just sat at `payment_status = 'pending'` forever. This is the server half: a hosted checkout the passenger is sent to, and a webhook that marks the row paid. Paystack first (per #29); the provider sits behind an adapter so Stripe (#45) is one new file, not a rewrite. Nothing here is reachable from the browser — both RPCs are `service_role` only, and the amount is always read from the row, never from the request.

### Added
| Item | Why |
|---|---|
| `bookings.payment_provider` / `.payment_ref`, same on `ride_requests`, with a unique partial index per provider | The webhook has to find exactly one row for a reference, and never guess. |
| `start_payment(user, target_type, target_id, provider, reference)` RPC | Verifies the caller owns the row and still owes money, stores the reference, and answers with the **stored** amount, currency and email. A tampered request can only ever pay the real price of something the caller owns; "not yours" and "does not exist" give the same error. |
| `mark_payment_paid(provider, reference, amount, currency, target_type, target_id)` RPC | Re-checks currency and amount against the row before flipping `payment_status = 'paid'`. Idempotent — providers retry, and a replay returns `already_paid` rather than an error. |
| `to_minor_units(amount, currency)` | Providers charge integers in the smallest unit. Mirrors `toMinorUnits()` in the Edge Functions, including the zero-decimal currencies Paystack settles in (XOF, RWF). |
| `supabase/functions/create-checkout-session` | Verifies the passenger's JWT, then calls `start_payment` as service role and returns the provider's checkout URL. Body is only `{ targetType, targetId }`. |
| `supabase/functions/payment-webhook` | Verifies HMAC-SHA512 over the **raw** body before parsing anything, then settles. `verify_jwt = false` in `config.toml`; the signature is the authentication. |
| `_shared/providers/` adapter (`PaymentProvider`, registry, Paystack), `_shared/money.ts`, `_shared/http.ts` | The seam for #45: callers name no provider, they read `PAYMENT_PROVIDER`. |
| 20 tests on the portable half — minor units, registry, checkout body, signature verification, event parsing (suite now 49) | Run by the normal `npm test`; only the Deno entry points need Deno. |
| README **Payments (Edge Functions)** section | Names the three secrets and the `supabase secrets set` / webhook-URL steps the owner still has to do. |

### Changed
| Item | Why |
|---|---|
| `bookings_guard_customer_update` and `ride_requests_guard_customer_update` now also freeze `payment_provider` / `payment_ref` | The existing guards stopped a customer setting `payment_status = 'paid'`; a customer who could point `payment_ref` at someone else's paid transaction would get there anyway. |
| A late payment on an abandoned checkout is resolved from the transaction's own metadata, not just the reference | Start a checkout, abandon it, start another, then pay the first tab: the row no longer holds that reference. Money that arrived has to land somewhere, so `mark_payment_paid` falls back to the `target_type` / `target_id` the provider echoes back, and keeps the reference that was actually paid. |

### Verification
`npm run lint` 0 errors (8 pre-existing warnings) · `npm run typecheck` clean · `npm test` 49/49 · `npm run build` OK. All 17 migrations were also applied in order to a throwaway Postgres 16 with an `auth` shim, and the RPCs exercised there: amount and currency mismatches refused, wrong owner refused, replay idempotent, metadata fallback lands, duplicate reference rejected by the index, `authenticated` denied on all three functions, and the guard triggers confirmed against a real `authenticated` role.

### Not changed (deliberately)
- **No UI.** "Pay now" on a pending prepay ride or booking is #31; blocking Complete on unpaid prepay is #32. Nothing in the app calls these functions yet.
- Stripe is #45 — the registry has the slot and the `payment_provider` check accepts `'stripe'`, but there is no adapter.
- No refunds, no partial payments, and no `payments` ledger table; an overpayment is accepted, an underpayment is refused.
- Needs the owner before it can be tested end to end: `PAYSTACK_SECRET_KEY` and `PAYMENT_CALLBACK_URL` as Edge Function secrets, and the webhook URL registered in the Paystack dashboard.

---

## 2026-09-23 — #28 Toggle is_active from the route card
branch `routine/issue-28` → `Dev` · closes #28 · no migration

**Why:** every route an operator created went straight onto the passenger map and could only be taken off it by deleting it — losing its stops and its fare history. A route is seasonal, suspended or still being built more often than it is permanently gone, so the card now carries the `is_active` flag the schema and `useShuttleRoutes` already respect.

### Added
| Item | Why |
|---|---|
| **Active / Inactive** switch on each route card, with an `Inactive` badge and "hidden from the passenger map" on the stop line | The flag existed in the database from day one with no way to reach it. The wording says what the switch does rather than naming the column. |
| `useSetRouteActive` — writes `is_active` alone | Leaves the stops and the RPC-rebuilt LineString untouched; the existing `shuttle_routes_update` RLS policy already limits an operator to their own routes, so no new SQL. |
| `buildRoutePayload(operatorId, input)` extracted from `useUpsertRoute`, plus 3 tests (suite 29 → 32) | The default-visible rule and the flag's round trip are now pure and tested. |

### Changed
| Item | Why |
|---|---|
| The edit dialog sends the route's current `isActive` | `useUpsertRoute` defaults the flag to `true`, so saving an edit to a hidden route used to put it back on the map. Mirrors how `VehicleManagement` passes `available`. |
| Only the switch being saved is disabled while the write is in flight (`setActive.variables?.id`) | One slow request shouldn't freeze the toggle on every other card. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 32/32 · `npm run build` OK.

### Not changed (deliberately)
- No confirmation step when hiding a route with rides already booked on it — worth a look once dispatch settles, but nothing is cancelled by the switch.
- #27 (polyline preview in the route editor) is still open: it needs the editor map from #25, which is unmerged in PR #65.

---

## 2026-09-22 — #26 Reverse-geocode stop names (Nominatim)
branch `routine/issue-26` → `Dev` · closes #26 · no migration

**Why:** an operator building a route had to type every stop name by hand next to a pair of coordinates. Once a stop has a position, OpenStreetMap already knows what is there — prefill the name and let the operator correct it. Nominatim is free but rate-limited (1 req/s) and asks callers to identify themselves, so the cap belongs in one place in the app, not in each caller.

### Added
| Item | Why |
|---|---|
| `src/lib/geocode.ts`: `buildReverseUrl`, `stopNameFromReverse`, `reverseGeocode`, `roundCoord`, `isValidLatLng` | One serial queue holds the **whole app** to 1 request/second, whatever the UI does. `stopNameFromReverse` picks a stop-sized name (`name`/amenity/building/road, qualified by suburb or town) and returns `""` when nothing is usable, so a blank answer never overwrites a real name. Coordinates round to ~1 m for a stable cache key. |
| `useReverseGeocode(coords, enabled)` hook | 800 ms debounce (dragging or typing a coordinate makes one request), TanStack Query cache per rounded coordinate, `retry: false`. |
| Route editor: name prefilled once a stop is positioned, plus a **Name from map** button and a "Finding a name…" hint | Auto-fill only when the operator hasn't typed a name; the button re-looks-up on demand and overwrites. Typing in the name field stops auto-fill for that stop. |
| `VITE_NOMINATIM_EMAIL` / `VITE_NOMINATIM_URL` (both optional), typed in `vite-env.d.ts` and documented in `.env.example` + README | The policy wants a contact address; the URL lets a busier deployment point at its own instance. |
| 14 tests in `src/lib/__tests__/geocode.test.ts` (suite now 43) | URL shape, name mapping and fallbacks, and that a second lookup cannot leave inside the 1 s window. |

### Changed
| Item | Why |
|---|---|
| `RouteManagement`: stop rows extracted into a `StopFields` child; parent exposes stable `patchStop` / `removeStop` callbacks | A stop row now owns a hook, so it has to be a component. Stable callbacks keep the auto-fill effect from re-running on every keystroke. Lat/lng/name inputs gained `aria-label`s. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 43/43 · `npm run build` OK.

### Not changed (deliberately)
- **Nothing blocks on geocoding.** A failed or empty lookup is silent; the name field is plain text and Save is unaffected.
- `User-Agent` and `Referer` cannot be set from browser `fetch` (forbidden header names). The browser sends `Referer` itself, which identifies the deployment; `VITE_NOMINATIM_EMAIL` adds the contact address.
- Forward search ("type a place, drop a pin") is not part of this issue.
- Clicking the map to place a stop is #25 (open in PR #65); this works off whatever sets a stop's coordinates, so it applies there too once merged.

---

## 2026-09-21 — #25 Route editor: click-to-add and drag-to-move stops on the map
branch `routine/issue-25` → `Dev` · closes #25 · no migration (UI only; stops still save through `save_route_stops`)

**Why:** creating a route meant typing raw decimal degrees into two number boxes per stop. Nobody knows their taxi rank's latitude, so operators were pasting coordinates out of another map app, one stop at a time, with no way to see whether the result was in the right order — or the right city. The map the passengers already look at is the natural place to draw the route.

### Added
| Item | Why |
|---|---|
| `RouteStopsMap` in the route dialog: click the map to append a stop, drag a pin to move it (`dragend` writes back lat/lng) | Placing a stop is now pointing at it. Same OSM tiles and `@/lib/leaflet` setup as the public map. |
| Numbered, draggable pins; the selected stop's pin and list card are highlighted together | Pickup order is the thing an operator gets wrong; the number on the pin shows it on the map, not just in the list. |
| Up / down buttons per stop, and a delete on every stop | Reordering was impossible before — the only fix was retyping the coordinates. Drag-and-drop reordering deliberately left out (up/down works on a phone). |
| `src/lib/routeStops.ts` (+9 tests, suite now 39): `moveStop`, `clampLat`, `wrapLng`, `toCoord`, `normalizePoint`, `nextStopSeed`, `stopBounds`, `formatCoord` | The ordering and coordinate rules are pure, so they are tested without a DOM. `clampLat`/`wrapLng` keep a pin dragged past a pole or the date line on the map; `toCoord` keeps the previous value when the number input is cleared (it used to become `0`, i.e. the Gulf of Guinea). |

### Changed
| Item | Why |
|---|---|
| The lat/lng inputs moved into a collapsible **Precise coordinates** section per stop, with the current pair shown on the trigger | Still there for a surveyed or pasted coordinate, no longer the primary way in. |
| A new route starts with **no** stops instead of two prefilled at the Johannesburg default | Two pins stacked on the same default point read as one stop in the wrong place. The dialog now says "click the map to place the first one"; the existing "at least 2 named stops" check still guards Save. |
| The map fits the existing stops once when the dialog opens (after `invalidateSize`, since the dialog is still animating when Leaflet measures) | Editing a route opens on that route. Refitting on every drag would yank the map away mid-edit. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 39/39 · `npm run build` OK.

### Not changed (deliberately)
- **No polyline preview** between the stops in the editor — that is #27.
- **No stop names from the map** — reverse geocoding is #26; a clicked stop still needs a name typed.
- Drag-and-drop reordering of the list (the issue marks it optional).

---

## 2026-09-18 — #56 Route fares: per-route / per-segment, per-seat, effective-dated
branch `feat/route-fares` → `Dev` · closes #56 · migration `20260918170000_route_fares.sql`

**Why:** minibus-taxi fares are fixed per route and per seat (see the taxi-bus research), changed a few times a year by operators/associations. The shuttle line had no price at all — passengers couldn't see what a ride costs, operators had nowhere to set it.

### Added
| Item | Why |
|---|---|
| `route_fares` table: whole-route rows (stops null) or one origin → destination override; `fare_per_seat`; `effective_from` / `effective_to` | Fares are **history**: an increase is a new row with a start date; amounts can't be edited (trigger), only ended early or removed before they start. Passengers already quoted keep their price. |
| `quote_ride_fare(route, from, to, passengers, at)` RPC | Segment fare in force at `at` → else whole-route fare → else "no fare" (ride still allowed, pay on board). Applies the operator's currency and VAT exactly like fleet bookings. |
| `create_ride_request(...)` RPC (`SECURITY DEFINER`) — now the **only** way to create a request | Validates the stops belong to the route, passengers 1–50, and `scheduled_at` ≥ now + 15 min (the server check deferred in #24); quotes; **snapshots** `fare_per_seat`, `currency`, `subtotal`, `tax_rate`, `tax_amount`, `total_price`, plus `origin/destination_stop_id`. |
| **Operator → Routes → Fares** dialog | Current fare, scheduled increases, past fares; add a whole-route or segment fare with a start date; end a fare. |
| **Request a ride**: live fare quote (seats × per-seat, tax line, total) before Submit; "pay on board" when no fare is set | Passengers see the price first. Re-quotes when destination, passengers or pickup time change. |
| **My rides** and **Queue** rows show the quoted total | Both sides see the same number. |
| `useRouteFares`, `useAddRouteFare`, `useEndRouteFare`, `useRideFareQuote`; `resolveFare()` mirrors the SQL precedence; 7 tests (suite now 29) | |

### Removed
| Item | Why |
|---|---|
| RLS policy `ride_requests_insert` and the client-side insert in `useCreateRideRequest` | Direct inserts bypassed the quote. |
| `originName/Lat/Lng`, `destinationName/Lat/Lng` from `RideRequestInput` | The RPC derives them from the stop ids; the columns stay on the table for display. |

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 29/29 · `vite build` OK. Migration runs on the Supabase preview branch for the PR.

### Not changed (deliberately)
- Correcting the fare on an existing request (audited) is #57.
- No "departs when full" seat counter yet; needs vehicle capacity per group (small follow-up once fares are in).

---

## 2026-09-18 — Fixes: map floating over the ride sheet on mobile; passengers need only name + mobile
branch `fix/mobile-map-and-passenger-signup` → `Dev` · migration `20260918150000_booking_email_optional.sql`

**Why:** owner testing on a phone found the map painting *over* the "Request a ride" sheet. Separately, the target passenger (minibus-taxi commuter) should be able to use the app with a name and a mobile number; email should not be a gate.

### Changed
| Item | Why |
|---|---|
| `RouteMap` wrapper: `relative isolate z-0` | Root cause: the wrapper set `z-0` without a stacking context, so Leaflet's internal layers (z-index 400 for tiles/markers, 1000 for controls) escaped and painted over every `z-50` overlay — ride-request sheet, booking modal, header menu, dropdowns. `isolate` contains them. Applies to the loading placeholder too. |
| **Sign-up** asks for a mobile number (required, validated) | Stored via the existing `handle_new_user` trigger into `profiles.phone`. Drivers reach passengers by phone; the number was never collected before. |
| **Fleet booking**: email optional; name / mobile / email prefilled from the profile | Passenger only types what's missing. `create_booking()` no longer rejects a blank email (stored as `''`). |
| **Request a ride**: if the profile has no mobile number, the sheet asks for one and saves it to the profile on submit | Covers accounts created before this change and OAuth sign-ins. |
| New `useMyProfile` / `useUpdateMyProfile` hooks | Shared by the two forms; the Profile page (#33) can build on them. |

### Not changed (deliberately)
- **Email + password are still the login.** Signing in with *only* a mobile number (SMS one-time code) needs an SMS provider configured in Supabase Auth — owner decision and account (see follow-up issue). Until then the number is the contact, not the identity.

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 22/22 · `vite build` OK. The map fix is CSS-only — please re-test on the phone after deploy.

---

## 2026-09-18 — #24 Ride request: "Now" or "Later" (scheduled_at)
branch `feat/schedule-for-later` → `Dev` · closes #24 · no migration (`scheduled_at` already existed)

**Why:** the column was there but nothing ever set it — every request was implicitly "right now". Commuters plan trips (early airport runs, end of shift), and operators need to see demand that is coming, not just demand that is waiting.

### Added
| Item | Why |
|---|---|
| **Now / Later** toggle in the ride request form; Later reveals a date-time picker (min = 15 min from now, rounded to 5 min) | Passengers book ahead. 15 minutes' notice is enforced client-side; the route's operating hours are shown as a hint. |
| `RideRequestInput.scheduledAt` → `ride_requests.scheduled_at` | Stored as an absolute instant (ISO/UTC); the browser handles the local-zone conversion. |
| `src/lib/schedule.ts` (+4 tests): local ⇄ input conversion, earliest-time rounding, display format | Pure helpers so the zone logic is testable. |
| **My rides** shows "scheduled for Fri 18 Sep, 15:30" on the card | Passenger sees what they booked. |
| **Queue** group cards show "3 now · next scheduled Fri 18 Sep, 15:30 (+2 more)"; rows within a group are ordered: now-requests first, then by pickup time | Operators see immediate vs upcoming demand per direction. Individual rows already showed "for <time>". |

### Not changed (deliberately)
- No server-side rejection of past `scheduled_at` values yet — the column is set via the plain INSERT policy. Worth a CHECK/trigger when a `create_ride_request` RPC lands (route fares will need one anyway).
- No reminder/notification before a scheduled pickup — that's the notifications issue (#37).

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 22/22 · `vite build` OK.

---

## 2026-09-18 — #23 My rides: status timeline and assigned vehicle
branch `routine/issue-23` → `Dev` · closes #23 · migration `20260918041011_my_ride_vehicles.sql`

**Why:** a passenger's card showed a status word and nothing else. With dispatch (#20/#21) stamping `assigned_at` / `started_at` / `completed_at` and Realtime (#22) delivering the changes, the card can show where the ride actually is and which vehicle is coming — but the passenger cannot read `public.vehicles` for it, because `vehicles_select` only exposes rows with `available = true`, so a vehicle taken off the listing mid-trip would disappear from the card.

### Added
| Item | Why |
|---|---|
| `get_my_ride_vehicles()` RPC (`SECURITY DEFINER`, `authenticated` only) | The passenger's read path for the assigned vehicle. Returns make/model/year/seats for vehicles attached to the **caller's own** ride requests only — no pricing, location or operator id — and does not depend on the `available` flag. |
| `useMyRideVehicles()` → `Map<vehicleId, AssignedVehicle>` | One call per passenger, looked up by `vehicleId` on each card. Query key is `["ride_requests","vehicles",uid]`, so the existing Realtime and dispatch invalidations of `["ride_requests"]` refresh it with no change to `useRideRequestsRealtime`. |
| `rideTimeline()` + `formatStepTime()` in `src/lib/rideTimeline.ts` | Pure mapping from a request to the four steps (Requested → Confirmed → On the way → Completed) with each step's timestamp and `done`/`current`/`upcoming` state. A cancelled ride has no place on the ladder, so how far it got is read back from the timestamps and no step is `current`. 6 new tests (suite 12 → 18). |
| `RideTimeline` component, rendered on every shuttle-request card | The timeline the issue asks for; muted for a cancelled ride, with a "This request was cancelled." line. |
| Assigned-vehicle line on the card: `Toyota Quantum (2022) · 14 seats` | Shown as soon as an operator assigns, live via Realtime. |
| `AssignedVehicle` type; `mapAssignedVehicle` mapper + 1 test | |

### Changed
| Item | Why |
|---|---|
| `src/integrations/supabase/types.ts`: `get_my_ride_vehicles` added to `Functions` | Hand-updated, as there is no CLI access to regenerate it. |

### Verification
`npm run lint` 0 errors (8 pre-existing shadcn warnings) · `npm run typecheck` clean · `npm test` 18/18 · `npm run build` OK. The migration runs on the Supabase preview branch for the PR; the live timeline needs two browsers against the real project (dispatch as operator, watch My rides as passenger).

### Not changed (deliberately)
- The toast on status change already shipped with #22 and covers what this issue asks for; left as is.
- Fleet bookings keep their existing card — the issue is about shuttle ride requests.
- No driver/operator name or contact on the card; that is passenger↔operator contact, a separate decision.

---

## 2026-09-17 — #22 Realtime for ride requests
branch `feat/realtime-ride-requests` → `Dev` · closes #22 · migration `20260917140000_realtime_ride_requests.sql`

**Why:** passengers and operators only saw a snapshot from page load. A new request, or an operator confirming one, needed a manual refresh to appear on the other side.

### Added
| Item | Why |
|---|---|
| `ride_requests` added to the `supabase_realtime` publication; `REPLICA IDENTITY FULL` | Enables `postgres_changes` subscriptions. Full replica identity lets Realtime evaluate row filters on UPDATE/DELETE. RLS still decides what each subscriber receives. |
| `useRideRequestsRealtime(scope, onChange?)` hook | One channel per user+scope; passengers filter to `customer_id=eq.<uid>`, operators rely on RLS. Invalidates `ride_requests` + `passenger_queue` queries, coalesced to one refetch per 250 ms burst (a "Confirm all" of 10 rows = 1 refetch). Cleans up on unmount; safe under StrictMode's double mount. |
| **My rides**: live refetch + a toast when an operator confirms / starts / completes / cancels the passenger's ride | The passenger learns without refreshing. |
| **Queue tab**: live refetch on any change | New requests and other operators' actions appear as they happen. |

### Verification
`npm run lint` 0 errors · `npm run typecheck` clean · `npm test` 12/12 · `vite build` OK. Migration runs on the Supabase preview branch for the PR. Realtime itself can only be exercised against the live project: open My rides as a passenger and the Queue as an operator in two browsers and confirm a request.

### Not changed (deliberately)
- Bookings are not on Realtime yet; the issue scoped ride requests. Same hook pattern applies if wanted.
- Status timeline and assigned-vehicle display in My rides remain #23.

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
