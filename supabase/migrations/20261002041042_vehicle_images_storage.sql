-- =========================================================
-- Vehicle images: a public bucket operators may write to, under their own
-- prefix only
--
-- Until now the vehicle form asked for an "Image URL", so every photo lived
-- on somebody else's host and broke when that host did. Photos now go into
-- Supabase Storage and `vehicles.image` keeps the public URL of the object.
--
-- Rules:
--   * anyone may READ — the listing is public and the bucket is public, so
--     the URL in `vehicles.image` has to resolve without a session;
--   * only an operator may WRITE, and only under `<their uid>/…`, so one
--     operator cannot overwrite or delete another's photos;
--   * the bucket caps size and MIME type server-side, because the browser
--     check in VehicleImageField is a courtesy, not a control.
--
-- The object path is `<operator uuid>/<filename>`; the first folder segment
-- is the owner, which is what every policy below tests.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-images',
  'vehicle-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicle_images_read"   on storage.objects;
drop policy if exists "vehicle_images_insert" on storage.objects;
drop policy if exists "vehicle_images_update" on storage.objects;
drop policy if exists "vehicle_images_delete" on storage.objects;

-- Public read: the bucket is public, and a passenger browsing the fleet is
-- often not signed in yet.
create policy "vehicle_images_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'vehicle-images');

create policy "vehicle_images_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role((select auth.uid()), 'operator')
  );

-- Overwrite (upsert) and tidy-up are confined to the same prefix. USING picks
-- the rows the operator may touch; WITH CHECK stops them moving an object out
-- of their own folder.
create policy "vehicle_images_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "vehicle_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
