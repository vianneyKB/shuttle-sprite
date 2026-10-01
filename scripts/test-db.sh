#!/usr/bin/env bash
# Apply the shim, every migration in order, the seed, then the RLS tests
# against a throwaway Postgres.
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
#     bash scripts/test-db.sh
#
# Locally: docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
# CI runs it against the `postgres` service in .github/workflows/ci.yml.
#
# Applying the migrations in filename order is itself the test that the
# migration chain still replays from nothing.
set -euo pipefail

DB="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
PSQL=(psql "$DB" -v ON_ERROR_STOP=1 --quiet --no-psqlrc)

echo "==> shim"
"${PSQL[@]}" -f supabase/tests/00_shim.sql

echo "==> migrations"
for f in supabase/migrations/*.sql; do
  printf '    %s\n' "$(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "==> seed"
"${PSQL[@]}" -f supabase/tests/10_seed.sql

echo "==> rls tests"
"${PSQL[@]}" -f supabase/tests/20_rls.sql
