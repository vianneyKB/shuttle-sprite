-- =========================================================
-- Fix: an operator could not correct the fare on a request they had not
--      already taken
--
-- The INSERT policy on ride_request_fare_adjustments (20260928150000)
-- required ride_requests.operator_id to be the caller. But
-- dispatch_ride_request writes the row once, at the end — so while the
-- audit row is being inserted, operator_id is still whatever it was, which
-- for an `awaiting` request nobody has confirmed is NULL. The policy
-- therefore refused the insert and the whole correction failed with "new
-- row violates row-level security policy".
--
-- That is the common case: an association fare increase is applied to
-- requests that are still waiting, before anyone confirms them.
--
-- The rule should match who may dispatch the request in the first place —
-- the operator who has taken it, or the operator whose route it is.
-- Found by the RLS tests added in #41.
-- =========================================================

drop policy if exists "fare_adjustments_insert" on public.ride_request_fare_adjustments;

create policy "fare_adjustments_insert" on public.ride_request_fare_adjustments
  for insert to authenticated
  with check (
    changed_by = (select auth.uid())
    and exists (
      select 1
      from public.ride_requests r
      left join public.shuttle_routes rt on rt.id = r.route_id
      where r.id = ride_request_fare_adjustments.ride_request_id
        and (
          r.operator_id = (select auth.uid())
          or rt.operator_id = (select auth.uid())
          or public.has_role((select auth.uid()), 'admin')
        )
    )
  );
