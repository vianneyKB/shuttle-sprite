#!/usr/bin/env bash
# Creates the completion-plan issues in vianneyKB/shuttle-sprite.
# One-time use. Requires: gh auth login (done once, interactively).
#
#   bash scripts/create-issues.sh
#
# Safe to re-run: labels are created with --force, and issues whose exact title
# already exists are skipped.
set -euo pipefail

REPO="vianneyKB/shuttle-sprite"

label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null; }

label "phase-0:stabilise"  "6e7781" "Lint, CI, deploy, migrations, test harness"
label "phase-1:security"   "b60205" "Move trust into the database (RLS, RPCs)"
label "phase-2:dispatch"   "1d76db" "Close the ride-request operational loop"
label "phase-3:routes"     "0e8a16" "Map-based route authoring"
label "phase-4:payments"   "fbca04" "Prepay collection and cash confirmation"
label "phase-5:polish"     "c5def5" "Profile, uploads, code-splitting, notifications, admin"
label "phase-6:testing"    "5319e7" "Unit, E2E and RLS verification"
label "security"           "b60205" "Security finding"

existing="$(gh issue list --repo "$REPO" --state all --limit 500 --json title --jq '.[].title')"

issue() {
  local title="$1" labels="$2" body="$3"
  if grep -Fxq "$title" <<<"$existing"; then
    echo "skip   $title"
    return
  fi
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --body "$body" >/dev/null
  echo "create $title"
}

# ───────────────────────── Phase 0 (done on Dev in d120965) ─────────────────────────
issue "Phase 0: Stabilise build, CI, deploy and test harness" "phase-0:stabilise" \
"Tracking issue. Completed on the \`Dev\` branch in commit d120965:

- [x] Fix all ESLint errors; \`npm run lint\` exits 0
- [x] Real CI workflow (lint, typecheck, test, build) — \`.github/workflows/ci.yml\`; hello-world stub removed
- [x] \`deploy.yml\` passes \`VITE_SUPABASE_URL\` / \`VITE_SUPABASE_PUBLISHABLE_KEY\` from repo secrets
- [x] \`.env.example\` committed
- [x] Duplicate June migration neutralised; repair command documented in the file
- [x] \`@types/react\` aligned to 19; unused deps and shadcn stubs removed
- [x] Vitest + Testing Library; mapper tests for bookings, routes, ride requests, vehicles

**Remaining manual step:** add the two \`VITE_SUPABASE_*\` secrets under *Settings → Secrets and variables → Actions*, then merge \`Dev\` → \`main\` to trigger a working deploy."

# ───────────────────────── Phase 1 ─────────────────────────
# Already fixed on main by PR #14 (4dbc6af): role self-assignment at signup,
# get_passenger_queue anon/role leak, missing WITH CHECK on UPDATE policies.
issue "Server-side booking creation: stop trusting client total_price" "phase-1:security,security" \
"**Finding (critical).** \`src/hooks/useBookings.ts\` calls \`calculate_booking_price\` and then the *client* inserts \`total_price\` into \`bookings\`. The INSERT policy only checks \`customer_id = auth.uid()\`, so any user can insert a booking at any price.

**Fix**
- Add a \`SECURITY DEFINER\` RPC \`create_booking(_vehicle_id, _passengers, _start_date, _time, _duration, _days_of_week, _stops jsonb, _customer_name, _customer_email, _customer_phone, _special_requests, _payment_method)\` that computes the price internally, inserts the booking and its stops in one transaction, and returns the id.
- Replace the client insert in \`useCreateBooking\` with the RPC call.
- Either drop the customer INSERT policy on \`bookings\`/\`booking_stops\` or add a trigger that recomputes \`total_price\` on insert as a belt-and-braces guard.
- Regenerate \`src/integrations/supabase/types.ts\`."

issue "Transactional save_route_stops RPC (currently delete-then-insert)" "phase-1:security" \
"\`useSaveRouteStops\` in \`src/hooks/useRoutes.ts\` deletes all stops, inserts the new set, then updates \`shuttle_routes.geometry\` — three separate requests. A failure mid-way leaves a route with no stops and stale geometry.

**Fix**
- RPC \`save_route_stops(_route_id uuid, _stops jsonb)\` that replaces stops and rebuilds the LineString in one transaction, checking \`shuttle_routes.operator_id = auth.uid()\`.
- Call it from the hook; drop the three-step client flow."

issue "Run Supabase security & performance advisors and clear findings" "phase-1:security" \
"After the Phase 1 migrations land, run the Supabase advisors (Dashboard → Advisors, or the MCP \`get_advisors\` tool) for both *security* and *performance*, and fix or explicitly accept each finding. Record accepted findings in this issue."

# ───────────────────────── Phase 2 ─────────────────────────
issue "ride_requests: add vehicle_id, operator_id, assigned_at" "phase-2:dispatch" \
"Dispatch needs to know who took a request and with what.

- Migration: \`ALTER TABLE ride_requests ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL, ADD COLUMN operator_id uuid REFERENCES auth.users(id), ADD COLUMN assigned_at timestamptz;\`
- Index on \`operator_id\`, \`vehicle_id\`.
- Update RLS so the assigned operator can read/update the request even if it drifts off their route.
- Update \`DbRideRequest\`, \`RideRequest\` types and \`mapRideRequest\` (+ test)."

issue "Operator queue: act on individual ride requests (confirm / assign / start / complete / cancel)" "phase-2:dispatch" \
"The Queue tab (\`src/components/operator/PassengerQueue.tsx\`) is view-only. \`useUpdateRideRequestStatus\` exists in \`src/hooks/useRideRequests.ts\` but is never rendered.

- Keep the origin→destination group card as the header; expand it to list the individual awaiting requests (passengers, payment method, notes, requested time).
- Per request: **Confirm** (→ confirmed, sets operator_id), **Assign vehicle** (select from \`useMyVehicles\`), **Start** (→ in_progress), **Complete**, **Cancel**.
- Bulk action on a group: confirm all + assign one vehicle.
- Needs a per-operator query for individual requests (RLS already permits operators on their routes)."

issue "Supabase Realtime for ride requests and the passenger queue" "phase-2:dispatch" \
"Both sides currently see one-shot query results.

- Passenger: subscribe to \`ride_requests\` filtered by \`customer_id = eq.<uid>\`; on change invalidate \`['ride_requests','mine']\`.
- Operator: subscribe to \`ride_requests\` (status changes) and invalidate \`['passenger_queue']\` and the per-request list.
- Enable Realtime on the table via migration (\`ALTER PUBLICATION supabase_realtime ADD TABLE ride_requests\`).
- Unsubscribe on unmount; guard against StrictMode double-subscribe."

issue "My rides: show live status transitions and assigned vehicle" "phase-2:dispatch" \
"In \`src/components/customer/MyRides.tsx\`, once Realtime lands:
- show a status timeline (awaiting → confirmed → in progress → completed)
- show the assigned vehicle (make/model, capacity) when set
- toast on status change while the tab is open"

issue "Ride request form: \"now\" vs \"schedule for later\" (scheduled_at)" "phase-2:dispatch" \
"\`ride_requests.scheduled_at\` exists but \`RideRequestModal\` never sets it.
- Add a Now / Later toggle; Later reveals a datetime input (min = now, within route operating hours if parseable).
- Pass \`scheduledAt\` through \`RideRequestInput\` → insert.
- Queue groups should show the earliest scheduled time."

# ───────────────────────── Phase 3 ─────────────────────────
issue "Route editor: click-to-add and drag-to-move stops on the map" "phase-3:routes" \
"\`src/components/operator/RouteManagement.tsx\` asks for raw lat/lng numbers per stop.
- Embed a Leaflet map in the dialog; \`useMapEvents({ click })\` appends a stop at the clicked point.
- Draggable markers update the stop's lat/lng on \`dragend\`.
- Keep the numeric inputs as a secondary, collapsible \"precise coordinates\" section.
- Reorder stops via up/down buttons (drag-and-drop optional)."

issue "Reverse-geocode stop names (Nominatim)" "phase-3:routes" \
"When a stop is placed on the map, prefill its name from Nominatim reverse geocoding (\`https://nominatim.openstreetmap.org/reverse\`).
- Respect the usage policy: 1 req/s, custom \`User-Agent\`/\`Referer\`, debounce.
- Name stays editable; never block save on geocoding."

issue "Route editor: live polyline preview" "phase-3:routes" \
"Draw the current stop order as a polyline inside the editor map so operators see the route shape before saving. Reuse the rendering logic from \`RouteMap.tsx\` (extract a \`RoutePolyline\` component)."

issue "Toggle is_active from the route card" "phase-3:routes" \
"Add an Active/Inactive switch on each route card in \`RouteManagement\`. Inactive routes disappear from the passenger map (\`useShuttleRoutes\` already filters \`is_active = true\`)."

# ───────────────────────── Phase 4 ─────────────────────────
issue "Decide payment provider (Stripe vs Paystack/Yoco)" "phase-4:payments" \
"Decision issue. Default: Stripe Checkout. If the launch market is South Africa (the map's default centre is Johannesburg), evaluate Paystack or Yoco for local card/EFT support and payouts. Record the decision and the reasons here before starting the integration issues."

issue "Edge Function: create-checkout-session + payment webhook" "phase-4:payments" \
"- \`supabase/functions/create-checkout-session\`: verifies the caller owns the booking/request, creates a provider checkout session for the stored amount, returns the URL.
- \`supabase/functions/payment-webhook\`: verifies the provider signature, sets \`payment_status = 'paid'\` on the matching booking / ride_request.
- Store provider ids (\`payment_provider\`, \`payment_ref\`) via migration.
- Secrets via \`supabase secrets set\`."

issue "Passenger: \"Pay now\" for pending prepay rides and bookings" "phase-4:payments" \
"In \`MyRides\`, show a **Pay now** button when \`paymentMethod === 'prepay' && paymentStatus === 'pending'\`; it calls \`create-checkout-session\` and redirects. Handle the return URL (success/cancel) with a toast."

issue "Operator: block Complete on unpaid prepay; mark cash collected" "phase-4:payments" \
"- Operator cannot mark a prepay ride/booking *completed* while \`payment_status = 'pending'\` (enforce in the UPDATE policy/trigger, not just the UI).
- For cash: on Complete, a \"Cash collected\" confirmation sets \`payment_status = 'paid'\`."

# ───────────────────────── Phase 5 ─────────────────────────
issue "Profile page (display name, phone)" "phase-5:polish" \
"\`profiles\` has \`display_name\`, \`phone\`, \`avatar_url\`, \`location\` but there is no UI. Bookings require a phone number that is never captured at signup.
- \`/profile\` route with a form bound to \`profiles\` (RLS already allows self-update).
- Prefill \`BookingModal\` and \`RideRequestModal\` from the profile."

issue "Vehicle image upload to Supabase Storage" "phase-5:polish" \
"Replace the \"Image URL\" field in \`VehicleManagement\` with an upload to a \`vehicle-images\` bucket (public read, operator write on own prefix). Store the public URL in \`vehicles.image\`. Add a storage policy migration."

issue "Code-split by route; target < 300 kB initial JS" "phase-5:polish" \
"Current build: one 976 kB chunk (285 kB gzip).
- \`React.lazy\` for \`/operator\` and the map panel (Leaflet is only needed there).
- Consider \`build.rolldownOptions.output.codeSplitting\` for vendor chunks.
- Add \`build.chunkSizeWarningLimit\` only after the split lands, not instead of it."

issue "Error boundary and error reporting" "phase-5:polish" \
"- Top-level React error boundary with a friendly fallback and a Reload button.
- Wire Sentry (or equivalent) with the DSN from a \`VITE_\` variable; no-op when unset.
- Remove the \`console.log\` calls in \`src/hooks/useBookingCalculator.ts\` (or delete the hook — pricing is now server-side)."

issue "Email notifications on booking confirmation and ride assignment" "phase-5:polish" \
"Send an email when a fleet booking is confirmed/declined and when a ride request is confirmed/assigned. Options: Supabase Database Webhooks → Edge Function → Resend. Template both emails; include the operator contact and the vehicle."

issue "Admin view: approve operators, see all bookings and requests" "phase-5:polish" \
"The \`admin\` role and its RLS policies already exist; there is no UI.
- \`/admin\` guarded by \`RoleRoute allow={['admin']}\`.
- Tabs: Operator applications (approve/reject → inserts \`user_roles\`), All bookings, All ride requests.
- Operator approval flow: PR #14 restricted signup to customer/operator; decide here whether operator still self-selects at signup or needs admin approval."

# ───────────────────────── Phase 6 ─────────────────────────
issue "Unit tests: pricing parity, role gating, ride request flow" "phase-6:testing" \
"Extend the Vitest suite added in Phase 0:
- \`RoleRoute\` / \`ProtectedRoute\` redirect behaviour with a mocked \`useAuth\`
- \`RideRequestModal\` submit validation (destination required, passengers ≥ 1)
- Any remaining client-side price display matches the server breakdown shape"

issue "Playwright E2E: signup → route → request → confirm → status" "phase-6:testing" \
"One end-to-end journey against a local Supabase (\`supabase start\`) or a dedicated test project:
1. operator signs up (seeded role), creates a route with two stops
2. passenger signs up, requests a ride from the map
3. operator confirms and completes it
4. passenger sees the final status in My rides
Run in CI on \`workflow_dispatch\` first; on PRs once stable."

issue "RLS tests (pgTAP): isolation and no status escalation" "phase-6:testing" \
"SQL tests run via \`supabase test db\`:
- customer A cannot select customer B's bookings / ride requests
- customer cannot update a booking to \`completed\` or change \`total_price\`
- operator cannot read requests on another operator's routes
- \`get_passenger_queue\` returns nothing for a customer"

echo "Done."
