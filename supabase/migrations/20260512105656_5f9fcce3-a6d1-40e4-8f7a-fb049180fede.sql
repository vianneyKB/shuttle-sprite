
-- =========================================================
-- ENUMS
-- =========================================================
create type public.app_role as enum ('admin', 'vendor', 'customer');
create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type public.stop_type as enum ('pickup', 'dropoff', 'stop');

-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- =========================================================
-- USER ROLES (separate table — never on profiles)
-- =========================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer function — avoids recursive RLS
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- =========================================================
-- VEHICLES
-- =========================================================
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null,
  year int not null,
  capacity int not null check (capacity > 0),
  price_per_hour numeric(10,2) not null check (price_per_hour >= 0),
  price_per_day numeric(10,2) not null check (price_per_day >= 0),
  location text not null,
  features text[] not null default '{}',
  image text,
  available boolean not null default true,
  rating numeric(3,2) not null default 0,
  reviews int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vehicles enable row level security;
create index vehicles_vendor_id_idx on public.vehicles(vendor_id);

-- =========================================================
-- BOOKINGS
-- =========================================================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  passengers int not null check (passengers > 0),
  start_date date not null,
  end_date date,
  days_of_week text[] not null default '{}',
  time text not null,
  duration numeric(6,2) not null check (duration > 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  price_breakdown jsonb not null default '{}'::jsonb,
  status public.booking_status not null default 'pending',
  special_requests text,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bookings enable row level security;
create index bookings_vehicle_id_idx on public.bookings(vehicle_id);
create index bookings_customer_id_idx on public.bookings(customer_id);

-- =========================================================
-- BOOKING STOPS
-- =========================================================
create table public.booking_stops (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  address text not null,
  type public.stop_type not null,
  stop_order int not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.booking_stops enable row level security;
create index booking_stops_booking_id_idx on public.booking_stops(booking_id);

-- =========================================================
-- updated_at TRIGGER
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_vehicles_updated before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger trg_bookings_updated before update on public.bookings
  for each row execute function public.set_updated_at();

-- =========================================================
-- AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'customer')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "Admins can view all profiles"
  on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

-- user_roles: users can read their own roles; only admins can insert/update/delete
create policy "Users can view their own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);
create policy "Admins manage all roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- vehicles
create policy "Anyone authenticated can view available vehicles"
  on public.vehicles for select to authenticated
  using (available = true or vendor_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Vendors create their own vehicles"
  on public.vehicles for insert to authenticated
  with check (vendor_id = auth.uid() and public.has_role(auth.uid(), 'vendor'));
create policy "Vendors update their own vehicles"
  on public.vehicles for update to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());
create policy "Vendors delete their own vehicles"
  on public.vehicles for delete to authenticated
  using (vendor_id = auth.uid());

-- bookings
create policy "Customers view their own bookings"
  on public.bookings for select to authenticated
  using (customer_id = auth.uid());
create policy "Vendors view bookings on their vehicles"
  on public.bookings for select to authenticated
  using (exists (
    select 1 from public.vehicles v
    where v.id = bookings.vehicle_id and v.vendor_id = auth.uid()
  ));
create policy "Customers create their own bookings"
  on public.bookings for insert to authenticated
  with check (customer_id = auth.uid());
create policy "Customers update their own pending bookings"
  on public.bookings for update to authenticated
  using (customer_id = auth.uid() and status = 'pending');
create policy "Vendors update bookings on their vehicles"
  on public.bookings for update to authenticated
  using (exists (
    select 1 from public.vehicles v
    where v.id = bookings.vehicle_id and v.vendor_id = auth.uid()
  ));

-- booking_stops: visible/editable to whoever can see/edit the parent booking
create policy "View stops for accessible bookings"
  on public.booking_stops for select to authenticated
  using (exists (
    select 1 from public.bookings b
    left join public.vehicles v on v.id = b.vehicle_id
    where b.id = booking_stops.booking_id
      and (b.customer_id = auth.uid() or v.vendor_id = auth.uid())
  ));
create policy "Customers manage stops on their bookings"
  on public.booking_stops for all to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_stops.booking_id and b.customer_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.bookings b
    where b.id = booking_stops.booking_id and b.customer_id = auth.uid()
  ));
