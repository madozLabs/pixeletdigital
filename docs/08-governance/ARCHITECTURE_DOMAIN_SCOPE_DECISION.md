# Architecture Domain Scope Decision — Organization, Projects, Tasks, Billing

Status: Open — owner decision required before further work on the domains named below
Raised by: CTO audit, 2026-07-25 (see `AUDIT_PIXEL_DIGITAL.md` at repository root, section 1.2, for the full technical evidence this decision is drawn from)
Register entry: `OWNER_DECISION_REGISTER.md` ODR-025

## 1. What triggered this decision

`docs/05-architecture/DOMAIN_BOUNDARIES.md` §5 ("Deferred domains") states, as an accepted Phase 2 baseline:

> Studio operations, Training operations, projects/tasks, production jobs, quotations as commercial documents, billing, payments, scheduling, certificates and client portals are not placeholder modules in the MVP. They require a scope decision and a boundary review before introduction.

`docs/02-product/MVP_SCOPE.md` independently confirms the same boundary from the product side: §4 states the MVP includes only "lightweight lead management" and explicitly "does not include full invoicing, accounting or a generic sales automation engine"; §12 ("Explicit exclusions") lists "complete project-management suite" by name.

The current repository state does not match either document. Both a scope decision and a boundary review are missing, and the code already exists.

## 2. What was actually built, with evidence

`prisma/schema.prisma` defines 28 models. Of these, the following have **no corresponding entry in `docs/05-architecture/DATA_MODEL.md`** and no module under `src/modules/`:

| Model | schema.prisma | Status vs. governance |
|---|---|---|
| `Project` | line 597 | Explicitly named as a deferred domain (`DOMAIN_BOUNDARIES.md` §5: "projects/tasks") |
| `Task` | line 628 | Explicitly named as a deferred domain (same reference) |
| `Quote`, `QuoteLine` | lines 678, 704 | Explicitly named as deferred ("quotations as commercial documents") |
| `Invoice`, `InvoiceLine`, `Payment` | lines 717, 746, 759 | Explicitly named as deferred ("billing, payments") |
| `CatalogueItem` | line 662 | Supports the Quote/Invoice line items above; same deferred category |
| `Department`, `Team`, `JobPosition`, `TeamMembership` | lines 240, 251, 268, 279 | Not named in `DOMAIN_BOUNDARIES.md` §5 at all — undocumented in either direction |
| `Client`, `ClientContact` | lines 545, 581 | Adjacent to the deferred "client portals" category; not itself named, undocumented |
| `EditorialItem` | line 508 | Not present in `DATA_MODEL.md` §3's content entity list; undocumented |

`billing` additionally has a full `src/modules/billing/{domain,application,infrastructure}` implementation with genuinely good test coverage (`invoice.test.ts` covers discount/tax order, state-transition rules, partial payment) — this is not a prototype, it is production-quality code built against an unapproved domain boundary.

`organization`, `projects`, `tasks` have no `src/modules/` counterpart at all. Their Server Actions call `prisma.*` directly from `src/app/workspace/{organization,projects,tasks}/actions.ts`, each file defining its own local authorization predicate (`organization/actions.ts:18-21`, `projects/actions.ts:19`, `tasks/actions.ts:19`) instead of a shared policy module, wrap mutations in bare `catch` blocks that discard the real error (`organization/actions.ts:34-42,54-66,77-85,97-116`), and write no audit event for any mutation despite `SECURITY_AND_PERMISSIONS.md` §7 requiring one for sensitive business actions.

In the opposite direction, `DATA_MODEL.md` §5 documents a `Lead`/`LeadNote`/`NextAction`/`LeadActivity` model set as part of the MVP's approved lead-management scope — **none of these exist in `schema.prisma`**. The `enquiries` module only implements `list` and `submit` (see `src/modules/enquiries/application`), with no qualification, assignment or conversion capability. So the drift runs both ways: unapproved domains were built, and an approved one was not.

## 3. Why this is an owner decision, not a pure engineering call

Per `AGENTS.md`, the CTO decides technical questions within an approved product scope, but a "changement majeur d'objectif produit... modification majeure de roadmap métier" requires the owner. Whether Pixel&Digital's internal Workspace becomes an operations tool covering HR structure, project delivery and invoicing — beyond the MVP's stated boundary of "content governance and incoming opportunities" (`MVP_SCOPE.md` §1) — is exactly that kind of call. It changes what "MVP acceptance" means, what `MVP_SCOPE.md` §12's exclusion list still means, and what gets tested, secured and maintained going forward.

## 4. Options

### Option A — Ratify the extended scope, bring it up to the project's own standard
Accept that Organization/Projects/Tasks/Billing are now part of the product, update `MVP_SCOPE.md` and `DOMAIN_BOUNDARIES.md`/`DATA_MODEL.md` to reflect it, and migrate the four areas to the same architecture already used by `access`/`content`/`enquiries`/`worlds`: domain layer with typed errors, application use cases, a shared authorization policy per module, audit events on sensitive mutations, and test coverage.
- **Effort:** substantial — four modules' worth of domain/application layers, plus the remediation already tracked separately in the audit (C1 audit trail, C4 pagination, C6 error feedback) which becomes mandatory once these modules are officially in scope.
- **Risk if chosen without follow-through:** none of the audit's other critical findings (C1, C4, C6) can be considered resolved for these four areas until this migration happens — ratifying scope without funding the migration just makes the drift official instead of fixing it.

### Option B — Freeze and minimize, revisit later
Keep Organization/Projects/Tasks/Billing exactly as they are, freeze new features in these areas, and explicitly exclude them from the MVP acceptance checklist (`MVP_SCOPE.md` §14) until a dedicated scope review happens post-launch.
- **Effort:** low — mostly documentation and a feature freeze, not code changes.
- **Risk:** these modules already handle real client/financial data paths (`Invoice`, `Payment`) with no audit trail and no pagination; freezing does not retroactively fix the C1/C4/C6 findings that already apply to them today. A freeze without remediation leaves a live gap.

### Option C — Extract and re-scope as a clearly separate concern
Keep the four areas, but formally split them out of the "MVP platform" boundary into a distinct, explicitly-labeled internal-tools scope with its own review cadence and its own (lighter) architecture bar — acknowledging they serve a different need (agency operations) than the governed content/lead platform.
- **Effort:** medium — mostly a documentation and dependency-boundary exercise (`DOMAIN_BOUNDARIES.md` §3's dependency map would need a new row), plus the same remediation debt as Option A, just declared against a different, explicitly lighter standard.
- **Risk:** a "lighter standard" for a module that already handles `Payment`/`Invoice` records is hard to justify from a security standpoint — this option should not be read as an excuse to skip C1/C4/C6.

## 5. CTO recommendation

Option A, with the audit's C1 (audit trail), C4 (pagination) and C6 (error feedback) treated as prerequisites for these four modules specifically, sequenced module by module (Billing first, since it already has partial domain/application structure to build on; Organization/Projects/Tasks after). Option B is the fallback if the owner does not want to commit the additional engineering time right now — in that case, the freeze must be paired with, at minimum, C1 and C6 for `billing` (it already touches real payment records) rather than deferred entirely.

This recommendation does not resolve the decision. It narrows the choice for the owner and states the engineering consequence of each path plainly, per `AGENTS.md`'s rule that the CTO "ne valide jamais par défaut" and "recherche les preuves nécessaires" before a recommendation.

## 6. Owner input required

- Ratify, freeze, or extract (Option A/B/C above), or a different disposition.
- If Option A: confirm this is an intentional, funded expansion of the MVP beyond `MVP_SCOPE.md` §1's stated boundary, and update that document accordingly.
- If Option B or C: confirm acceptance of the residual risk on `Invoice`/`Payment` records (no audit trail, no pagination) until remediation is scheduled.
- Approver and date, per the register format in `OWNER_DECISION_REGISTER.md`.

## 7. Downstream documents affected once decided

- `OWNER_DECISION_REGISTER.md` — close ODR-025 with the chosen disposition.
- `docs/02-product/MVP_SCOPE.md` §1, §4, §12 — reconcile with whichever option is chosen.
- `docs/05-architecture/DOMAIN_BOUNDARIES.md` §5 — move the ratified domains out of "Deferred domains" (Option A), or add an explicit freeze note (Option B), or add a new boundary row (Option C).
- `docs/05-architecture/DATA_MODEL.md` §3 — document the models currently missing from it (`Project`, `Task`, `Quote`, `Invoice`, `Payment`, `Department`, `Team`, `JobPosition`, `TeamMembership`, `Client`, `ClientContact`, `EditorialItem`).
- Separately (not blocked on this decision, but related): the documented-but-unbuilt `Lead`/`LeadNote`/`NextAction`/`LeadActivity` model set in `DATA_MODEL.md` §5 should be reconciled with reality — either build it (this is what `AUDIT_PIXEL_DIGITAL.md` recommendation C5 addresses) or mark it as not-yet-implemented rather than accepted baseline.
