-- =========================================================
-- #23  My rides: the passenger sees the vehicle assigned to their ride
--
-- ride_requests.vehicle_id is set by dispatch_ride_request(), but a
-- passenger cannot read public.vehicles for it: vehicles_select only
-- exposes rows with available = true (plus the operator's own and
-- admins). An operator who marks a vehicle unavailable while it is out
-- on a trip would make it vanish from the passenger's card mid-ride.
--
-- get_my_ride_vehicles() is the read path instead: SECURITY DEFINER, but
-- it only ever returns vehicles attached to a ride request belonging to
-- the caller, and only the identifying details a passenger needs
-- (make/model/year/seats) — no pricing, location or operator id.
-- =========================================================

create or replace function public.get_my_ride_vehicles()
returns table (
  vehicle_id uuid,
  make text,
  model text,
  year int,
  capacity int
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct v.id, v.make, v.model, v.year, v.capacity
  from public.ride_requests rr
  join public.vehicles v on v.id = rr.vehicle_id
  where rr.customer_id = (select auth.uid())
$$;

comment on function public.get_my_ride_vehicles() is
  'Vehicles assigned to the calling passenger''s ride requests. Identifying details only.';

revoke all on function public.get_my_ride_vehicles() from public, anon;
grant execute on function public.get_my_ride_vehicles() to authenticated, service_role;
