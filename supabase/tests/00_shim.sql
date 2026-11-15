-- =========================================================
-- Test shim: the parts of a Supabase project the migrations expect
--
-- Applied to a throwaway Postgres before the migrations, so the real
-- migration files run unmodified. Nothing here ships to production —
-- Supabase provides all of it.
-- =========================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

-- Realtime publication (20260917140000 adds ride_requests to it).
create publication supabase_realtime;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Supabase reads the subject from the request's JWT claims; the tests set
-- that setting directly to act as a given user.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- PostgREST's default privileges on the public schema. Supabase grants the
-- API roles broad table and function access and relies on RLS plus explicit
-- REVOKEs to restrict them; default privileges reproduce that for every
-- object the migrations go on to create, so the tests exercise the same
-- grant surface production has.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------
-- Test helper: assert a statement is refused, and refused for the right
-- reason. A typo in a test would otherwise raise undefined_column and be
-- swallowed by a bare exception handler — a test that passes for the wrong
-- reason is worse than no test.
--
-- Accepted refusals: 42501 insufficient_privilege (RLS / revoked EXECUTE),
-- P0001 raise_exception (our guards and RPCs), 23514 check_violation,
-- 23505 unique_violation.
-- ---------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.denied(stmt text)
returns void
language plpgsql
as $$
begin
  execute stmt;
  raise exception 'TESTS_NOT_REFUSED';
exception when others then
  if sqlstate = 'P0001' and sqlerrm = 'TESTS_NOT_REFUSED' then
    raise exception 'should have been refused but succeeded: %', stmt;
  end if;
  if sqlstate not in ('42501', 'P0001', '23514', '23505') then
    raise exception 'expected a policy or rule refusal for [%], got % %', stmt, sqlstate, sqlerrm;
  end if;
end $$;

grant execute on function tests.denied(text) to anon, authenticated, service_role;
