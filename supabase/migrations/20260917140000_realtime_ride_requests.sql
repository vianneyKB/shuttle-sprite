-- =========================================================
-- #22  Realtime for ride requests
--
-- Passengers and operators currently see one-shot query results. Adding
-- ride_requests to the supabase_realtime publication lets the client
-- subscribe to postgres_changes. RLS still applies: each subscriber only
-- receives rows their SELECT policy allows, so passengers see their own
-- requests and operators see their routes' / their own taken requests.
--
-- REPLICA IDENTITY FULL makes UPDATE/DELETE events carry the old row too,
-- which Realtime needs to evaluate filters like customer_id=eq.<uid>.
-- =========================================================

alter table public.ride_requests replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ride_requests'
  ) then
    alter publication supabase_realtime add table public.ride_requests;
  end if;
end $$;
