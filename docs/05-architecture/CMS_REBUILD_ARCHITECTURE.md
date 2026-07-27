# CMS rebuild architecture

Status: accepted technical direction for implementation on `codex/cms-rebuild`

## 1. Problem statement

The public application exposes forty indexed routes, while the current `Page`
workspace only governs a small override of the two home pages. Service routes,
contact and quote pages, navigation, footer copy and most home-page sections are
implemented directly in React. Published records cannot be revised without
changing the live record, media usages are hidden inside JSON payloads, and
Kwaliti Print CMS pages other than `accueil` have no public route.

The target is a structured visual page builder owned by the existing Content
module. It allows non-technical users to compose and create pages from a
controlled, extensible block library. It deliberately avoids arbitrary HTML or
executable code and does not introduce WordPress or another source of truth.

## 2. Non-negotiable outcomes

- Every public route is represented in the Workspace inventory.
- Every visible editorial string has an identified owner and editable source.
- A published revision remains live while a new draft revision is edited.
- Sections use controlled schemas and explicit media relations.
- Preview renders the same components and projections as publication.
- Publication is authorized, versioned, atomic and audited.
- Existing public URLs remain stable throughout migration.
- Existing pages and service records are migrated without destructive rewrites.

## 3. Target aggregate

### Page

Stable routing identity and ownership:

- `id`, `worldKey`, `routePath`, `slug`, `pageKind`, `templateKey`;
- `draftRevisionId`, `publishedRevisionId`;
- lifecycle and timestamps used for inventory/filtering;
- optional relation to a governed entity such as `Service`.

### PageRevision

Immutable publication candidate:

- page relation and monotonically increasing revision number;
- editorial title and SEO projection;
- workflow state (`DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`, `SUPERSEDED`);
- author, reviewer and publication actors/timestamps;
- optimistic concurrency version;
- ordered structured sections.

Editing a published page creates or reuses its draft revision. Publication
switches `Page.publishedRevisionId` atomically and marks the previous revision
as superseded. It never mutates the published revision in place.

### PageRevisionSection

- revision relation, stable section key, controlled type and order;
- schema version and validated payload;
- no arbitrary executable markup;
- explicit `SectionMediaUsage` relations for every media slot.

The initial controlled registry contains `HERO`, `RICH_TEXT`, `MEDIA`,
`GALLERY`, `FEATURE_GRID`, `STEPS`, `SERVICE_INDEX`, `TESTIMONIAL`,
`CASE_STUDY`, `FAQ`, `CTA` and `FORM`.

### MediaAsset and SectionMediaUsage

`MediaAsset` gains lifecycle, rights, credit, checksum, dimensions and safe
processing state. `SectionMediaUsage` records revision, section, asset, slot
and order. An asset cannot be destructively deleted while a usage exists.

### GlobalContent and Navigation

Per-world versioned records own header, footer, contact facts, default SEO,
social links and calls to action. Navigation trees contain explicit ordered
items referencing pages or allow-listed external URLs.

## 4. Rendering contract

Public routes load `publishedRevisionId` only. Preview routes resolve an opaque
draft revision identifier only after a Workspace session and world-scope check.
Both use the same section registry and rendering components.

Service records continue to own catalogue facts and availability. Each service
is linked to a Page whose revision owns the actual landing-page narrative,
media, proof, SEO and CTA. This prevents duplication without treating a service
status row as a complete web page.

## 5. Workspace contract

The primary inventory combines pages backed by `Page` and system routes still
awaiting migration. The latter are visibly marked `CODE_OWNED`, not silently
omitted. At the end of migration no public editorial route remains code-owned.

The editor provides structured fields, section reordering, media selection,
desktop/mobile preview, save state, conflict recovery, review and publication.
Raw JSON is restricted to technical administration and is never the default
editing surface.

The implemented block library includes hero, rich text, media, gallery,
feature grid, steps, service index, testimonial, case study, FAQ, CTA and form.
Blocks support visual addition, duplication, deletion and accessible drag and
drop ordering. Every block also exposes controlled presentation fields for a
primary image where relevant, an optional background image, its focal position
and overlay, plus per-block heading/body font, weight and style overrides. The
renderer allow-lists these values and records background media through an
explicit `SectionMediaUsage` slot. Both worlds expose dynamic CMS routes, so
creating an ordinary page does not require a code change.

Global brand content is governed separately through versioned SiteSettings:
site name, tagline, logo, favicon, heading/body fonts, navigation, footer,
contact CTA and WhatsApp contact number have an isolated
draft/review/publication lifecycle. Public layouts read only the published
identity revision.

Code-owned system forms (Contact and Kwaliti Print quote) expose their
surrounding copy as `HERO` and `FORM` blocks. Validation and submission stay in
code, while headings, explanatory text and reassurance points are editable and
follow the same draft/review/publication workflow.

## 6. Authorization and audit

- Readers may view inventory and previews within scope.
- Editors may create and edit drafts and submit them for review.
- World managers/admins may review, reject, schedule, publish and archive.
- Cross-world identifiers are revalidated from persisted ownership; client
  supplied parent IDs never establish authorization.
- Every review, publication, rollback, archive, destructive media action and
  rights change emits an audit event in the same transaction where possible.

## 7. Additive migration sequence

1. Close current authorization and upload defects.
2. Add revision/media-usage/global-content tables without changing reads.
3. Backfill one initial revision from every current Page and create Page shells
   for service, contact and quote routes.
4. Dual-read: prefer published revisions, fall back to current projections.
5. Deliver the unified inventory and structured editor.
6. Migrate hard-coded home, service, contact, quote, header and footer content.
7. Switch public reads to revisions and remove fallbacks only after parity and
   end-to-end verification.

Every migration is forward-only and compatible with the currently deployed
application until the read switch. No migration deletes legacy columns or
records during this programme.

## 8. Release gates

- authorization tests include forged parent IDs and lifecycle targets;
- migration tests cover populated production-shaped records and idempotency;
- every indexed route resolves before and after migration;
- published output parity is captured for the forty current URLs;
- draft edits never alter the published projection;
- media deletion is blocked by explicit usage relations;
- typecheck, lint, unit, integration and production build gates pass;
- production promotion requires an explicit owner decision after preview.
