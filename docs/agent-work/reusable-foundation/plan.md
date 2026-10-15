# Reusable foundation

## Objective
Keep the existing physics app working while establishing reusable application infrastructure so future projects can focus on business features.

## Decisions and gates
- Preserve existing uncommitted physics, social publishing, and document changes.
- User confirmed isolated Better Auth + Node/TypeScript + PostgreSQL on the existing Tencent host, retaining the Cloudflare frontend, and authorized read-only SSH inspection. Installation and deployment remain a later, concrete approval step; do not modify the shared server during inspection.
- Current shared access-code gate is not user authentication; preserve its deployment semantics while fixing verified defects.
- Keep public experiments available; isolate account and user-data concerns from experiment code.

## Implementation
1. Audit architecture, access gate, and baseline verification in parallel.
2. Restore repeatable unit/browser/type/build checks and CI; fix verified legacy lint defects and check dependency advisories.
3. Add runtime recovery, route fallback, resilient local preferences, and secure configuration defaults.
4. Add reusable authentication, profile, and user-owned data foundation once backend is selected.
5. Document setup/reuse and remaining external activation requirements.

## Success criteria
- Existing experiment smoke flows continue to work.
- Foundation routes recover from loading/error/unknown-route states.
- Account flows include registration, login, session lifecycle, password recovery, and account profile, backed by real service APIs (no fake production auth).
- User-owned database records enforce authorization at the data layer.
- A canonical aggregate verification command returns nonzero on required failures.
- Review scoped diff and verify browser desktop/mobile, console errors, config failures, and account flows.

## Current gate
Local foundation implementation and verification are complete. Runtime recovery, access-code hardening, individual account flows, database isolation, resource-origin separation, compatible dependency patches and reusable business-route protection pass the aggregate checks. Production activation is a separate pending stage: current domain/filing and SMTP details must be confirmed, and shared-host installation/publication remain unperformed.

The concrete server proposal and remaining live verification are in [server-assessment.md](server-assessment.md). Old server port/filing records cannot establish current state. Complete local implementation and verification before requesting permission to install or deploy on the shared host.
