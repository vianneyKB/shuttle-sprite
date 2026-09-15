-- =========================================================
-- Security hardening
--
-- 1. handle_new_user trusted a client-controlled role claim, so anyone
--    could sign up as 'admin'.
-- 2. get_passenger_queue was SECURITY DEFINER with no role check and
--    EXECUTE granted to anon, exposing every awaiting passenger's
--    origin/destination to unauthenticated callers.
-- 3. Five UPDATE policies had USING but no WITH CHECK, so passing the
--    row gate left the resulting row unconstrained.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Signup may not grant 'admin'
--
-- raw_user_meta_data is supplied by the client on signUp(), so the role
-- claim is untrusted input. Only the two self-serve roles are honoured;
-- anything else (including 'admin') falls back to 'customer'.
--
-- NOTE: 'operator' remains self-serve, matching current behaviour. If
-- operators should be verified before they can manage routes and fleet,
-- drop 'operator' from the list below and grant it from an admin flow.
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed text := new.raw_user_meta_data ->> 'role';
  v_role public.app_role;
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );

  v_role := case
    when v_claimed in ('customer', 'operator') then v_claimed::public.app_role
    else 'customer'
  end;

  insert into public.user_roles (user_id, role) values (new.id, v_role);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 2. get_passenger_queue: SECURITY DEFINER -> SECURITY INVOKER
--
-- As INVOKER the existing ride_requests RLS policies apply on their own,
-- so the function can no longer be used to read around them: operators
-- see their own routes' requests (plus unrouted ones), admins see all,
-- and a passenger only ever aggregates their own rows.
-- ---------------------------------------------------------
create or replace function public.get_passenger_queue()
returns table (
  origin_name text,
  destination_name text,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  request_count bigint,
  total_passengers bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  SELECT
    origin_name,
    destination_name,
    origin_lat,
    origin_lng,
    destination_lat,
    destination_lng,
    COUNT(*)::bigint AS request_count,
    SUM(passengers)::bigint AS total_passengers
  FROM public.ride_requests
  WHERE status = 'awaiting'
  GROUP BY origin_name, destination_name, origin_lat, origin_lng, destination_lat, destination_lng
  ORDER BY total_passengers DESC, request_count DESC;
$$;

revoke all on function public.get_passenger_queue() from public, anon;
grant execute on function public.get_passenger_queue() to authenticated, service_role;

-- ---------------------------------------------------------
-- 3a. profiles: pin the row identity on update
-- ---------------------------------------------------------
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------
-- 3b. bookings: customers may cancel, not confirm or re-own
--
-- WITH CHECK cannot see OLD, so it constrains reachable end states only;
-- the column-level guard below covers the rest.
-- ---------------------------------------------------------
drop policy if exists "Customers update their own pending bookings" on public.bookings;
create policy "Customers update their own pending bookings"
  on public.bookings for update to authenticated
  using (customer_id = auth.uid() and status = 'pending')
  with check (customer_id = auth.uid() and status in ('pending', 'cancelled'));

drop policy if exists "Operators update bookings on their vehicles" on public.bookings;
create policy "Operators update bookings on their vehicles"
  on public.bookings for update to authenticated
  using (exists (
    select 1 from public.vehicles v
    where v.id = bookings.vehicle_id and v.operator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.vehicles v
    where v.id = bookings.vehicle_id and v.operator_id = auth.uid()
  ));

-- Customers must not be able to rewrite money, payment state, the vehicle
-- or ownership on a booking they can otherwise cancel.
create or replace function public.bookings_guard_customer_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT means service_role / a server-side job, not a customer.
  if auth.uid() is null then
    return new;
  end if;

  if public.has_role(auth.uid(), 'admin')
     or exists (
       select 1 from public.vehicles v
       where v.id = old.vehicle_id and v.operator_id = auth.uid()
     ) then
    return new;
  end if;

  if new.total_price     is distinct from old.total_price
  or new.price_breakdown is distinct from old.price_breakdown
  or new.payment_status  is distinct from old.payment_status
  or new.payment_method  is distinct from old.payment_method
  or new.vehicle_id      is distinct from old.vehicle_id
  or new.customer_id     is distinct from old.customer_id then
    raise exception
      'Customers cannot change pricing, payment, vehicle or ownership on a booking';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bookings_guard_customer_update on public.bookings;
create trigger trg_bookings_guard_customer_update
  before update on public.bookings
  for each row execute function public.bookings_guard_customer_update();

-- ---------------------------------------------------------
-- 3c. ride_requests: customers may cancel, not confirm or self-pay
-- ---------------------------------------------------------
drop policy if exists "Customers cancel own awaiting requests" on public.ride_requests;
create policy "Customers cancel own awaiting requests"
  on public.ride_requests for update to authenticated
  using (customer_id = auth.uid() and status = 'awaiting')
  with check (customer_id = auth.uid() and status in ('awaiting', 'cancelled'));

drop policy if exists "Operators update ride requests" on public.ride_requests;
create policy "Operators update ride requests"
  on public.ride_requests for update to authenticated
  using (
    public.has_role(auth.uid(), 'operator')
    and (
      route_id is null
      or exists (
        select 1 from public.shuttle_routes r
        where r.id = ride_requests.route_id and r.operator_id = auth.uid()
      )
    )
  )
  with check (
    public.has_role(auth.uid(), 'operator')
    and (
      route_id is null
      or exists (
        select 1 from public.shuttle_routes r
        where r.id = ride_requests.route_id and r.operator_id = auth.uid()
      )
    )
  );

create or replace function public.ride_requests_guard_customer_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT means service_role / a server-side job, not a customer.
  if auth.uid() is null then
    return new;
  end if;

  if public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'operator') then
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
  or new.payment_method is distinct from old.payment_method
  or new.customer_id    is distinct from old.customer_id
  or new.route_id       is distinct from old.route_id
  or new.passengers     is distinct from old.passengers then
    raise exception
      'Customers cannot change payment state, ownership, route or headcount on a ride request';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ride_requests_guard_customer_update on public.ride_requests;
create trigger trg_ride_requests_guard_customer_update
  before update on public.ride_requests
  for each row execute function public.ride_requests_guard_customer_update();
