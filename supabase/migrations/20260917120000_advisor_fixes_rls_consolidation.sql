-- =========================================================
-- #19  Supabase advisor findings (run 2026-09-17 on dyynbzbpitjoyfrxnxux)
--
-- SECURITY
--   * rls_auto_enable() is SECURITY DEFINER and executable by anon and
--     authenticated. It is not defined by any migration (left behind by
--     the original scaffolding); revoke EXECUTE so it is not callable
--     over PostgREST.
--   * has_role() answered "is user X an admin/operator?" for *any* X.
--     It now only answers for the caller, or for anyone if the caller
--     is an admin.
--   * create_booking() being SECURITY DEFINER + callable by authenticated
--     is intentional (it is the only way to create a booking) — accepted.
--   * Leaked-password protection is a dashboard toggle, not SQL.
--
-- PERFORMANCE
--   * auth_rls_initplan (28 policies): auth.uid() was re-evaluated per
--     row. Every policy below uses (select auth.uid()) so it is computed
--     once per query.
--   * multiple_permissive_policies (11 findings): several tables had 2–3
--     permissive policies for the same role+action, each evaluated for
--     every row. Consolidated to exactly one policy per table/action,
--     with the same access rules OR-ed together.
--   * unused_index (3, INFO): the database has almost no rows yet; the
--     indexes back foreign keys and the status filter — kept.
--
-- Every policy on the eight application tables is dropped and recreated
-- so the end state is explicit and reviewable in one place.
-- =========================================================

-- ---------------------------------------------------------
-- Functions
-- ---------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role = _role
      -- Only answer about yourself, unless you are an admin.
      and (
        _user_id = (select auth.uid())
        or exists (
          select 1 from public.user_roles a
          where a.user_id = (select auth.uid()) and a.role = 'admin'
        )
      )
  )
$$;

-- ---------------------------------------------------------
-- Drop every existing policy on the application tables
-- ---------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','user_roles','vehicles','bookings','booking_stops',
                        'shuttle_routes','route_stops','ride_requests','operator_settings')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------
-- profiles
-- ---------------------------------------------------------
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));

create policy "profiles_update" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------
create policy "user_roles_select" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));

create policy "user_roles_insert" on public.user_roles for insert to authenticated
  with check (public.has_role((select auth.uid()), 'admin'));

create policy "user_roles_update" on public.user_roles for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

create policy "user_roles_delete" on public.user_roles for delete to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

-- ---------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------
create policy "vehicles_select" on public.vehicles for select to authenticated
  using (
    available = true
    or operator_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
  );

create policy "vehicles_insert" on public.vehicles for insert to authenticated
  with check (operator_id = (select auth.uid()) and public.has_role((select auth.uid()), 'operator'));

create policy "vehicles_update" on public.vehicles for update to authenticated
  using (operator_id = (select auth.uid()))
  with check (operator_id = (select auth.uid()));

create policy "vehicles_delete" on public.vehicles for delete to authenticated
  using (operator_id = (select auth.uid()));

-- ---------------------------------------------------------
-- bookings  (no INSERT policy: create_booking() is the only path)
-- ---------------------------------------------------------
create policy "bookings_select" on public.bookings for select to authenticated
  using (
    customer_id = (select auth.uid())
    or exists (
      select 1 from public.vehicles v
      where v.id = bookings.vehicle_id and v.operator_id = (select auth.uid())
    )
  );

-- Customers may move a pending booking to cancelled; the operator of the
-- vehicle may update freely. Column-level limits for customers are enforced
-- by trg_bookings_guard_customer_update.
create policy "bookings_update" on public.bookings for update to authenticated
  using (
    (customer_id = (select auth.uid()) and status = 'pending')
    or exists (
      select 1 from public.vehicles v
      where v.id = bookings.vehicle_id and v.operator_id = (select auth.uid())
    )
  )
  with check (
    (customer_id = (select auth.uid()) and status in ('pending', 'cancelled'))
    or exists (
      select 1 from public.vehicles v
      where v.id = bookings.vehicle_id and v.operator_id = (select auth.uid())
    )
  );

create policy "bookings_delete" on public.bookings for delete to authenticated
  using (customer_id = (select auth.uid()) and status = 'pending');

-- ---------------------------------------------------------
-- booking_stops  (read-only for clients; written by create_booking())
-- ---------------------------------------------------------
create policy "booking_stops_select" on public.booking_stops for select to authenticated
  using (exists (
    select 1 from public.bookings b
    left join public.vehicles v on v.id = b.vehicle_id
    where b.id = booking_stops.booking_id
      and (b.customer_id = (select auth.uid()) or v.operator_id = (select auth.uid()))
  ));

-- ---------------------------------------------------------
-- shuttle_routes
-- ---------------------------------------------------------
create policy "shuttle_routes_select" on public.shuttle_routes for select to authenticated
  using (
    is_active = true
    or operator_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
  );

create policy "shuttle_routes_insert" on public.shuttle_routes for insert to authenticated
  with check (
    (operator_id = (select auth.uid()) and public.has_role((select auth.uid()), 'operator'))
    or public.has_role((select auth.uid()), 'admin')
  );

create policy "shuttle_routes_update" on public.shuttle_routes for update to authenticated
  using (
    (operator_id = (select auth.uid()) and public.has_role((select auth.uid()), 'operator'))
    or public.has_role((select auth.uid()), 'admin')
  )
  with check (
    (operator_id = (select auth.uid()) and public.has_role((select auth.uid()), 'operator'))
    or public.has_role((select auth.uid()), 'admin')
  );

create policy "shuttle_routes_delete" on public.shuttle_routes for delete to authenticated
  using (
    (operator_id = (select auth.uid()) and public.has_role((select auth.uid()), 'operator'))
    or public.has_role((select auth.uid()), 'admin')
  );

-- ---------------------------------------------------------
-- route_stops
-- ---------------------------------------------------------
create policy "route_stops_select" on public.route_stops for select to authenticated
  using (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_stops.route_id
      and (r.is_active = true
           or r.operator_id = (select auth.uid())
           or public.has_role((select auth.uid()), 'admin'))
  ));

create policy "route_stops_insert" on public.route_stops for insert to authenticated
  with check (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_stops.route_id
      and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  ));

create policy "route_stops_update" on public.route_stops for update to authenticated
  using (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_stops.route_id
      and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  ))
  with check (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_stops.route_id
      and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  ));

create policy "route_stops_delete" on public.route_stops for delete to authenticated
  using (exists (
    select 1 from public.shuttle_routes r
    where r.id = route_stops.route_id
      and (r.operator_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  ));

-- ---------------------------------------------------------
-- ride_requests
-- ---------------------------------------------------------
create policy "ride_requests_select" on public.ride_requests for select to authenticated
  using (
    customer_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
    or (
      public.has_role((select auth.uid()), 'operator')
      and (
        operator_id = (select auth.uid())
        or route_id is null
        or exists (
          select 1 from public.shuttle_routes r
          where r.id = ride_requests.route_id and r.operator_id = (select auth.uid())
        )
      )
    )
  );

create policy "ride_requests_insert" on public.ride_requests for insert to authenticated
  with check (customer_id = (select auth.uid()));

-- Customers: awaiting → cancelled only (column limits via
-- trg_ride_requests_guard_customer_update). Operators: their own taken
-- requests, or untaken ones on their routes; transitions are enforced by
-- dispatch_ride_request().
create policy "ride_requests_update" on public.ride_requests for update to authenticated
  using (
    (customer_id = (select auth.uid()) and status = 'awaiting')
    or (
      public.has_role((select auth.uid()), 'operator')
      and (
        operator_id = (select auth.uid())
        or (
          operator_id is null
          and (
            route_id is null
            or exists (
              select 1 from public.shuttle_routes r
              where r.id = ride_requests.route_id and r.operator_id = (select auth.uid())
            )
          )
        )
      )
    )
  )
  with check (
    (customer_id = (select auth.uid()) and status in ('awaiting', 'cancelled'))
    or (
      public.has_role((select auth.uid()), 'operator')
      and (operator_id is null or operator_id = (select auth.uid()))
    )
  );

-- ---------------------------------------------------------
-- operator_settings
-- ---------------------------------------------------------
create policy "operator_settings_select" on public.operator_settings for select to authenticated
  using (true);

create policy "operator_settings_insert" on public.operator_settings for insert to authenticated
  with check (operator_id = (select auth.uid()) and public.has_role((select auth.uid()), 'operator'));

create policy "operator_settings_update" on public.operator_settings for update to authenticated
  using (operator_id = (select auth.uid()))
  with check (operator_id = (select auth.uid()));
