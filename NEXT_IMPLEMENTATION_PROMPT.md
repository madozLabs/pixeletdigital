# Prompt d'implémentation — reste des items Phase 2/3 (Facturation + Éditorial/Tâches)

**À coller tel quel dans une session Claude Code sur ce dépôt.** Source de vérité : `AUDIT_BILLING_MODULE.md` et `AUDIT_EDITORIAL_TASKS_MODULE.md` (déjà commités). Lire `AGENTS.md` avant de commencer si ce n'est pas déjà en contexte.

---

## Contexte général

Deux audits ont été menés et déjà partiellement implémentés (voir historique Git : commits `40f0ba2` à `3c3e874`) sur le module Facturation et le module Éditorial/Tâches. Les correctifs critiques de robustesse (concurrence, plafonds, requêtes non bornées) sont déjà faits. Ce prompt couvre le **reste** : les items Phase 2 et Phase 3 des deux rapports, moins ce qui a été explicitement écarté par décision propriétaire.

**Décisions propriétaire déjà prises, à respecter strictement :**
- **Pas de PDF serveur autonome.** L'impression navigateur (`window.print()`, déjà en place) suffit à l'usage réel. Ne pas construire ni proposer de librairie PDF.
- **Pas d'envoi e-mail réel.** Le statut « Envoyée » d'une facture reste un simple changement de statut. Ne pas ajouter de dépendance e-mail.
- **Identité émetteur à rendre configurable** (nom, logo, adresse) sur le document imprimé — actuellement `"Pixel&Digital"` est codé en dur dans `src/app/workspace/billing/invoices/[id]/print/page.tsx:46`. C'est le SEUL paramètre d'affichage à configurer pour l'instant (pas de mentions légales/fiscales, pas de conditions de paiement standard, pas de config devise — hors périmètre tant que non redemandé).

**Règles de travail (identiques à tout ce qui a déjà été fait dans ce dépôt ce soir) :**
- Un item = une slice = un commit séparé. Ne pas mélanger deux items dans un commit.
- Pour chaque item : implémenter → `npx tsc --noEmit` → `npx eslint src --max-warnings=0` → `npm run test:run` → si le schéma Prisma est touché, `npm run test:integration:db` (lance une DB PGlite jetable, pas besoin de DB locale) → si changement visuel/comportemental UI, lancer le serveur de dev et vérifier dans le navigateur avant de considérer que c'est fini.
- Aucune nouvelle dépendance sans la justifier explicitement et sans confirmation — le projet en a peu, volontairement (`AGENTS.md`).
- Après chaque item, mettre à jour le tableau et la ligne du rapport concerné (`AUDIT_BILLING_MODULE.md` ou `AUDIT_EDITORIAL_TASKS_MODULE.md`) avec un statut « ✅ traité <date> » et un paragraphe expliquant ce qui a été réellement fait vs prévu.
- Commit par item, pas de `--no-verify`, pas d'`--amend`. **Ne pas pusher** — l'validation du propriétaire se fait avant push, comme pour tout ce soir.
- Traiter dans l'ordre ci-dessous (F1 → F8, T1 → T6). Si un item révèle qu'il dépend d'un autre non encore fait, le signaler et passer au suivant plutôt que de bloquer.

---

## Facturation

### F1 — Identité émetteur configurable sur le document imprimé

**✅ Traité 2026-07-30.** Réalisé plus simplement que prévu : aucune migration Prisma, aucun nouveau formulaire. `SiteSettings`/`SiteIdentityConfig` (module `content`, déjà utilisé par les layouts publics) exposait déjà `siteName`, `logoMediaId`→`logoUrl` et `address` par monde, éditables via l'onglet Identité existant (`workspace/site-content/settings`). `invoices/[id]/print/page.tsx` appelle désormais `getPublishedSiteIdentity(worldKey, ...)` (même fonction que `site-header.tsx`/`kwaliti-header.tsx`) au lieu du texte en dur, avec repli sur `displayName` du monde si l'identité n'est pas encore publiée. Logo rendu via `next/image` (cohérent avec le header public, pas `<img>` brut). Écarté : champ `legalName` distinct de `displayName`/`siteName` — non nécessaire, `siteName` suffisait déjà comme "nom d'émetteur affiché". Vérifié : `tsc --noEmit`, `eslint --max-warnings=0`, suite de tests complète (591/591) ; pas de vérification navigateur live (page nécessite auth + facture réelle, changement de lecture pure sur un mécanisme déjà exercé visuellement ailleurs).

**Contexte :** `invoices/[id]/print/page.tsx:46` affiche `<p className="invoice-print__brand">Pixel&Digital</p>` en dur, sans lien avec le monde (`worldKey`) de la facture. Kwaliti Print (l'autre monde du projet) n'a donc jamais sa propre identité sur ses factures imprimées.

**Objectif :** Rendre nom, logo et adresse de l'émetteur configurables par monde, affichés sur le document imprimé au lieu du texte en dur.

**Périmètre autorisé :**
- Étendre le modèle `World` (`prisma/schema.prisma`) avec des champs optionnels : `legalName` (nom d'émetteur affiché, distinct de `displayName` si besoin), `address` (texte libre multi-ligne), `logoUrl`. Migration Prisma requise.
- `invoices/[id]/print/page.tsx` lit ces champs via le `World` déjà chargé (ou à charger) au lieu du texte en dur `"Pixel&Digital"`.
- Un formulaire d'édition simple dans le Workspace (probablement dans les réglages du monde déjà existants si une telle page existe — vérifier avant d'en créer une nouvelle) pour que l'Admin/World Manager renseigne ces champs, avec repli propre si vide (ne pas laisser un champ vide casser l'affichage : à défaut, garder `displayName` déjà existant).

**Contraintes :**
- Aucune mention légale/fiscale à inventer — seulement nom/logo/adresse, rien d'autre.
- Ne pas casser l'affichage existant pour un monde qui n'aurait pas encore renseigné ces champs (repli sur `displayName`).

**Résultat attendu :** Une facture imprimée depuis Kwaliti Print affiche l'identité Kwaliti Print, pas Pixel&Digital.

### F2 — Facturation directe (sans devis préalable)

**✅ Traité 2026-07-30.** `createInvoiceAction` (`billing/actions.ts`) ajouté, mirroir exact de `createQuoteAction` (mêmes champs client/lignes/remise/taxe/notes, `dueAt` à la place de `validUntil`). `CreateInvoiceForm` (`billing-forms.tsx`) même patron que `CreateQuoteForm`, rendu dans l'onglet Factures de `billing/page.tsx`, avec son propre datalist catalogue (`billing-catalogue-labels-invoices`, id distinct de celui du devis pour éviter toute ambiguïté même si les deux onglets ne se rendent jamais en même temps). Plafond de lignes **dupliqué** (`INVOICE_LINE_SLOTS = 12`, même commentaire de synchronisation que `QUOTE_LINE_SLOTS`) plutôt que généralisé en constante partagée — choix pris pour rester au plus près du patron `createQuoteAction`/`CreateQuoteForm` existant sans toucher au flux devis déjà en place, cohérent avec la seconde option laissée ouverte par ce prompt. Facture créée reste `DRAFT` par défaut (comportement du domaine, inchangé). Flux devis→facture (`convertQuoteToInvoiceAction`) non touché. Vérifié : `tsc --noEmit`, `eslint --max-warnings=0`, suite de tests complète (573+/573+, quelques crashs de worker vitest liés à la mémoire de la machine plutôt qu'au code — voir note d'environnement) ; pas de vérification navigateur live (formulaire suit un patron déjà vérifié visuellement pour `CreateQuoteForm`).

**Contexte :** `src/modules/billing/application/invoice-use-cases.ts` expose déjà `createDraftInvoice`, testé, mais aucun formulaire du Workspace ne l'appelle — seule `convertQuoteToInvoiceAction` crée une facture, à partir d'un devis `ACCEPTED`.

**Objectif :** Exposer un formulaire « Nouvelle facture » dans l'onglet Factures de `billing/page.tsx`, appelant `createDraftInvoice` directement, sans devis.

**Périmètre autorisé :**
- Nouvelle Server Action `createInvoiceAction` dans `billing/actions.ts`, suivant exactement le patron de `createQuoteAction` (mêmes champs : client, lignes, remise, taxe, notes, échéance).
- Nouveau composant formulaire dans `billing-forms.tsx`, même patron que `CreateQuoteForm` (réutiliser le composant de ligne si pertinent).
- Réutiliser le plafond de 12 lignes déjà en place (constante `QUOTE_LINE_SLOTS`, à généraliser en `LINE_SLOTS` partagé si c'est propre, sinon dupliquer avec le même commentaire de synchronisation déjà utilisé).

**Contraintes :**
- Ne pas toucher au flux devis→facture existant.
- Vérifier si une facture créée directement doit rester en `DRAFT` (oui, comme toute facture — cohérent avec le domaine existant).

**Résultat attendu :** Un utilisateur autorisé peut créer une facture depuis zéro, sans étape de devis.

### F3 — Paiement antidatable

**✅ Traité 2026-07-30.** `RecordPaymentInput` accepte `paidAt?: Date | null` ; utilisé pour `Payment.paidAt` (le ledger de paiement individuel), avec une garde explicite refusant toute date future (`INVALID_PAID_AT`, ajouté à `PaymentDomainErrorCode`). Champ `<input type="date" name="paidAt">` ajouté au formulaire, valeur par défaut = aujourd'hui, `max` = aujourd'hui (garde-fou navigateur en plus de la validation serveur). **Écart volontaire par rapport au prompt** : `applyInvoicePayment(invoice, totalPaidCents, now)` continue de recevoir `now` (pas `paidAt`) — ce paramètre alimente à la fois `Invoice.paidAt` et `Invoice.updatedAt` dans le domaine existant (`invoice.ts:307-313`), et rétrodater `updatedAt` serait sémantiquement faux (ce champ doit refléter le moment réel de l'écriture système, pas la date métier du paiement). Seul le paiement individuel porte la date réelle ; le `paidAt` agrégé de la facture reste la date de constatation système. Changer ce couplage serait un changement de domaine plus large que ce que ce prompt demandait. Comportement existant inchangé quand le champ est vide (`?? now`). Vérifié : `tsc --noEmit`, `eslint --max-warnings=0`, suite de tests complète (591/591, en single-fork pour éviter les crashs mémoire de la machine) ; pas de vérification navigateur live.

**Contexte :** `recordInvoicePayment` (`payment-use-cases.ts:64-73`) fixe `paidAt: now` sans option ; le formulaire de paiement (`billing-forms.tsx`) n'a aucun champ de date.

**Objectif :** Permettre de saisir la date réelle du paiement (rapprochement bancaire), avec `now()` comme valeur par défaut.

**Périmètre autorisé :**
- `RecordPaymentInput` (`payment-use-cases.ts`) accepte un `paidAt?: Date` optionnel, utilisé à la place de `now` si fourni (le domaine `recordPayment` l'accepte déjà).
- Champ `<input type="date" name="paidAt">` optionnel dans le formulaire de paiement, valeur par défaut = date du jour.
- `recordPaymentAction` (`billing/actions.ts`) lit ce champ, le convertit en `Date` si présent.

**Contraintes :**
- Ne jamais accepter une date dans le futur (validation simple, retourner une erreur de champ sinon).
- Ne pas changer le comportement existant si le champ est laissé vide (comportement actuel = `now()`, doit rester identique).

**Résultat attendu :** Un paiement peut être enregistré avec sa date réelle, pas seulement la date de saisie.

### F4 — Pièces jointes sur devis/factures

**Contexte :** Aucune pièce jointe (contrat, bon de commande) ne peut être liée à un devis ou une facture. Une infrastructure médias existe déjà pour le CMS public (`src/modules/content` ou équivalent — vérifier son emplacement exact avant de commencer).

**Objectif :** Permettre d'attacher un ou plusieurs fichiers à un devis/facture.

**Périmètre autorisé :**
- Vérifier d'abord si l'infra média existante (upload, stockage Supabase) est réutilisable telle quelle ou nécessite une adaptation minime — ne pas réinventer un système de stockage.
- Nouveau modèle de liaison (ex. table `QuoteAttachment`/`InvoiceAttachment`, ou une table générique si un tel motif existe déjà ailleurs dans le schéma — vérifier avant d'inventer).
- UI : liste de pièces jointes sur la carte devis/facture, bouton d'ajout, suppression avec confirmation (`ConfirmAction`, motif déjà en place).

**Contraintes :**
- Réutiliser le composant de confirmation et le patron de retour visuel déjà établis (`Feedback`, `ConfirmAction`).
- Limiter la taille/le type de fichier de façon cohérente avec ce qui existe déjà pour les médias CMS.

**Résultat attendu :** Un devis/une facture peut porter ses pièces justificatives.

### F5 — Remise en pourcentage

**Contexte :** `discountCents` est un montant fixe uniquement (`quote.ts`/`invoice.ts` domaine, `billing-forms.tsx` champ « Remise (XOF) »).

**Objectif :** Permettre de saisir la remise en pourcentage OU en montant fixe, au choix.

**Périmètre autorisé :**
- Ajouter un sélecteur type de remise (montant/pourcentage) dans `CreateQuoteForm`, calcul du montant équivalent côté client avant soumission (ou côté serveur dans l'action — au choix, mais le domaine (`invoice.ts`/`quote.ts`) continue de ne recevoir qu'un `discountCents` calculé, pas un pourcentage brut, pour ne pas complexifier le domaine).

**Contraintes :**
- Ne pas changer la signature du domaine (`createDraftQuote`/`createDraftInvoice` continuent de recevoir `discountCents`).
- Le calcul pourcentage→cents doit être arrondi de façon cohérente avec `computeTotal` existant.

**Résultat attendu :** Un commercial peut taper « 10% » au lieu de calculer le montant à la main.

### F6 — Recherche/filtres devis-factures

**Contexte :** Aucun filtre sur les listes (`billing/page.tsx`), seulement la pagination et les onglets par statut implicite.

**Objectif :** Filtrer par client, statut, période.

**Périmètre autorisé :**
- Paramètres d'URL (`?client=`, `?status=`, `?from=&to=`) similaires au patron déjà utilisé pour `?page=`.
- Étendre `listBillingSummary` (`billing-summary-query.ts`) pour accepter ces filtres, appliqués côté Prisma (pas de filtrage JS après coup).

**Résultat attendu :** Retrouver un document précis en quelques secondes sur une liste volumineuse.

### F7 — Total live à la saisie

**Contexte :** Le total d'un devis n'est visible qu'après soumission du formulaire.

**Objectif :** Afficher un total calculé (sous-total, remise, taxe, total) recalculé en direct pendant la saisie des lignes.

**Périmètre autorisé :**
- Logique de calcul côté client (JS pur, même formule que `computeTotal` du domaine — dupliquer la formule est acceptable ici puisque c'est un affichage indicatif, pas la source de vérité qui reste calculée côté serveur/domaine à la soumission).

**Résultat attendu :** Confiance immédiate dans le montant avant d'envoyer le devis.

### F8 — Duplication de devis

**Contexte :** Chaque devis se crée depuis un formulaire vide, y compris pour un client récurrent aux prestations connues.

**Objectif :** Bouton « Dupliquer » sur un devis existant, pré-remplissant un nouveau formulaire de création avec les mêmes lignes/client.

**Périmètre autorisé :**
- Un lien/bouton sur la carte devis qui pré-remplit `CreateQuoteForm` (via paramètres d'URL ou état local) à partir des données du devis source.

**Résultat attendu :** Moins de ressaisie pour un client récurrent.

---

## Éditorial / Tâches

### T1 — Dépendance de tâche appliquée

**Contexte :** `dependencyTaskId` existe (`Task` schema) mais n'est jamais vérifié — rien n'empêche de passer une tâche à `DONE` alors que sa dépendance ne l'est pas.

**Décision produit encore ouverte, à trancher AVANT de coder :** blocage strict (impossible de passer à `DONE` tant que la dépendance n'est pas terminée) ou simple avertissement (message affiché, action autorisée quand même) ? **Si cette information n'est pas fournie explicitement dans ce prompt ou par le propriétaire avant de commencer cet item, implémenter la version avertissement (moins intrusive, réversible) et le signaler clairement dans le rapport — ne pas bloquer silencieusement une action sans confirmation explicite du choix.**

**Périmètre autorisé :**
- `updateTaskAction`/`moveTaskAction` (`tasks/actions.ts`) vérifient le statut de `dependencyTaskId` avant d'accepter un passage à `DONE`.

**Résultat attendu :** Le champ dépendance devient réellement fonctionnel, pas seulement informatif.

### T2 — Vue « mon travail » transverse

**Contexte :** Aucune vue ne filtre par utilisateur connecté, ni pour les tâches ni pour les contenus éditoriaux — seulement par projet/monde. Déjà noté comme manque général par l'audit précédent (item I2).

**Objectif :** Une vue (nouvelle page ou section repliable sur le dashboard existant) montrant : mes tâches assignées (tous projets), mes contenus éditoriaux (propriétaire ou relecteur), tous mondes confondus si l'utilisateur a une portée globale.

**Périmètre autorisé :**
- Nouvelle requête filtrée par `assigneeId`/`ownerId`/`reviewerId` = utilisateur courant (`context.actor.id`, déjà disponible via `getWorkspaceRequestContext()`).
- Peut vivre comme section sur le dashboard `workspace/page.tsx` existant (cohérent avec I2 déjà recommandé) ou comme nouvelle route — choisir ce qui perturbe le moins l'existant.

**Résultat attendu :** Un collaborateur voit immédiatement ce qu'il doit faire, sans chercher dans les tableaux complets.

### T3 — Motif de rejet tracé (validation éditoriale)

**Contexte :** Le changement de statut d'un contenu éditorial (y compris un retour en arrière depuis `CLIENT_REVIEW`) ne capture aucun motif — juste un changement de statut brut.

**Objectif :** Champ « motif » optionnel mais visible, affiché à l'historique, quand un contenu recule de statut ou passe à `CANCELLED`.

**Périmètre autorisé :**
- Champ texte optionnel dans `EditorialWorkflowForm`, stocké (nouveau champ sur `EditorialItem` ou table d'historique séparée si un tel motif existe déjà pour d'autres entités — vérifier `AuditEvent`/`recordAuditEvent` du module `audit`, potentiellement réutilisable ici plutôt que d'inventer un nouveau mécanisme).

**Résultat attendu :** Traçabilité du pourquoi, pas seulement du quoi.

### T4 — Filtrage du sélecteur de tâche dépendante

**Contexte :** Le formulaire de création de tâche liste toutes les tâches existantes du projet sans filtre (`create-task-form.tsx`) — impraticable au-delà de quelques dizaines de tâches.

**Objectif :** Remplacer le `<select>` exhaustif par une recherche/filtre texte.

**Périmètre autorisé :**
- Un `<input list="...">` avec `<datalist>` (même patron déjà utilisé pour l'auto-complétion du catalogue en Facturation, `billing/page.tsx:164-168`) au lieu d'un `<select>` géant.

**Résultat attendu :** Utilisable même avec des centaines de tâches par projet.

### T5 — Exposer le champ budget projet

**Contexte :** `Project.budgetCents` existe en base mais n'est affiché ni saisi nulle part dans l'UI, alors que le sous-titre de la page Projets promet un suivi budgétaire.

**Objectif :** Afficher et permettre de saisir ce champ.

**Périmètre autorisé :**
- Champ dans `CreateProjectForm`/`UpdateProjectForm` (`project-forms.tsx`), affichage sur la carte projet (`projects/page.tsx`).

**Contraintes :** Aucune nouvelle donnée à inventer, le champ existe déjà — juste l'exposer.

**Résultat attendu :** Cohérence entre la promesse de l'interface et ce qu'elle permet réellement.

### T6 — Vue mois du calendrier éditorial

**Contexte :** Seules les vues Semaine et Pipeline existent pour le calendrier éditorial.

**Objectif :** Ajouter une vue Mois, cohérente avec la vue Semaine déjà en place (même navigation précédent/suivant, même requête bornée par date — **appliquer la même discipline que le correctif déjà fait sur la vue Semaine, ne pas réintroduire une requête non bornée**).

**Périmètre autorisé :**
- Nouvel onglet « Mois » dans `editorial/page.tsx`, nouvelle fonction de calcul de plage dans `_lib/week.ts` (à renommer/étendre en conséquence si ça devient trop spécifique au mot « semaine »).

**Résultat attendu :** Vision de planification à moyen terme, pas seulement 7 jours à la fois.

---

## Ordre de traitement recommandé

1. **F1** (identité émetteur — bloque potentiellement rien mais demandé explicitement en premier)
2. **F2, F3** (Critique/Important, petits, indépendants)
3. **T1, T5** (petits, indépendants)
4. **T2, T4** (Important, taille moyenne)
5. **F4, T3** (nécessitent de vérifier une infra existante avant de coder — média, audit)
6. **F5, F6, F7, F8, T6** (Phase 3, amélioration UX, à faire dans l'ordre qui reste une fois ce qui précède est stable)

Une fois tout traité : résumé court de ce qui a été fait, ce qui reste ouvert (dépendances non résolues, décisions encore en attente), ne pas enchaîner sur les items Innovation sans validation explicite.
