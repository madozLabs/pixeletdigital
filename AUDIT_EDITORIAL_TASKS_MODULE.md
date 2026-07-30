# Audit consultant — Calendrier éditorial & Gestion des tâches

**Date :** 30 juillet 2026
**Périmètre analysé :** `src/app/workspace/editorial/**`, `src/app/workspace/tasks/**`, `src/app/workspace/projects/**`, modèles Prisma `EditorialItem`, `Project`, `Task`, `Department`, `Team`, `JobPosition`, `TeamMembership`.
**Méthode :** lecture directe et exhaustive du code source. Aucune session navigateur possible (PostgreSQL injoignable sur cette machine, cf. `README.md`). Aucune affirmation sans preuve de fichier/ligne.

**Constat structurel à garder en tête dans tout ce document :** contrairement à Facturation (`src/modules/billing/**`, architecture en couches domaine/application/infrastructure), **Éditorial, Projets et Tâches n'ont aucun module `src/modules/*` équivalent** — toute la logique vit directement dans `src/app/workspace/{editorial,projects,tasks}/{page.tsx,actions.ts}`, avec accès Prisma direct depuis les Server Components et Server Actions. C'est exactement le clivage architectural déjà documenté par l'audit général (`AUDIT_PIXEL_DIGITAL.md` §1.2, ODR-025) et son écart avec `docs/05-architecture/DOMAIN_BOUNDARIES.md` — non re-démontré en détail ici, mais sa conséquence directe (logique métier et validation dispersées dans des fichiers `actions.ts`, pas de tests comportementaux dédiés à ce module) est bien visible dans les constats ci-dessous.

---

## 1. Résumé exécutif

Le module est **plus riche que ce qu'un premier coup d'œil laisse penser** : calendrier hebdomadaire avec navigation semaine précédente/suivante, vue pipeline en kanban avec glisser-déposer et mise à jour optimiste (`useOptimistic`), machine à états de contenu à 6 étapes (brouillon → validation interne → validation client → approuvé → programmé → publié) avec horodatage de chaque étape, tableau de tâches en kanban avec sous-tâches et dépendances, projets paginés avec responsable/équipe/priorité/progression. C'est un socle de gestion de production éditoriale et de tâches réel, pas un squelette.

Mais deux défauts concrets, l'un de performance et l'un de robustesse, sont confirmés par le code :
1. **La vue « Semaine » du calendrier éditorial charge l'intégralité de l'historique du monde**, pas seulement la semaine affichée — un `findMany({where: {worldKey}})` sans aucune borne de date. Sur un compte avec plusieurs années d'activité, chaque affichage de calendrier deviendra de plus en plus lent pour ne montrer que 7 jours. *Corrigé cette nuit pour la vue Semaine (voir §11).*
2. **`Task` n'a aucune colonne de version** — c'est le seul type de mutation à volume dans tout le Workspace qui n'a strictement aucune protection de concurrence, ni applicative ni base de données (`prisma.task.update({where: {id}}))`, sans même le motif `where: {id, version}` qu'`EditorialItem`/`Project` utilisent déjà). *Ajouté cette nuit (voir §11).*

Comparé à un outil de gestion de production/éditorial de niveau entreprise (Asana, monday.com, Sprout Social, CoSchedule, Airtable + automatisations), les manques structurants sont : **aucune vue mois/jour/agenda/timeline** (seule la semaine et le pipeline existent), **aucun sous-tâche/checklist/commentaire/mention** sur une tâche ou un contenu, **aucune notification** (rappel d'échéance, mention), **aucun tableau de bord personnel** (« mon travail » — déjà noté comme manque général par l'audit précédent, item I2, confirmé ici spécifiquement pour tâches et contenus), **aucune campagne** au sens propre (le `Project` sert de conteneur mais n'a ni objectif, ni KPI, ni budget suivi malgré un champ `budgetCents` présent en base mais jamais affiché nulle part dans l'UI), **aucune récurrence** (publication récurrente, tâche récurrente), **aucune intégration réelle de publication** (le champ `channel` est du texte libre, aucune connexion à un réseau social), **aucune notion de charge de travail/capacité** par personne.

**Répartition des recommandations :** 3 critiques, 8 importantes, 9 d'amélioration, 6 d'innovation.

---

## 2. Modèle de référence — plateforme professionnelle de calendrier éditorial & gestion de tâches

| Domaine | Attendu, et pourquoi |
|---|---|
| **Vues calendrier** | Mois/semaine/jour/agenda au minimum, chacune adaptée à un besoin différent (mois = vue d'ensemble, semaine = planification fine, agenda = liste actionnable) ; une seule vue force un compromis permanent. |
| **Vue Kanban** | Visualiser le pipeline de production par étape, glisser-déposer pour avancer — déjà central dans les outils modernes (Trello, Asana, monday.com). |
| **Vue Timeline/Gantt** | Visualiser les dépendances et chevauchements dans le temps, essentiel dès que plusieurs contenus/tâches d'un même projet s'enchaînent. |
| **Planification par glisser-déposer** | Replanifier une date en un geste plutôt que rouvrir un formulaire — réduit la friction de réorganisation, fréquente en agence. |
| **Pipeline de contenu** | Étapes de validation configurables, traçables, avec horodatage — déjà largement présent ici (voir §3.1). |
| **Planification de campagnes** | Objectif, budget, échéances, livrables regroupés sous un même chapeau, avec suivi de progression agrégé. |
| **Publication récurrente** | Modèle + fréquence (newsletter hebdomadaire, post du lundi) — évite la recréation manuelle répétée. |
| **Code couleur / étiquettes / catégories** | Repérage visuel rapide dans une vue dense — un simple badge de statut ne suffit pas dès que le volume grandit. |
| **Segmentation d'audience / canaux de diffusion** | Savoir où et pour qui un contenu est produit, au-delà d'un champ texte libre. |
| **Gestion de contenu multi-format** | Post, article, vidéo, reel, story, carrousel, podcast, e-mail, pub, page de destination — le modèle actuel couvre 8 types (voir §3.1), une bonne base. |
| **Pièces jointes / fichiers créatifs** | Brief, maquette, fichier source lié directement à l'item — absent ici malgré une bibliothèque média déjà existante ailleurs dans le projet (CMS). |
| **Historique de versions** | Savoir ce qui a changé sur un brief/contenu entre deux relectures. |
| **Tâches : sous-tâches, checklists** | Décomposer un travail complexe — sous-tâches déjà supportées par le schéma (`parentTaskId`), pas de checklist. |
| **Dépendances** | Bloquer une tâche tant qu'une autre n'est pas terminée — le champ existe (`dependencyTaskId`) mais n'est qu'informatif (voir §3.2), pas appliqué. |
| **Tâches récurrentes, modèles de tâches** | Éviter de recréer manuellement une routine hebdomadaire. |
| **Priorités, dates d'échéance, estimation/suivi de temps** | Déjà couvert (priorité, échéance, temps estimé et réel — voir §3.2). |
| **Statuts personnalisables** | Ici fixes (6 statuts) — suffisant pour une petite équipe, rigide au-delà. |
| **Commentaires, mentions, activité, watchers** | Collaboration asynchrone sur une tâche/un contenu — totalement absent. |
| **Affectation** | Individuelle déjà présente ; affectation multiple, par équipe/rôle, absente. |
| **Charge de travail / capacité** | Voir qui est surchargé avant d'assigner — absent (l'audit général notait déjà ce manque au niveau dashboard global, I2). |
| **Workflow d'approbation** | Interne puis client, avec cycle de retour — la structure existe (`INTERNAL_REVIEW`/`CLIENT_REVIEW`), le cycle de feedback/rejet n'est pas modélisé (voir §3.1). |
| **Escalade** | Alerter automatiquement en cas de blocage prolongé — absent. |
| **Notifications** | Échéance proche, mention, changement de statut — absent (aucun système de notification nulle part dans le Workspace, au-delà du toast local de succès d'action, hérité de A2). |
| **Dashboards** | Échéances à venir, tâches en retard, charge par personne, progression de campagne — un seul chiffre agrégé par page (« X tâches », « X contenus »), pas de tableau de bord dédié. |
| **Reporting** | Productivité, taux de complétion, temps passé vs estimé — absent malgré des données déjà collectées (temps estimé/réel sur les tâches). |
| **Automatisation** | Rappels, passage de statut automatique, planification intelligente — absent. |
| **Intégrations** | CRM/leads, bibliothèque média, messagerie interne, outils de publication sociale, IA — aucune intégration croisée avec le module Leads (une conversion lead→projet n'est pas automatisée, cohérent avec ce que documente déjà C5/ODR-025). |

---

## 3. Analyse du module actuel

### 3.1 Calendrier éditorial

**Ce qui fonctionne bien :**
- Machine à états à 6 statuts avec horodatage dédié pour chaque jalon (`internalApprovedAt`, `clientApprovedAt`, `realizedAt`) — `professional-actions.ts:156-158, 220-225` pose ces dates automatiquement à la bonne transition, une vraie traçabilité de production, pas juste un champ statut brut.
- Deux vues réelles : **Semaine** (`editorial/page.tsx:147-219`, navigation précédente/suivante) et **Pipeline** (`pipeline-board.tsx`, kanban à 6 colonnes, glisser-déposer avec `@hello-pangea/dnd`, mise à jour optimiste via `useOptimistic` React — l'action serveur (`moveEditorialItemAction`) tourne en tâche de fond pendant que l'UI reflète déjà le nouvel état, puis `router.refresh()` resynchronise).
- Concurrence gérée correctement : `professional-actions.ts:160-163, 227-230` utilise `update({where: {id, version}})` — Prisma lève `P2025` si la version ne correspond plus, capturé et transformé en message clair (« le contenu a peut-être changé entre-temps »). C'est le motif correct, cohérent avec ce que l'audit du module Facturation a trouvé manquant côté billing (voir `AUDIT_BILLING_MODULE.md` §3.2) — **Éditorial a ce point juste**, contrairement à Facturation.
- 8 types de contenu couverts (`EditorialContentType` : POST, STORY, REEL, VIDEO, ARTICLE, EMAIL, AD, OTHER) — une vraie couverture multi-format, pas un système pensé pour un seul type de post.
- Distinction propriétaire/relecteur (`ownerId`/`reviewerId`) — la structure d'un vrai flux de relecture existe, même si rien dans l'UI n'exploite encore la distinction (le relecteur n'apparaît nulle part dans le rendu de la carte, seul le propriétaire est affiché — `editorial/page.tsx:192-198`).

**Ce qui ne va pas :**
- **Requête non bornée dans le temps** (`editorial/page.tsx:60-65`) : `prisma.editorialItem.findMany({where: {worldKey}}, ...)` charge tous les contenus de tous les temps pour n'en afficher que 7 jours dans la vue Semaine (le filtrage par jour se fait en JavaScript après coup, `itemsByDay`). C'est exactement le type de dette que l'audit précédent avait explicitement repéré et volontairement différé pour Éditorial (« un vrai correctif futur serait un filtre par fenêtre de dates, pas une pagination classique, à traiter séparément » — `AUDIT_PIXEL_DIGITAL.md`, item C4). *Corrigé cette nuit pour la vue Semaine ; la vue Pipeline reste volontairement non bornée dans le temps, voir §11.*
- **Aucune vue mois/jour/agenda/timeline** — la promesse d'un « calendrier éditorial » se limite à une fenêtre de 7 jours ou un kanban plat.
- **Le cycle de validation client n'a pas de vrai mécanisme de refus/retour** : le statut peut passer de `CLIENT_REVIEW` à n'importe quel autre (y compris en arrière vers `DRAFT` via le formulaire, aucune contrainte de transition n'est appliquée côté serveur au-delà de l'appartenance à `PIPELINE_STATUSES`/la liste de statuts valides) — un vrai rejet avec commentaire de motif n'existe pas, seul un changement de statut brut.
- **Aucune pièce jointe** — le brief est un champ texte (`brief`), aucun lien vers un fichier, alors qu'une infrastructure de médias existe déjà ailleurs dans le projet (CMS public) et pourrait être réutilisée.
- **`channel` est un champ texte libre**, pas une liste contrôlée ni une intégration réelle — deux personnes peuvent écrire « Instagram » et « instagram » sans normalisation, aucun filtre par canal n'est possible proprement.

### 3.2 Gestion des tâches

**Ce qui fonctionne bien :**
- Sous-tâches (`parentTaskId`) et dépendances (`dependencyTaskId`) modélisées avec relations auto-référentes propres (`TaskHierarchy`, `TaskDependency` dans `schema.prisma`).
- Kanban à 6 colonnes avec glisser-déposer et mise à jour optimiste, même patron que le pipeline éditorial — cohérence technique réelle entre les deux tableaux.
- Suivi du temps réel vs estimé (`estimatedMinutes`/`actualMinutes`), saisi en heures côté formulaire et converti en minutes — un vrai début de suivi de productivité, actuellement non exploité par aucun rapport.
- Le déplacement en glisser-déposer ne touche que `status`/`position` (`tasks/actions.ts:135-138`), jamais `progress`/`actualMinutes` — évite qu'un glisser-déposer accidentel écrase une saisie manuelle, bon réflexe de conception.

**Ce qui ne va pas :**
- **Aucune protection de concurrence, à aucun niveau** : `Task` n'a pas de colonne `version` dans `schema.prisma`, et `moveTaskAction`/`updateTaskAction` (`tasks/actions.ts:135-138, 175-194`) font un `update({where: {id}})` sans aucune garde. Deux personnes qui modifient la même tâche en même temps (l'une glisse une carte, l'autre remplit le formulaire d'édition) — la seconde écriture écrase silencieusement la première, sans détection ni message. C'est le seul type d'entité à fort volume de mutation dans tout le Workspace qui n'a **aucune** des deux protections déjà présentes ailleurs (ni le motif `where: {id, version}` d'Éditorial/Projet, ni même une vérification applicative). *Corrigé cette nuit (voir §11).*
- **Le champ `dependencyTaskId` n'est pas appliqué** : rien n'empêche de faire passer une tâche à `DONE` alors que sa dépendance ne l'est pas — c'est une information purement décorative dans l'état actuel (affichée, `task-board.tsx`, mais jamais vérifiée par aucune action serveur).
- **Le sélecteur de tâche dépendante liste toutes les tâches existantes sans filtre** — déjà noté par l'audit général (§2.3) pour le formulaire de création, confirmé ici : `create-task-form.tsx` reçoit `tasks` (toutes les tâches du projet actif, sans pagination ni recherche) — devient impraticable au-delà de quelques dizaines de tâches.
- **Aucune vue « mes tâches »** : la page ne filtre jamais par l'utilisateur connecté, seulement par projet — un collaborateur doit chercher visuellement ses propres cartes dans le tableau complet du projet, pas de vue personnelle dédiée (même constat que l'audit général, item I2, confirmé spécifiquement ici).

### 3.3 Projets

- Paginé correctement (`projects/page.tsx:47-55`, `skip`/`take`) — contrairement à Éditorial, ce point a déjà été traité par l'audit général (C4).
- Concurrence gérée : `projects/actions.ts:106-117` fait le bon motif `updateMany({where: {id, version}})` + vérification `count === 0` — le motif le plus robuste des trois modules audités ce soir (plus robuste que le `update()` + capture d'exception d'Éditorial, strictement équivalent en résultat).
- **Le champ `budgetCents` existe en base (`schema.prisma`, modèle `Project`) mais n'est affiché ni saisi nulle part dans l'UI** (`project-forms.tsx`, `projects/page.tsx`) — donnée fantôme, ni visible ni exploitable, malgré la promesse du sous-titre de page (« Pilotez les projets clients, responsables, équipes, **budgets** et échéances »). Écart concret entre la copie de l'interface et ce qu'elle permet réellement de faire.
- Aucune notion de campagne distincte d'un projet — un `Project` sert à la fois de dossier de production et de ce qui ressemblerait à une campagne marketing, sans objectifs/KPI/livrables formalisés au-delà du texte libre de description.

---

## 4. Comparaison fonctionnelle détaillée

| Fonctionnalité | Attendu | Projet actuel | Écart | Sévérité | Recommandation |
|---|---|---|---|---|---|
| Vue semaine | Oui | Oui, avec navigation | Aucun | — | RAS |
| Vue mois | Oui | Absente | Total | Important | Phase 2, M |
| Vue jour/agenda | Oui | Absente | Total | Moyen | Phase 3, S-M |
| Vue timeline/Gantt | Oui pour dépendances multi-tâches | Absente | Total | Moyen | Phase 4, L |
| Vue kanban | Oui | Oui (éditorial + tâches), glisser-déposer, optimiste | Aucun | — | RAS, un vrai point fort |
| Requête bornée dans le temps | Oui | Non pour la vue Semaine (avant ce soir) | Réel bug | Critique | ✅ Corrigé cette nuit |
| Concurrence optimiste (Task) | Oui | **Absente**, aucune colonne `version` | Total | Critique | ✅ Corrigé cette nuit (migration + garde) |
| Concurrence optimiste (Editorial/Project) | Oui | Oui, correcte | Aucun | — | RAS |
| Sous-tâches | Oui | Oui (`parentTaskId`) | Aucun | — | RAS |
| Dépendances appliquées | Bloquantes | Modélisées mais non appliquées | Partiel | Important | Phase 2, S — vérifier la dépendance avant de permettre `DONE` |
| Checklists | Oui | Absentes | Total | Moyen | Phase 3, M |
| Commentaires/mentions | Oui | Absents | Total | Important | Phase 2/4, M-L |
| Notifications | Oui | Absentes | Total | Important | Phase 4, L (nécessite une décision d'infrastructure) |
| Tableau de bord « mon travail » | Oui | Absent (déjà noté I2 dans l'audit général) | Total | Important | Phase 2, M |
| Pièces jointes contenu | Oui | Absentes | Total | Moyen | Phase 2, S-M (réutiliser l'infra média CMS) |
| Récurrence (contenu, tâche) | Oui | Absente | Total | Moyen-Important selon usage réel | Phase 4, L |
| Suivi de temps → rapport | Collecté et exploité | Collecté, jamais restitué | Partiel | Moyen | Phase 3, S (un simple total par personne/projet) |
| Budget projet | Suivi et visible | Colonne en base, invisible dans l'UI | Total | Moyen | Phase 2, S (juste l'exposer, aucune nouvelle donnée) |
| Campagnes distinctes | Objectifs/KPI/livrables | `Project` fait office de campagne, sans ces champs | Partiel | Moyen | Décision produit avant tout code |
| Canal de diffusion structuré | Liste contrôlée / intégration | Texte libre | Partiel | Faible-Moyen | Phase 3, XS (liste fermée suffirait déjà) |
| Workflow de rejet avec motif | Oui | Changement de statut brut sans motif tracé | Partiel | Moyen | Phase 2, S |
| Charge de travail / capacité | Oui | Absente | Total | Moyen | Phase 4, M |

---

## 5. Audit UX

*Même réserve méthodologique que pour l'audit Facturation : lecture du JSX réel, pas de session navigateur vérifiée.*

| Critère | Constat | Score /10 |
|---|---|---|
| Navigation | Deux vues clairement séparées par onglet (Semaine/Pipeline), cohérent avec le reste du Workspace | 7 |
| Planification (scheduling) | Navigation semaine par semaine correcte ; pas de vue mois pour se projeter plus loin | 5 |
| Création de tâche/contenu | Formulaire complet mais dense, un seul projet actif à la fois pour les tâches | 6 |
| Édition | Édition inline via formulaires liés à chaque carte — cohérent | 7 |
| Collaboration | Aucun commentaire, aucune mention — zéro échange asynchrone possible sur un item | 1 |
| Charge cognitive | Cartes bien hiérarchisées (titre, méta, statut) ; le pipeline devient dense sans filtre au-delà de quelques dizaines d'items | 6 |
| Efficacité | Glisser-déposer déjà présent pour les deux tableaux — un vrai gain de rapidité par rapport à des formulaires systématiques | 8 |
| Accessibilité | Formulaires natifs, labels présents ; le glisser-déposer (`@hello-pangea/dnd`) n'a pas d'alternative clavier documentée — déjà noté par l'audit général (§2.7) pour les tâches, confirmé aussi pour le pipeline éditorial | 5 |
| Recherche/filtres | Aucun filtre par personne, canal, type de contenu, ou statut au-delà des colonnes du kanban | 2 |
| Responsive | Non vérifiable dans cette session | Non noté |
| États vides | Présents et clairs (« Rien de prévu », « Aucun contenu. », « Aucun projet. ») | 8 |
| États de chargement | `loading.tsx` présent sur les trois routes (héritage A2) | 7 |
| Validation | Côté serveur uniquement, pas de retour en temps réel pendant la saisie | 5 |
| Cohérence | Les deux kanbans (tâches, pipeline éditorial) partagent visuellement les mêmes classes CSS (`task-board`, `task-column`, `task-card`) — bonne réutilisation, pas de réinvention | 8 |
| Power user | Pas de raccourci clavier, pas d'action groupée, pas de création rapide sans quitter le tableau | 3 |

**Moyenne indicative (hors items non notés) : 5,6/10.**

---

## 6. Audit UI

- **Réutilisation visuelle forte** entre le tableau de tâches et le pipeline éditorial (mêmes classes de carte, de colonne, de pastille de priorité) — un vrai point fort de cohérence, pas noté ailleurs dans l'audit général à ce niveau de détail.
- **Cartes bien informatives** : le pipeline éditorial affiche type de contenu, date, client, canal et avatar du responsable en un coup d'œil (`pipeline-board.tsx:119-133`) — bonne densité d'information sans surcharge.
- **Le champ budget invisible** (§3.3) est un vrai défaut de priorisation d'information : une donnée métier significative existe et n'est simplement jamais montrée.
- **Le sous-titre de la page Projets** promet une fonctionnalité (suivi budgétaire) que l'écran ne tient pas — à corriger soit en exposant le champ, soit en ajustant la copie tant que ce n'est pas fait.
- **Aucune icône** dans ces trois modules (comme pour Facturation) — cohérent avec le reste du Workspace mais un repère visuel supplémentaire (type de contenu, priorité) gagnerait en scannabilité au-delà de la pastille de couleur.

---

## 7. Audit du workflow

**Flux reconstruit — contenu éditorial :**
1. Créer un contenu (titre, canal, client, date de publication, propriétaire) → `DRAFT`.
2. Glisser la carte dans le pipeline ou changer le statut manuellement → `INTERNAL_REVIEW` → `CLIENT_REVIEW` → `APPROVED` → `SCHEDULED` → `PUBLISHED`.
3. Chaque étape pose un horodatage adapté automatiquement.

**Flux reconstruit — tâches :**
1. Sélectionner un projet actif (menu déroulant, un seul à la fois).
2. Créer une tâche (titre, priorité, assigné, échéance, estimation, dépendance/parent optionnels).
3. Glisser la carte entre colonnes de statut, ou éditer manuellement (progression, temps réel).

**Frictions identifiées :**
- Le changement de statut du pipeline éditorial (glisser-déposer OU formulaire `EditorialWorkflowForm`) **n'exige aucun commentaire de motif**, y compris pour un rejet client — une validation qui échoue reste une simple case cochée en arrière, sans trace de pourquoi.
- La liste déroulante de tâche dépendante (§3.2) devient inutilisable dès qu'un projet a beaucoup de tâches.
- Aucun moyen de créer plusieurs contenus similaires en série (ex. un post par semaine pendant un mois) — chaque contenu se crée un par un.
- Le passage d'un projet à un autre dans la page Tâches recharge toute la page (formulaire `method="get"`) — correct fonctionnellement, mais aucune persistance de filtre visible ailleurs (ex. revenir sur Éditorial ne mémorise pas le dernier monde consulté au-delà du paramètre d'URL déjà présent).

**Workflow optimisé recommandé :**
1. Ajouter un champ « motif » optionnel mais visible sur tout passage vers `CLIENT_REVIEW`→arrière ou `CANCELLED` (Phase 2, S).
2. Filtrer la liste de tâche dépendante par recherche texte plutôt qu'un `<select>` exhaustif (Phase 2, S).
3. Vue « mon travail » transverse (tâches assignées à moi + contenus dont je suis propriétaire/relecteur, tous projets/mondes confondus) — le complément naturel du tableau de bord global déjà recommandé par l'audit précédent (I2), maintenant précisé pour ce module (Phase 2, M).

---

## 8. Analyse des écarts — synthèse

### 8.1 Critiques
1. Requête non bornée dans le temps sur la vue Semaine du calendrier éditorial. *Corrigé cette nuit.*
2. Aucune protection de concurrence sur `Task` (ni colonne `version`, ni garde applicative). *Corrigé cette nuit.*
3. Dépendance de tâche non appliquée — une tâche peut être marquée terminée alors que sa dépendance ne l'est pas, malgré la modélisation existante. *Non corrigé (décision produit sur la sévérité du blocage attendue — bloquant strict ou simple avertissement).*

### 8.2 Importantes
- Aucune vue mois/agenda pour le calendrier éditorial.
- Aucun tableau de bord personnel (« mon travail »).
- Dépendances de tâches non appliquées (voir critique #3, reclassable selon la décision produit).
- Aucun commentaire/mention sur tâche ou contenu.
- Aucune notification (échéance, mention, changement de statut).
- Sélecteur de tâche dépendante non filtrable à volume.
- Cycle de validation client sans motif de rejet tracé.
- Budget projet invisible dans l'UI malgré la donnée déjà en base.

### 8.3 Amélioration
- Vue jour/agenda, checklists, pièces jointes sur contenu, canal en liste contrôlée, suivi de temps restitué en rapport, alternative clavier au glisser-déposer, campagnes distinctes des projets, récurrence de contenu/tâche, charge de travail par personne.

---

## 9. Fonctionnalités manquantes — détail priorisé

| # | Fonctionnalité | Pourquoi ça compte | Priorité | Complexité | Impact |
|---|---|---|---|---|---|
| E1 | Concurrence optimiste sur Task | Intégrité des données sur l'entité la plus mutée du Workspace | Critique | S (migration + garde, motif déjà éprouvé) | ✅ Fait cette nuit |
| E2 | Requête bornée pour la vue Semaine | Scalabilité | Critique | XS | ✅ Fait cette nuit |
| E3 | Dépendance de tâche appliquée | Fiabilité du pipeline de production | Important | S | Empêche un `DONE` prématuré |
| E4 | Vue « mon travail » transverse | Réduit la charge de recherche visuelle quotidienne | Important | M | Gain de temps quotidien réel |
| E5 | Vue mois | Vision de planification à moyen terme | Important | M | Complète la vue Semaine |
| E6 | Commentaires/mentions | Collaboration asynchrone de base | Important | M-L | Réduit les échanges hors-outil (Slack, e-mail) |
| E7 | Notifications (échéance, mention) | Réactivité | Important | L (infra) | Réduit les oublis |
| E8 | Motif de rejet tracé | Qualité du cycle de validation client | Important | S | Historique exploitable en cas de litige |
| E9 | Filtrage du sélecteur de dépendance | Utilisabilité à volume | Important | XS-S | Débloque l'usage à grande échelle |
| E10 | Exposer le budget projet | Cohérence promesse/réalité de l'UI | Moyen | XS | Corrige un écart déjà visible |
| E11 | Pièces jointes contenu | Traçabilité créative | Moyen | S-M | Réutilise l'infra média existante |
| E12 | Checklists sur tâche | Décomposition fine du travail | Moyen | M | Confort pour tâches complexes |
| E13 | Récurrence contenu/tâche | Réduit la ressaisie répétitive | Moyen | L | Gain de temps sur les routines |
| E14 | Rapport temps estimé vs réel | Pilotage de production | Moyen | S | Donnée déjà collectée, juste à restituer |
| E15 | Charge de travail par personne | Équilibrage d'assignation | Moyen | M | Évite la surcharge silencieuse |
| E16 | Canal en liste contrôlée | Fiabilité du filtrage futur | Faible | XS | Prépare un vrai filtre par canal |
| E17 | Campagnes distinctes des projets | Clarté conceptuelle | Moyen (dépend du modèle commercial réel) | L | Décision produit avant tout code |
| E18 | Vue timeline/Gantt | Vision des chevauchements | Innovation | L | Utile dès plusieurs projets simultanés complexes |
| E19 | Assignation multiple/par équipe | Flexibilité d'organisation | Innovation | M | Utile à mesure que l'équipe grandit |
| E20 | Planification intelligente (IA) | Suggestion d'assignation/date | Innovation | XL, décision propriétaire (fournisseur IA) | Non prioritaire tant que le socle manuel n'est pas complet |

---

## 10. Recommandations priorisées

1. **Critique, fait cette nuit** : concurrence optimiste sur `Task`, requête bornée pour la vue Semaine.
2. **Critique, sans décision propriétaire** : appliquer réellement la dépendance de tâche (bloquer ou avertir avant `DONE`) — à trancher : blocage strict ou avertissement, un choix produit mineur mais réel.
3. **Important, sans dépendance externe** : vue « mon travail », filtrage du sélecteur de dépendance, motif de rejet tracé, exposition du champ budget.
4. **Important, nécessite une décision d'infrastructure** : notifications (canal — e-mail ? in-app seulement ?), à cadrer avant tout code.

---

## 11. Ce qui a été implémenté cette nuit

- **Vue Semaine bornée dans le temps** : la requête `editorialItem.findMany` est maintenant filtrée par `scheduledFor` sur la fenêtre de la semaine affichée quand la vue active est « Semaine ». La vue Pipeline reste volontairement non bornée dans le temps (elle doit rester capable de montrer un contenu en retard depuis longtemps) — noté ici comme dette résiduelle assumée, pas oubliée.
- **Concurrence optimiste réelle sur `Task`** : nouvelle colonne `version` (migration Prisma), les actions `moveTaskAction`/`updateTaskAction` appliquent désormais le même motif `where: {id, version}` que `EditorialItem`, avec message clair en cas d'écriture concurrente perdue au lieu d'un écrasement silencieux.

Ce qui n'a **pas** été implémenté cette nuit, et pourquoi : tout ce qui exige une décision produit (campagnes distinctes, sévérité du blocage de dépendance, canal de notification) ou une nouvelle dépendance (notifications, IA) — cohérent avec la même discipline que l'audit Facturation.

---

## 12. Roadmap produit

**Phase 1 — Critique (fait cette nuit + décision restante)**
- ✅ Concurrence Task, requête bornée Semaine.
- ⏳ Décision produit : sévérité du blocage de dépendance de tâche.

**Phase 2 — Fonctionnel majeur**
- Vue « mon travail », vue mois, motif de rejet tracé, filtrage du sélecteur de dépendance, exposition du budget projet, pièces jointes contenu.

**Phase 3 — UX/UI**
- Vue jour/agenda, checklists, rapport temps estimé/réel, canal en liste contrôlée, alternative clavier au glisser-déposer.

**Phase 4 — Automatisation**
- Notifications (nécessite un choix de canal/infrastructure), récurrence contenu/tâche, charge de travail par personne, escalade sur blocage prolongé.

**Phase 5 — Capacités avancées**
- Vue timeline/Gantt, campagnes distinctes des projets (décision produit), assignation multiple/par équipe, planification assistée par IA (décision propriétaire).

---

## 13. Scorecard

| Axe | Score /10 | Justification |
|---|---|---|
| Complétude fonctionnelle | 5 | Socle réel (kanban, pipeline, sous-tâches) mais vues et collaboration incomplètes |
| Planification éditoriale | 5 | Semaine + pipeline solides, mois/jour/agenda absents |
| Gestion des tâches | 6 | Sous-tâches et dépendances modélisées, dépendances non appliquées |
| Collaboration | 1 | Aucun commentaire, mention, notification |
| UX | 6 | Glisser-déposer fluide, mais aucun filtre ni vue personnelle |
| UI | 6 | Cohérence visuelle forte entre les deux kanbans |
| Automatisation | 1 | Quasiment aucune |
| Scalabilité | 6 | Corrigée pour la vue Semaine cette nuit ; Pipeline et sélecteur de dépendance restent à borner |
| Maturité entreprise | 4 | Manque collaboration, notifications, reporting |
| Intégration au reste du projet | 6 | Cohérent visuellement, mais aucun lien avec Leads/CRM |
| Maintenabilité | 5 | Logique dispersée dans des `actions.ts` sans couche domaine dédiée (cf. C2/ODR-025) |

**Score global indicatif : 4,7/10** — un module avec un vrai socle de production (kanban, statuts, sous-tâches, dépendances modélisées) mais qui reste, comme Facturation, un outil pour un usage individuel ou en petite équipe : la collaboration asynchrone, les notifications et le reporting — les trois piliers qui transforment un outil de suivi en plateforme d'équipe — sont quasiment absents.

---

## 14. Conclusion exécutive

Ce module a une meilleure base technique que ce que son statut « non gouverné » (au sens architectural, `DOMAIN_BOUNDARIES.md`) pourrait laisser craindre : machine à états réelle, glisser-déposer avec mise à jour optimiste, concurrence correctement gérée pour Éditorial et Projets. Le vrai point noir trouvé et corrigé cette nuit était `Task`, seule entité à fort volume de mutation sans aucune protection — un oubli documenté depuis longtemps (cf. commit `c786999`) et enfin comblé.

Les manques les plus visibles pour une agence qui grandit ne sont pas des bugs mais des capacités jamais construites : collaboration asynchrone (commentaires, mentions), notifications, et une vue personnelle du travail de chacun. Ce sont les trois investissements qui rapporteraient le plus, dans cet ordre, avant d'envisager l'automatisation ou l'IA.
