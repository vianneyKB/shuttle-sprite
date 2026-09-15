-- Lock down EXECUTE on SECURITY DEFINER functions
-- handle_new_user: only fired by trigger on auth.users; no role needs direct EXECUTE
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role: invoked from RLS policies; only authenticated needs EXECUTE
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- get_passenger_queue: called from operator dashboard only
REVOKE ALL ON FUNCTION public.get_passenger_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_passenger_queue() TO authenticated, service_role;

-- calculate_booking_price is SECURITY INVOKER but tighten default grants too
REVOKE ALL ON FUNCTION public.calculate_booking_price(uuid, numeric, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_booking_price(uuid, numeric, integer, integer) TO authenticated, service_role;
