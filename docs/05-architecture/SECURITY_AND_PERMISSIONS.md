# Security and Permissions

Status: Accepted Phase 2 security baseline; production assurance still requires implementation and operational evidence

## 1. Trust model

The browser, public requests, uploaded files, headers, query parameters and client-visible role state are untrusted. Authentication establishes identity; it does not grant business authorization. Every protected query and mutation enforces permission and world scope on the server, as close as practical to the use case and data query.

Auth.js integrates identity and session handling. The application-owned `User` and active `RoleAssignment` records remain authoritative for Workspace access. Workspace access is employee-only: accounts are provisioned by authorized administrators, public self-registration is disabled, and a configurable professional-email policy is enforced once the final company domain is confirmed. Authentication activity is recorded with controlled, privacy-minimized events. Selecting the exact identity/email provider, company domain, MFA policy and session duration remains deferred until approved operational inputs exist.

## 2. RBAC plus world scope

Authorization is the intersection of:

`authenticated active user` + `role permission` + `explicit global/world scope` + `resource state/ownership rule`.

UI hiding is usability only and never an authorization control. Global scope is explicit. A missing world scope means no world access, not access to all worlds.

| Capability | Super Admin | Admin | World Manager | Editor | Sales | Contributor | Reader |
|---|---|---|---|---|---|---|---|
| Users | manage | manage except Super Admin boundary | none | none | none | none | none |
| Roles/security | manage | read | none | none | none | none | none |
| Global settings | manage | limited approved settings | none | none | none | none | none |
| World settings | manage | manage | manage scoped active world | read | read | read | read |
| Content | publish/manage | publish/manage | publish scoped world | create/edit/submit scoped | read if granted | contribute if assigned | read scoped |
| Media | manage | manage | manage scoped world | upload/use scoped | read if granted | upload if granted | read scoped |
| Leads | manage | manage | manage scoped world | read only if explicitly granted | manage scoped | read assigned only | none |
| Audit | read | limited read | scoped read | none | none | none | none |

Studio and Training remain teaser/foundation only and receive no operational World Manager scope in the MVP without an approved scope change. A global Sales assignment may span multiple worlds only through explicit scopes.

## 3. Sensitive actions

The following require server-side authorization, deliberate confirmation, audit and recent authentication or equivalent step-up once the identity policy supports it:

- create, activate or remove an administrator;
- assign/revoke roles or world scopes;
- change security or external-integration settings;
- bulk publish/unpublish or destructive delete;
- export commercial or personal data;
- change world identity;
- issue sensitive media access or change rights status.

Access/security administration and commercial export fail closed if their audit event cannot be durably recorded.

## 4. Session and account controls

- Secure, HTTP-only, same-site cookies are required in deployed environments; state-changing HTTP endpoints require CSRF protection appropriate to the Auth.js/Next.js mechanism.
- Session checks include user active status and current assignments; revocation must take effect within a documented bounded interval.
- Login, recovery, invitation and account-linking responses avoid account enumeration.
- Redirect destinations are local or explicitly allow-listed.
- Secrets exist only in environment/secret management, never source, database content settings, logs or client bundles.
- Development identities and bypasses cannot be enabled in preview or production.

## 5. Input, upload and abuse controls

- Runtime schemas reject unexpected or oversized input and validate all server boundaries.
- Public forms use layered abuse controls: rate limits, honeypot or equivalent low-friction checks, idempotency and an adapter for stronger challenge only if later justified.
- Rate limits must account for trusted proxy configuration and cannot trust arbitrary forwarded headers.
- Uploads use allow-listed types, verified signatures where practical, size limits, private quarantine and malware-scanning policy before internal download or publication.
- S3-compatible access uses least-privilege credentials, private buckets by default and short-lived signed operations. Public delivery exposes approved derivatives, not raw private objects.
- Rich content is sanitized and rendered without arbitrary script, HTML or unsafe URL schemes.

## 6. Web and infrastructure controls

The implementation must define CSP, frame restrictions, content-type protections, referrer policy, transport security and permissions policy appropriate to deployed assets. CORS is deny-by-default and enabled only for documented external consumers. Server-side outbound requests use fixed provider endpoints or host allow-lists, timeouts and response-size limits to reduce SSRF risk.

Database and storage credentials use separate least-privilege identities per environment. Production data cannot be copied into local or preview environments without an approved, sanitized process. Dependency provenance, lockfile integrity, security updates and secret scanning are CI/release concerns.

## 7. Audit expectations

Audit events cover authentication/security administration, role and scope changes, publication/scheduling/archival, sensitive world settings, media rights changes, lead assignment/status changes, commercial exports, destructive actions and integration changes.

Each event records time, actor, action, target, applicable world, result and correlation id with allow-listed metadata. Audit is append-only, access-controlled and integrity-monitored. Logs and audit events exclude secrets, tokens, full enquiry bodies, contact details unless strictly required, note bodies and customer-file contents.

Retention, legal access, data-subject handling and evidentiary requirements remain owner/legal decisions. Production release is blocked until those policies and an accountable reviewer are supplied.

## 8. Security verification gates

- Unit tests for authorization policies and lifecycle restrictions.
- Integration tests proving repository-level world scoping and cross-world denial.
- Contract tests for unauthenticated, forbidden, concealed-not-found and conflict outcomes.
- End-to-end tests for role changes, publication, lead access, upload isolation and conditional route absence.
- Static analysis, dependency audit, secret scan and security-header verification.
- Manual threat review for authentication, authorization, public forms, uploads, exports and provider callbacks before release.

Passing code tests is repository evidence only. Production security requires deployment configuration, access-control, logging, backup/restore and operational evidence.
