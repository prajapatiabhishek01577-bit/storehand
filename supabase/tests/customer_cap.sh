#!/usr/bin/env bash
# Applies the cap migration to a plain Postgres with a stub auth.users and checks
# that the 5th signup fails. Needs PG* env vars (CI uses a postgres service).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
psql -v ON_ERROR_STOP=1 -q <<'SQL'
drop schema if exists auth cascade;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
SQL
psql -v ON_ERROR_STOP=1 -q -f "$here/migrations/20261117000000_customer_cap.sql"
for n in 1 2 3 4; do psql -v ON_ERROR_STOP=1 -q -c "insert into auth.users (email) values ('c$n@example.test')"; done
if psql -v ON_ERROR_STOP=1 -q -c "insert into auth.users (email) values ('c5@example.test')" 2>/tmp/cap.err; then
  echo "FAIL: 5th signup was allowed"; exit 1
fi
grep -q "customer limit reached" /tmp/cap.err
[ "$(psql -tAc 'select count(*) from auth.users')" = 4 ]
echo "customer cap: ok"
