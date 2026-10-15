# Initial findings

- React 19 / Vite 7 / React Router 7 application; existing modular experiment interfaces and control schemas are useful business infrastructure.
- No individual authentication SDK, database, profile model, or permission enforcement exists.
- `functions/_middleware.ts` implements only a shared access code; cookie currently has no signed server expiry, logout, or origin validation.
- Unit tests exist but no unit runner/dependencies/script are declared. React tests mix Jest and Vitest conventions.
- Node 18 documentation does not match Vite 7 requirements or direct Node execution of TypeScript scripts.
- Routes have no wildcard fallback or application error boundary.
- i18n accesses localStorage during module initialization without catching storage failures.
- GitHub deploy workflow only runs build before deployment.

## Implemented corrections
- Shared platform module handles safe browser preferences, validated JSON/manifest data, render recovery and fallback routes.
- Shared gate now has server expiry, nonce/signature, code-hash revocation, origin/body checks, logout and explicit fail-closed configuration.
- Hooks defects, malformed/failed local persistence, deferred initialization and mobile overflow corrected with regression coverage.
- Repeatable Vitest/Node/Playwright/type/lint/security checks and verified-artifact CI established.
- npm audit initially reported 21 advisories (12 high); compatible same-major direct/transitive updates now report zero. This is dependency advisory coverage, not proof of zero application security defects.
- Existing production package majors preserved. No cloud account or database configuration changed.

## Existing Tencent server assessment (2026-10-06)
- User supplied the external Tencent server project; local records dated 2026-10-02 describe a shared 4-core/8-GB/60-GB host running Caddy, CameraAI and Hermes. Authorized read-only SSH measured 6543 MiB available memory, 45 GB free disk and low load; Node 22.23.2 and the existing services are active.
- CameraAI code provides a shared administrator password/session, not individual user accounts. Avoid coupling a reusable account base to that service.
- Anonymous TCP probes reached 80, 443 and 8443, contrary to the old closed-port record. This does not validate HTTP health, certificates or filing status.
- Later SSH inspection found actual listeners on 80/8443, no 443 listener. The existing certificate-validated IP:8443 route returned healthy CameraAI/database/worker results; this does not verify trusted new-domain HTTPS or current ICP status.
- Prefer a separately deployed Node/TypeScript + Better Auth + PostgreSQL module; fewer components than full Supabase is a footprint inference, not a measured resource guarantee. Full Supabase recommends at least 80 GB SSD, exceeding the existing total disk.
- Detailed evidence, cookie/origin boundaries, existing firmware compatibility and verification gates are in server-assessment.md.

## Account implementation verification findings
- Better Auth 1.7.7 + native temporary PostgreSQL and actual loopback SMTP exercise registration, verified sign-in, profile/notes, password recovery, revocation and two-user isolation; tests do not replace production SMTP/HTTPS verification.
- App role guard also rejects parent memberships and schema CREATE, preventing a mistaken grant from allowing SET ROLE or ownership-based bypass.
- Public Suffix List checks (tldts 7.4.16, private suffixes enabled) enforce schemeful same-site deployment while keeping resource hostname distinct from app/API. Port differences do not isolate cookies.
- Better Auth's pinned rate buckets advance lastRequest on successful requests. Restored standard 100/10s global limit, retained stricter sensitive routes and database storage after real-browser sessions exposed overblocking with 60/60s.
- Visual inspection found unlayered universal margin reset overriding Tailwind utilities. Moved reset into the base layer; the account form centering/spacing and existing experiment browser flows were rechecked.
- Latest audit retrieved GHSA-68fv-2mgg-jv7q for source-map-js 1.2.1 after one registry request failure; only the compatible transitive patch was updated to 1.2.2 and both audits passed. Earlier zero-advisory results were snapshots, not a permanent guarantee.
- Notes API 401 now clears private data and refetches the SDK session. Regression coverage checks read/add/delete failures and prevents the stale session from bouncing a signed-out user back to the dashboard.

## Primary sources
- Vite Node requirements: https://vite.dev/guide/
- Cloudflare static headers versus Functions: https://developers.cloudflare.com/pages/configuration/headers/
- Pages routing/failure settings: https://developers.cloudflare.com/pages/functions/routing/
- Server-side session expiry: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Maintainer dependency advisories: https://github.com/advisories/GHSA-chx6-hx7r-mcp5 , https://github.com/advisories/GHSA-4w7w-66w2-5vf9 , https://github.com/advisories/GHSA-mw96-cpmx-2vgc
- Proposed account-provider capabilities (not integrated): https://supabase.com/docs/guides/auth , https://supabase.com/docs/guides/database/postgres/row-level-security
- Better Auth standalone React/Node integration and account flows: https://better-auth.com/docs/installation , https://better-auth.com/docs/integrations/express , https://better-auth.com/docs/authentication/email-password
- Better Auth session/origin/cookie/rate controls: https://better-auth.com/docs/reference/security
- Supabase self-hosting resource requirements and responsibilities: https://supabase.com/docs/guides/self-hosting/docker , https://supabase.com/docs/guides/self-hosting
- Tencent current mainland IP/domain filing explanation: https://cloud.tencent.cn/document/product/243/18910
- Same-site domain parsing including private suffixes: https://github.com/remusao/tldts
- New source-map patch advisory: https://github.com/advisories/GHSA-68fv-2mgg-jv7q
