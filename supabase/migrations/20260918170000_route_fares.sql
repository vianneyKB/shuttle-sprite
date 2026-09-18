-- =========================================================
-- #56  Route fares: per-route / per-segment, per-seat, effective-dated
--
-- Minibus-taxi fares are fixed per route and per seat, set by operators
-- (often following association rates) and changed a few times a year.
-- The shuttle line had no price at all.
--
--   route_fares          one row per (route, optional segment, effective period)
--   quote_ride_fare()    resolves the fare in force and applies the operator's
--                        currency / VAT — same engine as fleet bookings
--   create_ride_request()the only way to create a request; snapshots the quote
--                        so later fare changes never rewrite history
-- =========================================================

-- ---------------------------------------------------------
-- 1. route_fares
-- ---------------------------------------------------------
create table public.route_fares (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.shuttle_routes(id) on delete cascade,
  -- Both null = whole-route fare. Both set = fare for that origin → destination.
  from_stop_id uuid references public.route_stops(id) on delete cascade,
  to_stop_id uuid references public.route_stops(id) on delete cascade,
  fare_per_seat numeric(10,2) not null check (fare_per_seat >= 0),
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint route_fares_segment_both_or_neither
    check ((from_stop_id is null) = (to_stop_id is null)),
  constraint route_fares_segment_distinct
    check (from_stop_id is null or from_stop_id <> to_stop_id),
  constraint route_fares_period
    check (effective_to is null or effective_to >= effective_from)
);
comment on table public.route_fares is
  'Per-seat fares for shuttle routes. Whole-route rows have null stops; segment rows override for one origin→destination. Effective-dated: add a new row for an increase, never edit history.';

create index route_fares_route_id_idx on public.route_fares(route_id);
create index route_fares_lookup_idx on public.route_fares(route_id, from_stop_id, to_stop_id, effective_from desc);

alter table public.route_fares enable row level security;
grant select, insert, update, delete on public.route_fares to authenticated;
grant all on public.route_fares to service_role;

create policy "route_fares_select" on public.route_fares for select to authenticated
  using (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_fares.route_id
      and (r.is_active = true
           or r.operator_id = (select auth.uid())
           or public.has_role((select auth.uid()), 'admin'))
  ));

create policy "route_fares_insert" on public.route_fares for insert to authenticated
  with check (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_fares.route_id
      and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  ));

-- Only the period may be edited (to close a fare early); amounts are history.
create policy "route_fares_update" on public.route_fares for update to authenticated
  using (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_fares.route_id
      and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  ))
  with check (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_fares.route_id
      and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  ));

create policy "route_fares_delete" on public.route_fares for delete to authenticated
  using (
    -- A fare that has not started yet may be deleted; past/current ones are kept.
    effective_from > current_date
    and exists (
      select 1 from public.shuttle_routes r
      where r.id = route_fares.route_id
        and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
    )
  );

create or replace function public.route_fares_guard_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fare_per_seat is distinct from old.fare_per_seat
  or new.route_id is distinct from old.route_id
  or new.from_stop_id is distinct from old.from_stop_id
  or new.to_stop_id is distinct from old.to_stop_id then
    raise exception 'Fares are history: add a new fare with a later effective date instead of editing this one';
  end if;
  return new;
end;
$$;
revoke all on function public.route_fares_guard_update() from public, anon, authenticated;
create trigger trg_route_fares_guard_update
  before update on public.route_fares
  for each row execute function public.route_fares_guard_update();

-- ---------------------------------------------------------
-- 2. ride_requests: fare snapshot
-- ---------------------------------------------------------
alter table public.ride_requests
  add column if not exists fare_per_seat numeric(10,2) check (fare_per_seat is null or fare_per_seat >= 0),
  add column if not exists currency char(3) not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists subtotal numeric(10,2) check (subtotal is null or subtotal >= 0),
  add column if not exists tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  add column if not exists tax_amount numeric(10,2) check (tax_amount is null or tax_amount >= 0),
  add column if not exists total_price numeric(10,2) check (total_price is null or total_price >= 0),
  add column if not exists origin_stop_id uuid references public.route_stops(id) on delete set null,
  add column if not exists destination_stop_id uuid references public.route_stops(id) on delete set null;

comment on column public.ride_requests.total_price is
  'Quoted total at request time (seats × fare + tax). Null = no fare set on the route; pay on board.';

-- ---------------------------------------------------------
-- 3. quote_ride_fare
-- ---------------------------------------------------------
create or replace function public.quote_ride_fare(
  _route_id uuid,
  _from_stop_id uuid,
  _to_stop_id uuid,
  _passengers integer default 1,
  _at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_operator uuid;
  v_fare numeric;
  v_source text := 'none';
  v_currency char(3) := 'ZAR';
  v_tax_rate numeric := 15;
  v_tax_label text := 'VAT';
  v_incl boolean := false;
  v_seats integer := greatest(1, coalesce(_passengers, 1));
  v_day date := (_at at time zone 'UTC')::date;
  v_subtotal numeric;
  v_tax numeric;
  v_total numeric;
begin
  select operator_id into v_operator from public.shuttle_routes where id = _route_id;
  if v_operator is null then raise exception 'Route % not found', _route_id; end if;

  -- Segment fare in force, else whole-route fare in force. Latest start wins.
  select fare_per_seat, 'segment' into v_fare, v_source
  from public.route_fares
  where route_id = _route_id
    and from_stop_id = _from_stop_id and to_stop_id = _to_stop_id
    and effective_from <= v_day and (effective_to is null or effective_to >= v_day)
  order by effective_from desc, created_at desc
  limit 1;

  if v_fare is null then
    select fare_per_seat, 'route' into v_fare, v_source
    from public.route_fares
    where route_id = _route_id
      and from_stop_id is null and to_stop_id is null
      and effective_from <= v_day and (effective_to is null or effective_to >= v_day)
    order by effective_from desc, created_at desc
    limit 1;
  end if;

  select currency, tax_rate, tax_label, prices_include_tax
    into v_currency, v_tax_rate, v_tax_label, v_incl
  from public.operator_settings where operator_id = v_operator;

  if v_fare is null then
    return jsonb_build_object(
      'source', 'none', 'farePerSeat', null, 'passengers', v_seats,
      'currency', v_currency, 'subtotal', null, 'taxRate', v_tax_rate,
      'taxLabel', v_tax_label, 'taxAmount', null, 'total', null
    );
  end if;

  if v_incl then
    v_total := round(v_fare * v_seats, 2);
    v_subtotal := round(v_total / (1 + v_tax_rate / 100), 2);
    v_tax := v_total - v_subtotal;
  else
    v_subtotal := round(v_fare * v_seats, 2);
    v_tax := round(v_subtotal * v_tax_rate / 100, 2);
    v_total := v_subtotal + v_tax;
  end if;

  return jsonb_build_object(
    'source', v_source, 'farePerSeat', v_fare, 'passengers', v_seats,
    'currency', v_currency, 'subtotal', v_subtotal, 'taxRate', v_tax_rate,
    'taxLabel', v_tax_label, 'taxAmount', v_tax, 'pricesIncludeTax', v_incl, 'total', v_total
  );
end;
$$;
revoke all on function public.quote_ride_fare(uuid, uuid, uuid, integer, timestamptz) from public, anon;
grant execute on function public.quote_ride_fare(uuid, uuid, uuid, integer, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------
-- 4. create_ride_request: the only way to create a request
-- ---------------------------------------------------------
create or replace function public.create_ride_request(
  _route_id uuid,
  _origin_stop_id uuid,
  _destination_stop_id uuid,
  _passengers integer default 1,
  _payment_method public.payment_method default 'cash',
  _scheduled_at timestamptz default null,
  _notes text default null
)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := auth.uid();
  v_origin public.route_stops;
  v_dest public.route_stops;
  v_quote jsonb;
  v_row public.ride_requests;
begin
  if v_customer is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shuttle_routes where id = _route_id and is_active) then
    raise exception 'Route is not available';
  end if;
  select * into v_origin from public.route_stops where id = _origin_stop_id and route_id = _route_id;
  select * into v_dest   from public.route_stops where id = _destination_stop_id and route_id = _route_id;
  if v_origin.id is null or v_dest.id is null then
    raise exception 'Stops must belong to the route';
  end if;
  if v_origin.id = v_dest.id then raise exception 'Origin and destination must differ'; end if;
  if _passengers is null or _passengers < 1 or _passengers > 50 then
    raise exception 'Passengers must be between 1 and 50';
  end if;
  if _scheduled_at is not null and _scheduled_at < now() + interval '15 minutes' then
    raise exception 'Scheduled rides need at least 15 minutes'' notice';
  end if;

  v_quote := public.quote_ride_fare(_route_id, _origin_stop_id, _destination_stop_id, _passengers, coalesce(_scheduled_at, now()));

  insert into public.ride_requests (
    customer_id, route_id, origin_stop_id, destination_stop_id,
    origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng,
    passengers, payment_method, payment_status, status, scheduled_at, notes,
    fare_per_seat, currency, subtotal, tax_rate, tax_amount, total_price
  ) values (
    v_customer, _route_id, v_origin.id, v_dest.id,
    v_origin.name, v_origin.lat, v_origin.lng, v_dest.name, v_dest.lat, v_dest.lng,
    _passengers, _payment_method,
    case when _payment_method = 'prepay' then 'pending' else 'not_required' end,
    'awaiting', _scheduled_at, nullif(btrim(_notes), ''),
    (v_quote ->> 'farePerSeat')::numeric,
    (v_quote ->> 'currency')::char(3),
    (v_quote ->> 'subtotal')::numeric,
    (v_quote ->> 'taxRate')::numeric,
    (v_quote ->> 'taxAmount')::numeric,
    (v_quote ->> 'total')::numeric
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.create_ride_request(uuid, uuid, uuid, integer, public.payment_method, timestamptz, text) from public, anon;
grant execute on function public.create_ride_request(uuid, uuid, uuid, integer, public.payment_method, timestamptz, text) to authenticated, service_role;

-- Direct inserts bypassed the quote; the RPC is now the only path.
drop policy if exists "ride_requests_insert" on public.ride_requests;
