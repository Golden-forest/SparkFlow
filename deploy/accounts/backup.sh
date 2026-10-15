#!/usr/bin/env bash
set -euo pipefail
umask 077

# Operator-only: run as the local OS postgres account using peer authentication.
# Use the table owner/admin, never the RLS-limited application role.
backup_directory="${1:-/var/lib/sparkflow-backups}"
export PGHOST="${PGHOST:-/var/run/postgresql}"
export PGDATABASE="${PGDATABASE:-sparkflow_accounts}"
export PGUSER="${PGUSER:-postgres}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

for binary in pg_dump pg_restore; do
    command -v "$binary" >/dev/null || { printf '%s is required\n' "$binary" >&2; exit 1; }
done
if [[ ! -d "$backup_directory" || ! -w "$backup_directory" ]]; then
    printf 'Create a private, writable backup directory first: %s\n' "$backup_directory" >&2
    exit 1
fi
if [[ "$PGUSER" == "sparkflow_app" ]]; then
    printf 'The application role cannot make a complete backup of RLS-protected data.\n' >&2
    exit 1
fi

backup_path="$backup_directory/accounts-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
partial_path="$backup_path.partial"
cleanup() { rm -f -- "$partial_path"; }
trap cleanup EXIT
pg_dump --no-password --format=custom --lock-wait-timeout=10000 --file="$partial_path"
pg_restore --list "$partial_path" >/dev/null
mv -- "$partial_path" "$backup_path"
if command -v sha256sum >/dev/null; then
    (cd "$backup_directory" && sha256sum "$(basename "$backup_path")" > "$(basename "$backup_path").sha256")
else
    (cd "$backup_directory" && shasum -a 256 "$(basename "$backup_path")" > "$(basename "$backup_path").sha256")
fi
printf 'Backup created (contains private account data): %s\n' "$backup_path"
