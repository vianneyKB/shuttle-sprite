-- =========================================================
-- #20 / #21  Dispatch: operators act on individual ride requests
--
-- ride_requests had a status column but nothing recorded who took the
-- request or with which vehicle, and the only way to change status was
-- a raw UPDATE with no transition rules.
--
-- This adds the dispatch columns, extends RLS so the assigned operator
-- keeps access, and routes every status change through
-- dispatch_ride_request(), which enforces the state machine:
--
--   awaiting ──► confirmed ──► in_progress ──► completed
--       │            │              │
--       └────────────┴──────────────┴──────► cancelled
-- =========================================================

alter table public.ride_requests
  add column if not exists operator_id uuid references auth.users(id) on delete set null,
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

comment on column public.ride_requests.operator_id is 'Operator who confirmed the request.';
comment on column public.ride_requests.vehicle_id is 'Vehicle assigned to carry the passenger(s).';

create index if not exists ride_requests_operator_id_idx on public.ride_requests(operator_id);
create index if not exists ride_requests_vehicle_id_idx on public.ride_requests(vehicle_id);

-- ---------------------------------------------------------
-- RLS: an operator who has taken a request keeps seeing it even if the
-- route is later deleted (route_id becomes null) or reassigned.
-- ---------------------------------------------------------
drop policy if exists "Operators view ride requests on their routes" on public.ride_requests;
create policy "Operators view ride requests on their routes"
  on public.ride_requests for select to authenticated
  using (
    public.has_role(auth.uid(), 'operator')
    and (
      operator_id = auth.uid()
      or route_id is null
      or exists (
        select 1 from public.shuttle_routes r
        where r.id = ride_requests.route_id and r.operator_id = auth.uid()
      )
    )
  );

drop policy if exists "Operators update ride requests" on public.ride_requests;
create policy "Operators update ride requests"
  on public.ride_requests for update to authenticated
  using (
    public.has_role(auth.uid(), 'operator')
    and (
      operator_id = auth.uid()
      or (
        operator_id is null
        and (
          route_id is null
          or exists (
            select 1 from public.shuttle_routes r
            where r.id = ride_requests.route_id and r.operator_id = auth.uid()
          )
        )
      )
    )
  )
  with check (
    public.has_role(auth.uid(), 'operator')
    and (operator_id is null or operator_id = auth.uid())
  );

-- ---------------------------------------------------------
-- dispatch_ride_request: the one way operators change a request
--
-- SECURITY INVOKER so the policies above still gate row access. Pass a
-- status to transition, a vehicle to (re)assign, or both. Confirming
-- stamps operator_id; the vehicle must belong to the caller.
-- ---------------------------------------------------------
create or replace function public.dispatch_ride_request(
  _id uuid,
  _status public.ride_request_status default null,
  _vehicle_id uuid default null
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
      payment_status = v_row.payment_status
  where id = _id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.dispatch_ride_request(uuid, public.ride_request_status, uuid) from public, anon;
grant execute on function public.dispatch_ride_request(uuid, public.ride_request_status, uuid) to authenticated, service_role;

-- The customer-side guard trigger already lets operators through; nothing
-- else needs to change for it.
