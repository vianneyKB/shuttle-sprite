-- =========================================================
-- #41  RLS and privilege tests
--
-- Each test runs in its own transaction as the `authenticated` role with a
-- subject set, then rolls back. Refusals go through tests.denied(), which
-- insists the statement failed for a policy or guard reason — a typo in a
-- test raises undefined_column and fails loudly instead of looking like a
-- pass. psql runs with ON_ERROR_STOP=1, so the first broken rule fails CI.
-- =========================================================

\set ON_ERROR_STOP on

\set OP_A '11111111-1111-1111-1111-111111111111'
\set OP_B '22222222-2222-2222-2222-222222222222'
\set PAX1 '33333333-3333-3333-3333-333333333333'
\set PAX2 '44444444-4444-4444-4444-444444444444'
\set ADMIN '55555555-5555-5555-5555-555555555555'
\set ROUTE_A 'a2000000-0000-0000-0000-000000000001'
\set STOP_A1 'a3000000-0000-0000-0000-000000000001'
\set STOP_A2 'a3000000-0000-0000-0000-000000000002'
\set VEHICLE_A 'a1000000-0000-0000-0000-000000000001'

-- Both passengers request a ride through the RPC, as the app does.
-- Committed, so the isolation tests below have rows they must not see.
set role authenticated;
select set_config('request.jwt.claim.sub', :'PAX1', false);
select public.create_ride_request(:'ROUTE_A', :'STOP_A1', :'STOP_A2', 2, 'cash', null, 'pax1 ride');
select set_config('request.jwt.claim.sub', :'PAX2', false);
select public.create_ride_request(:'ROUTE_A', :'STOP_A1', :'STOP_A2', 1, 'prepay', null, 'pax2 ride');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Real ids, read outside RLS, so a test acting as someone who cannot see
-- the row still passes it a row that exists.
select id as req1 from public.ride_requests where notes = 'pax1 ride' \gset
select id as req2 from public.ride_requests where notes = 'pax2 ride' \gset

-- ---------------------------------------------------------
-- The fare stored is the fare the route charges
-- ---------------------------------------------------------
do $$
declare v_total numeric; v_fare numeric; v_rate numeric; v_seats int;
begin
  select total_price, fare_per_seat, tax_rate, passengers
    into v_total, v_fare, v_rate, v_seats
  from public.ride_requests where notes = 'pax1 ride';
  assert v_fare = 18, format('seat fare should come from route_fares, got %s', v_fare);
  assert v_total = round(v_fare * v_seats * (1 + v_rate / 100), 2),
    format('total should be seats x fare + tax, got %s', v_total);
end $$;

-- ---------------------------------------------------------
-- Passenger isolation
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX1', true);
  do $$
  begin
    assert (select count(*) from public.ride_requests) = 1,
      'a passenger must see only their own ride requests';
    assert (select notes from public.ride_requests) = 'pax1 ride', 'and it must be theirs';
    assert (select count(*) from public.profiles) = 1,
      'a passenger must see only their own profile';
  end $$;
rollback;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX2', true);
  do $$
  declare v_pax bigint;
  begin
    select coalesce(sum(total_passengers), 0) into v_pax from public.get_passenger_queue();
    assert v_pax = 1, format('get_passenger_queue must not leak other passengers, saw %s', v_pax);
  end $$;
rollback;

-- ---------------------------------------------------------
-- A passenger may cancel, and nothing else
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX1', true);
  select tests.denied(format('update public.ride_requests set status = ''confirmed'' where id = %L', :'req1'));
  select tests.denied(format('update public.ride_requests set status = ''completed'' where id = %L', :'req1'));
  do $$
  begin
    update public.ride_requests set status = 'cancelled'
    where id = (select id from public.ride_requests);
    assert (select status from public.ride_requests) = 'cancelled',
      'a passenger must be able to cancel while awaiting';
  end $$;
rollback;

-- ---------------------------------------------------------
-- A passenger cannot rewrite the money  (the hole #57 closed)
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX1', true);
  select tests.denied(format('update public.ride_requests set total_price = 0 where id = %L', :'req1'));
  select tests.denied(format('update public.ride_requests set fare_per_seat = 1 where id = %L', :'req1'));
  select tests.denied(format('update public.ride_requests set subtotal = 0, tax_amount = 0 where id = %L', :'req1'));
  select tests.denied(format('update public.ride_requests set payment_status = ''paid'' where id = %L', :'req1'));
  select tests.denied(format('update public.ride_requests set passengers = 20 where id = %L', :'req1'));
  select tests.denied(format('update public.ride_requests set customer_id = %L where id = %L', :'PAX2', :'req1'));
rollback;

-- A passenger must not reach another passenger's row at all.
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX1', true);
  do $$
  begin
    assert (select count(*) from public.ride_requests where notes = 'pax2 ride') = 0,
      'another passenger''s ride must be invisible';
  end $$;
rollback;

-- ---------------------------------------------------------
-- Rides and bookings are created only through their RPCs
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX1', true);
  select tests.denied(format($q$
    insert into public.ride_requests
      (customer_id, route_id, origin_name, origin_lat, origin_lng,
       destination_name, destination_lat, destination_lng, passengers, total_price)
    values (%L, %L, 'Rank A', -26.2, 28.04, 'Mall B', -26.1, 28.05, 1, 0)
  $q$, :'PAX1', :'ROUTE_A'));
  select tests.denied(format($q$
    insert into public.bookings
      (vehicle_id, customer_id, customer_name, customer_email, customer_phone,
       passengers, start_date, time, duration, total_price)
    values (%L, %L, 'Pax One', 'p@e.com', '0833330000', 1, current_date + 1, '08:00', 2, 1)
  $q$, :'VEHICLE_A', :'PAX1'));
rollback;

-- ---------------------------------------------------------
-- create_booking prices the booking itself
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX1', true);
  do $$
  declare v_id uuid; v_total numeric; v_expected numeric;
  begin
    v_id := public.create_booking(
      'a1000000-0000-0000-0000-000000000001', 'Pax One', 'p@e.com', '0833330000',
      2, current_date + 1, '08:00', 3,
      '[{"address":"Rank A","type":"pickup"},{"address":"Mall B","type":"dropoff"}]'::jsonb);
    select total_price into v_total from public.bookings where id = v_id;
    select (public.calculate_booking_price('a1000000-0000-0000-0000-000000000001', 3, 2, 0)
            ->> 'finalTotal')::numeric into v_expected;
    assert v_total = v_expected,
      format('booking total %s should equal the priced total %s', v_total, v_expected);
    assert v_total > 0, 'a priced booking cannot be free';
  end $$;
rollback;

-- ---------------------------------------------------------
-- Operators are scoped to their own routes
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'OP_B', true);
  do $$
  begin
    assert (select count(*) from public.ride_requests) = 0,
      'an operator must not see requests on another operator''s route';
  end $$;
  select tests.denied(format('select public.dispatch_ride_request(%L, ''confirmed'')', :'req1'));
  select tests.denied(format('select public.dispatch_ride_request(%L, null, null, 5, ''undercut'')', :'req1'));
  select tests.denied(format($q$
    insert into public.route_fares (route_id, fare_per_seat, effective_from)
    values (%L, 1, current_date)
  $q$, :'ROUTE_A'));
  -- An UPDATE whose USING clause hides the row is a no-op, not an error:
  -- the row is simply not visible to change. Assert that nothing moved.
  do $$
  declare v_n integer;
  begin
    update public.shuttle_routes set name = 'hijacked'
    where id = 'a2000000-0000-0000-0000-000000000001';
    get diagnostics v_n = row_count;
    assert v_n = 0, 'an operator must not rename another operator''s route';
  end $$;
rollback;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'OP_A', true);
  do $$
  begin
    assert (select count(*) from public.ride_requests) = 2,
      'the route''s operator must see both requests on it';
  end $$;
rollback;

-- ---------------------------------------------------------
-- The owning operator can dispatch, and the state machine holds
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'OP_A', true);
  select tests.denied(format('select public.dispatch_ride_request(%L, ''completed'')', :'req1'));
  do $$
  declare v_row public.ride_requests;
  begin
    v_row := public.dispatch_ride_request(
      (select id from public.ride_requests where notes = 'pax1 ride'), 'confirmed');
    assert v_row.status = 'confirmed', 'the operator can confirm';
    assert v_row.operator_id = '11111111-1111-1111-1111-111111111111',
      'confirming takes ownership of the request';
  end $$;
  select tests.denied(format('select public.dispatch_ride_request(%L, ''in_progress'')', :'req1'));
  do $$
  declare v_row public.ride_requests;
  begin
    v_row := public.dispatch_ride_request((select id from public.ride_requests where notes = 'pax1 ride'), null, 'a1000000-0000-0000-0000-000000000001');
    assert v_row.vehicle_id is not null, 'the operator can assign their own vehicle';
    v_row := public.dispatch_ride_request((select id from public.ride_requests where notes = 'pax1 ride'), 'in_progress');
    assert v_row.started_at is not null, 'starting stamps started_at';
    v_row := public.dispatch_ride_request((select id from public.ride_requests where notes = 'pax1 ride'), 'completed');
    assert v_row.completed_at is not null, 'completing stamps completed_at';
    assert v_row.payment_status = 'paid', 'a cash ride settles on completion';
  end $$;
  select tests.denied(format('select public.dispatch_ride_request(%L, null, null, 25, ''too late'')', :'req1'));
rollback;

-- ---------------------------------------------------------
-- A fare correction is recorded; nobody else can write one
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'OP_A', true);
  do $$
  declare v_row public.ride_requests; v_n integer;
  begin
    v_row := public.dispatch_ride_request((select id from public.ride_requests where notes = 'pax1 ride'), null, null, 25, 'association increase');
    assert v_row.fare_per_seat = 25, 'the corrected fare is stored';
    assert v_row.total_price = round(25 * v_row.passengers * (1 + v_row.tax_rate / 100), 2),
      'the total is recomputed from the new fare';
    select count(*) into v_n from public.ride_request_fare_adjustments
    where ride_request_id = v_row.id;
    assert v_n = 1, 'the correction is recorded';
  end $$;
  select tests.denied(format('select public.dispatch_ride_request(%L, null, null, 30, '''')', :'req1'));
  select tests.denied(format('select public.dispatch_ride_request(%L, null, null, -1, ''negative'')', :'req1'));
rollback;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX1', true);
  select tests.denied(format($q$
    insert into public.ride_request_fare_adjustments
      (ride_request_id, changed_by, new_fare_per_seat, new_total, currency, reason)
    values (%L, %L, 0, 0, 'ZAR', 'forged')
  $q$, :'req1', :'PAX1'));
rollback;

-- ---------------------------------------------------------
-- Role enumeration, anonymous access
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'PAX1', true);
  do $$
  begin
    assert public.has_role('33333333-3333-3333-3333-333333333333', 'customer'),
      'a user can ask about their own role';
    assert not public.has_role('55555555-5555-5555-5555-555555555555', 'admin'),
      'has_role must not reveal who the admins are';
    assert not public.has_role('11111111-1111-1111-1111-111111111111', 'operator'),
      'nor who the operators are';
  end $$;
rollback;

begin;
  set local role anon;
  -- EXECUTE was revoked from anon explicitly, so these raise.
  select tests.denied('select public.get_passenger_queue()');
  select tests.denied('select public.has_role(''55555555-5555-5555-5555-555555555555'', ''admin'')');
  -- Tables are granted to anon (as on Supabase) but every policy is `to
  -- authenticated`, so an anonymous reader matches nothing and sees nothing.
  do $$
  begin
    assert (select count(*) from public.ride_requests) = 0, 'anon must read no ride requests';
    assert (select count(*) from public.shuttle_routes) = 0, 'anon must read no routes';
    assert (select count(*) from public.profiles) = 0, 'anon must read no profiles';
    assert (select count(*) from public.route_fares) = 0, 'anon must read no fares';
  end $$;
rollback;

-- ---------------------------------------------------------
-- Admins see across operators
-- ---------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', :'ADMIN', true);
  do $$
  begin
    assert (select count(*) from public.ride_requests) = 2, 'an admin sees every ride request';
    assert public.has_role('11111111-1111-1111-1111-111111111111', 'operator'),
      'an admin may ask about anyone''s role';
  end $$;
rollback;

\echo 'RLS tests passed'
