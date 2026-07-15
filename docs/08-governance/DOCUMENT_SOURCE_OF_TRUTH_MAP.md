# Document Source of Truth Map

Status: Active governance map

## Precedence

When two documents disagree, use this order:

1. Repository state and Git history.
2. Explicit owner approvals recorded in `OWNER_DECISION_REGISTER.md` and the completed owner decision form.
3. `CONFIRMED_OWNER_FACTS.md` for owner-stated facts that are not approvals.
4. `PROJECT_BIBLE.md`, `MVP_SCOPE.md` and approved phase-gate documents for strategic boundaries.
5. Domain documents for brand, product and UX working rules.
6. Content drafts, readiness matrices and CTO recommendations.

A lower-precedence document cannot approve, expand or override a higher-precedence record.

## Authoritative governance records

| Document | Authority | Limitation |
|---|---|---|
| `OWNER_DECISION_REGISTER.md` | Status and scope of owner decisions | Open defaults are planning positions, not public facts |
| `PHASE_1_OWNER_DECISION_FORM.md` | Fillable owner approval evidence | Has no authority until completed and reconciled |
| `CONFIRMED_OWNER_FACTS.md` | Explicit owner-stated facts | Does not authorize publication |
| `PHASE_1_READINESS_REVIEW.md` | Current Phase 1 readiness verdict | Must be updated after material owner decisions |
| `PHASE_2_ENTRY_CRITERIA.md` | Formal gate for technical work | Phase 2 remains blocked until explicit completion |

## Strategic and domain sources

| Domain | Primary source | Supporting sources |
|---|---|---|
| Vision and business boundary | `00-vision/PROJECT_BIBLE.md` | `07-roadmap/ROADMAP.md` |
| MVP scope | `02-product/MVP_SCOPE.md` | journeys, information architecture and roadmap |
| Brand relationships | `01-brand/BRAND_ARCHITECTURE.md` | brand bibles and art-direction documents |
| Pixel&Digital logo evidence | `01-brand/PIXEL_DIGITAL_LOGO_REGISTER.md` | visual foundations and asset plan |
| Content evidence and rights | `02-product/EVIDENCE_AND_CASE_STUDY_FRAMEWORK.md` | content protocol, inventory and intake templates |
| Public UX structure | `03-ux/INFORMATION_ARCHITECTURE.md` | public journeys and wireframe specifications |
| Internal roles and workflow | `02-product/ROLES_AND_PERMISSIONS.md` | admin journeys and content inventory |
## Draft and advisory documents

The following remain supporting material and cannot independently authorize scope or publication:

- all files under `04-content/drafts/`;
- `CTO_OWNER_DECISION_RECOMMENDATIONS.md`;
- visual exploration briefs and provisional foundations;
- readiness matrices and review packets.

## Current non-negotiable boundaries

- Pixel&Digital services are candidates until item-level approval under ODR-002.
- Personalized Gadgets is current-stated, but not yet publication-ready.
- Banner Printing, Vinyl Printing and 3D Lettering/CNC are future-only.
- Studio and Training remain teaser/foundation only.
- Architecture and development remain unauthorized.

## Duplicate and stale-risk areas

- `OWNER_INPUT_CHECKLIST.md`, `OWNER_REVIEW_PACKET.md`, `PHASE_1_OWNER_DECISION_FORM.md` and `CTO_OWNER_DECISION_RECOMMENDATIONS.md` overlap. The completed decision form and decision register must govern; the others are preparation aids.
- `LAUNCH_READINESS_MATRIX.md` and `PHASE_1_READINESS_REVIEW.md` overlap. The matrix is item-level detail; the review is the phase-level verdict.
- Service taxonomy, catalogue and page mapping drafts intentionally overlap. After owner approval, reconcile them together and mark replaced versions as superseded.

## Maintenance workflow

1. Record or change the owner decision in the governing decision record.
2. Update confirmed facts only when an explicit owner statement changes.
3. Reconcile affected scope, brand, UX, catalogue and readiness documents.
4. Run contradiction searches and `git diff --check`.
5. Mark outdated drafts as superseded; do not delete traceability without reason.
6. Re-evaluate the Phase 1 verdict and Phase 2 gate after every material decision batch.