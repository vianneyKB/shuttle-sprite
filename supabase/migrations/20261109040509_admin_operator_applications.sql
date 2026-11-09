-- =========================================================
-- #38  Admin view: approve operators, see all bookings and requests
--
-- The `admin` role and its policies have existed since the first
-- migration; nothing in the product used them. Two gaps had to close
-- before an admin screen could mean anything:
--
--   1. Being an operator was self-granted. handle_new_user honoured a
--      `role: 'operator'` claim from the sign-up form, so anyone who
--      picked "Operator" could immediately publish routes, set fares and
--      take passengers' money. 20260906135126 left that in place with a
--      note to move it behind an admin flow — this is that flow. A claim
--      of 'operator' now files an application; the account starts as a
--      passenger and an admin decides.
--   2. `bookings_select` and `booking_stops_select` were the only read
--      policies on the application tables without an admin branch, so an
--      admin could see every ride request but not a single booking.
--
-- Existing operators keep their role: the backfill records an approved
-- application for each of them, so the pending list starts empty and
-- nobody is locked out of work they already have.
-- =========================================================

create type public.operator_application_status as enum ('pending', 'approved', 'rejected');

create table public.operator_applications (
  id uuid primary key default gen_random_uuid(),
  -- One application per account: the unique constraint is what makes the
  -- sign-up insert and the backfill idempotent.
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status public.operator_application_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text
    check (decision_note is null or char_length(btrim(decision_note)) between 3 and 500),
  -- A pending row carries no decision; a decided row is stamped with when.
  -- `decided_by` stays nullable so the backfill below can record the
  -- grandfathered operators, which no admin actually decided.
  constraint operator_applications_decision_shape check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or (status <> 'pending' and decided_at is not null)
  ),
  -- A rejection the applicant cannot read a reason for is not a decision.
  constraint operator_applications_rejection_has_note check (
    status <> 'rejected' or coalesce(btrim(decision_note), '') <> ''
  )
);
comment on table public.operator_applications is
  'One row per account that asked to operate. Filed by handle_new_user when sign-up claims the operator role; decided only by review_operator_application().';

create index operator_applications_status_idx
  on public.operator_applications(status, requested_at);

alter table public.operator_applications enable row level security;
grant select on public.operator_applications to authenticated;
grant all on public.operator_applications to service_role;

-- The applicant sees their own application and why it was refused; an
-- admin sees all of them. There is deliberately no INSERT, UPDATE or
-- DELETE policy: rows are filed by handle_new_user and decided by
-- review_operator_application(), both SECURITY DEFINER. A client cannot
-- approve itself by writing the row directly.
create policy "operator_applications_select" on public.operator_applications
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));

-- ---------------------------------------------------------
-- Sign-up: every account starts as a passenger
--
-- raw_user_meta_data is client-supplied, so the role claim was already
-- untrusted input (20260906135126 stopped it granting 'admin'). It no
-- longer grants 'operator' either — it files an application. The account
-- is a usable passenger account in the meantime, which is why the
-- customer role is inserted regardless of what was claimed.
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );

  insert into public.user_roles (user_id, role) values (new.id, 'customer');

  if v_claimed = 'operator' then
    insert into public.operator_applications (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------
-- Backfill: the operators who signed up while it was self-serve
--
-- Recorded as approved so they keep working and the admin's pending list
-- is not filled with accounts that are already live. `decided_by` is null
-- because no admin decided them, and the note says so rather than
-- inventing an approver.
-- ---------------------------------------------------------
insert into public.operator_applications (user_id, status, requested_at, decided_at, decision_note)
select ur.user_id,
       'approved',
       coalesce(p.created_at, now()),
       now(),
       'Operating before admin approval existed; recorded as approved by the #38 backfill.'
from public.user_roles ur
left join public.profiles p on p.id = ur.user_id
where ur.role = 'operator'
on conflict (user_id) do nothing;

-- ---------------------------------------------------------
-- review_operator_application: the only way to decide one
--
-- SECURITY DEFINER for the same reason create_booking() is: it is the
-- single path, and it has to write two tables (the application and
-- user_roles) as one unit. The admin check is explicit and first, so the
-- definer rights are not reachable by anyone else.
-- ---------------------------------------------------------
create or replace function public.review_operator_application(
  _user_id uuid,
  _approve boolean,
  _note text default null
)
returns public.operator_applications
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.operator_applications;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only an admin can decide operator applications' using errcode = '42501';
  end if;

  select * into v_row from public.operator_applications
  where user_id = _user_id
  for update;

  if v_row.id is null then
    raise exception 'No operator application for user %', _user_id;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This application was already %', v_row.status;
  end if;
  if not _approve and coalesce(btrim(_note), '') = '' then
    raise exception 'Give a reason when rejecting an application';
  end if;

  update public.operator_applications
  set status = (case when _approve then 'approved' else 'rejected' end)::public.operator_application_status,
      decided_at = now(),
      decided_by = auth.uid(),
      decision_note = nullif(btrim(_note), '')
  where id = v_row.id
  returning * into v_row;

  if _approve then
    insert into public.user_roles (user_id, role)
    values (_user_id, 'operator')
    on conflict (user_id, role) do nothing;
  end if;

  return v_row;
end;
$$;

revoke all on function public.review_operator_application(uuid, boolean, text) from public, anon;
grant execute on function public.review_operator_application(uuid, boolean, text) to authenticated, service_role;

-- ---------------------------------------------------------
-- Admins can read every booking
--
-- Both policies are recreated whole, with the admin branch added, so the
-- end state is readable in one place. Everything else is unchanged from
-- 20260917120000.
-- ---------------------------------------------------------
drop policy if exists "bookings_select" on public.bookings;
create policy "bookings_select" on public.bookings for select to authenticated
  using (
    customer_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
    or exists (
      select 1 from public.vehicles v
      where v.id = bookings.vehicle_id and v.operator_id = (select auth.uid())
    )
  );

drop policy if exists "booking_stops_select" on public.booking_stops;
create policy "booking_stops_select" on public.booking_stops for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (
      select 1 from public.bookings b
      left join public.vehicles v on v.id = b.vehicle_id
      where b.id = booking_stops.booking_id
        and (b.customer_id = (select auth.uid()) or v.operator_id = (select auth.uid()))
    )
  );
