-- =========================================================
-- #18  Transactional save_route_stops
--
-- Problem: the client saved stops as three separate requests — delete all
-- stops, insert the new set, update shuttle_routes.geometry. A failure
-- after the delete left a route with no stops and a stale LineString,
-- and the delete's own error was never checked.
--
-- Fix: one SECURITY INVOKER function. A function call is a single
-- transaction, so either every statement lands or none does. RLS still
-- applies to each statement, and an explicit ownership check gives a
-- clear error instead of a silent zero-row delete.
-- =========================================================

-- Two stops on one route can't share a position.
alter table public.route_stops
  add constraint route_stops_route_id_stop_order_key unique (route_id, stop_order);

create or replace function public.save_route_stops(
  _route_id uuid,
  _stops jsonb   -- [{name, description?, lat, lng}, …] in order
)
returns setof public.route_stops
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_stop jsonb;
  v_idx integer := 0;
  v_lat numeric;
  v_lng numeric;
  v_coords jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.shuttle_routes r
    where r.id = _route_id
      and (r.operator_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  ) then
    raise exception 'Route % not found or not yours', _route_id using errcode = '42501';
  end if;

  if _stops is null or jsonb_typeof(_stops) <> 'array' then
    raise exception 'Stops must be an array';
  end if;
  if jsonb_array_length(_stops) < 2 then
    raise exception 'A route needs at least 2 stops';
  end if;

  -- Validate everything before touching the table.
  for v_stop in select * from jsonb_array_elements(_stops) loop
    v_idx := v_idx + 1;
    if coalesce(btrim(v_stop ->> 'name'), '') = '' then
      raise exception 'Stop % needs a name', v_idx;
    end if;
    begin
      v_lat := (v_stop ->> 'lat')::numeric;
      v_lng := (v_stop ->> 'lng')::numeric;
    exception when others then
      raise exception 'Stop % has invalid coordinates', v_idx;
    end;
    if v_lat is null or v_lng is null
       or v_lat < -90 or v_lat > 90 or v_lng < -180 or v_lng > 180 then
      raise exception 'Stop % has coordinates out of range', v_idx;
    end if;
  end loop;

  delete from public.route_stops where route_id = _route_id;

  v_idx := 0;
  for v_stop in select * from jsonb_array_elements(_stops) loop
    v_lat := (v_stop ->> 'lat')::numeric;
    v_lng := (v_stop ->> 'lng')::numeric;
    insert into public.route_stops (route_id, name, description, stop_order, lat, lng)
    values (
      _route_id,
      btrim(v_stop ->> 'name'),
      nullif(btrim(v_stop ->> 'description'), ''),
      v_idx,
      v_lat,
      v_lng
    );
    -- GeoJSON is [lng, lat]. Wrap the pair so `||` appends one element
    -- rather than concatenating the two numbers into the outer array.
    v_coords := v_coords || jsonb_build_array(jsonb_build_array(v_lng, v_lat));
    v_idx := v_idx + 1;
  end loop;

  update public.shuttle_routes
  set geometry = jsonb_build_object('type', 'LineString', 'coordinates', v_coords)
  where id = _route_id;

  return query
    select * from public.route_stops
    where route_id = _route_id
    order by stop_order;
end;
$$;

revoke all on function public.save_route_stops(uuid, jsonb) from public, anon;
grant execute on function public.save_route_stops(uuid, jsonb) to authenticated, service_role;
