-- Trigger functions are not reachable over PostgREST (PostgREST will not
-- expose a `returns trigger` function), but they still inherit PUBLIC
-- EXECUTE by default. Revoke it so the grant surface matches the rest of
-- the hardening in 20260906135126.
revoke all on function public.bookings_guard_customer_update() from public, anon, authenticated;
revoke all on function public.ride_requests_guard_customer_update() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
