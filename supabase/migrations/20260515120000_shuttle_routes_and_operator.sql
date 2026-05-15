
-- Rename vendor role → operator
ALTER TYPE public.app_role RENAME VALUE 'vendor' TO 'operator';

-- Rename vehicles.vendor_id → operator_id
ALTER TABLE public.vehicles RENAME COLUMN vendor_id TO operator_id;
ALTER INDEX vehicles_vendor_id_idx RENAME TO vehicles_operator_id_idx;

-- Drop old vehicle policies (vendor naming)
DROP POLICY IF EXISTS "Vendors create their own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Vendors update their own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Vendors delete their own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Vendors view bookings on their vehicles" ON public.bookings;
DROP POLICY IF EXISTS "Vendors update bookings on their vehicles" ON public.bookings;

-- Recreate vehicle policies with operator naming
CREATE POLICY "Operators create their own vehicles"
  ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (operator_id = auth.uid() AND public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Operators update their own vehicles"
  ON public.vehicles FOR UPDATE TO authenticated
  USING (operator_id = auth.uid())
  WITH CHECK (operator_id = auth.uid());

CREATE POLICY "Operators delete their own vehicles"
  ON public.vehicles FOR DELETE TO authenticated
  USING (operator_id = auth.uid());

-- Update select policy (drop and recreate with operator_id)
DROP POLICY IF EXISTS "Anyone authenticated can view available vehicles" ON public.vehicles;
CREATE POLICY "Anyone authenticated can view available vehicles"
  ON public.vehicles FOR SELECT TO authenticated
  USING (available = true OR operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators view bookings on their vehicles"
  ON public.bookings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = bookings.vehicle_id AND v.operator_id = auth.uid()
  ));

CREATE POLICY "Operators update bookings on their vehicles"
  ON public.bookings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = bookings.vehicle_id AND v.operator_id = auth.uid()
  ));

-- Update booking_stops policy
DROP POLICY IF EXISTS "View stops for accessible bookings" ON public.booking_stops;
CREATE POLICY "View stops for accessible bookings"
  ON public.booking_stops FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
    WHERE b.id = booking_stops.booking_id
      AND (b.customer_id = auth.uid() OR v.operator_id = auth.uid())
  ));

-- Payment method on fleet bookings
CREATE TYPE public.payment_method AS ENUM ('cash', 'prepay');
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'paid'));

-- =========================================================
-- SHUTTLE ROUTES (GeoJSON LineString in geometry column)
-- =========================================================
CREATE TABLE public.shuttle_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  operating_hours text,
  geometry jsonb NOT NULL DEFAULT '{"type":"LineString","coordinates":[]}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shuttle_routes ENABLE ROW LEVEL SECURITY;
CREATE INDEX shuttle_routes_operator_id_idx ON public.shuttle_routes(operator_id);

CREATE TRIGGER trg_shuttle_routes_updated BEFORE UPDATE ON public.shuttle_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- ROUTE STOPS (ordered points on a route)
-- =========================================================
CREATE TABLE public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.shuttle_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  stop_order int NOT NULL,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE INDEX route_stops_route_id_idx ON public.route_stops(route_id);

-- =========================================================
-- RIDE REQUESTS (passenger pickup → destination, queue for drivers)
-- =========================================================
CREATE TYPE public.ride_request_status AS ENUM (
  'awaiting', 'confirmed', 'in_progress', 'completed', 'cancelled'
);

CREATE TABLE public.ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.shuttle_routes(id) ON DELETE SET NULL,
  origin_name text NOT NULL,
  origin_lat numeric(10,7) NOT NULL,
  origin_lng numeric(10,7) NOT NULL,
  destination_name text NOT NULL,
  destination_lat numeric(10,7) NOT NULL,
  destination_lng numeric(10,7) NOT NULL,
  passengers int NOT NULL DEFAULT 1 CHECK (passengers > 0),
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  payment_status text NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'paid')),
  status public.ride_request_status NOT NULL DEFAULT 'awaiting',
  scheduled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX ride_requests_customer_id_idx ON public.ride_requests(customer_id);
CREATE INDEX ride_requests_status_idx ON public.ride_requests(status);
CREATE INDEX ride_requests_route_id_idx ON public.ride_requests(route_id);

CREATE TRIGGER trg_ride_requests_updated BEFORE UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- RLS: shuttle_routes
-- =========================================================
CREATE POLICY "Authenticated users view active routes"
  ON public.shuttle_routes FOR SELECT TO authenticated
  USING (is_active = true OR operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators manage their routes"
  ON public.shuttle_routes FOR ALL TO authenticated
  USING (operator_id = auth.uid() AND public.has_role(auth.uid(), 'operator'))
  WITH CHECK (operator_id = auth.uid() AND public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins manage all routes"
  ON public.shuttle_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- RLS: route_stops
-- =========================================================
CREATE POLICY "View stops on visible routes"
  ON public.route_stops FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shuttle_routes r
    WHERE r.id = route_stops.route_id
      AND (r.is_active = true OR r.operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Operators manage stops on their routes"
  ON public.route_stops FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shuttle_routes r
    WHERE r.id = route_stops.route_id AND r.operator_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shuttle_routes r
    WHERE r.id = route_stops.route_id AND r.operator_id = auth.uid()
  ));

-- =========================================================
-- RLS: ride_requests
-- =========================================================
CREATE POLICY "Customers view own ride requests"
  ON public.ride_requests FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Operators view ride requests on their routes"
  ON public.ride_requests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'operator')
    AND (
      route_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.shuttle_routes r
        WHERE r.id = ride_requests.route_id AND r.operator_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins view all ride requests"
  ON public.ride_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers create ride requests"
  ON public.ride_requests FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers cancel own awaiting requests"
  ON public.ride_requests FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() AND status = 'awaiting');

CREATE POLICY "Operators update ride requests"
  ON public.ride_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'operator')
    AND (
      route_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.shuttle_routes r
        WHERE r.id = ride_requests.route_id AND r.operator_id = auth.uid()
      )
    )
  );

-- Queue summary for operators (passengers awaiting same direction)
CREATE OR REPLACE FUNCTION public.get_passenger_queue()
RETURNS TABLE (
  origin_name text,
  destination_name text,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  request_count bigint,
  total_passengers bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    origin_name,
    destination_name,
    origin_lat,
    origin_lng,
    destination_lat,
    destination_lng,
    COUNT(*)::bigint AS request_count,
    SUM(passengers)::bigint AS total_passengers
  FROM public.ride_requests
  WHERE status = 'awaiting'
  GROUP BY origin_name, destination_name, origin_lat, origin_lng, destination_lat, destination_lng
  ORDER BY total_passengers DESC, request_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_passenger_queue() TO authenticated;

-- Update signup default role metadata key (handle_new_user still uses 'role' from metadata)
-- Existing signups with role 'vendor' in metadata would fail; document migration for users
