-- =========================================================
-- Seed for the RLS tests
--
-- Two operators who must not see each other's work, two passengers who
-- must not see each other's rides, and one admin. Users go in through
-- auth.users so handle_new_user assigns the role the same way a real
-- sign-up does.
-- =========================================================

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'op-a@example.com',
   '{"display_name":"Operator A","phone":"0821110000","role":"operator"}'),
  ('22222222-2222-2222-2222-222222222222', 'op-b@example.com',
   '{"display_name":"Operator B","phone":"0822220000","role":"operator"}'),
  ('33333333-3333-3333-3333-333333333333', 'pax-1@example.com',
   '{"display_name":"Passenger One","phone":"0833330000","role":"customer"}'),
  ('44444444-4444-4444-4444-444444444444', 'pax-2@example.com',
   '{"display_name":"Passenger Two","phone":"0844440000","role":"customer"}'),
  ('55555555-5555-5555-5555-555555555555', 'admin@example.com',
   '{"display_name":"Admin","phone":"0855550000","role":"customer"}');

-- handle_new_user grants neither 'admin' nor (since #38) 'operator' from
-- client metadata, so the platform grants those out of band. Operator A and
-- Operator B are approved operators; their applications are approved too, so
-- the pending list in the admin tests contains only the account below that is
-- actually waiting.
insert into public.user_roles (user_id, role) values
  ('55555555-5555-5555-5555-555555555555', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'operator'),
  ('22222222-2222-2222-2222-222222222222', 'operator');

update public.operator_applications
set status = 'approved', decided_at = now(),
    decided_by = '55555555-5555-5555-5555-555555555555'
where user_id in ('11111111-1111-1111-1111-111111111111',
                  '22222222-2222-2222-2222-222222222222');

-- One account still waiting on a decision, so the admin tests have a real
-- pending application and the applicant has one row they may read.
insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'applicant@example.com',
   '{"display_name":"Applicant","phone":"0866660000","role":"operator"}');

-- Operator A: a vehicle, a route with two stops, and a fare.
insert into public.vehicles (id, operator_id, make, model, year, capacity,
                             price_per_hour, price_per_day, location, available)
values ('a1000000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'Toyota', 'Quantum', 2022, 14, 100, 800, 'Johannesburg', true);

insert into public.shuttle_routes (id, operator_id, name, is_active)
values ('a2000000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'Rank A to Mall B', true);

insert into public.route_stops (id, route_id, name, stop_order, lat, lng) values
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
   'Rank A', 0, -26.2041, 28.0473),
  ('a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001',
   'Mall B', 1, -26.1076, 28.0567);

insert into public.route_fares (route_id, fare_per_seat, effective_from, created_by)
values ('a2000000-0000-0000-0000-000000000001', 18, current_date,
        '11111111-1111-1111-1111-111111111111');

-- Operator B: their own route, so "not mine" is a real row and not an empty table.
insert into public.shuttle_routes (id, operator_id, name, is_active)
values ('b2000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', 'Other operator route', true);

insert into public.route_stops (id, route_id, name, stop_order, lat, lng) values
  ('b3000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001',
   'Rank C', 0, -25.7479, 28.2293),
  ('b3000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001',
   'Mall D', 1, -25.7700, 28.2100);
