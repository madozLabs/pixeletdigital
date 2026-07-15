# Delivery and Operations

Status: Accepted Phase 2 baseline; no deployment or paid-provider approval

## 1. Delivery model

The application is a stateless Next.js modular monolith with PostgreSQL and S3-compatible object storage. Docker Compose or an equivalent checked-in Docker configuration will provide local dependencies, not a claim of production parity. The deployable remains compatible with Vercel while avoiding provider-only business logic.

No production deployment, provider purchase or infrastructure commitment is authorized by this document.

## 2. Environments

| Environment | Purpose | Data rule |
|---|---|---|
| Local | Development and targeted tests | Synthetic fixtures only; local Docker dependencies |
| Test/CI | Deterministic automated verification | Ephemeral isolated database and object-storage substitute |
| Preview | Review of a candidate revision | Non-production accounts, secrets and synthetic/sanitized data |
| Production | Approved public and Workspace release | Real data under approved legal, retention, backup and access policies |

Environment configuration is validated at startup and split into server-only secrets, server-public configuration and explicitly client-public values. Missing required configuration fails fast. Conditional features such as Insights, consultation, analytics and notification delivery default off until governed approval and valid configuration both exist.

## 3. Repository and change boundaries

The eventual repository should separate presentation, domain modules, infrastructure adapters, database migrations, tests and operational documentation while retaining one deployable. Generated Prisma client code and framework artifacts must not leak into domain modules. Architectural dependency checks protect boundaries.

Every change includes its relevant migration, tests and documentation. Product, migration and governance changes should remain reviewable and be committed coherently; this baseline itself authorizes no commit.

## 4. Testing layers

- Domain unit tests: policies, lifecycle transitions, publication eligibility, future-only restrictions, lead state and authorization decisions.
- Application tests: use cases with fake ports, typed errors, idempotency and audit behavior.
- Integration tests: Prisma repositories against PostgreSQL, transactions, constraints, world-scoped queries, migrations and storage adapter contracts.
- Contract tests: public projections, HTTP/Server Action validation, error mapping and conditional route absence.
- Component/accessibility tests: critical public and Workspace interaction states.
- End-to-end tests: public discovery/enquiry, editorial review/publication, media flow, lead handling and access administration.
- Non-functional checks: accessibility, representative performance budgets, security headers, abuse boundaries and graceful reduced-motion/no-3D behavior.

Tests use synthetic content and must not turn placeholders into approved claims. Exact performance and availability thresholds remain a pre-release architecture decision after hosting and experience inputs exist.

## 5. CI quality gates

Every proposed merge must pass, as applicable:

1. clean dependency installation from a locked dependency graph;
2. formatting and whitespace checks;
3. lint and type checking;
4. architecture/dependency-boundary checks;
5. unit, application and integration tests;
6. migration validation against an empty database and an upgrade fixture;
7. production build;
8. component/contract/end-to-end tests for affected critical paths;
9. accessibility and security-header checks;
10. dependency vulnerability, license-policy and secret scans;
11. generated-file and unexplained-artifact review;
12. documentation and diff review.

A partial gate is reported as partial evidence. A flaky or skipped required test is not a pass. Preview deployment, when later configured, is not production proof.

## 6. Database migrations

- Prisma migration files are immutable after sharing and are reviewed like application code.
- Prefer backward-compatible expand/migrate/contract steps for destructive or high-volume changes.
- Application deployment must remain compatible with the database state during rollout and rollback.
- Data migrations are bounded, restartable where material, observable and tested on representative synthetic volume.
- A pre-production rehearsal verifies duration, locks, indexes and failure recovery.
- Production migration execution requires an approved operator, verified backup/restore posture and a recorded rollback decision.

Schema rollback is not assumed to be automatic. Roll forward is preferred after a migration has changed data; destructive down migrations require explicit proof they preserve required data.

## 7. Backups and restoration

PostgreSQL and object storage require provider-independent backup objectives once legal, volume, budget and availability inputs are supplied. Before production release there must be:

- automated database backups with documented retention and encryption;
- object versioning or an equivalent recoverability strategy for media;
- separation of backup access from routine application credentials;
- a restoration runbook covering database/media consistency;
- a successful restore test into an isolated environment with measured recovery evidence;
- named ownership, alerting and periodic restore-test cadence.

Backup presence is not proof of recoverability. Exact RPO, RTO, geography and retention are owner/operational decisions and remain unset.

## 8. Deployment and rollback

Release artifacts are traceable to a reviewed Git revision and immutable dependency lock. Deployment order accounts for migration compatibility. Health checks cover application availability and required dependency reachability without exposing secrets.

Rollback options are, in order: disable a conditional feature, route traffic to the previous compatible application revision, or apply a reviewed forward database correction. A previous application must never be restored against an incompatible schema. Content publication can be archived/unpublished through an audited business action; database restoration is not a content rollback tool.

Production deployment requires explicit owner authorization, accepted residual risks, environment access, provider choices and a release checklist. None are implied here.

## 9. Observability

The application emits structured, sanitized logs with environment, severity, event name, correlation id and safe module context. It records request/error latency, error categories, dependency health, public submission outcomes, notification failures, migration results and scheduled-publication failures without logging sensitive payloads.

Traces and metrics use provider-neutral instrumentation where practical. Analytics business events are separate from operational telemetry and remain disabled until an approved provider/configuration and consent policy exist. Alerts must be actionable and routed to a named owner before production.

Minimum operational views cover availability/errors, database saturation/connection failures, object-storage failures, enquiry persistence failures, authentication anomalies and audit append failures. Numeric SLOs and alert thresholds require measured baselines and approved availability priorities; none are invented here.

## 10. Operational readiness gate

Production release remains blocked until provider and region choices, legal/privacy/retention policy, accountable operators, secrets, domain/DNS ownership, backup/restore evidence, incident contacts, monitoring destinations, security review and measurable non-functional thresholds are approved and verified.

Scaffolding readiness is narrower: it requires acceptance of this six-document baseline and a clean implementation plan that introduces no provider commitment or unresolved product fact.
