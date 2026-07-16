# Application Contracts

Status: Accepted Phase 2 baseline; CTO accepted 2026-07-15

## 1. Contract principles

Contracts are defined at application boundaries before transport details. The same use case may be invoked by a Server Action, route handler or scheduled process, but transport code never bypasses validation, authorization or domain policy. Internal TypeScript types alone are not runtime validation.

## 2. Request context

Protected use cases receive a server-created context containing:

- authenticated actor id and account status;
- assigned role and explicit global or world scopes;
- correlation/request id;
- trusted clock;
- origin metadata needed for audit and abuse controls.

Client input cannot supply or override role, scope, owner identity, publication actor, audit actor or trusted timestamps.

## 3. Validation boundary

Validation occurs in layers:

1. transport validation: shape, types, size, allowed MIME types, pagination limits and unknown-field rejection;
2. application validation: authenticated context, permission, world scope, existence and concurrency preconditions;
3. domain validation: lifecycle transitions, publication eligibility, current/future capability rules and invariants;
4. infrastructure validation: database constraints, storage outcome and provider-safe limits.

All public form input is untrusted. Text is normalized without changing intended meaning; rich text is restricted to an approved structured format and safely rendered. URLs, redirects, filenames and object keys require allow-list validation. Upload authorization is short-lived, actor-bound and constrained by type and size.

## 4. Error model

Application use cases return typed outcomes. Stable error codes are separated from localized/user-facing messages.

| Error | Meaning | Typical HTTP mapping |
|---|---|---|
| `VALIDATION_ERROR` | Input failed a declared rule | 400 or field result |
| `UNAUTHENTICATED` | No valid internal session | 401 |
| `FORBIDDEN` | Actor lacks action or world scope | 403 |
| `NOT_FOUND` | Target absent or intentionally concealed | 404 |
| `CONFLICT` | Version, uniqueness or lifecycle conflict | 409 |
| `RATE_LIMITED` | Abuse threshold reached | 429 |
| `DEPENDENCY_UNAVAILABLE` | Replaceable infrastructure failed | 503 when retryable |
| `INTERNAL_ERROR` | Unexpected failure | 500 with correlation id |

Responses never expose stack traces, SQL, provider payloads, secrets, authorization policy detail or whether concealed cross-scope data exists. Logs retain the error code and correlation id with sanitized context.

## 5. Public read contracts

Public queries expose dedicated projections, never ORM records:

- `getPublicWorld(key)` returns only enabled public identity and navigation;
- `listPublishedServices(world, filters)` returns approved-current, Published services only;
- `getPublishedPage(world, slug)` returns a publication-safe structured page projection;
- `listPublishedWork` and `getPublishedCaseStudy` return only approved evidence fields and publishable media;
- `listPublishedResources` is unavailable unless Insights is governed and enabled;
- teaser queries for Studio/Training expose only approved teaser fields and a general information route.

Draft, review, audit, commercial, rights-internal and private attachment fields are excluded by construction. Unapproved conditional routes return not found or are omitted from navigation rather than appearing disabled with speculative copy.

## 6. Public mutation contracts

Initial commands are:

- `submitGeneralContact`;
- `submitProjectOrQuotationRequest`;
- `submitKwalitiPrintQuotationRequest`, restricted to an owner-approved current capability;
- `submitConsultationRequest`, registered only if consultation is approved.

Each command accepts declared contact and brief fields, source page/world, consent responses required by the approved form version, and optional approved attachment references. The server derives canonical source context where possible. Success returns an opaque receipt id and approved next-step wording; it never promises price, response time or availability.

Commands are idempotent for safe client retries through a bounded idempotency key. Abuse controls, payload limits and attachment scanning/quarantine policy must execute before internal use. A recorded submission is not rolled back because a downstream notification fails.

## 7. Workspace query contracts

Queries include scoped content/review lists, content detail, media list/usages, lead list/detail, users/assignments for authorized administrators, and scoped audit history. Every query requires a request context and applies permission plus world scope in the repository query itself. Filtering after retrieving unauthorized rows is forbidden.

Pagination is bounded and deterministic. Search is module-local for MVP. Exports are separate sensitive commands, never an unbounded list response.

## 8. Workspace command contracts

- Content: create draft, edit with version precondition, submit review, reject with note, schedule, publish, archive and preview.
- Media: create upload intent, complete upload, edit metadata/rights, attach usage and archive when unused.
- Leads: assign, change status, add note, set/complete next action and close with a typed outcome.
- Access: provision an employee account with its provider identity, initial role/scope and audit event in one transaction; activate/deactivate users; assign/revoke role and world scope. Provisioning requires deliberate confirmation and an active global Super Admin because it includes security administration. There is no public signup contract.
- Worlds: update governed settings without changing unresolved facts into defaults.

All commands enforce authorization server-side and return the updated projection plus version where useful. Sensitive commands require deliberate confirmation expressed as a fresh command input, not only a UI dialog.

## 9. Compatibility and versioning

Server Components and Server Actions may use in-repository application contracts. Public HTTP endpoints, upload callbacks and integrations are versioned when exposed outside the deployment unit. Additive response changes are preferred; removals or semantic changes require a compatibility plan. Stored structured section payloads carry schema versions and explicit migrations.

## 10. Conditional and provider contracts

Feature availability derives from governed server configuration and approved content, not client flags. Provider ports cover object storage, notification delivery, analytics emission, clock and identity integration. Ports use domain-neutral inputs and map provider errors to typed application errors. Disabled/no-op adapters are valid only for optional capabilities; they cannot silently bypass security, persistence or required audit.
