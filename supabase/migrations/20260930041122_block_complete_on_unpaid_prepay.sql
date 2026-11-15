-- =========================================================
-- #32  Completing a ride or booking settles the money
--
-- Two rules, both of which have so far existed only as an absence:
--
--   1. A **prepay** ride or booking must not be marked `completed` while
--      the money has not arrived. Completing it is what tells the operator
--      the fare is earned, and there is no refund or chase-up path — so a
--      completed unpaid prepay row is a fare nobody will ever collect.
--
--   2. A **cash** ride or booking is settled on board, so completing it is
--      exactly the moment `payment_status` becomes `paid`.
--
-- dispatch_ride_request() already applied rule 2 to ride requests, but
-- rule 1 was nowhere, and bookings had neither: the operator UPDATE policy
-- on `bookings` lets the vehicle's owner write any status they like. So
-- both rules go in a BEFORE UPDATE trigger on each table rather than in
-- the RPC — a raw UPDATE from PostgREST has to obey them too.
--
-- Deliberately not exempt: admins and service_role. The money either
-- arrived or it did not, and neither role can make it arrive by asking.
-- To close an unpaid prepay row, cancel it, or mark the payment paid
-- first (which for a real payment is the webhook's job).
-- =========================================================

create or replace function public.settle_payment_on_complete()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_noun text := case tg_table_name when 'bookings' then 'booking' else 'ride' end;
begin
  -- Only the transition into `completed` is interesting. Re-saving an
  -- already-completed row (the updated_at trigger, an admin edit) must not
  -- re-run either rule.
  if new.status::text <> 'completed' or old.status::text = 'completed' then
    return new;
  end if;

  -- Rule 1. `not_required` on a prepay row would be a data fault, not a
  -- waiver, so anything other than `paid` blocks: prepay means prepaid.
  if new.payment_method = 'prepay' and new.payment_status <> 'paid' then
    raise exception
      'This % has not been paid for yet, so it cannot be completed. Wait for the payment, or cancel it.',
      v_noun;
  end if;

  -- Rule 2. Cash is handed over on board; completing the % records it.
  if new.payment_method = 'cash' and new.payment_status <> 'paid' then
    new.payment_status := 'paid';
  end if;

  return new;
end;
$$;

comment on function public.settle_payment_on_complete() is
  'BEFORE UPDATE guard on bookings and ride_requests: refuses to complete an unpaid prepay row, and records cash as collected on completion. #32';

revoke all on function public.settle_payment_on_complete() from public, anon, authenticated;

-- Both run *after* the per-table customer guard (trigger order is
-- alphabetical, and `s` follows `g`), so the guard still judges the
-- caller's own diff rather than the payment_status this one writes.
drop trigger if exists trg_bookings_settle_payment on public.bookings;
create trigger trg_bookings_settle_payment
  before update on public.bookings
  for each row execute function public.settle_payment_on_complete();

drop trigger if exists trg_ride_requests_settle_payment on public.ride_requests;
create trigger trg_ride_requests_settle_payment
  before update on public.ride_requests
  for each row execute function public.settle_payment_on_complete();
