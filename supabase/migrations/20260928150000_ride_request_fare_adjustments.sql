-- =========================================================
-- #57  Operator corrects the fare on a ride request, audited
--
-- Fares are quoted and snapshotted when the request is created
-- (20260918170000). Real operations need a correction path: an
-- association increase that landed this morning, a discount, or a
-- mistake. What they must not have is a silent edit — the passenger was
-- shown a price, so every change is recorded and attributable.
--
-- Rules: only before the ride is completed or cancelled, never after the
-- money has been taken, always with a reason.
-- =========================================================

create table public.ride_request_fare_adjustments (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_fare_per_seat numeric(10,2),
  new_fare_per_seat numeric(10,2) not null check (new_fare_per_seat >= 0),
  old_total numeric(10,2),
  new_total numeric(10,2) not null check (new_total >= 0),
  currency char(3) not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500)
);
comment on table public.ride_request_fare_adjustments is
  'Append-only record of every fare correction an operator made to a ride request. No UPDATE or DELETE policy exists: rows are history.';

create index ride_request_fare_adjustments_request_idx
  on public.ride_request_fare_adjustments(ride_request_id, changed_at desc);

alter table public.ride_request_fare_adjustments enable row level security;
grant select, insert on public.ride_request_fare_adjustments to authenticated;
grant all on public.ride_request_fare_adjustments to service_role;

-- The passenger sees corrections to their own ride; the operator sees the
-- ones on requests they can already see.
create policy "fare_adjustments_select" on public.ride_request_fare_adjustments
  for select to authenticated
  using (exists (
    select 1 from public.ride_requests r
    where r.id = ride_request_fare_adjustments.ride_request_id
      and (
        r.customer_id = (select auth.uid())
        or r.operator_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'admin')
      )
  ));

-- Written by dispatch_ride_request, which runs as the operator.
create policy "fare_adjustments_insert" on public.ride_request_fare_adjustments
  for insert to authenticated
  with check (
    changed_by = (select auth.uid())
    and exists (
      select 1 from public.ride_requests r
      where r.id = ride_request_fare_adjustments.ride_request_id
        and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
    )
  );

-- ---------------------------------------------------------
-- dispatch_ride_request gains the fare arguments
--
-- Dropped and recreated rather than overloaded: two functions of the same
-- name would make the PostgREST call ambiguous.
-- ---------------------------------------------------------
drop function if exists public.dispatch_ride_request(uuid, public.ride_request_status, uuid);

create or replace function public.dispatch_ride_request(
  _id uuid,
  _status public.ride_request_status default null,
  _vehicle_id uuid default null,
  _fare_per_seat numeric default null,
  _fare_reason text default null
)
returns public.ride_requests
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_row public.ride_requests;
  v_now timestamptz := now();
  v_old_fare numeric;
  v_old_total numeric;
  v_incl boolean := false;
  v_operator uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_role(auth.uid(), 'operator') and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only operators can dispatch ride requests' using errcode = '42501';
  end if;

  select * into v_row from public.ride_requests where id = _id for update;
  if v_row.id is null then
    raise exception 'Ride request % not found' , _id;
  end if;

  if v_row.operator_id is not null and v_row.operator_id <> auth.uid()
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'This request has been taken by another operator' using errcode = '42501';
  end if;

  if _vehicle_id is not null then
    if not exists (
      select 1 from public.vehicles v
      where v.id = _vehicle_id
        and (v.operator_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    ) then
      raise exception 'Vehicle % is not in your fleet', _vehicle_id;
    end if;
    if v_row.status in ('completed', 'cancelled') then
      raise exception 'Cannot assign a vehicle to a % request', v_row.status;
    end if;
    v_row.vehicle_id := _vehicle_id;
    v_row.assigned_at := coalesce(v_row.assigned_at, v_now);
    -- Assigning a vehicle implies taking the request.
    v_row.operator_id := coalesce(v_row.operator_id, auth.uid());
  end if;

  -- ---- fare correction -------------------------------------------------
  if _fare_per_seat is not null then
    if v_row.status in ('completed', 'cancelled') then
      raise exception 'Cannot change the fare on a % ride', v_row.status;
    end if;
    if v_row.payment_status = 'paid' then
      raise exception 'This ride has been paid for; the fare can no longer be changed';
    end if;
    if _fare_per_seat < 0 then
      raise exception 'A fare cannot be negative';
    end if;
    if coalesce(btrim(_fare_reason), '') = '' then
      raise exception 'Give a reason for the fare change';
    end if;

    v_old_fare := v_row.fare_per_seat;
    v_old_total := v_row.total_price;

    -- Tax follows the operator's current tax-inclusive setting, but the
    -- rate and currency stay the ones the request was quoted with.
    select r.operator_id into v_operator
    from public.shuttle_routes r where r.id = v_row.route_id;
    select os.prices_include_tax into v_incl
    from public.operator_settings os where os.operator_id = coalesce(v_operator, v_row.operator_id);
    v_incl := coalesce(v_incl, false);

    v_row.fare_per_seat := round(_fare_per_seat, 2);
    if v_incl then
      v_row.total_price := round(v_row.fare_per_seat * v_row.passengers, 2);
      v_row.subtotal := round(v_row.total_price / (1 + v_row.tax_rate / 100), 2);
      v_row.tax_amount := v_row.total_price - v_row.subtotal;
    else
      v_row.subtotal := round(v_row.fare_per_seat * v_row.passengers, 2);
      v_row.tax_amount := round(v_row.subtotal * v_row.tax_rate / 100, 2);
      v_row.total_price := v_row.subtotal + v_row.tax_amount;
    end if;

    v_row.operator_id := coalesce(v_row.operator_id, auth.uid());

    insert into public.ride_request_fare_adjustments (
      ride_request_id, changed_by, old_fare_per_seat, new_fare_per_seat,
      old_total, new_total, currency, reason
    ) values (
      _id, auth.uid(), v_old_fare, v_row.fare_per_seat,
      v_old_total, v_row.total_price, v_row.currency, btrim(_fare_reason)
    );
  end if;

  if _status is not null and _status <> v_row.status then
    case
      when v_row.status = 'awaiting'    and _status in ('confirmed', 'cancelled') then null;
      when v_row.status = 'confirmed'   and _status in ('in_progress', 'cancelled') then null;
      when v_row.status = 'in_progress' and _status in ('completed', 'cancelled') then null;
      else
        raise exception 'Cannot move a request from % to %', v_row.status, _status;
    end case;

    if _status = 'in_progress' and v_row.vehicle_id is null then
      raise exception 'Assign a vehicle before starting the ride';
    end if;

    v_row.status := _status;
    if _status = 'confirmed' then
      v_row.operator_id := coalesce(v_row.operator_id, auth.uid());
      v_row.assigned_at := coalesce(v_row.assigned_at, v_now);
    elsif _status = 'in_progress' then
      v_row.started_at := v_now;
    elsif _status = 'completed' then
      v_row.completed_at := v_now;
      -- Cash is settled on board; prepay stays whatever the payment flow set.
      if v_row.payment_method = 'cash' then
        v_row.payment_status := 'paid';
      end if;
    end if;
  end if;

  update public.ride_requests
  set status = v_row.status,
      operator_id = v_row.operator_id,
      vehicle_id = v_row.vehicle_id,
      assigned_at = v_row.assigned_at,
      started_at = v_row.started_at,
      completed_at = v_row.completed_at,
      payment_status = v_row.payment_status,
      fare_per_seat = v_row.fare_per_seat,
      subtotal = v_row.subtotal,
      tax_amount = v_row.tax_amount,
      total_price = v_row.total_price
  where id = _id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.dispatch_ride_request(uuid, public.ride_request_status, uuid, numeric, text) from public, anon;
grant execute on function public.dispatch_ride_request(uuid, public.ride_request_status, uuid, numeric, text) to authenticated, service_role;

-- ---------------------------------------------------------
-- Close a hole the fares migration left open
--
-- ride_requests_guard_customer_update (20260906135126) predates fares, so
-- it freezes payment and ownership columns but not the money ones. The
-- customer UPDATE policy still lets a passenger edit their own request
-- while it is `awaiting` — which since 20260918170000 has meant they could
-- set their own total_price to 0. Operators and admins pass through as
-- before; the fare correction above is how *they* change it.
-- ---------------------------------------------------------
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

  if new.fare_per_seat       is distinct from old.fare_per_seat
  or new.subtotal            is distinct from old.subtotal
  or new.tax_rate            is distinct from old.tax_rate
  or new.tax_amount          is distinct from old.tax_amount
  or new.total_price         is distinct from old.total_price
  or new.currency            is distinct from old.currency
  or new.origin_stop_id      is distinct from old.origin_stop_id
  or new.destination_stop_id is distinct from old.destination_stop_id then
    raise exception 'Customers cannot change the fare on a ride request';
  end if;

  return new;
end;
$$;
revoke all on function public.ride_requests_guard_customer_update() from public, anon, authenticated;
