-- =========================================================
-- #17  Server-side booking creation + per-operator pricing
--
-- Problem: the client called calculate_booking_price and then inserted
-- bookings.total_price itself. The INSERT policy only checked
-- customer_id, so any user could book at any price.
--
-- Fix: bookings are created only through create_booking(), a
-- SECURITY DEFINER function that computes the price, inserts the booking
-- and its stops in one transaction, and snapshots currency and tax.
--
-- Platform defaults are South Africa: ZAR, 15% VAT. Multi-country:
-- currency, tax rate, tax label, tax-inclusive pricing
-- and the additional-stop fee are per operator (operator_settings), so
-- one platform can serve ZAR + 15% VAT, GBP + 20% VAT, JPY + 10%, etc.
-- Bookings snapshot those values so later changes never rewrite history.
-- =========================================================

-- ---------------------------------------------------------
-- 1. operator_settings
-- ---------------------------------------------------------
create table public.operator_settings (
  operator_id uuid primary key references auth.users(id) on delete cascade,
  currency char(3) not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  tax_rate numeric(5,2) not null default 15 check (tax_rate >= 0 and tax_rate <= 100),
  tax_label text not null default 'VAT' check (char_length(tax_label) between 1 and 30),
  prices_include_tax boolean not null default false,
  additional_stop_fee numeric(10,2) not null default 15 check (additional_stop_fee >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.operator_settings is
  'Per-operator pricing locale: ISO 4217 currency, tax rate (%), whether listed prices already include tax, and the fee per extra stop.';

alter table public.operator_settings enable row level security;
grant select, insert, update on public.operator_settings to authenticated;
grant all on public.operator_settings to service_role;

create trigger trg_operator_settings_updated before update on public.operator_settings
  for each row execute function public.set_updated_at();

-- Every signed-in user may read settings: passengers need the currency to
-- display vehicle prices. Nothing here is sensitive.
create policy "Authenticated users read operator settings"
  on public.operator_settings for select to authenticated
  using (true);

create policy "Operators insert their own settings"
  on public.operator_settings for insert to authenticated
  with check (operator_id = auth.uid() and public.has_role(auth.uid(), 'operator'));

create policy "Operators update their own settings"
  on public.operator_settings for update to authenticated
  using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

-- Default row whenever someone becomes an operator, and for existing ones.
create or replace function public.ensure_operator_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'operator' then
    insert into public.operator_settings (operator_id) values (new.user_id)
    on conflict (operator_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.ensure_operator_settings() from public, anon, authenticated;

create trigger trg_user_roles_operator_settings
  after insert on public.user_roles
  for each row execute function public.ensure_operator_settings();

insert into public.operator_settings (operator_id)
select user_id from public.user_roles where role = 'operator'
on conflict (operator_id) do nothing;

-- ---------------------------------------------------------
-- 2. bookings: snapshot the pricing locale
-- ---------------------------------------------------------
alter table public.bookings
  add column if not exists currency char(3) not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  add column if not exists tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  add column if not exists tax_amount numeric(10,2) not null default 0 check (tax_amount >= 0);

comment on column public.bookings.subtotal is 'Amount before tax, in bookings.currency.';
comment on column public.bookings.tax_amount is 'Tax charged; total_price = subtotal + tax_amount.';

-- Existing rows: treat historic total as tax-free.
update public.bookings set subtotal = total_price where subtotal = 0 and total_price > 0;

-- ---------------------------------------------------------
-- 3. calculate_booking_price: currency + tax aware
--
-- Still SECURITY INVOKER — it only reads vehicles and operator_settings,
-- both readable by any authenticated user. Used by the client for the
-- live preview and by create_booking for the real thing.
-- ---------------------------------------------------------
create or replace function public.calculate_booking_price(
  _vehicle_id uuid,
  _duration numeric,
  _stop_count integer,
  _days_of_week_count integer
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_hourly numeric;
  v_operator uuid;
  v_currency char(3) := 'ZAR';
  v_tax_rate numeric := 15;
  v_tax_label text := 'VAT';
  v_incl boolean := false;
  v_stop_fee numeric := 15;
  v_additional_stops integer;
  v_additional_stops_cost numeric;
  v_recurring_multiplier integer;
  v_base numeric;
  v_subtotal numeric;
  v_tax numeric;
  v_total numeric;
begin
  select price_per_hour, operator_id into v_hourly, v_operator
  from public.vehicles where id = _vehicle_id;
  if v_hourly is null then raise exception 'Vehicle % not found', _vehicle_id; end if;
  if _duration is null or _duration <= 0 then raise exception 'Duration must be positive'; end if;

  select currency, tax_rate, tax_label, prices_include_tax, additional_stop_fee
    into v_currency, v_tax_rate, v_tax_label, v_incl, v_stop_fee
  from public.operator_settings where operator_id = v_operator;
  -- No settings row → defaults declared above.

  v_additional_stops := greatest(0, coalesce(_stop_count, 0) - 2);
  v_additional_stops_cost := v_additional_stops * v_stop_fee;
  v_recurring_multiplier := greatest(1, coalesce(_days_of_week_count, 0));
  v_base := (v_hourly * _duration + v_additional_stops_cost) * v_recurring_multiplier;

  if v_incl then
    -- Listed prices already contain tax: back the tax out.
    v_total := round(v_base, 2);
    v_subtotal := round(v_base / (1 + v_tax_rate / 100), 2);
    v_tax := v_total - v_subtotal;
  else
    v_subtotal := round(v_base, 2);
    v_tax := round(v_subtotal * v_tax_rate / 100, 2);
    v_total := v_subtotal + v_tax;
  end if;

  return jsonb_build_object(
    'currency', v_currency,
    'hourlyRate', v_hourly,
    'duration', _duration,
    'additionalStops', v_additional_stops,
    'additionalStopFee', v_stop_fee,
    'additionalStopsCost', v_additional_stops_cost,
    'recurringMultiplier', v_recurring_multiplier,
    'pricesIncludeTax', v_incl,
    'subtotal', v_subtotal,
    'taxRate', v_tax_rate,
    'taxLabel', v_tax_label,
    'taxAmount', v_tax,
    'finalTotal', v_total
  );
end;
$$;

-- ---------------------------------------------------------
-- 4. create_booking: the only way to insert a booking
-- ---------------------------------------------------------
create or replace function public.create_booking(
  _vehicle_id uuid,
  _customer_name text,
  _customer_email text,
  _customer_phone text,
  _passengers integer,
  _start_date date,
  _time text,
  _duration numeric,
  _stops jsonb,                       -- [{address, type, notes?}, …] in order
  _days_of_week text[] default '{}',
  _special_requests text default null,
  _payment_method public.payment_method default 'cash'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := auth.uid();
  v_capacity integer;
  v_available boolean;
  v_price jsonb;
  v_booking_id uuid;
  v_stop jsonb;
  v_idx integer := 0;
  v_type text;
  v_days text[] := coalesce(_days_of_week, '{}');
begin
  if v_customer is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select capacity, available into v_capacity, v_available
  from public.vehicles where id = _vehicle_id;
  if v_capacity is null then raise exception 'Vehicle % not found', _vehicle_id; end if;
  if not v_available then raise exception 'Vehicle is not available'; end if;

  if _passengers is null or _passengers < 1 then raise exception 'Passengers must be at least 1'; end if;
  if _passengers > v_capacity then raise exception 'Max capacity is %', v_capacity; end if;
  if _duration is null or _duration <= 0 then raise exception 'Duration must be positive'; end if;
  if _start_date is null then raise exception 'Start date is required'; end if;
  if _start_date < current_date then raise exception 'Start date cannot be in the past'; end if;
  if coalesce(btrim(_time), '') = '' then raise exception 'Time is required'; end if;
  if coalesce(btrim(_customer_name), '') = '' then raise exception 'Name is required'; end if;
  if coalesce(btrim(_customer_email), '') = '' then raise exception 'Email is required'; end if;
  if coalesce(btrim(_customer_phone), '') = '' then raise exception 'Phone is required'; end if;

  if _stops is null or jsonb_typeof(_stops) <> 'array' or jsonb_array_length(_stops) < 2 then
    raise exception 'At least a pickup and a drop-off stop are required';
  end if;

  v_price := public.calculate_booking_price(
    _vehicle_id, _duration, jsonb_array_length(_stops), coalesce(array_length(v_days, 1), 0)
  );

  insert into public.bookings (
    vehicle_id, customer_id, customer_name, customer_email, customer_phone,
    passengers, start_date, time, duration, days_of_week, is_recurring,
    special_requests, status, payment_method, payment_status,
    currency, subtotal, tax_rate, tax_amount, total_price, price_breakdown
  ) values (
    _vehicle_id, v_customer, btrim(_customer_name), btrim(_customer_email), btrim(_customer_phone),
    _passengers, _start_date, btrim(_time), _duration, v_days, coalesce(array_length(v_days, 1), 0) > 0,
    nullif(btrim(_special_requests), ''), 'pending', _payment_method,
    case when _payment_method = 'prepay' then 'pending' else 'not_required' end,
    (v_price ->> 'currency')::char(3),
    (v_price ->> 'subtotal')::numeric,
    (v_price ->> 'taxRate')::numeric,
    (v_price ->> 'taxAmount')::numeric,
    (v_price ->> 'finalTotal')::numeric,
    v_price
  )
  returning id into v_booking_id;

  for v_stop in select * from jsonb_array_elements(_stops) loop
    v_type := v_stop ->> 'type';
    if v_type not in ('pickup', 'dropoff', 'stop') then
      raise exception 'Invalid stop type %', v_type;
    end if;
    if coalesce(btrim(v_stop ->> 'address'), '') = '' then
      raise exception 'Stop % needs an address', v_idx + 1;
    end if;
    insert into public.booking_stops (booking_id, address, type, stop_order, notes)
    values (v_booking_id, btrim(v_stop ->> 'address'), v_type::public.stop_type, v_idx, nullif(btrim(v_stop ->> 'notes'), ''));
    v_idx := v_idx + 1;
  end loop;

  return v_booking_id;
end;
$$;

revoke all on function public.create_booking(uuid, text, text, text, integer, date, text, numeric, jsonb, text[], text, public.payment_method) from public, anon;
grant execute on function public.create_booking(uuid, text, text, text, integer, date, text, numeric, jsonb, text[], text, public.payment_method) to authenticated, service_role;

-- ---------------------------------------------------------
-- 5. Close the client-side write paths the RPC replaces
-- ---------------------------------------------------------
drop policy if exists "Customers create their own bookings" on public.bookings;

-- Customers could insert/delete stops on their own bookings, which changes
-- the priced stop count after the fact. Reads stay covered by
-- "View stops for accessible bookings".
drop policy if exists "Customers manage stops on their bookings" on public.booking_stops;
