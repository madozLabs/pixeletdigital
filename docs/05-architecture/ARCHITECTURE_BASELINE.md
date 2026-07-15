# Architecture Baseline

Status: Accepted Phase 2 baseline; CTO accepted 2026-07-15; product scaffolding authorized

Decision date: 2026-07-15

Scope: Approved MVP boundaries in `docs/08-governance/PHASE_2_ENTRY_CRITERIA.md`

## 1. Decision

Pixel&Digital will start as a modular monolith implemented as one full-stack Next.js application. PostgreSQL is the system of record, Prisma is the database access adapter, Auth.js provides the authentication integration boundary, and media bytes are stored through an S3-compatible object-storage adapter. Docker supports reproducible local dependencies. The application remains deployable to Vercel without making Vercel, an authentication provider, an object-storage vendor, an email service, an analytics service or any paid service a domain dependency.

This is an architectural selection, not approval to publish content, purchase a provider or deploy to production. The six-document baseline has passed independent review and CTO acceptance; product scaffolding may now begin within these boundaries.

## 2. Product constraints carried into architecture

- Pixel&Digital services are candidate records, not approved launch offerings.
- Personalized Gadgets is the sole current-stated Kwaliti Print capability. It is not automatically publication-approved.
- Banner Printing, Vinyl Printing and 3D Lettering/CNC are future-only and cannot enter current-capability pages or quotation routes.
- Studio and Training are teaser/foundation worlds only; operational modules, catalogues, schedules and registration are excluded.
- Insights exists only if the governing owner decision includes it in the MVP.
- Consultation exists only if the governing owner decision approves that route.
- Unknown languages, geography, prices, legal wording, claims, metrics, evidence, retention periods and providers remain unset governed data or disabled capabilities.
- No architectural default constitutes commercial, legal or publication approval.

## 3. System context

The monolith exposes two surfaces over shared governed modules:

1. a public multi-world experience for published content and approved enquiry routes;
2. an authenticated Workspace for content, media, access administration, leads and audit visibility.

External systems are limited to replaceable adapters: PostgreSQL, object storage, identity/email delivery when later approved, analytics when later approved, and telemetry destinations. No external system may own core publication, authorization or lead state.

## 4. Logical layers

Each domain module uses these inward-pointing layers:

- `domain`: entities, value objects, policies, state transitions and typed domain errors; no framework, Prisma or provider imports;
- `application`: use cases, commands, queries, authorization requirements and ports; depends only on domain and shared primitives;
- `infrastructure`: Prisma repositories and provider adapters implementing application ports;
- `presentation`: Next.js routes, Server Components, Server Actions or route handlers; validates transport input, invokes use cases and maps results to transport responses.

React components contain presentation behavior only. Route handlers and Server Actions do not contain business rules or access Prisma directly.

## 5. Dependency rules

- Presentation may depend on application contracts and presentation-safe schemas.
- Infrastructure may depend on application ports and domain types.
- Application may depend on its own domain and narrowly scoped read contracts from another module.
- Domain depends only on shared, framework-free primitives.
- Cross-module writes call the owning module's application use case; they never mutate another module's tables through Prisma.
- Cross-module reads use explicit query ports or immutable identifiers; direct repository imports are forbidden.
- Shared code is limited to primitives such as identifiers, clock, pagination, result/error types and request context. It cannot become a generic business module.
- Circular module dependencies are forbidden and checked by architecture tests or dependency rules in CI.

## 6. Modules

Initial modules are Access, Worlds, Content, Media, Enquiries, Leads and Audit. Their ownership and collaboration rules are defined in `DOMAIN_BOUNDARIES.md`. SEO projection and public navigation belong to Content; they are not independent domains at MVP. Studio/Training operational domains, billing, project management, manufacturing, learning management and generic workflow engines are excluded.

## 7. Request and data flow

Public reads use published projections only. Workspace reads require an authenticated request context containing actor, role and world scope. Mutations follow: transport validation, authentication, authorization, domain validation, transaction, audit append where required, then a response with a typed outcome.

Database transactions remain within one module by default. A use case spanning modules coordinates explicit application ports and records recoverable partial failure where atomicity cannot be guaranteed. No message broker or distributed transaction is introduced for the MVP.

## 8. Reversibility decisions

- Auth.js is an integration layer; provider configuration is deferred. Internal `User`, role and scope records remain authoritative for authorization.
- Media uses an application-owned storage port compatible with S3 semantics. Bucket vendor, CDN and image transformation provider are deferred.
- Notifications use an outbox-shaped application record or synchronous port only when a delivery channel is approved; lead capture must not fail solely because notification delivery fails.
- Analytics emits an internal allow-listed event vocabulary to a replaceable adapter; disabled is a valid configuration.
- Deployment configuration must use standard environment variables, stateless application instances and PostgreSQL-compatible migrations.

## 9. Architecture acceptance criteria

Before scaffolding, reviewers must confirm:

- all six documents agree on modules, identifiers, permissions, errors and lifecycle states;
- no unresolved owner input has been converted into public fact or mandatory paid dependency;
- future-only and conditional routes are structurally suppressible;
- server-side authorization and world scoping are mandatory at every protected entry point;
- migration, backup, rollback, test and observability strategies are implementable;
- the proposed repository structure can enforce the dependency rules without premature abstractions.

## 10. Explicit non-decisions

This baseline does not select hosting plans, database hosts, object-storage vendors, email providers, analytics providers, domains, locales, geographic regions, SLAs, legal terms, retention durations, pricing, launch metrics or final brand content. Those require evidence or owner decisions before their relevant release gate.
