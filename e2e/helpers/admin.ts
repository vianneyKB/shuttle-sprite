import { createClient } from "@supabase/supabase-js";

/**
 * Housekeeping only. The journey itself goes through the UI with the anon key,
 * exactly as a passenger does; the service-role key is used for nothing but
 * removing the accounts a run created, so repeated local runs against the same
 * `supabase start` stack stay clean. Every row the test wrote hangs off those
 * two users with `on delete cascade`, so deleting them is the whole cleanup.
 *
 * Without a service-role key (a shared test project, say) this is a no-op and
 * the run simply leaves its users behind — the test never depends on it.
 */
const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function deleteUsersByEmail(emails: string[]): Promise<void> {
  if (!url || !serviceRoleKey) return;

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const wanted = new Set(emails.map((e) => e.toLowerCase()));
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return;

  for (const user of data.users) {
    if (user.email && wanted.has(user.email.toLowerCase())) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}
