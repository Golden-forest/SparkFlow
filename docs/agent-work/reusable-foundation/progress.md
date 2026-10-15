# Progress

## Completed (2026-10-06)
- Repository, architecture, shared gate, verification and existing Tencent host audited. Existing user edits and unrelated files preserved; no commit, push, cloud install or deployment performed.
- Runtime/render recovery, fallback routes, validated resource loading/retry, resilient preference storage, explicit persistence failure, keyboard/mobile fixes and verified legacy lint corrections implemented.
- Shared access-code gate hardened: signed server expiry, rotation, logout, origin/body checks, exact resource-frame/CORS configuration, private caching and explicit fail-closed settings.
- Independent Better Auth 1.7.7 frontend and Node/TypeScript API implemented: registration, email verification, sign-in/out, session restoration, profile, password recovery/change and other-device revocation. Business-route protection is reusable without account page chrome.
- Native PostgreSQL migrations, separate operator/runtime roles, startup role checks, FORCE RLS and a user-owned notes API implemented. Unauthorized notes requests clear private data and refresh the real session.
- Separate account/resource production artifacts, distinct hostnames, PSL same-site guards and iframe storage/cookie isolation implemented. Original public sources remain intact.
- Compatible dependency patches and canonical verification/CI harness established. Latest root and server dependency audits both report zero vulnerabilities.
- Reviewable Caddy/systemd/database/backup/restore/rollback materials created. Real disposable PostgreSQL backup/restore drill preserved records, ownership and FORCE RLS and rejected nonempty/production targets.
- Setup and reuse documented in docs/foundation.md, docs/accounts.md, README and AGENTS.

## Final verification
- npm run verify passed with exit 0: lint, frontend/server/test typechecks, 119 Vitest tests, 18 physics tests, 14 gate tests, 2 real-PG account suites, both dependency audits, server/frontend builds, 12 experiment browser tests and 4 account browser flows. Total: 153 unit/integration tests and 16 browser tests.
- Desktop and 375px mobile account checks used real temporary PostgreSQL, HTTP APIs and SMTP; covered email confirmation, password recovery/change, device revocation, two-user isolation, resource iframe isolation and console errors. Screenshots were visually inspected.
- One intervening verification attempt was interrupted by confirmed Mac clamshell sleep from 09:48 until 11:18. The full repeat while awake passed; no product behavior or timeout was relaxed to hide that failure.
- Explicit account-enabled production and build:content commands passed. Artifact assertions found 1 account HTML, 211 resource HTML including its landing page, all 210 original resource HTML preserved, all four resource directories isolated and redirected.
- git diff --check passed. Fixture shutdown was verified: no task-created PostgreSQL/browser API/Vite processes or temporary sleep-prevention process remained.
- Local runtime is Node 25. Target host Node 22.23.2 was observed read-only; remote Node 22 CI and production platform behavior have not been executed.

## Server assessment
- User confirmed the independent account architecture and authorized SSH read-only inspection. Live shared host had 6543 MiB available memory, 45 GB free disk, low load, Node 22.23.2 and active Caddy/CameraAI API/worker.
- Existing certificate-validated IP:8443 health route returned HTTP 200 with database OK and fresh worker heartbeat. Actual listeners were 80/8443, not 443; this does not verify trusted new-domain HTTPS or ICP status. See server-assessment.md for evidence and scope.

## Remaining production activation
- Confirm domain/ICP/connection-filing status and the existing SMTP service/configuration location; these details were requested and remain unanswered.
- Server installation, new services, DNS/Caddy changes and publication remain pending. No existing CameraAI/Hermes service or cloud configuration was changed.
- Validate Caddy/systemd templates on target Ubuntu, activate trusted HTTPS and real SMTP, arrange encrypted off-host backup/alerts, and repeat two-user production flows plus the original CameraAI IP:8443 check.
- Verify Cloudflare Production/Preview gate settings, Fail closed and distributed rate limits, and check each resource's compatibility after deployment to its new origin.
- Mail delivery uses a process-local queue; abnormal termination can lose pending messages. Resend is supported, durable delivery is not guaranteed. Existing experiment chunks still have size warnings; future optimization can split them further as needed.
