/**
 * Small HTTP helpers shared by the payment functions.
 *
 * CORS is wide open on origin because the app is served from GitHub Pages in
 * production and localhost in development; every function still requires a
 * valid JWT (or, for the webhook, a valid provider signature).
 */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const fail = (message: string, status = 400): Response => json({ error: message }, status);

/** Postgres raises carry the operator-facing message; surface it, not a 500. */
export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
