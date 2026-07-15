# Wireframe Specifications — Pixel&Digital MVP

Status: UX specification; implementation-neutral
Parent references: `docs/03-ux/INFORMATION_ARCHITECTURE.md`, `docs/03-ux/PUBLIC_JOURNEYS.md`, `docs/03-ux/ADMIN_JOURNEYS.md`

## 1. Purpose

Define the content order, decisions and states that wireframes must prove before visual design or architecture begins. Wireframes validate comprehension, navigation, evidence and conversion; they do not prescribe a component library, final styling or technical stack.

## 2. Principles

- Start each screen with user intent, required information and one primary outcome.
- Establish hierarchy with structure and copy before colour, motion or imagery.
- Put evidence near the claim or choice it supports.
- Include realistic content lengths and all material states, not ideal-state boxes only.
- Design mobile and larger-screen layouts as equal requirements.

## 3. Public priority wireframes

### Pixel&Digital home

Required sequence: ecosystem identity and navigation; clear promise; primary action; capability overview; selected evidence; method or trust; Kwaliti Print entry; Studio and Training teasers; closing action and public footer. The first view must identify who Pixel&Digital helps, what it does and the next step without relying on animation.

### Service family and detail

Required sequence: user problem and outcome; scope; relevant proof; approach; useful qualification; related services; primary enquiry. Lists must distinguish confirmed services from broad capability language.

### Work index and case study

Index supports understandable filtering by relevant need or universe. Detail includes context, challenge, contributing units, approved work, process, attributable outcome, related services and a similar-project action. Missing measurable outcomes must not be disguised.

### Kwaliti Print home and capability detail

Home sequence: distinct identity and ecosystem link; proposition; current-capability overview; approved material or process evidence; selected work; quotation action. Personalized Gadgets is the only current-stated candidate unless ODR-003 explicitly changes it. Banner Printing, Vinyl Printing and 3D Lettering/CNC must not receive current-capability cards, detail pages or quotation routes while future-only. Any approved current-capability detail follows: intended use; confirmed options and constraints; visual evidence with scale/context; related examples; information needed for a quotation; quotation entry. 3D is an optional presentation layer beside a complete static experience, not evidence that CNC or 3D Lettering is available.

### Contact and quotation

Start with route selection when intents differ. State purpose, required information and what happens next. Group fields into manageable steps; preserve source and universe context; support references or files where appropriate; show validation, submission, success and recoverable failure states. Do not promise price or response time.

### Studio and Training teasers

Include only an approved provisional descriptor, concise purpose, status and general information/contact action. Exclude full service catalogues, schedules, registration, pricing and availability in MVP.

## 4. Workspace priority wireframes

### Role-based home

Show actionable work first: review queue, assigned leads, due next actions and relevant alerts. Avoid decorative metrics and do not expose data outside the user’s universe scope.

### Content list, editor and review

List exposes owner, universe, type, status and last material update. Editor uses structured fields, media metadata, relationships, SEO inputs and preview. Review exposes change context, note, submit, reject-to-Brouillon, publish or plan actions according to permission. States are Brouillon, En revue, Planifié if needed, Publié and Archivé.

### Lead list and detail

List supports source, universe, status, owner and next-action visibility. Detail prioritizes contact context, need, consent-relevant information, activity, notes, assignment and next action. Sensitive information remains scoped and exports are not assumed.

### Media and access administration

Media screens expose ownership, rights, alternative text, usages and archive constraints. Access screens expose user, role, universe scope, consequence of changes, confirmation and audit expectations.

## 5. Concrete rules and boundaries

- Every wireframe annotates page purpose, primary user, primary action, required content and entry/exit paths.
- Include loading, empty, incomplete-content, permission-denied, validation, recoverable-error and success states where relevant.
- Keep primary actions consistent in wording and location within a journey.
- Use real or clearly labelled draft content; never invent final claims, prices, legal copy or dates.
- Do not introduce features outside MVP, including full Studio/Training flows, unrestricted page building or advanced operations.
- Visual flourishes cannot repair a hierarchy that fails in grayscale structure.

## 6. Mobile behavior

- Specify mobile reading order explicitly rather than shrinking a desktop composition.
- Keep identity, page purpose and primary action discoverable without persistent obstruction.
- Stack comparisons into labelled groups and make tables or dense records usable without losing row context.
- Forms use suitable grouping, clear errors and resumable input behavior as a UX requirement, without prescribing implementation.
- Workspace actions with irreversible or sensitive consequences require deliberate confirmation on small screens.

## 7. Accessibility

- Annotate heading hierarchy, landmarks, focus order, labels, instructions and error association.
- Specify keyboard behavior for menus, dialogs, galleries, filters and complex Workspace controls.
- Controls use persistent labels; placeholders are examples, not labels.
- Status and selection have text or structural indicators beyond colour.
- Media includes alternative, caption, transcript or decorative treatment according to purpose.
- Reduced-motion and no-3D variants must preserve the same reading and action sequence.

## 8. Performance

- Annotate the critical content that must appear before enhanced media.
- Reserve stable media regions and define poster, fallback and error presentation.
- Avoid wireframes that require multiple rich assets to understand the first view.
- Pagination, progressive disclosure or editorial limits must be considered for long indexes and media libraries without choosing a technical mechanism.

## 9. Conversion intent

- Each public template states its conversion hypothesis and the evidence required before the ask.
- Trackable intent points include service-to-proof, proof-to-enquiry, world transition and completed qualified request; provider selection is deferred.
- Confirmation states preserve submitted context, explain the next step and offer a safe onward route.
- Workspace wireframes optimize reliable follow-through: ownership, status, next action and history must remain visible.

## 10. Content implications

Wireframing requires an inventory of approved services, case studies, outcomes, testimonials, team information, capability categories, material guidance, form questions and media with rights. Content owners must supply representative short, typical and long examples. Unknown content is recorded as a gap with an owner decision, not silently replaced by generic copy.

## 11. Open owner decisions

- Final launch services and Kwaliti Print capability categories.
- Pricing visibility and preferred consultation route.
- Launch languages and priority geographies.
- Approved evidence, testimonials and media available for wireframe testing.
- Exact Studio and Training teaser naming and wording.
- Legal identity, consent wording, required notices and retention rules.
- Whether Insights has enough governed content for MVP inclusion.
