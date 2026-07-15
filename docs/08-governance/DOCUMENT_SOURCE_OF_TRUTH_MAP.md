# Document Source of Truth Map

Status: Active documentation-governance map
Scope: Documentation authority, precedence, lifecycle and consolidation only

## 1. Current phase and hard gate

Phase 2 technical architecture is active and explicitly authorized under `PHASE_2_ENTRY_CRITERIA.md`. The six-document baseline under `05-architecture/` passed independent review and was accepted by the CTO on 2026-07-15; product scaffolding may proceed within it.

Open Phase 1 business decisions still govern publication, commercial claims, launch scope, legal/privacy content and future-world boundaries. Production deployment, paid-provider commitments, full Studio/Training implementation and current treatment of future-only Kwaliti Print capabilities remain excluded.

## 2. Precedence

When statements conflict, apply this order:

1. `AGENTS.md` for repository governance, authority, safety and phase restrictions.
2. Direct repository evidence and Git history for facts about files and recorded changes; repository presence does not equal business or publication approval.
3. Completed, explicit owner decisions recorded in `OWNER_DECISION_REGISTER.md`, supported by the completed `PHASE_1_OWNER_DECISION_FORM.md`. An approved decision must include its answer, authority, approver and date.
4. `CONFIRMED_OWNER_FACTS.md` for owner-stated facts and directly verified repository facts that have not been promoted into approvals.
5. Mandatory phase gates and current assessments: `PHASE_2_ENTRY_CRITERIA.md`, `PHASE_1_READINESS_REVIEW.md` and `PHASE_1_CLOSEOUT_PLAN.md`.
6. Controlled product baselines for intent and boundaries: Project Bible, MVP Scope, Roadmap, Brand Architecture and the product/UX foundations.
7. Supporting standards, plans, registers, protocols and intake templates.
8. Advisory recommendations and all documents explicitly marked working, provisional, directional, template or draft.
9. Conversation summaries or informal descriptions.

Higher precedence does not silently rewrite lower-precedence documents. A conflict must be recorded and reconciled downstream. A planning default or recommendation never becomes an owner decision. A stated fact never becomes publication approval by repetition.

## 3. Authoritative governance records

| Document | Authority and limit |
|---|---|
| `AGENTS.md` | Highest repository operating authority. It records Phase 2 architecture and product scaffolding as authorized within the accepted baseline. |
| `08-governance/OWNER_DECISION_REGISTER.md` | Governing register for ODR-001 through ODR-022. Open entries still govern launch and publication decisions. |
| `08-governance/CONFIRMED_OWNER_FACTS.md` | Canonical record of owner-stated and repository-verified facts. It explicitly does not approve launch inclusion, wording or publication. |
| `08-governance/PHASE_2_ENTRY_CRITERIA.md` | Mandatory Phase 2 gate. Architecture is authorized within its recorded scope, exclusions and accepted residual risks. |
| `08-governance/PHASE_1_OWNER_DECISION_FORM.md` | Required owner decision capture instrument for unresolved business decisions. Blank fields confer no approval. |
| `08-governance/PHASE_1_READINESS_REVIEW.md` | Historical Phase 1 readiness assessment. Its former architecture block is superseded by the completed Phase 2 gate. |
| `08-governance/PHASE_1_CLOSEOUT_PLAN.md` | Historical closeout plan; retained for traceability and unresolved business-decision sequencing. |

## 4. Controlled baselines and supporting documents

These documents govern their subject only within the authoritative records above. Their `draft`, `working`, `directional`, `provisional` or `implementation-neutral` labels must be preserved.

| Area | Controlled baseline | Supporting material |
|---|---|---|
| Vision and scope | `00-vision/PROJECT_BIBLE.md`; `02-product/MVP_SCOPE.md`; `07-roadmap/ROADMAP.md` | None of these closes an ODR item or authorizes Phase 2. |
| Brand | `01-brand/BRAND_ARCHITECTURE.md`; both brand bibles | `ASSET_PRODUCTION_PLAN.md`; `PIXEL_DIGITAL_ART_DIRECTION_BRIEF.md`; `PIXEL_DIGITAL_LOGO_REGISTER.md`; `PIXEL_DIGITAL_VISUAL_FOUNDATIONS.md` |
| Product governance | `02-product/ROLES_AND_PERMISSIONS.md`; `CONTENT_INVENTORY_AND_OWNERSHIP.md`; `EVIDENCE_AND_CASE_STUDY_FRAMEWORK.md` | `CONTENT_COLLECTION_PROTOCOL.md` and the intake templates under `04-content/` |
| UX | `03-ux/INFORMATION_ARCHITECTURE.md`; `PUBLIC_JOURNEYS.md`; `ADMIN_JOURNEYS.md`; `WIREFRAME_SPECIFICATIONS.md`; `MOTION_AND_IMMERSION_GUIDELINES.md` | These specify requirements, not final URLs or visual design. |
| Technical architecture | `05-architecture/ARCHITECTURE_BASELINE.md`; `DOMAIN_BOUNDARIES.md`; `DATA_MODEL.md`; `APPLICATION_CONTRACTS.md`; `SECURITY_AND_PERMISSIONS.md`; `DELIVERY_AND_OPERATIONS.md` | Accepted Phase 2 baseline; implementation must conform to it. |
| Governance advice | None | `08-governance/CTO_OWNER_DECISION_RECOMMENDATIONS.md` is advisory only and cannot close decisions. |

## 5. Draft and review-only set

Every file under `04-content/drafts/` is non-authoritative for approval and publication:

- `PIXEL_DIGITAL_SERVICE_CATALOGUE_DRAFT.md` and `KWALITI_PRINT_CAPABILITY_CATALOGUE_DRAFT.md` record owner-stated candidates and validation gaps.
- `SERVICE_TAXONOMY_DRAFT.md` proposes editorial groupings only.
- `CONTENT_TO_PAGE_MAPPING_DRAFT.md` proposes placement and gates only.
- `LAUNCH_READINESS_MATRIX.md` assesses readiness and currently finds every service/capability blocked for publication.
- `OWNER_REVIEW_PACKET.md` is a review instrument; unchecked dispositions are not decisions.
- `OWNER_INPUT_CHECKLIST.md` is a convenience checklist, not a decision record.

The templates directly under `04-content/` are blank collection instruments. Filling a template does not create approval unless the required authority and governance record are also completed.

## 6. Current factual and scope boundaries

- Pixel&Digital services are owner-stated candidates only: Social Media Management; Website Creation; Facebook advertising; Graphic Design; Motion Design; Video Editing; Content Creation; Audiovisual Production. Exact public names, grouping, scope and launch inclusion remain open under ODR-002. Broader `Digital Advertising` language is a proposed grouping grounded only in the stated Facebook advertising capability.
- Personalized Gadgets is the only current-stated Kwaliti Print capability. It is not yet approved as a launch offer or for publication.
- Banner Printing, Vinyl Printing and 3D Lettering using a CNC cutter are future-only. They must not receive current-capability presentation or quotation routes unless a later explicit owner decision changes their status.
- Pixel&Digital and Kwaliti Print are the live MVP worlds.
- Studio and Training remain teaser/foundation only. Studio's existing photo/video support for Pixel&Digital Audiovisual Production does not authorize a full Studio world. Training has no approved offer, schedule, registration, pricing or availability. Any promotion requires a separate, explicit owner-approved scope change.
- Four Pixel&Digital raster PNG sources are repository evidence only. They do not approve vector masters, rights, usage rules, typography, colours or gradients.
- No reviewed service/capability, client evidence, case study, testimonial, metric, media set, price, launch language/geography, launch date, legal fact or privacy/retention rule is approved for publication unless later recorded through the governing decision process.

## 7. Duplicate, overlapping and stale-risk material

No document is deleted by this map. The following overlaps require controlled consolidation:

| Documents | Finding and handling |
|---|---|
| `PROJECT_BIBLE.md`, `BRAND_ARCHITECTURE.md`, `MVP_SCOPE.md`, `ROADMAP.md` | They repeat ecosystem, scope and future-world descriptions. Retain as distinct baselines, but reconcile them after owner decisions. Broad capability lists in the Project Bible and Brand Architecture are directional and must yield to `CONFIRMED_OWNER_FACTS.md` for current/future and approval status. |
| `OWNER_INPUT_CHECKLIST.md`, `OWNER_REVIEW_PACKET.md`, `PHASE_1_OWNER_DECISION_FORM.md`, `OWNER_DECISION_REGISTER.md` | They overlap in decision collection. Use the decision form for owner completion and the register for status; keep the checklist and review packet as supporting aids only. |
| The two catalogue drafts, `SERVICE_TAXONOMY_DRAFT.md`, `CONTENT_TO_PAGE_MAPPING_DRAFT.md` and `LAUNCH_READINESS_MATRIX.md` | They repeat the same candidates across fact, grouping, placement and readiness views. Their roles are distinct but highly duplicative; update them from the governing fact/decision records, never independently. |
| `PHASE_1_READINESS_REVIEW.md`, `PHASE_1_CLOSEOUT_PLAN.md`, `PHASE_2_ENTRY_CRITERIA.md` | They overlap on the Phase 2 block but serve assessment, closeout sequence and authorization respectively. Keep all three and cross-check the verdict whenever one changes. |
| `ROLES_AND_PERMISSIONS.md`, journeys and future-world sections in vision/brand documents | They describe future Studio/Training roles or target journeys. These are forward-looking only and must not be read as MVP launch approval. |
| Project Bible and Brand Architecture Kwaliti Print lists | Their broad printing/signage/fabrication language predates or lacks the later explicit status split. Treat it as stale-risk shorthand: Personalized Gadgets is current-stated; Banner Printing, Vinyl Printing and 3D Lettering/CNC are future-only. Other detailed capabilities remain unconfirmed. |
| `ROADMAP.md` | Its Phase 0 status and older high-level phase language may become stale against the newer Phase 1 readiness records. For current phase status and entry authorization, the governance readiness and gate documents prevail. |

## 8. Maintenance rules

1. Record a fact once in `CONFIRMED_OWNER_FACTS.md`; link to it rather than converting repetition into authority.
2. Record every owner disposition in the decision form and decision register with explicit value, evidence/authority, approver and date.
3. Change the governing record first, then reconcile every downstream document named by the decision in the same reviewed documentation change.
4. Preserve labels such as candidate, current-stated, future-only, teaser/foundation, draft, proposed and not approved for publication until a governing decision explicitly changes them.
5. Never infer approval from repository presence, a default posture, recommendation, unchecked form, roadmap placement or repeated wording.
6. Mark replaced drafts `Superseded` with a pointer and date; do not delete historical evidence during consolidation.
7. Add no parallel decision list when an ODR item already exists. Extend the register or link to it.
8. Run a contradiction review across facts, register, scope, catalogues, taxonomy, mappings, journeys, readiness and phase gates after every approved owner decision.
9. Keep this map and `docs/README.md` current whenever a document changes authority, status, location or replacement state.
10. Documentation maintenance cannot authorize architecture, stack selection or implementation. Only the completed Phase 2 gate can do so.

## 9. Next consolidation actions

1. Have the owner complete `PHASE_1_OWNER_DECISION_FORM.md` in the closeout order; do not prefill unapproved answers.
2. Transfer valid dispositions into `OWNER_DECISION_REGISTER.md` and update `CONFIRMED_OWNER_FACTS.md` only where a confirmed fact actually changes.
3. Reconcile the service/capability catalogues, taxonomy, page mapping and readiness matrix from those governing records, preserving the Kwaliti Print current/future split and Studio/Training boundary.
4. Reconcile Project Bible, MVP Scope, Brand Architecture, Roadmap and UX documents where approved decisions change scope or terminology.
5. Mark convenience or draft documents superseded only when their content has been migrated and the replacement is named; delete nothing as part of this pass.
6. Continue resolving Phase 1 business decisions for launch/publication while Phase 2 architecture and product scaffolding proceed within the accepted baseline. Reassess readiness before any public release.
