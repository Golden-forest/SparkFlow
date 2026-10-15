# Standalone account service

Reusable Node.js 22.12+ / TypeScript account API. Better Auth **1.7.7** owns password hashing, verification/reset tokens, cookies and revocable database sessions. PostgreSQL and SMTP remain independently configured infrastructure. There is no fake production login or email mode.

## Exact commands

Run from `server/`:

```bash
npm ci
cp .env.example .env
cp migration.env.example .env.migration
# Supply a random AUTH_SECRET, restricted app database URL, and real local SMTP.
node --env-file=.env.migration --import tsx scripts/migrate.ts
npm run dev
npm run verify
```

`npm run verify` typechecks, runs real disposable PostgreSQL account tests, and builds. Install PostgreSQL 15+ binaries or set `POSTGRES_BIN` (also accepts `PG_BIN`) to a directory containing `initdb`, `pg_ctl` and `postgres`. Database tests fail instead of silently skipping. A restricted local execution environment may require permission to start loopback services.

Build and production entrypoints:

```bash
npm run build
node --env-file=/etc/sparkflow/accounts/migration.env dist/scripts/migrate.js
node --env-file=/etc/sparkflow/accounts/runtime.env dist/src/index.js
```

Preserve `migrations/*.sql` alongside `dist/`; migration lookup supports both source and compiled modules. Run migrations **before** starting Better Auth: its eager schema validation caches initial schema status. No automatic schema creation occurs in the application process. Each SQL migration is transactionally applied under an advisory lock, tracked by checksum, and cannot be silently edited after application.

## Environment contract

| Variable | Contract |
|---|---|
| `NODE_ENV` | Explicit `development`, `test` or `production` |
| `APP_NAME` | Trusted application label, defaults to `Application`, 1–80 characters |
| `AUTH_BASE_URL` | Exact public API origin; no path, credentials or wildcards |
| `APP_ORIGIN` | Exact frontend origin; only this origin receives credentialed CORS |
| `AUTH_SECRET` | Random secret, at least 32 characters; generate with `openssl rand -hex 32` |
| `PORT` | Defaults to 3100; HTTP server always binds `127.0.0.1` |
| `DATABASE_URL` | Application login role, PostgreSQL connection URL |
| `DATABASE_APP_ROLE` | Expected app login name, defaults to `sparkflow_app` |
| `DATABASE_POOL_MAX` | Defaults to 10, maximum 30; finite connection/query timeouts |
| `MIGRATION_DATABASE_URL` | Only in migration environment; production runtime rejects it |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` | Mandatory real mail configuration (`SMTP_SECURE` must be `true` or `false`) |
| `SMTP_USER`, `SMTP_PASSWORD` | Both required in production; optional together for local Mailpit |

Production requires HTTPS on both public origins and authenticated SMTP with validated TLS certificates (465 implicit TLS or 587 STARTTLS). Startup validates API/frontend origins share the **same site**, using `tldts` 7.4.16 with private Public Suffix List entries included; separate `pages.dev` projects cannot bypass this check. Public hostnames are required. A same-origin `/api` proxy is also supported: host-only `Secure; HttpOnly; SameSite=Lax; Path=/` cookies intentionally do not permit cross-site embedded login. No parent-domain cookie is set. Development/test origins are limited to loopback hosts.

The loopback reverse proxy must overwrite `X-Real-IP` with the actual client address; the application ignores forwarded chains. Never expose port 3100 publicly or forward client-supplied `X-Real-IP` unchanged. Secrets and verification/reset links are never logged by application code. Configure reverse-proxy access logs to omit sensitive query strings too.

## Database permissions

Create a dedicated database owned by a **non-superuser migration role** and a separate `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION` app role without any parent role memberships. Migration grants only schema usage and specific table CRUD. The app role cannot own or create objects in `auth` or `app` schemas; startup rejects inherited ownership, schema creation, an incorrect login or a privileged connection. Denying every parent role also blocks indirect membership and `NOINHERIT` roles that can still be selected with `SET ROLE`.

`auth` contains the pinned, officially generated Better Auth schema. `app.notes` has an indexed owner column, explicit SQL owner predicates, `ENABLE` + `FORCE ROW LEVEL SECURITY`, and a policy using transaction-local `app.current_user_id`. Missing user context gives no access. `asUser()` always ends the transaction, clears pooled context and destroys failed connections. The app role cannot migrate or update notes in place.

The role holds application-level rights to auth tables because Better Auth requires them; do not grant raw SQL access to end users. PostgreSQL RLS protects the notes example even when an application query accidentally omits its owner predicate. It does not replace parameterized queries or authenticated server ownership checks.

## API and frontend contract

- `GET /api/health`: 200 `{status:"ok"}` only when database queries succeed; 503 on failure. Startup additionally verifies app privileges, auth schema and SMTP connectivity.
- `/api/auth/*`: standard Better Auth routes. Email verification is mandatory; sign-up sends a real link and does not create a session. Confirmation redirects to `APP_ORIGIN/account/verify-email`; then the user signs in manually.
- Passwords are 12–128 characters. `sign-up/email` and `update-user` names must be nonblank and at most 80 characters.
- `request-password-reset` uses `redirectTo: APP_ORIGIN/account/reset-password`. Resets revoke all sessions; reset links expire after 30 minutes and are single-use. Email verification links expire after one hour.
- `get-session` uses the Better Auth `{session,user}` or `null` response. Cookie caching is disabled, so sign-out, password reset and session revocation take effect immediately.
- `change-password` and `revoke-other-sessions` are supported built-in routes. Set `revokeOtherSessions:true` when changing a password.
- `GET /api/notes`: `{notes:[{id,body,createdAt}]}`, newest first, up to 100 records.
- `POST /api/notes` with `{body}`: 201 `{note:{id,body,createdAt}}`. Trimmed body length is 1–2000.
- `DELETE /api/notes/:id`: 204 when deleted; 404 for missing or another user's note. Unauthenticated/unverified users receive 401.

Every mutation requires an exact trusted `Origin`. CORS preflight permits only GET/POST/DELETE and Content-Type from `APP_ORIGIN`; use `credentials:"include"`. Auth and response errors remain generic outside Better Auth's standard error contract. The frontend should display generic account errors to avoid enumeration. Database-backed Better Auth rate limiting remains enabled in development, tests and production.

The global rate policy uses Better Auth's standard 100 requests / 10 seconds. Built-in sensitive limits remain stricter: sign-in/sign-up/password change are 3 / 10 seconds; reset/verification resend are 3 / 60 seconds. In this pinned version, successful requests refresh `lastRequest`; a bucket clears after the window passes without another matching request, rather than counting requests in a conventional rolling window. Limits share an IP/path bucket, so users behind the same NAT share the limit. The regression test verifies 70 active session reads stay available while sign-in limits persist across auth instances. Adjust production limits using observed legitimate traffic; never replace database storage with per-process memory.

## Actual mail and browser test fixture

```bash
npm run test:browser-fixture
```

This **test-only source** starts a disposable native PostgreSQL cluster, API at `127.0.0.1:3100`, SMTP at `127.0.0.1:1025`, and mailbox at `127.0.0.1:3101`. Nodemailer connects to real local SMTP; no direct fake sender replaces that path. Frontend origin is `http://127.0.0.1:4175`. `GET /messages?recipient=email` returns `{messages:[{to,subject,text}]}` in arrival order. Test collectors are excluded from compiled output, have no production API route, and reject production mode. Signals stop only the test fixture's own services and remove its temporary cluster.

An injected in-memory mail sink is supported solely by unit/integration tests in `NODE_ENV=test`. Runtime requires SMTP and never accepts a collector override. Email dispatch is asynchronous to avoid account enumeration by SMTP response timing. It is an in-process queue: a crash or rejected SMTP delivery can lose a message; users can request a new verification/reset link. Add a transactional outbox before promising durable mail delivery. Graceful shutdown waits for active HTTP requests and queued delivery, then closes SMTP and the database pool.

Local tests exercise actual HTTP registration, mandatory confirmation, profile update, logout, password reset, old-session revocation, expired/replayed reset tokens, expired sessions, persistent limits across auth instances, database roles, direct SQL RLS and two distinct user accounts. They do not prove production DNS, certificates, SMTP delivery or deployed database configuration.

Official sources: [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql), [Email and password](https://better-auth.com/docs/authentication/email-password), [Sessions](https://better-auth.com/docs/concepts/session-management), [Rate limits](https://better-auth.com/docs/concepts/rate-limit), [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [tldts Public Suffix List options](https://github.com/remusao/tldts).
