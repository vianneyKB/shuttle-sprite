
-- Fix mutable search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- handle_new_user is only called by the auth trigger; revoke broad execute
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- has_role must remain executable by authenticated (used in RLS policies),
-- but should not be callable by anon
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
