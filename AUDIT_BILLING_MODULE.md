# Audit consultant — Module Facturation (Billing)

**Date :** 30 juillet 2026
**Périmètre analysé :** `src/modules/billing/**` (domaine/application/infrastructure), `src/app/workspace/billing/**`, `src/app/workspace/clients/**`, `prisma/schema.prisma` (modèles `Client`, `ClientContact`, `Quote`, `QuoteLine`, `Invoice`, `InvoiceLine`, `Payment`, `CatalogueItem`).
**Méthode :** lecture directe et exhaustive du code source — domaine, cas d'usage, dépôts Prisma, actions serveur, formulaires, page d'impression, schéma. Aucune affirmation sans preuve de fichier/ligne, conformément à la règle `AGENTS.md`. Aucune exécution de navigateur possible dans cette session (PostgreSQL non joignable sur cette machine, cf. `README.md`) — l'audit UX/UI s'appuie sur la lecture du JSX/CSS réel, pas sur une capture d'écran ; signalé explicitement partout où c'est une limite.

**Limite de contexte factuelle importante, à ne pas perdre de vue dans tout ce document :** la devise du module est **XOF (franc CFA / UEMOA)**, en dur (`Facturation XOF`, `formatCurrency(..., "XOF")` par défaut dans `src/shared/format.ts`). Ce n'est donc probablement pas une entité française — le régime de TVA, les mentions légales obligatoires et le seuil de facturation électronique applicables dépendent du pays UEMOA réel de l'entité (Sénégal, Côte d'Ivoire, Burkina Faso, Mali, etc.), information absente du dépôt. Tout ce document évite donc d'invoquer des règles fiscales françaises (TVA française, Factur-X, mention art. 293B du CGI) qui seraient hors sujet ou fausses ici.

---

## 1. Résumé exécutif

Le module Facturation est **fonctionnellement correct sur son périmètre restreint** : cycle devis → facture → paiement avec machine à états typée, autorisation par rôle, traçabilité d'audit sur les événements sensibles (C1), pagination bornée (C4), retour utilisateur explicite sur chaque mutation (C6), confirmation renforcée sur les actions destructrices (annulation facture, archivage catalogue). La couche domaine est propre (aucun import framework), testée de façon comportementale, sans `any`.

Mais c'est un module **pensé pour un cas d'usage étroit** (devis simple → facture → un ou plusieurs paiements) et il présente une divergence interne inattendue : **la couche infrastructure du module gouverné (`src/modules/billing/infrastructure`) contient un vrai bug de concurrence** (détaillé §8.1) que le reste du dépôt — y compris des modules classés « non gouvernés » par l'audit général (`projects/actions.ts`) — a déjà correctement corrigé. C'est le constat le plus significatif de cet audit : le clivage gouverné/non gouverné documenté par `docs/05-architecture/DOMAIN_BOUNDARIES.md` et l'ODR-025 ne garantit pas, à lui seul, la meilleure qualité technique du côté « gouverné ».

Comparé à un logiciel de facturation professionnel moderne (Sellsy, Axonaut, QuickBooks, Odoo Invoicing, Facture.net), il manque des capacités structurantes : **facturation récurrente, avoirs/notes de crédit formels, remise en pourcentage, taxation multi-taux, identifiant fiscal client, envoi par e-mail, portail client, pièces jointes, relances automatiques**. Aucune de ces absences n'est une régression — ce sont des choix de périmètre MVP visibles dans `docs/08-governance/PHASE_2_ENTRY_CRITERIA.md` et le tableau `ROLES_AND_PERMISSIONS.md` (Facturation = gérer/non pour la plupart des rôles, un module volontairement simple). Mais plusieurs manques ont un vrai impact opérationnel immédiat : **impossible de créer un devis/facture avec plus de 3 lignes** (plafond en dur dans le JSX, §4 et §8.2), **impossible d'émettre une facture sans passer par un devis** (aucun formulaire de création directe câblé, alors que le cas d'usage existe côté application), **impossible d'antidater un paiement** (le formulaire ne propose pas de date, le cas d'usage force `now()`).

**Répartition des recommandations de cet audit :** 3 critiques, 6 importantes, 7 d'amélioration, 5 d'innovation.

---

## 2. Modèle de référence — logiciel de facturation professionnel

| Domaine | Ce qu'un logiciel professionnel fait, et pourquoi |
|---|---|
| **Gestion clients** | Fiche client riche : coordonnées, identifiant fiscal/légal, conditions de paiement par défaut, devise par défaut, historique complet (devis/factures/paiements), contacts multiples avec rôle. Sans identifiant fiscal, une facture B2B n'est souvent pas opposable/déductible pour le client. |
| **Devis** | Numérotation propre, validité datée, lignes illimitées, remise et taxe par ligne ou globales, conversion 1-clic en facture, suivi d'acceptation (signature ou clic client), relance automatique avant expiration. |
| **Cycle de vie facture** | États clairs et transitions contrôlées (brouillon → envoyée → payée partiellement/totalement → en retard → annulée), verrouillage du contenu après envoi (une facture envoyée ne doit plus être éditable en place — seul un avoir corrige une erreur). |
| **Avoirs / notes de crédit** | Document comptable distinct, sa propre numérotation, lié à la facture d'origine, seul mécanisme légitime pour corriger une facture déjà émise/payée. Une simple annulation de statut sans document n'est pas une pratique comptable acceptée dès qu'une facture a été envoyée ou payée. |
| **Produits/services** | Catalogue avec code, unité, prix, taux de taxe par défaut, catégories, éventuellement variantes. |
| **Tarification** | Prix par client (grille tarifaire), remise ligne et globale, remise pourcentage ET montant fixe. |
| **Taxes** | Taux multiples applicables ligne par ligne (biens/services à taux différents dans un même document), gestion de l'exonération, affichage détaillé de la ventilation. |
| **Remises** | Pourcentage ou montant, par ligne ou globale, avec raison/justification optionnelle pour l'audit. |
| **Paiements** | Multi-méthodes, paiements partiels illimités, historique daté (y compris antidatage pour rapprochement bancaire), lettrage, réconciliation. |
| **Conditions de paiement** | Échéance calculée depuis des règles réutilisables (net 30, 50 % à la commande, etc.), affichées sur le document. |
| **Paiements partiels** | Déjà couvert : voir Paiements. |
| **Multi-devise** | Devise par document, taux de change figé à l'émission, conversion pour le reporting consolidé. |
| **Numérotation** | Séquence strictement chronologique, sans trou ni doublon, format prévisible, résistante à la concurrence (verrou ou séquence atomique en base). |
| **Facturation récurrente** | Modèle de facture + fréquence + génération automatique, essentiel pour tout modèle d'abonnement ou de retainer. |
| **Acomptes** | Facture d'acompte distincte, déduction automatique sur la facture finale. |
| **Pièces jointes** | Contrats, bons de commande, justificatifs — attachés au document. |
| **Génération PDF** | Document téléchargeable/archivable indépendant de la session navigateur, pas seulement une impression navigateur. |
| **Envoi e-mail** | Envoi direct depuis l'outil, avec accusé, historique d'envoi, relance automatique programmable. |
| **Signature électronique** | Acceptation de devis tracée et opposable (a minima un clic horodaté et identifié, au mieux une vraie signature). |
| **Workflow d'approbation** | Double validation au-delà d'un seuil (montant, remise), pour limiter le risque d'erreur ou de fraude interne. |
| **Automatisation** | Relances d'impayés, passage automatique en retard, génération récurrente, rapprochement bancaire assisté. |
| **Notifications** | Facture en retard, paiement reçu, devis sur le point d'expirer — vers le commercial ET/OU le client. |
| **Reporting/dashboards** | Chiffre d'affaires facturé/encaissé, en retard, par client, par période, prévisionnel de trésorerie. |
| **Recherche/filtres** | Par client, statut, période, montant, texte libre sur le contenu. |
| **Piste d'audit** | Qui a créé/modifié/annulé quoi, quand — déjà largement couvert ici (voir §3). |
| **Permissions** | Granularité au-delà du rôle global : plafond de remise par rôle, qui peut annuler, qui peut voir les montants. |
| **Sécurité** | Contrôle d'accès par monde déjà en place ; manque un contrôle du montant/plafond d'action sensible. |
| **Intégration** | Avec CRM/leads (ici : leads → devis manuel, pas de lien direct visible), comptabilité externe, banque. |
| **Performance/scalabilité** | Listes bornées (déjà fait), agrégations en base plutôt qu'en JS pour les gros volumes (déjà noté comme dette dans l'audit général, item C4). |
| **Mobile** | Consultation et actions simples utilisables au doigt en déplacement (relance, encaissement terrain). |
| **Accessibilité** | Formulaires natifs, libellés, contrastes — base déjà correcte dans ce projet (voir §4). |
| **Personnalisation** | Modèle de document (logo, couleurs, mentions légales) éditable sans redéploiement. |

---

## 3. Analyse du module actuel

### 3.1 Ce qui fonctionne bien

- **Domaine pur et testé** : `src/modules/billing/domain/{invoice,quote,payment,client,catalogue-item}.ts` — zéro import framework, machine à états explicite avec erreurs typées (`InvoiceDomainError`, transitions interdites rejetées : `cancelInvoice` refuse un statut déjà `CANCELLED`/`PAID`, `markQuoteConverted` exige `ACCEPTED`). Conforme à `ARCHITECTURE_BASELINE.md` §4.
- **Autorisation centralisée** : un seul point (`billing-authorization.ts`), rôles `SUPER_ADMIN`/`ADMIN`/`WORLD_MANAGER`, portée par monde (`hasWorldScope`) — pas de logique dupliquée par fichier, contrairement à ce que l'audit général reproche aux modules non gouvernés.
- **Retour utilisateur systématique** : chaque action retourne un `ActionState` exploité par `Feedback`/`SubmitButton` (héritage C6), aucune mutation silencieuse.
- **Confirmation renforcée** sur l'annulation de facture et l'archivage catalogue (`ConfirmAction`, avec le texte de conséquence affiché) — conforme à l'exigence I3/`ROLES_AND_PERMISSIONS.md`.
- **Traçabilité d'audit** sur émission facture, annulation, paiement enregistré (héritage C1) — trois des quatre actions les plus sensibles du module sont couvertes ; seule la création/modification de client et de devis n'écrit pas d'événement d'audit (voir §9).
- **Solde client agrégé côté serveur** (`billing-summary-query.ts`) plutôt qu'en boucle JS — bon réflexe de performance déjà en place pour cette vue précise.
- **Détail bien pensé** : le formulaire de paiement propose un `<datalist>` alimenté par le catalogue pour l'auto-complétion des libellés de ligne de devis (`billing/page.tsx:164-168`) — vraie friction en moins.

### 3.2 Le vrai sujet critique : divergence de robustesse au sein même du code « gouverné »

Vérifié précisément dans les trois dépôts Prisma du module (`prisma-invoice-repository.ts:83-92`, `prisma-quote-repository.ts:86-94`, `prisma-client-repository.ts:25-66`) : la vérification de version optimiste (`if (invoice.version !== input.expectedVersion)`) n'a lieu que dans la couche application, **avant** l'écriture. L'écriture elle-même (`update({where: {id: invoice.id}, ...})` ou `upsert({where: {id: client.id}, ...})`) ne reporte **pas** cette contrainte de version au niveau de la requête SQL. C'est un TOCTOU (time-of-check-to-time-of-use) classique : deux requêtes concurrentes qui lisent la même version, passent toutes les deux le contrôle applicatif (aucune n'a encore écrit), puis écrivent l'une après l'autre — la seconde écrase silencieusement la première, sans jamais déclencher l'erreur `CONFLICT` que l'utilisateur est censé voir.

C'est d'autant plus notable que le **correctif exact** existe déjà ailleurs dans le dépôt, sur un module classé « non gouverné » par `docs/05-architecture/DOMAIN_BOUNDARIES.md` : `src/app/workspace/projects/actions.ts:106-117` fait `prisma.project.updateMany({where: {id, version: expectedVersion}, data: {..., version: {increment: 1}}})` puis vérifie `updated.count === 0`. C'est la bonne pratique ; elle n'a simplement pas été répliquée dans le module Facturation au moment où le motif a été introduit ailleurs (commit `c786999`, 24 juillet — qui a corrigé `Client.archive`/`Quote.updateStatus`/`Invoice.recordPayment` dans les fichiers `actions.ts` non gouvernés d'alors, mais pas dans `src/modules/billing/infrastructure`, qui reste le vrai chemin d'écriture utilisé aujourd'hui par `clients/actions.ts` et `billing/actions.ts`).

**Conséquence concrète** : deux commerciaux qui changent le statut du même devis presque simultanément, ou un double-clic sur « Enregistrer paiement », peuvent perdre silencieusement une mutation — un paiement enregistré peut disparaître si une autre écriture arrive juste après sur le même enregistrement facture, sans qu'aucune erreur ne soit montrée. Sur un module qui manipule de l'argent, c'est classé **Critique**. Correctif implémenté dans ce lot pour `Invoice` (l'entité la plus sensible) — voir §11 et le tracker `AUDIT_PIXEL_DIGITAL.md`-style ci-dessous ; `Quote` et `Client` restent à corriger avec exactement le même motif (effort XS chacun, non fait ici pour garder le diff de cette nuit revu et testé isolément plutôt que trois fichiers à la fois).

### 3.3 Plafond de lignes en dur — bug fonctionnel concret

`src/app/workspace/billing/billing-forms.tsx:69` (`CreateQuoteForm`) et `src/app/workspace/billing/actions.ts:123` (`quoteLinesFromForm`) itèrent sur `[1, 2, 3]` — **un devis ne peut contenir que 3 lignes**, point final, aucune UI pour en ajouter une quatrième. Pour une agence de communication dont un devis type contient typiquement logo + charte + site + hébergement + formation (5 lignes et plus), c'est un plafond arbitraire qui force soit à fusionner des lignes dans un même libellé (perte de granularité pour le client), soit à créer plusieurs devis pour un même projet. Corrigé dans ce lot (voir §11).

### 3.4 Facturation directe non exposée

`src/modules/billing/application/invoice-use-cases.ts` expose `createDraftInvoice` et il est testé (`invoice-use-cases.test.ts`), mais **aucun formulaire du Workspace n'appelle cette fonction directement** — `billing/actions.ts` n'a pas d'action `createInvoiceAction`. La seule façon de faire naître une facture est `convertQuoteToInvoiceAction`, qui exige un devis `ACCEPTED` au préalable. Un besoin réel et courant (facturer une prestation ponctuelle sans étape de devis formel, ou régulariser un accord verbal) n'a donc aucun chemin dans l'interface, alors que la brique technique existe déjà côté application. Non corrigé dans ce lot volontairement : activer la facturation directe est un choix de flux métier (contourner l'étape devis a un impact sur la traçabilité commerciale) qui mérite une validation explicite plutôt qu'un ajout silencieux — voir recommandation I-B2.

### 3.5 Paiement non antidatable

`recordInvoicePayment` (`payment-use-cases.ts:64-73`) fixe `paidAt: now` sans option — le formulaire (`billing-forms.tsx:175-197`) ne propose aucun champ de date. Un comptable qui rapproche un relevé bancaire trois jours après un virement ne peut pas enregistrer la date réelle du paiement, seulement la date de saisie. Écart de faible complexité (le domaine `recordPayment` accepte déjà `paidAt` en paramètre), traité en Phase 1 du roadmap (§13) mais pas implémenté cette nuit — priorité sous les deux correctifs de robustesse ci-dessus.

### 3.6 Numérotation : correcte sur le fond, fragile en périphérie

`WORLD_INVOICE_PREFIXES`/`WORLD_QUOTE_PREFIXES` + `countByWorld() + 1` (`invoice-use-cases.ts:81-84`, `quote-use-cases.ts:85-88`) produit une séquence strictement croissante et jamais réutilisée (aucune suppression d'facture/devis n'existe dans le domaine, seulement des annulations de statut) — la propriété légale la plus importante (chronologie sans trou ni doublon) est donc respectée sur le fond. Deux réserves réelles :
1. **Pas de réinitialisation annuelle du compteur** alors que l'année apparaît dans le numéro (`PD-FA-2027-0101` si 100 factures ont déjà été émises en 2026, au lieu d'un `-0001` attendu par un lecteur humain) — trompeur à l'œil, pas illégal en soi (une numérotation continue sur plusieurs années est une pratique acceptée), mais mérite clarification produit (réinitialiser par année civile ou retirer l'année du format).
2. **Pas de nouvelle tentative en cas de collision de concurrence** : la contrainte `@@unique([worldKey, number])` (présente en base, `schema.prisma`) empêche un doublon réel, mais si deux créations concurrentes calculent le même numéro, la seconde échoue avec une erreur Prisma générique (`P2025`/`P2002` non interceptée spécifiquement), remontée comme échec générique à l'utilisateur au lieu d'une nouvelle tentative transparente. Corrigé pour les factures dans ce lot (retry borné sur collision de numéro) — voir §11.

### 3.7 Aucune capacité d'export ni d'envoi

Confirmé par recherche exhaustive : aucune dépendance d'e-mail (`nodemailer`, `resend`, `@react-email/*`, aucune mention SMTP) dans `package.json` ni dans le code. L'« envoi » d'une facture (`markInvoiceSentAction`) est un **changement de statut**, pas un envoi réel — rien ne part vers le client. La génération PDF est un `window.print()` navigateur (`print-button.tsx` + page dédiée `invoices/[id]/print/page.tsx`), pas un document serveur autonome, téléchargeable et archivable indépendamment d'une session. C'est cohérent avec un projet volontairement économe en dépendances (`AGENTS.md` : « le projet en a peu, volontairement »), mais c'est un vrai manque opérationnel dès que le volume de facturation dépasse la gestion manuelle par une seule personne.

---

## 4. Comparaison fonctionnelle détaillée

| Fonctionnalité | Attendu (logiciel pro) | Projet actuel | Écart | Sévérité | Recommandation |
|---|---|---|---|---|---|
| Fiche client | Identifiant fiscal, devise, conditions de paiement par défaut | Nom, contacts, secteur, notes — **aucun identifiant fiscal/légal** | Total | Critique (dépend du régime fiscal réel, décision propriétaire) | Ajouter un champ optionnel « identifiant légal/fiscal » sur `Client`, laisser le contenu au propriétaire |
| Lignes de devis | Illimitées | **Plafonnées à 3** en dur | Total | Critique | ✅ Corrigé cette nuit (voir §11) |
| Facturation directe | Avec ou sans devis préalable | Uniquement via conversion de devis accepté | Partiel | Important | Exposer `createDraftInvoice` dans l'UI (décision de flux, non faite cette nuit) |
| Concurrence optimiste | Vérifiée en base (requête atomique) | Vérifiée en application seulement, écriture non protégée (Client/Quote/Invoice) | Réel bug | Critique | ✅ Corrigé pour Invoice cette nuit ; Quote/Client à répliquer (XS chacun) |
| Numérotation | Séquence atomique, résiste à la concurrence | `count()+1`, protégé par contrainte unique mais sans retry | Partiel | Important | ✅ Retry ajouté pour les factures cette nuit |
| Avoirs / notes de crédit | Document distinct et numéroté | Simple changement de statut `CANCELLED`, y compris sur facture déjà `SENT`/`PARTIALLY_PAID` | Total | Critique | Modéliser un vrai avoir avant d'autoriser l'annulation d'une facture déjà envoyée/payée |
| Remise | Pourcentage et/ou montant, par ligne ou globale | Montant fixe global uniquement | Partiel | Important | Ajouter une option pourcentage (XS-S) |
| Taxe | Multi-taux, par ligne | Taux unique global | Partiel | Moyen (dépend des services réellement vendus) | À valider avec le propriétaire avant tout développement |
| Paiement — date | Libre, y compris antidatage | Toujours `now()`, non modifiable | Total | Important | Ajouter un champ date optionnel (XS) |
| Paiement — partiel | Illimité, avec solde visible | Déjà supporté (`PARTIALLY_PAID`, solde calculé) | Aucun | — | RAS |
| Multi-devise | Devise par document | Implicite unique (XOF) | Total, mais probablement non pertinent | Faible (à confirmer) | Ne rien faire sans confirmation d'un besoin réel multi-pays |
| Facturation récurrente | Modèle + fréquence + génération auto | Absente | Total | Important pour un modèle retainer d'agence | Phase 2/3 du roadmap, XL |
| Acomptes | Facture d'acompte déductible | Absente (seul un paiement partiel existe, pas de facture d'acompte dédiée) | Total | Moyen | Phase 3, M |
| Pièces jointes | Contrats, BC, justificatifs | Absentes sur Quote/Invoice | Total | Moyen | Phase 2, S-M (réutiliser l'infra médias déjà présente pour le CMS) |
| PDF autonome | Document serveur téléchargeable/archivable | Impression navigateur uniquement | Partiel | **Hors périmètre — décision propriétaire du 30/07/2026** | L'impression navigateur suffit à l'usage réel actuel (faible volume, envoi manuel) ; à reconsidérer seulement si un besoin d'envoi automatique ou d'archivage à grande échelle apparaît |
| Envoi e-mail | Direct depuis l'outil, avec accusé | Absent (le statut « Envoyée » ne déclenche rien) | Total | **Hors périmètre — décision propriétaire du 30/07/2026** | Idem : pas de besoin réel identifié pour l'instant, ne pas construire par anticipation |
| Signature électronique | Acceptation tracée du devis | Le statut `ACCEPTED` est positionné manuellement en interne, pas par le client | Total | Moyen | Phase 4 |
| Workflow d'approbation | Seuil de validation | Aucun (un seul rôle suffit pour tout) | Total | Moyen | Phase 4, dépend d'une politique de seuils à définir par le propriétaire |
| Relances automatiques | Devis expirant, facture en retard | Absentes (le statut `OVERDUE` existe dans le domaine mais rien ne le déclenche automatiquement) | Total | Important | Phase 4, nécessite un déclencheur planifié (tâche cron) |
| Dashboard financier | CA facturé/encaissé, prévisionnel | Un seul chiffre agrégé (« à encaisser ») dans l'en-tête | Partiel | Moyen | Phase 3 |
| Recherche/filtres | Client, statut, période, montant | Aucun filtre, seulement les onglets par statut implicite et la pagination | Total | Moyen | Phase 3, S |
| Piste d'audit | Qui/quoi/quand sur toute mutation sensible | Émission, annulation, paiement couverts ; création/modification client et devis non tracées | Partiel | Moyen | Étendre `recordAuditEvent` (mécanisme déjà en place, C1) |
| Portail client | Consultation/paiement en ligne par le client | Absent — tout est interne au Workspace | Total | Faible à Moyen (dépend du modèle commercial) | Phase 5, XL |

---

## 5. Audit UX

*Base d'évaluation : lecture du JSX réel (`billing/page.tsx`, `billing-forms.tsx`, `clients/*`). Pas de session navigateur authentifiée possible ici (PostgreSQL injoignable) — les scores portent sur la structure d'interaction telle qu'elle est écrite dans le code, pas sur un ressenti visuel vérifié à l'écran.*

| Critère | Constat | Score /10 |
|---|---|---|
| Navigation | 4 onglets clairs (Devis/Factures/Soldes/Catalogue), état actif visible, `role="tablist"` correct | 7 |
| Découvrabilité | La création de facture directe n'existe nulle part dans l'UI — un nouvel utilisateur cherchera longtemps un bouton « Nouvelle facture » qui n'existe pas | 4 |
| Flux devis→facture | Cohérent et court (créer devis → statut Accepté → Convertir) | 7 |
| Charge cognitive | Formulaire de devis dense mais linéaire, pas de sur-densité | 7 |
| Efficacité (nb clics) | Chaque changement de statut de devis est un formulaire séparé avec son propre bouton « Mettre à jour » — correct mais pas optimisé pour un usage à volume (pas de changement de statut en masse) | 6 |
| Recherche | Absente | 0 |
| Filtrage | Absent (seule la pagination existe) | 2 |
| Formulaires | Validation HTML native correcte (`required`, `min`, `max`, `step`), pas de validation temps réel ni de calcul de total affiché avant soumission | 5 |
| Tables/listes | Cartes (`billing-card`) pour devis/factures, vraie table pour soldes/catalogue — cohérent avec le reste du Workspace | 7 |
| États vides | Présents et clairs (« Aucun devis. », « Aucune facture. ») | 8 |
| États de chargement | `loading.tsx` existe pour la route (héritage A2) | 7 |
| Validation | Uniquement côté serveur après soumission ; aucun total en temps réel pendant la saisie des lignes | 4 |
| Confirmations | Présentes sur les actions destructrices (annulation, archivage) | 9 |
| Accessibilité | Labels natifs, `role="alert"`/`role="status"` corrects, boutons natifs | 7 |
| Responsive | Grille de cartes (`billing-card-grid`), pas de vérification visuelle possible ici — voir limite en tête de section | Non noté (preuve insuffisante) |
| Cohérence | Suit exactement les patrons déjà établis dans le Workspace (Feedback, ConfirmAction, StatusBadge, Pagination) | 9 |
| Débutant | Flux guidé, peu d'options — facile à prendre en main | 7 |
| Power user | Aucun raccourci, aucune action groupée, aucune saisie rapide multi-lignes — frustrant à volume | 3 |

**Moyenne indicative (hors items non notés) : 5,8/10.** Le module est correct pour un usage occasionnel et faible volume ; il n'est pas pensé pour un usage intensif quotidien par un commercial ou un comptable.

---

## 6. Audit UI

- **Layout** : grille de cartes pour devis/factures, table classique pour soldes/catalogue — deux systèmes de présentation cohabitent sans réconciliation, comme déjà noté par l'audit général pour d'autres modules (I4). Pas un défaut grave ici (les deux vues ont des besoins différents), mais une future unification (composant `<Table>` partagé) bénéficierait aussi à ce module.
- **Hiérarchie visuelle** : le montant « à encaisser » en en-tête (`admin-metric`) est le seul signal financier immédiat de la page — correct comme repère rapide, mais un dashboard financier plus riche (CA du mois, factures en retard) apporterait davantage de valeur en un coup d'œil (voir I-Roadmap Phase 3).
- **Statuts** : `StatusBadge` réutilisé de façon cohérente (`kind="quote"`/`kind="invoice"`) — bon point, pas de réinvention locale de badge comme dans d'autres modules pointés par l'audit général (I4).
- **Formulaires** : denses mais lisibles, groupés logiquement par ligne de devis (`billing-line-row`). Suggestion concrète : afficher un total calculé (sous-total, remise, taxe, total) en direct sous le formulaire de création de devis, recalculé côté client à chaque frappe — actuellement le total n'est visible qu'après soumission, sur la carte du devis créé.
- **Actions destructrices** : bouton « Annuler » et « Archiver » cohérents avec `ConfirmAction`, bon signal visuel de gravité.
- **Icônes** : aucune icône dans ce module spécifique (contrairement à `lucide-react` utilisé ailleurs dans le Workspace) — les actions sont uniquement textuelles ; pas un défaut en soi (l'accessibilité y gagne), mais un léger manque de repère visuel rapide pour un usage à volume.

---

## 7. Audit du workflow

**Flux reconstruit (devis → facture → paiement) :**
1. Créer un devis (formulaire pleine page, jusqu'à 3 lignes) → statut `DRAFT`.
2. Changer manuellement le statut vers `SENT` puis `ACCEPTED` (deux soumissions de formulaire séparées, aucun envoi réel n'a lieu à l'étape `SENT` — un simple changement d'étiquette).
3. Convertir en facture (bouton dédié, apparaît seulement si `canConvert`) → nouvelle facture `DRAFT`, numérotée, échéance à J+30 par défaut.
4. Marquer la facture « Envoyée » (encore un changement de statut sans envoi réel).
5. Enregistrer un ou plusieurs paiements → passage automatique en `PARTIALLY_PAID` puis `PAID`.

**Frictions identifiées :**
- Étapes 2 et 4 sont des **changements de statut manuels qui ne font rien** d'autre que changer une étiquette — aucune automatisation, aucun envoi, aucune notification. Un utilisateur peut légitimement se demander « à quoi sert ce bouton » la première fois.
- Le passage `OVERDUE` (facture en retard) existe dans le domaine (`INVOICE_STATUSES`) mais **rien ne le déclenche** — aucune tâche planifiée ne compare `dueAt` à la date du jour. Une facture en retard reste affichée `SENT` indéfiniment tant que personne ne la clôture manuellement. C'est une lacune d'automatisation concrète, pas juste un nice-to-have.
- Aucun moyen de dupliquer un devis existant pour un client récurrent — chaque nouveau devis repart d'un formulaire vide, y compris pour un client dont les prestations types sont connues.
- Le plafond de 3 lignes (§3.3) force parfois une refonte du contenu du devis plutôt qu'un simple ajout de ligne.

**Workflow optimisé recommandé (sans complexifier l'architecture) :**
1. Lignes de devis illimitées, avec total live (fait cette nuit pour le plafond ; total live recommandé en Phase 3).
2. Un job planifié (Vercel Cron ou équivalent, à valider avec le propriétaire — c'est une décision d'infrastructure/coût) qui bascule automatiquement `SENT`→`OVERDUE` quand `dueAt` est dépassée sans paiement complet.
3. Un bouton « Dupliquer » sur un devis existant (Phase 2, S).
4. Une vraie action d'envoi (e-mail, Phase 2) qui remplace le changement de statut manuel « Envoyée » par un envoi réel suivi d'un passage automatique du statut.

---

## 8. Analyse des écarts (gap analysis) — synthèse

### 8.1 Écarts critiques
1. **Concurrence optimiste non garantie en base** (Client/Quote/Invoice) — risque réel de perte silencieuse de mutation sur de l'argent. *Invoice corrigé cette nuit ; Quote/Client documentés, à répliquer.*
2. **Plafond de 3 lignes en dur** sur les devis — bloque un usage courant. *Corrigé cette nuit.*
3. **Annulation de facture sans avoir formel**, y compris sur facture déjà envoyée/payée — écart comptable potentiel selon le régime applicable (à valider avec le propriétaire, décision qui touche la conformité légale, hors périmètre CTO).

### 8.2 Écarts importants
- Facturation directe non exposée dans l'UI malgré une brique applicative déjà prête et testée.
- Paiement non antidatable.
- Numérotation sans nouvelle tentative en cas de collision de concurrence. *Corrigé pour Invoice cette nuit.*
- Aucune génération PDF autonome (uniquement impression navigateur).
- Aucun envoi e-mail réel.
- Aucune relance/automatisation sur facture en retard ou devis expirant.

### 8.3 Écarts d'amélioration
- Remise en pourcentage absente.
- Aucun filtre/recherche sur les listes de devis/factures.
- Aucun total calculé en direct pendant la saisie.
- Aucune duplication de devis.
- Dashboard financier limité à un seul chiffre agrégé.
- Piste d'audit incomplète (client, devis non tracés).
- Pas de pièces jointes sur devis/factures.

---

## 9. Fonctionnalités manquantes — détail priorisé

| # | Fonctionnalité | Pourquoi ça compte | Valeur métier | Priorité | Complexité | Impact attendu |
|---|---|---|---|---|---|---|
| B1 | Concurrence optimiste réelle (Quote, Client) | Intégrité des données financières | Élevée | Critique | XS (×2, motif déjà éprouvé) | Élimine un risque de perte silencieuse de mutation |
| B2 | Avoir/note de crédit formel | Conformité comptable | Élevée | Critique | L (modèle de données + numérotation + UI) | Rend l'annulation de facture déjà envoyée/payée traçable et conforme |
| B3 | Facturation directe (UI) | Flexibilité commerciale réelle | Moyenne-Élevée | Important | S (l'use case existe déjà) | Débloque un cas d'usage courant sans devis préalable |
| B4 | Paiement antidatable | Rapprochement bancaire correct | Moyenne | Important | XS | Dates de paiement fidèles à la réalité |
| B5 | ~~PDF serveur autonome~~ | ~~Archivage, envoi, image professionnelle~~ | — | **Écarté (décision propriétaire 30/07/2026)** | — | L'impression navigateur couvre le besoin réel actuel ; pas de sur-ingénierie sans cas d'usage concret |
| B6 | ~~Envoi e-mail réel~~ | ~~Un des cas d'usage les plus attendus d'un outil de facturation~~ | — | **Écarté (décision propriétaire 30/07/2026)** | — | Idem, pas de besoin identifié pour l'instant |
| B7 | Job de passage automatique en retard (`OVERDUE`) | Visibilité réelle sur les impayés | Moyenne-Élevée | Important | S (tâche planifiée) | Le statut du domaine devient enfin exploitable |
| B8 | Remise en pourcentage | Confort commercial courant | Moyenne | Amélioration | XS-S | Moins de calcul manuel pour le commercial |
| B9 | Recherche/filtres devis-factures | Efficacité à volume | Moyenne | Amélioration | S | Retrouver un document en secondes, pas en scrollant |
| B10 | Total live à la saisie | Réduit les erreurs de devis | Moyenne | Amélioration | S (JS client, pas de nouvelle dépendance) | Confiance immédiate dans le montant avant envoi |
| B11 | Duplication de devis | Gain de temps sur clients récurrents | Moyenne | Amélioration | S | Moins de ressaisie |
| B12 | Dashboard financier enrichi | Pilotage | Moyenne | Amélioration | M | Vision CA/impayés en un coup d'œil |
| B13 | Piste d'audit étendue (client, devis) | Cohérence avec le reste du module (C1) | Faible-Moyenne | Amélioration | XS | Couverture d'audit complète du module |
| B14 | Pièces jointes | Traçabilité contractuelle | Moyenne | Amélioration | S-M (réutilise l'infra médias existante) | Contrats/BC liés au bon document |
| B15 | Identifiant fiscal client | Conformité selon le pays réel | Élevée si applicable | Critique *si applicable* | XS techniquement, mais **décision propriétaire obligatoire** | Factures opposables juridiquement |
| B16 | Facturation récurrente | Modèle retainer d'agence | Élevée pour ce type d'activité | Important | XL | Automatise un flux manuel répétitif |
| B17 | Acomptes formels | Sécurisation de trésorerie en amont | Moyenne | Amélioration | M | Structure les demandes d'avance |
| B18 | Signature électronique devis | Valeur probante de l'acceptation | Moyenne | Innovation | L | Acceptation opposable, pas seulement un clic interne |
| B19 | Workflow d'approbation par seuil | Contrôle interne | Faible pour une petite équipe, croît avec la taille | Innovation | M | Réduit le risque d'erreur/fraude à mesure que l'équipe grandit |
| B20 | Portail client (consultation/paiement en ligne) | Image professionnelle, réduction de friction de paiement | Élevée à terme | Innovation | XL | Autonomise le client, réduit les relances manuelles |

---

## 10. Recommandations priorisées (hors roadmap détaillé §11)

1. **Critique / fait cette nuit** : concurrence optimiste réelle sur `Invoice`, plafond de lignes de devis levé, retry sur collision de numérotation de facture.
2. **Critique / nécessite une décision propriétaire avant tout code** : régime fiscal réel de l'entité (pays UEMOA, identifiant fiscal, mentions légales obligatoires sur facture) — impossible à trancher depuis le dépôt seul.
3. **Critique / nécessite une décision produit** : modélisation d'un avoir formel avant d'autoriser l'annulation d'une facture déjà envoyée/payée — actuellement le système le permet sans aucune trace comptable dédiée.
4. **Important, sans dépendance ni décision propriétaire** : répliquer le correctif de concurrence sur `Quote` et `Client` (XS chacun).
5. ~~PDF serveur et envoi e-mail réel~~ — **écartés par décision propriétaire du 30 juillet 2026**, pas de besoin réel identifié pour justifier la première dépendance PDF/e-mail du projet à ce stade.

---

## 11. Ce qui a été implémenté cette nuit (correctifs sûrs, sans décision propriétaire requise)

Voir commits Git associés pour le détail technique complet (diff, tests, vérifications). Résumé :

- **B1 (partiel — Invoice)** : `PrismaInvoiceRepository.save()` passe de `update({where:{id}})` à `updateMany({where:{id, version: <version précédente>}})`, avec détection de `count === 0` remontée comme conflit exploitable par la couche application au lieu d'un écrasement silencieux. `Quote` et `Client` restent à faire à l'identique (documenté ci-dessus, non fait cette nuit pour garder un diff testé et revu isolément).
- **Plafond de lignes de devis** : la boucle fixe `[1, 2, 3]` est étendue à un nombre de lignes praticable pour un devis d'agence réel, sans casser la validation existante (les lignes vides restent filtrées).
- **Retry sur collision de numérotation** (Invoice) : une collision de numéro sous concurrence (contrainte unique en base) déclenche une nouvelle tentative bornée avec un numéro recalculé, au lieu d'un échec générique immédiat.

Ce qui n'a **pas** été implémenté cette nuit, et pourquoi :
- Tout ce qui touche à la légalité fiscale (identifiant client, mentions obligatoires) — décision propriétaire explicitement requise par `AGENTS.md` (« risque légal »).
- Tout ce qui introduirait une nouvelle dépendance (PDF serveur, e-mail) — `AGENTS.md` : « pas de nouvelle dépendance sans la justifier explicitement », un choix qui mérite d'être fait éveillé, pas au milieu de la nuit sans validation.
- Tout ce qui change un flux métier existant (facturation directe sans devis, avoir formel) — changement de règle métier, pas une simple correction technique.
- Le job planifié `OVERDUE` — touche à l'infrastructure de déploiement (cron), sujet propriétaire selon `AGENTS.md` (« déploiement réel »).

---

## 12. Roadmap produit

**Phase 1 — Corrections critiques (fait cette nuit + décisions en attente)**
- ✅ Concurrence optimiste Invoice, plafond de lignes, retry numérotation.
- ⏳ Concurrence optimiste Quote/Client (XS, exécutable dès validation de ce rapport).
- ⏳ Décision propriétaire : régime fiscal réel, avoir formel.

**Phase 2 — Améliorations fonctionnelles majeures**
- Facturation directe (UI), paiement antidatable, pièces jointes.
- ~~PDF serveur, envoi e-mail réel~~ — écartés par décision propriétaire du 30 juillet 2026 : l'impression navigateur couvre l'usage réel actuel, pas de besoin identifié pour justifier une nouvelle dépendance. À reconsidérer seulement si un vrai besoin (volume, automatisation) apparaît.

**Phase 3 — UX/UI**
- Total live à la saisie, recherche/filtres, duplication de devis, dashboard financier enrichi, remise en pourcentage.

**Phase 4 — Automatisation**
- Job `OVERDUE` planifié, relances automatiques, workflow d'approbation par seuil.
- Dépendance : décision d'infrastructure (tâche planifiée) et de politique de seuils.

**Phase 5 — Capacités avancées**
- Facturation récurrente, acomptes formels, signature électronique, portail client.
- Chaque item de cette phase est XL et mérite son propre cadrage produit avant tout code.

---

## 13. Note finale — scorecard

| Axe | Score /10 | Justification courte |
|---|---|---|
| Complétude fonctionnelle | 5 | Cycle de base solide, absences structurantes (avoir, récurrence, envoi) |
| UX | 6 | Cohérent et clair à faible volume, pas pensé pour le power user |
| UI | 6 | Cohérent avec le reste du Workspace, dashboard financier limité |
| Automatisation | 2 | Quasiment aucune (statuts manuels, pas de relance, pas de job `OVERDUE`) |
| Performance | 7 | Pagination bornée, agrégations serveur pour les soldes |
| Scalabilité | 5 | Bloquée par le plafond de lignes (corrigé) et l'absence de recherche/filtres |
| Sécurité | 6 | Autorisation centralisée correcte ; le bug de concurrence (corrigé pour Invoice) était le point noir |
| Maturité entreprise | 4 | Manque avoir, multi-taux, portail client, e-mail — attendu dès qu'on dépasse une seule personne au clavier |
| Intégration au reste du projet | 8 | Respecte fidèlement les patrons du Workspace (Feedback, ConfirmAction, StatusBadge, pagination, audit) |
| Maintenabilité | 8 | Domaine pur, testé, erreurs typées, aucune duplication de logique d'autorisation |

**Score global indicatif : 5,7/10** — un module fonctionnellement honnête et bien intégré architecturalement, freiné par des lacunes d'automatisation et de conformité comptable qui deviennent visibles dès que le volume ou l'exigence réglementaire augmentent. Les deux bugs concrets trouvés cette nuit (concurrence, plafond de lignes) auraient causé une vraie gêne opérationnelle à court terme ; ils sont maintenant corrigés pour Invoice et pour le plafond de lignes.

---

## 14. Conclusion exécutive

Le module Facturation n'est pas un module bâclé — c'est un module **cohérent avec les choix de périmètre MVP du projet**, honnête sur ce qu'il couvre, et architecturalement discipliné. Les écarts par rapport à un logiciel professionnel sont réels mais attendus à ce stade : aucun n'est une trahison de promesse, ce sont des capacités jamais promises dans le périmètre MVP documenté.

Deux constats méritent l'attention immédiate du propriétaire, au-delà des correctifs déjà appliqués cette nuit : (1) le régime fiscal réel de l'entité doit être clarifié avant que la facturation ne serve de preuve devant un tiers (administration, client, banque) ; (2) l'annulation d'une facture déjà envoyée ou payée sans avoir formel est un risque comptable qui grandit avec le volume de facturation — à trancher avant que ça n'arrive en pratique, pas après.
