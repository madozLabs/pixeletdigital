# Pixel&Digital — MVP Scope

Status: Working draft
Parent references:

- `docs/00-vision/PROJECT_BIBLE.md`
- `docs/01-brand/BRAND_ARCHITECTURE.md`

## 1. MVP objective

Deliver a premium multi-brand public platform and a controlled administration foundation that prove three things:

1. Pixel&Digital can present a distinctive, modern and credible market experience;
2. visitors can understand the ecosystem and become qualified leads;
3. internal users can govern content and incoming opportunities without relying on a developer for routine operations.

The MVP is not the complete internal operating system.

## 2. Public scope

### 2.1 Pixel&Digital world

Required:

- premium home experience;
- agency positioning and story;
- service families and detailed service pages;
- work and case studies;
- team presentation;
- evidence, results and testimonials;
- insights or resources;
- contact and quotation journeys;
- access to the ecosystem’s other worlds.

### 2.2 Kwaliti Print world

Required:

- visually distinct immersive landing experience;
- a current-capability presentation limited to owner-approved launch scope;
- Personalized Gadgets treated as the only current-stated capability unless ODR-003 explicitly changes it;
- Banner Printing, Vinyl Printing and 3D Lettering/CNC excluded from current-capability pages and quotation routes while future-only;
- project or product evidence only where authentic, permissioned and relevant to an approved current capability;
- materials, formats or production guidance only where operationally validated;
- quotation request adapted only to an approved current capability;
- clear relationship to the Pixel&Digital ecosystem;
- responsive fallback for heavy visual or 3D elements.

### 2.3 Studio and Training foundations

Required for MVP:

- reserved content structures;
- public teaser or coming-soon capability if approved;
- navigation and brand architecture capable of adding the full worlds later.

Full Studio and Training launches are outside the approved MVP. Adding either requires an explicit owner-approved scope change before scope freeze.

## 3. Content administration scope

The administration must support structured management of:

- brands or business units;
- pages and controlled page sections;
- services and service families;
- projects and case studies;
- participating business units per project;
- measurable project results;
- testimonials;
- team members;
- articles or resources;
- media assets;
- navigation and global settings;
- SEO metadata;
- contact and quotation form submissions.

The MVP will not include an unrestricted drag-and-drop page builder.

## 4. Commercial scope

The MVP includes lightweight lead management:

- lead identity and contact information;
- source and originating brand;
- requested service or project type;
- status;
- owner;
- notes;
- next action and due date;
- activity history;
- conversion to client or closed outcome.

The MVP does not include full invoicing, accounting or a generic sales automation engine.

## 5. Users and access

Initial roles:

- Super Admin;
- Administrateur;
- Responsable de marque;
- Éditeur;
- Commercial;
- Collaborateur;
- Lecteur.

Permissions must distinguish:

- public versus unpublished content;
- global versus business-unit access;
- content versus commercial data;
- read, create, edit, publish, archive and administer actions.

Final permission matrices will be defined in `ROLES_AND_PERMISSIONS.md`.

## 6. Publishing workflow

Canonical lifecycle:

1. Draft;
2. In review;
3. Scheduled, when delayed publication is requested;
4. Published;
5. Archived.

Rejection returns content to Draft with a review note. Preview is an action available before publication, not a lifecycle state. Only an authorized publishing role may move content from In review to Published or Scheduled.

The system should record who created, updated and published significant content.

Complex multi-stage approvals are out of scope for the MVP unless a real operational need is confirmed.

## 7. Forms and conversion

Required forms:

- general contact;
- project or quotation request;
- Kwaliti Print quotation request;
- consultation or appointment request.

Each submission must:

- capture consent where legally required;
- record source page and business unit;
- create or update a lead without silent duplication where practical;
- notify the appropriate internal users;
- protect against abuse and spam;
- avoid exposing sensitive data in logs.

## 8. Media scope

The media system must support:

- images;
- video references or managed video assets according to later infrastructure decisions;
- alternative text;
- captions and credits;
- owning business unit;
- usage context;
- responsive variants or optimization workflow;
- archival rather than destructive deletion when assets are in use.

Original 3D assets may be supported, but their production and delivery strategy is an architecture decision deferred until the experience designs are approved.

## 9. Search and discovery

Public MVP:

- intuitive navigation;
- service and project discovery;
- cross-links between related services, projects and business units.

Internal MVP:

- practical filtering and search for content, leads and media.

A universal enterprise search engine is not required.

## 10. Non-functional requirements

The MVP cannot be accepted unless it meets defined gates for:

- responsive behavior;
- accessibility;
- performance;
- SEO fundamentals;
- security;
- privacy;
- observability;
- backup and restoration readiness;
- maintainability;
- browser compatibility;
- graceful degradation of animations and 3D.

Exact measurable thresholds will be set after architecture and hosting decisions, but they remain release requirements.

## 11. Analytics direction

The MVP should measure meaningful business events such as:

- qualified form submissions;
- consultation requests;
- quotation requests by business unit;
- service and case-study engagement;
- navigation between brand worlds;
- lead sources and outcomes.

Vanity metrics alone are insufficient.

Analytics provider selection is deferred.

## 12. Explicit exclusions

Not part of MVP:

- accounting and payroll;
- full HR management;
- internal chat;
- video conferencing;
- client portal;
- online contract signature;
- complete project-management suite;
- manufacturing resource planning for Kwaliti Print;
- learning management system for Training;
- native mobile app;
- public marketplace;
- complex AI agents;
- microservices without demonstrated need.

## 13. Release slices

### Slice A — Foundation and public Pixel&Digital

- approved product and UX documentation;
- shared experience foundations;
- Pixel&Digital public pages;
- basic CMS content;
- contact and quotation capture.

### Slice B — Kwaliti Print world

- distinct brand theme;
- immersive public experience;
- governed capability structure limited to approved current scope;
- Personalized Gadgets as the sole current-stated candidate unless ODR-003 changes it;
- no current pages or quotation routes for Banner Printing, Vinyl Printing or 3D Lettering/CNC while future-only;
- adapted quotation flow for approved current capability only.

### Slice C — Administration and leads

- users and roles;
- structured content management;
- publication workflow;
- media management;
- lightweight lead tracking.

### Slice D — Evidence, optimization and release readiness

- case studies and measurable results;
- SEO and performance hardening;
- accessibility review;
- security review;
- analytics and operational checks.

The implementation sequence may be adjusted after UX and architecture reviews, but the scope boundaries remain.

## 14. Acceptance definition

The MVP is accepted only when:

- the public experience clearly differentiates Pixel&Digital and Kwaliti Print;
- visitors can understand and act without getting lost;
- the site remains usable on mobile and reduced-capability devices;
- Éditeurs can perform routine updates safely;
- incoming opportunities are visible and assignable;
- permissions prevent obvious cross-unit or privilege leakage;
- quality gates pass;
- launch risks and owner decisions are documented.

## 15. Owner decisions needed before scope freeze

- whether a future scope change promotes Studio from its approved MVP foundation/teaser to a full launch;
- whether a future scope change promotes Training from its approved MVP foundation/teaser to a full launch;
- languages required at launch;
- whether service pricing is public, indicative or quotation-only;
- preferred consultation booking approach;
- launch deadline and material budget;
- priority geographic markets;
- legal identity and required public notices.

Until these are resolved, discovery and UX work can continue, but final scope freeze and release planning cannot be completed.
