-- =========================================================
-- #45  Stripe adapter: the operator chooses who takes the card
--
-- #30 left the provider a platform-wide Edge Function secret
-- (PAYMENT_PROVIDER). With two adapters that is the wrong place for the
-- decision: an operator in Johannesburg settles through Paystack, one in
-- Nairobi or Lisbon through Stripe, on the same deployment.
--
--   operator_settings.payment_provider   who takes this operator's cards
--   start_payment()                      now *returns* the provider to use,
--                                        resolved from the operator who owns
--                                        the vehicle / route — so the choice
--                                        is made in Postgres, not in the
--                                        browser and not in an env var
--
-- The caller still passes a provider; it is only the fallback for an operator
-- with no settings row. Everything else about start_payment is unchanged.
-- =========================================================

-- ---------------------------------------------------------
-- 1. The setting
-- ---------------------------------------------------------
alter table public.operator_settings
  add column if not exists payment_provider text not null default 'paystack'
    check (payment_provider in ('paystack', 'stripe'));

comment on column public.operator_settings.payment_provider is
  'Which hosted checkout takes this operator''s card payments: paystack or stripe. Read by start_payment(); passengers never choose.';

-- ---------------------------------------------------------
-- 2. Resolving the provider for a payment target
--
-- Bookings belong to a vehicle, ride requests to a route (and, once taken, to
-- the operator who took it). Both land on one operator, so one helper does.
-- ---------------------------------------------------------
create or replace function public.operator_payment_provider(
  _operator_id uuid,
  _fallback text default 'paystack'
)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select os.payment_provider from public.operator_settings os
      where os.operator_id = _operator_id),
    case when _fallback in ('paystack', 'stripe') then _fallback end,
    'paystack'
  );
$$;
comment on function public.operator_payment_provider(uuid, text) is
  'The payment provider configured for an operator, falling back to the platform default. Never returns null.';
revoke all on function public.operator_payment_provider(uuid, text) from public, anon, authenticated;
grant execute on function public.operator_payment_provider(uuid, text) to service_role;

-- ---------------------------------------------------------
-- 3. start_payment returns the provider it chose
--
-- The return type gains a column, so the old function has to go first.
-- Same arguments, same ownership and amount checks as #30.
-- ---------------------------------------------------------
drop function if exists public.start_payment(uuid, text, uuid, text, text);

create function public.start_payment(
  _user_id uuid,
  _target_type text,
  _target_id uuid,
  _provider text,
  _reference text
)
returns table (
  target_type text,
  target_id uuid,
  amount numeric,
  currency text,
  customer_email text,
  customer_name text,
  description text,
  provider text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_request public.ride_requests;
  v_email text;
  v_name text;
  v_operator uuid;
  v_provider text;
begin
  if _user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  -- The caller's provider is now only a fallback, so an unknown one is still
  -- refused rather than silently replaced.
  if _provider is not null and _provider not in ('paystack', 'stripe') then
    raise exception 'Unknown payment provider: %', _provider;
  end if;
  if _reference is null or length(_reference) < 8 then
    raise exception 'A payment reference is required';
  end if;

  if _target_type = 'booking' then
    select * into v_booking from public.bookings where id = _target_id;
    -- Same error for "missing" and "not yours": never confirm a booking exists.
    if v_booking.id is null or v_booking.customer_id <> _user_id then
      raise exception 'Booking not found' using errcode = '42501';
    end if;
    if v_booking.payment_method <> 'prepay' then
      raise exception 'This booking is paid in cash on board';
    end if;
    if v_booking.payment_status = 'paid' then
      raise exception 'This booking is already paid';
    end if;
    if v_booking.payment_status <> 'pending' then
      raise exception 'This booking does not require payment';
    end if;
    if coalesce(v_booking.total_price, 0) <= 0 then
      raise exception 'This booking has no amount to pay';
    end if;

    select v.operator_id into v_operator
      from public.vehicles v where v.id = v_booking.vehicle_id;
    v_provider := public.operator_payment_provider(v_operator, _provider);

    update public.bookings
       set payment_provider = v_provider, payment_ref = _reference
     where id = v_booking.id
     returning * into v_booking;

    select coalesce(nullif(v_booking.customer_email, ''), u.email),
           coalesce(nullif(v_booking.customer_name, ''), p.display_name, u.email)
      into v_email, v_name
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = v_booking.customer_id;

    return query select
      'booking'::text,
      v_booking.id,
      v_booking.total_price,
      v_booking.currency::text,
      v_email,
      v_name,
      format('ShuttleBook booking %s', left(v_booking.id::text, 8)),
      v_provider;

  elsif _target_type = 'ride_request' then
    select * into v_request from public.ride_requests where id = _target_id;
    if v_request.id is null or v_request.customer_id <> _user_id then
      raise exception 'Ride request not found' using errcode = '42501';
    end if;
    if v_request.payment_method <> 'prepay' then
      raise exception 'This ride is paid in cash on board';
    end if;
    if v_request.payment_status = 'paid' then
      raise exception 'This ride is already paid';
    end if;
    if v_request.payment_status <> 'pending' then
      raise exception 'This ride does not require payment';
    end if;
    if v_request.status = 'cancelled' then
      raise exception 'This ride was cancelled';
    end if;
    if coalesce(v_request.total_price, 0) <= 0 then
      raise exception 'This ride has no fare set; pay the driver on board';
    end if;

    -- The route's owner prices the ride; the operator who took the request is
    -- the fallback for a route that has since been deleted.
    select r.operator_id into v_operator
      from public.shuttle_routes r where r.id = v_request.route_id;
    v_provider := public.operator_payment_provider(
      coalesce(v_operator, v_request.operator_id), _provider);

    update public.ride_requests
       set payment_provider = v_provider, payment_ref = _reference
     where id = v_request.id
     returning * into v_request;

    select u.email, coalesce(p.display_name, u.email)
      into v_email, v_name
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = v_request.customer_id;

    return query select
      'ride_request'::text,
      v_request.id,
      v_request.total_price,
      v_request.currency::text,
      v_email,
      v_name,
      format('ShuttleBook ride %s → %s', v_request.origin_name, v_request.destination_name),
      v_provider;

  else
    raise exception 'Unknown payment target: %', coalesce(_target_type, '(null)');
  end if;
end;
$$;
comment on function public.start_payment(uuid, text, uuid, text, text) is
  'Reserves a payment reference against a booking / ride request the caller owns and returns the amount from the row plus the provider configured for its operator. service_role only.';
revoke all on function public.start_payment(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_payment(uuid, text, uuid, text, text) to service_role;
