
-- Server-side pricing function (single source of truth)
create or replace function public.calculate_booking_price(
  _vehicle_id uuid,
  _duration numeric,
  _stop_count integer,
  _days_of_week_count integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hourly numeric;
  v_subtotal numeric;
  v_additional_stops integer;
  v_additional_stops_cost numeric;
  v_recurring_multiplier integer;
  v_final numeric;
  c_additional_stop_cost constant numeric := 15;
begin
  select price_per_hour into v_hourly
  from public.vehicles
  where id = _vehicle_id;

  if v_hourly is null then
    raise exception 'Vehicle % not found', _vehicle_id;
  end if;

  if _duration is null or _duration <= 0 then
    raise exception 'Duration must be positive';
  end if;

  v_subtotal := v_hourly * _duration;
  v_additional_stops := greatest(0, coalesce(_stop_count, 0) - 2);
  v_additional_stops_cost := v_additional_stops * c_additional_stop_cost;
  v_recurring_multiplier := greatest(1, coalesce(_days_of_week_count, 0));
  v_final := (v_subtotal + v_additional_stops_cost) * v_recurring_multiplier;

  return jsonb_build_object(
    'hourlyRate', v_hourly,
    'duration', _duration,
    'subtotal', v_subtotal,
    'additionalStops', v_additional_stops,
    'additionalStopsCost', v_additional_stops_cost,
    'recurringMultiplier', v_recurring_multiplier,
    'finalTotal', v_final
  );
end;
$$;

grant execute on function public.calculate_booking_price(uuid, numeric, integer, integer) to authenticated;

-- Allow customers to delete (cancel) their own pending bookings
drop policy if exists "Customers cancel their own pending bookings" on public.bookings;
create policy "Customers cancel their own pending bookings"
on public.bookings
for delete
to authenticated
using (customer_id = auth.uid() and status = 'pending');
