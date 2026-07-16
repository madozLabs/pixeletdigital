# Data Model

Status: Accepted conceptual and logical Phase 2 baseline; Prisma schema follows during scaffolding

## 1. Modeling rules

- PostgreSQL is the source of record; Prisma is the persistence adapter.
- Application-generated opaque identifiers are used at boundaries. Public slugs are mutable business data, never foreign keys.
- All mutable records carry creation and update timestamps; material records also carry creator/updater identifiers where meaningful.
- World-owned records require a non-null primary `worldId`.
- Archive timestamps preserve history. Hard deletion is not a normal lifecycle operation.
- Enumerations below are controlled application vocabularies. Unknown owner inputs remain null, disabled or separate decision data; they are not guessed defaults.
- Free-form JSON is limited to versioned, validated presentation configuration or sanitized audit metadata. Core relationships and searchable business state use typed columns and relations.

## 2. Access and world entities

| Entity | Purpose and essential fields |
|---|---|
| `User` | Internal identity: id, name, email-normalized identifier, status, timestamps. No role inferred from email domain. |
| `AuthAccount` | Auth.js provider linkage: userId, provider key, provider account id. Provider selection remains configuration. |
| `RoleAssignment` | userId, role, optional worldId, active interval. Global scope is explicit, not represented by an arbitrary world. |
| `World` | id, stable key, governed display name, mode (`ACTIVE`, `TEASER`, `INACTIVE`), timestamps. Initial keys identify Pixel&Digital, Kwaliti Print, Studio and Training without inventing final Studio/Training names. |
| `WorldSetting` | worldId, versioned setting key and validated value for approved public configuration. Secrets are prohibited. |

Initial roles are `SUPER_ADMIN`, `ADMIN`, `WORLD_MANAGER`, `EDITOR`, `SALES`, `CONTRIBUTOR` and `READER`. Roles do not replace per-action authorization checks.

## 3. Content entities

| Entity | Purpose and essential fields |
|---|---|
| `Page` | worldId, page type, governed title, slug, lifecycle, publication timestamps, SEO fields and revision reference. |
| `PageSection` | pageId, controlled section type, ordered structured payload with schema version. No unrestricted page builder. |
| `ServiceFamily` | worldId, candidate label, order and lifecycle. Candidate records do not imply owner approval. |
| `Service` | worldId, optional familyId, governed name, availability status, lifecycle and structured description. |
| `CaseStudy` | primary worldId, title, lifecycle, context and approved narrative fields. |
| `CaseStudyContribution` | caseStudyId and contributing worldId. |
| `CaseStudyService` | caseStudyId and serviceId. |
| `Outcome` | caseStudyId, value/display text, evidence source and approval state; no invented metric. |
| `Testimonial` | worldId, attributable text fields, permission/evidence state and lifecycle. |
| `TeamProfile` | worldId, governed public fields and lifecycle. |
| `Resource` | worldId, resource type, lifecycle and structured content; exposed only if Insights is approved and enabled. |
| `NavigationItem` | worldId, parent, order, label, validated destination and lifecycle. |
| `ContentRevision` | content type/id, version, structured snapshot or diff, actor, note and timestamp. |
| `ReviewRecord` | content type/id, submitter, reviewer, outcome, note and timestamp. |

Canonical content lifecycle is `DRAFT`, `IN_REVIEW`, optional `SCHEDULED`, `PUBLISHED`, `ARCHIVED`. Rejection creates a review record and returns the item to `DRAFT`. `PREVIEW` is not a stored state.

Service availability is distinct from lifecycle: `CANDIDATE`, `CURRENT_STATED`, `APPROVED_CURRENT`, `FUTURE_ONLY`, `WITHDRAWN`. The initial data must represent Pixel&Digital entries as `CANDIDATE`, Personalized Gadgets as `CURRENT_STATED`, and Banner Printing, Vinyl Printing and 3D Lettering/CNC as `FUTURE_ONLY`. Only an owner-governed transition may set `APPROVED_CURRENT`.

## 4. Media entities

| Entity | Purpose and essential fields |
|---|---|
| `MediaAsset` | worldId, storage key, original filename, media type, MIME type, byte size, checksum, dimensions/duration when known, lifecycle and timestamps. |
| `MediaMetadata` | assetId, alternative text, caption, credit and validated usage context. |
| `MediaRights` | assetId, rights status, source, approver reference and optional validity dates. Missing rights are not approval. |
| `MediaUsage` | assetId, owning module, entity type/id and usage role; used to prevent destructive deletion. |
| `UploadIntent` | short-lived actor-bound upload authorization, constraints, expiry and completion state. |

Customer attachments use private object access and a separate usage classification from public editorial media. Storage keys never encode sensitive user data.

## 5. Enquiry and lead entities

| Entity | Purpose and essential fields |
|---|---|
| `Enquiry` | type, worldId, optional approved serviceId, normalized contact fields, message/brief, source page, submission time, anti-abuse status and processing state. |
| `ConsentRecord` | enquiryId, purpose/version key, captured response, timestamp and source; wording remains owner/legal supplied. |
| `EnquiryAttachment` | enquiryId, private media asset id and validated classification. |
| `Lead` | worldId, primary contact data, source, status, ownerUserId, originating enquiry reference and timestamps. |
| `LeadEnquiry` | explicit association supporting deduplication without losing submissions. |
| `LeadNote` | leadId, author, body, visibility classification and timestamp. |
| `NextAction` | leadId, owner, description, due date, status and completion timestamp. |
| `LeadActivity` | leadId, typed event, actor and timestamp. |

Lead status begins with a minimal controlled vocabulary: `NEW`, `IN_REVIEW`, `QUALIFIED`, `UNQUALIFIED`, `CLOSED`. Any sales-stage expansion requires a product decision. Contact deduplication is conservative: normalized identifiers may suggest a match, but submissions are never silently discarded or merged irreversibly.

## 6. Audit and operational entities

| Entity | Purpose and essential fields |
|---|---|
| `AuditEvent` | immutable id, occurredAt, actorId, action, target type/id, worldId when applicable, result, correlationId and allow-listed metadata. |
| `AuthenticationEvent` | append-only employee authentication activity: controlled event type, occurredAt, optional internal user id, optional provider key, controlled reason, correlationId and origin. No password, token, IP address or raw user-agent storage. |
| `NotificationDelivery` | optional provider-neutral delivery intent, channel, destination classification, status, attempts and last error code; created only when a channel is approved. |
| `SchemaMigration` | Managed by Prisma migration history and deployment procedure, not application business logic. |

Audit events are append-only at the application level. They must not include passwords, tokens, full contact submissions, note bodies, uploaded content or unnecessary personal data.

## 7. Integrity and indexes

- Unique normalized internal email where the chosen identity policy requires it.
- Unique Auth.js provider/provider-account pair.
- Unique world key and unique active slug within its world and content type.
- Foreign keys use restrictive deletion by default; archive-dependent records instead.
- Partial or composite indexes support published public reads, review queues, lead owner/status/next action and media usage checks.
- Database constraints enforce valid required relations and uniqueness; application policies enforce cross-record publication and permission rules.
- Optimistic concurrency uses a version or last-updated precondition for editorial and access-administration writes.

## 8. Retention and classification

Public content, internal account data, commercial contact data, private attachments, security events and operational telemetry are separate classifications. Exact retention durations, legal bases, export rules and deletion/anonymization duties remain BLOCKING inputs for production release, not reasons to invent defaults. The schema must support policy-driven archive, deletion or anonymization without erasing required audit evidence.
