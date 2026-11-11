#!/usr/bin/env bash
# Run the Playwright journey against a real Supabase.
#
#   bash scripts/test-e2e.sh                 # local stack via the Supabase CLI
#   bash scripts/test-e2e.sh --headed        # extra args go to Playwright
#   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... \
#     bash scripts/test-e2e.sh               # a dedicated test project instead
#
# The local path needs the Supabase CLI and Docker. The test signs users up,
# creates a route and dispatches a ride, so point it at a throwaway project —
# never at production (ref dyynbzbpitjoyfrxnxux).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "${VITE_SUPABASE_URL:-}" && -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  echo "==> using the Supabase at $VITE_SUPABASE_URL"
else
  if ! command -v supabase >/dev/null 2>&1; then
    echo "supabase CLI not found. Install it (https://supabase.com/docs/guides/cli)" >&2
    echo "or set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for a test project." >&2
    exit 1
  fi

  echo "==> supabase start"
  # Studio, image proxy and the log pipeline are not part of the journey.
  supabase start -x studio,imgproxy,logflare,vector >/dev/null

  # A clean database on every run: `db reset` replays every migration in
  # filename order, so a run never inherits the last one's routes or users.
  echo "==> supabase db reset"
  supabase db reset >/dev/null

  eval "$(supabase status -o env)"
  export VITE_SUPABASE_URL="${API_URL:?supabase status did not report API_URL}"
  export VITE_SUPABASE_PUBLISHABLE_KEY="${ANON_KEY:?supabase status did not report ANON_KEY}"
  export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
fi

echo "==> playwright"
npx playwright test "$@"
