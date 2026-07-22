# Owner Decision Register

Status: Mixed — 8 of 23 decisions approved or deferred as of 2026-07-22; remaining decisions open for Phase 1
Owner: Project owner
Rule: Pixel&Digital and Kwaliti Print are live MVP worlds. Studio and Training remain teaser/foundation only unless the owner explicitly approves a future scope change.

## 1. Use

Record the approved answer, rationale, approver and review date when a decision closes. `Default posture` governs planning only and must not be presented publicly as an approved fact. Status values are `Open`, `Approved`, `Deferred` or `Rejected`.

## 2. Register

| ID | Decision required | Impact | Deadline/gate | Default posture | Owner | Status | Blocking status |
|---|---|---|---|---|---|---|---|
| ODR-001 | Approve official Pixel&Digital positioning and tagline | Homepage, services, SEO, claims and conversion copy | Final content approval | Use labelled draft structure; publish no final claim | Project owner | Approved | Closed 2026-07-22; see section 4 |
| ODR-002 | Confirm Pixel&Digital launch service catalogue | Navigation, service pages, forms and evidence needs | Scope freeze and content approval | Include only owner-confirmed services | Project owner | Approved | Closed 2026-07-22; full catalogue in `docs/04-content/drafts/PIXEL_DIGITAL_SERVICE_CATALOGUE_DRAFT.md`, publication gated per-service by lifecycle |
| ODR-003 | Confirm Kwaliti Print launch categories, materials, formats and capabilities | Discovery, quotation qualification and proof | Scope freeze and content approval | Treat all unconfirmed commercial facts as gaps | Project owner | Approved | Closed 2026-07-22; full catalogue approved for creation now, unavailable capabilities enter as Draft and are activated by publish toggle without new migration |
| ODR-004 | Decide pricing visibility | Copy, catalogue treatment, forms and qualification | Final UX/content and release | Quotation-only language; publish no price | Project owner | Approved | Closed 2026-07-22; quotation-only, no public price, ever |
| ODR-005 | Decide consultation booking approach | Calls to action, journey and privacy dependencies | Final UX and release planning | Define an implementation-neutral request journey | Project owner | Open | Blocks stated gate |
| ODR-006 | Approve launch languages | Content volume, approvals, accessibility and SEO | Scope freeze and production plan | Do not assume a language set | Project owner | Open | Blocks stated gate |
| ODR-007 | Approve priority geographies/service area | Claims, relevance, fulfilment and legal context | Scope freeze and legal/content approval | Publish no geographic promise | Project owner | Open | Blocks stated gate |
| ODR-008 | Approve Studio final name, identity and teaser wording | Navigation and teaser asset/copy | Final brand/content approval | Provisional descriptor only; foundation/teaser scope | Project owner | Open | Blocks stated gate |
| ODR-009 | Approve any future Studio promotion to a full launch | Roadmap, scope, content and operations | New owner-approved scope change | Remain teaser/foundation only | Project owner | Open | Blocks stated gate |
| ODR-010 | Approve Training final name, identity and teaser wording | Navigation and teaser asset/copy | Final brand/content approval | Provisional descriptor only; foundation/teaser scope | Project owner | Open | Blocks stated gate |
| ODR-011 | Approve any future Training promotion to a full launch | Roadmap, scope, content and operations | New owner-approved scope change | Remain teaser/foundation only | Project owner | Open | Blocks stated gate |
| ODR-012 | Approve final logos and usage rules | Identity assets and cross-world orientation | Visual design and asset production | Preserve the four repository source Pixel&Digital PNG files as raster-only inputs; do not infer missing variants, rules or rights | Project owner | Approved | Closed 2026-07-22 for interim use: current raster PNGs authorized for production use now; architecture must allow swapping in vector masters (SVG/AI/PDF) later without code changes. Rights authority and misuse rules remain unresolved and are not required to block interim use |
| ODR-013 | Approve exact colours and type families | Brand system, contrast testing and production | Visual design and accessibility approval | Preserve directional red/white intent only; no exact values/fonts | Project owner | Approved | Closed 2026-07-22; see section 4 for Pixel&Digital palette/type. Kwaliti Print's own palette/type remain a separate open question (its brand bible requires visual autonomy from Pixel&Digital) |
| ODR-014 | Approve clients, case studies, metrics, testimonials and attribution | Credibility, rights, case-study content and claims | Content approval and release | Publish only verified, permissioned evidence | Project owner | Open | Blocks stated gate |
| ODR-015 | Approve media subjects, rights and production direction | Photography, video, 3D, team and work media | Asset production and release | Audit existing rights; commission nothing unapproved | Project owner | Open | Blocks stated gate |
| ODR-016 | Approve media-production budget | Asset ambition, prioritisation and schedule | Production commitment and release planning | Plan essential/static-first packages without assuming spend | Project owner | Open | Blocks stated gate |
| ODR-017 | Approve launch date | Sequencing, content freeze and release readiness | Release planning | No public or internal date commitment | Project owner | Open | Blocks stated gate |
| ODR-018 | Provide legal identity and required public notices | Footer, forms, ownership statements and compliance | Final content and release | Use no invented legal facts or final legal copy | Project owner | Deferred | Deferred 2026-07-22 by explicit owner instruction; not required now. Architecture must keep legal identity fields (raison sociale, RCCM, IFU, adresse, téléphone, email, responsable de publication, mentions légales) as governed configuration, empty until supplied. Still blocks public release of the footer/legal pages |
| ODR-019 | Approve privacy terms, consent wording and data-retention rules | Forms, leads, media, analytics and operational handling | Final forms, analytics and release | Minimise requested data; keep final wording and retention unresolved | Project owner | Open | Partially progressed 2026-07-22: mechanism scope approved (privacy policy page, consent management, cookie handling, contact-form consent capture, configurable retention duration, data-deletion-on-request). Final legal wording and exact retention values remain open and still block release |
| ODR-020 | Decide analytics scope/provider constraints | Conversion evidence, consent and privacy review | Architecture/release planning after Phase 1 | Define meaningful events only; select no provider | Project owner | Open | Blocks stated gate |
| ODR-021 | Decide whether Insights has sufficient governed content for MVP | Navigation, editorial workload and conversion paths | Scope freeze and content inventory | Exclude unless approved content is sufficient | Project owner | Open | Blocks stated gate |
| ODR-022 | Approve file-acceptance guidance for Kwaliti Print requests | Mobile forms, privacy, customer instructions and operations | Final quotation journey and release | Do not promise accepted formats or handling | Project owner | Open | Blocks stated gate |
| ODR-023 | Approve Kwaliti Print final logo assets, endorsement wording and relationship to Pixel&Digital | Identity assets, launch collateral and cross-world orientation | Final brand/content approval | Preserve the three repository Kwaliti Print PNG files as raster-only inputs; do not infer missing variants, rules or rights | Project owner | Approved | Closed 2026-07-22 for interim use: current raster PNGs authorized for production use now; architecture must allow swapping in vector masters later without code changes. Endorsement wording and rights authority remain unresolved and are not required to block interim use |

## 3. Decision quality gate

A decision is `Approved` only when its answer and implications are explicit, affected documents/content are identified, evidence or authority is recorded, privacy/legal consequences are addressed, and an approver is named. Decisions affecting mobile, accessibility, performance or conversion must state how those release requirements remain satisfied. No open item may be silently converted into a public claim, capability, price, date, budget or legal fact.

### ODR-012 evidence note

Four 1418 × 1418 Pixel&Digital PNG files are present under `assets/brand/pixel-digital/source/` and registered with names, transparency behavior, sizes and SHA-256 hashes in `docs/01-brand/PIXEL_DIGITAL_LOGO_REGISTER.md`. They are repository source assets but remain raster-only. The dominant opaque red observed in the symbol raster samples as RGB 232, 27, 44 / `#E81B2C`; this is raster evidence, not an approved universal brand token. Vector/master files, formal usage rules, rights authority, clear-space rules, minimum-size rules, typography specifications and authoritative colour/gradient specifications remain pending, but no longer block interim production use per the ODR-012 approval above.

## 4. Approved decisions — record

### ODR-001: Positioning and tagline

Positioning: "Pixel & Digital est un studio créatif spécialisé dans la communication visuelle, le marketing digital, la création de contenus, l'audiovisuel, le développement web et les solutions d'impression à travers sa marque Kwaliti Print. Nous accompagnons les entreprises, institutions, ONG et entrepreneurs dans la création, le développement et la valorisation de leur image de marque."

Tagline: "Nous créons des marques qui attirent, convainquent et restent en mémoire."

Approved by: Project owner. Date: 2026-07-22.

### ODR-002 / ODR-003: Service and capability catalogues

Full catalogues approved for both worlds. See `docs/04-content/drafts/PIXEL_DIGITAL_SERVICE_CATALOGUE_DRAFT.md` and `docs/04-content/drafts/KWALITI_PRINT_CAPABILITY_CATALOGUE_DRAFT.md` for the complete lists.

Binding rule for implementation: every service/capability is created now as a governed record, administrable individually, with a Published/Draft toggle. Capabilities not yet physically available (e.g. laser cutting) are created as Draft and activated later purely by publishing — no new migration or development may be required to bring a new capability online once equipment/capacity exists. This directly matches the existing `Service` domain's `lifecycle` (DRAFT/PUBLISHED/ARCHIVED) and `availabilityStatus` model; no architecture change is required to satisfy this rule.

Approved by: Project owner. Date: 2026-07-22.

### ODR-004: Pricing visibility

No public pricing, ever. Every commercial path is: request a quotation → receive an estimate → get called back. No price is displayed publicly anywhere on the site.

Approved by: Project owner. Date: 2026-07-22.

### ODR-013: Pixel&Digital colour palette and type

| Token | Value |
|---|---|
| Primary red | `#C62828` |
| Dark red | `#8E0000` |
| Black | `#111111` |
| White | `#FFFFFF` |
| Light grey | `#F5F5F5` |

Typography: headings in Montserrat, body text in Inter.

This palette/type may evolve later without architectural impact (colours and fonts are presentation-layer tokens, not structural). This decision covers Pixel&Digital only; Kwaliti Print's own colour/type system remains open (see `docs/01-brand/KWALITI_PRINT_BRAND_BIBLE.md` section 10) since it must remain visually autonomous from the parent brand.

Approved by: Project owner. Date: 2026-07-22.

### ODR-012 / ODR-023: Interim logo use

Current repository raster PNGs (four Pixel&Digital, three Kwaliti Print) are authorized for production use now. The architecture must allow later replacement by vector masters (SVG/AI/PDF) as a pure asset swap, without code changes. Rights authority, formal usage/misuse rules and (for Kwaliti Print) endorsement wording toward the parent brand remain open but do not block interim use.

Approved by: Project owner. Date: 2026-07-22.

### ODR-019: Privacy mechanism scope

Approved mechanisms to build now, wording to follow later: a privacy-policy page, consent management, cookie handling, consent capture on the contact form, a configurable data-retention duration, and a data-deletion-on-request capability. Final legal wording and exact retention values are not yet approved and must not be invented.

Approved by: Project owner. Date: 2026-07-22.

### ODR-018: Deferred

Legal identity and public notices (raison sociale, RCCM, IFU, adresse, téléphone, email, responsable de publication, mentions légales) are explicitly deferred by the owner and will be supplied before production release. The architecture must expose these as governed, individually configurable fields rather than hard-coded content, so supplying them later requires no code change.

Deferred by: Project owner. Date: 2026-07-22.
