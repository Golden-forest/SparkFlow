#!/usr/bin/env bash
set -euo pipefail
umask 077

# No DROP, --clean, --create, or production database replacement is performed.
if [[ $# -lt 2 || $# -gt 3 || ( $# -eq 3 && "$3" != "--apply" ) ]]; then
    printf 'Usage: %s ARCHIVE sparkflow_restore_NAME [--apply]\n' "$0" >&2
    exit 1
fi
archive_path="$1"
restore_database="$2"
restore_role="${RESTORE_ROLE:-sparkflow_migrator}"
if [[ ! -f "$archive_path" || ! "$restore_database" =~ ^sparkflow_restore_[a-z0-9_]+$ || ! "$restore_role" =~ ^[a-z_][a-z0-9_]*$ ]]; then
    printf 'Use an existing trusted archive and a dedicated sparkflow_restore_* database/valid role.\n' >&2
    exit 1
fi
for binary in pg_restore psql; do
    command -v "$binary" >/dev/null || { printf '%s is required\n' "$binary" >&2; exit 1; }
done
pg_restore --list "$archive_path"
if [[ $# -eq 2 ]]; then
    printf '\nReview only. No database was changed. Verify the archive checksum and inspect its SQL before --apply.\n'
    exit 0
fi

export PGHOST="${PGHOST:-/var/run/postgresql}"
export PGUSER="${PGUSER:-postgres}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"
object_count="$(psql --no-password --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 --dbname="$restore_database" --command="
SELECT count(*) FROM (
  SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT t.oid FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT oid FROM pg_extension WHERE extname <> 'plpgsql'
  UNION ALL
  SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public', 'information_schema')
) AS existing_objects;")"
if [[ "$object_count" != "0" ]]; then
    printf 'Refusing to restore into a nonempty database: %s\n' "$restore_database" >&2
    exit 1
fi
pg_restore --no-password --exit-on-error --single-transaction --no-owner \
    --role="$restore_role" --dbname="$restore_database" "$archive_path"
printf 'Restored into %s. Verify role ownership, RLS, login, and data before any separately approved switch.\n' "$restore_database"
