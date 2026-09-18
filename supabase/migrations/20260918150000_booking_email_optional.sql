-- =========================================================
-- Passengers need only a name and mobile number
--
-- create_booking() required an email. For minibus-taxi passengers the
-- mobile number is the contact that matters (drivers phone or WhatsApp);
-- email is optional and stored as '' when absent. The function body is
-- otherwise identical to 20260915120000.
-- =========================================================

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
  -- Email is optional for passengers; the mobile number is how drivers reach them.
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
    _vehicle_id, v_customer, btrim(_customer_name), coalesce(btrim(_customer_email), ''), btrim(_customer_phone),
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

