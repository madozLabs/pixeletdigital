# Domain Boundaries

Status: Accepted Phase 2 baseline; CTO accepted 2026-07-15

## 1. Boundary principles

Each module owns its rules, writes and persistence mapping. Ownership means that only the owning module may change the record. Other modules use stable identifiers and explicit application contracts. A shared PostgreSQL database is an operational choice, not permission for cross-module table access.

## 2. Initial domains

### Access

Owns users, authentication-account linkage, roles, user status, sessions as required by Auth.js, and world-scope assignments. It answers `who is the actor?` and `may this actor attempt this action in this world?` It does not own business content, lead assignments or audit records.

### Worlds

Owns the canonical world identity and lifecycle for Pixel&Digital, Kwaliti Print, Studio and Training, including stable keys and governed display settings. It distinguishes live MVP worlds from teaser/foundation worlds. It does not approve individual services, capabilities or public claims.

### Content

Owns structured pages, controlled sections, service families, candidate services/capabilities, case studies, outcomes, testimonials, team profiles, conditional resources, navigation, SEO fields and publication workflow. It owns publication eligibility and public projections. It references Media assets and Worlds but cannot change either.

Content rules must prevent future-only Kwaliti Print capabilities from being projected as current, prevent Studio/Training operational publication, and keep Insights disabled unless explicitly enabled by a governing decision. Candidate status and publication status are separate.

### Media

Owns asset metadata, storage key, media type, size, checksum, ownership world, alternative text, caption, credit, rights/permission state, usages and archive state. Bytes are stored behind an object-storage port. Media cannot be destructively removed while referenced. Uploading an asset does not grant publication rights.

### Enquiries

Owns public form definitions that are enabled for launch, submissions, source context, consent evidence when applicable, attachments and anti-abuse outcome. It accepts general contact and approved quotation flows. Kwaliti Print qualification can target only an approved current capability. Consultation remains absent unless approved. Enquiries contains the original submitted record and does not own sales progression.

### Leads

Owns commercial qualification, deduplication decisions, originating enquiry reference, world, status, owner, notes, next action, due date, activity and closed outcome. It does not mutate the original enquiry. A submission may create or associate a lead through an explicit Leads use case; notification failure cannot erase the submission.

### Audit

Owns append-only records of security-sensitive and material business actions. It receives sanitized audit facts from application use cases. It does not store request bodies, credentials, customer files or unrestricted before/after payloads.

## 3. Dependency and collaboration map

| Consumer | Provider | Allowed contract | Forbidden coupling |
|---|---|---|---|
| Content | Worlds | Resolve world identity and allowed mode | Updating world configuration |
| Content | Media | Resolve publishable asset metadata | Reading storage credentials or deleting assets |
| Enquiries | Worlds/Content | Resolve enabled world and approved enquiry target | Inferring approval from a candidate record |
| Leads | Enquiries | Read normalized submission reference | Editing original submission |
| All protected modules | Access | Actor and authorization decision | Trusting client-provided role or world scope |
| All sensitive use cases | Audit | Append sanitized event | Updating or deleting audit history |

No module may depend on Audit to complete its core business transaction. Audit append failure for a sensitive action must be treated according to the action risk: fail closed for access/security administration and exports; raise an operational alert with a traceable recovery path for lower-risk mutations.

## 4. Invariants across boundaries

- Every world-owned record has exactly one primary `worldId`; case studies may reference additional contributing worlds through an explicit relation.
- Public queries return only records that are both publication-eligible and currently Published; scheduled content becomes public only through an authorized, audited transition.
- Rejection returns content to Draft with a review note. Preview never changes lifecycle state.
- Archival is the default removal behavior. Destructive deletion is exceptional, Super Admin-only and audited.
- Operational and commercial records never become public content projections.
- IDs cross boundaries; ORM models and mutable entities do not.
- Time, actor and correlation identifiers are supplied by application context, not hidden global state.

## 5. Deferred domains

Studio operations, Training operations, projects/tasks, production jobs, quotations as commercial documents, billing, payments, scheduling, certificates and client portals are not placeholder modules in the MVP. They require a scope decision and a boundary review before introduction. Reserved world identities do not imply reserved operational schemas.
