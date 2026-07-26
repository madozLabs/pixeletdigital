# Audit exhaustif — Pixel & Digital (Workspace interne & Sites publics)

**Date :** 25 juillet 2026
**Périmètre analysé :** état réel du dépôt `D:\Dev\pixeldigital`, branche `main`, commit `2523cc1` et suivants (état non commité inclus)
**Méthode :** lecture directe du code source (`src/`, `prisma/schema.prisma`, `docs/`), des captures d'écran déjà présentes dans le dépôt (`home-check*.png`, `kwaliti-check.png`, `contact-check.png`, `quote-check.png`, `mobile-*.png`), et vérification croisée avec les documents de gouvernance (`AGENTS.md`, `docs/05-architecture/*`, `docs/03-ux/*`, `docs/01-brand/*`). Chaque constat cite un fichier et, quand c'est pertinent, une ligne. Aucune affirmation n'est faite sans preuve dans le dépôt — conformément à la règle de `AGENTS.md` ("Aucune affirmation de build, test, sécurité... ne doit être faite sans preuve correspondante").

**Un audit précédent** (`AUDIT_PIXEL_DIGITAL.md`, signé "Manus AI") existait déjà dans le dépôt à l'état non suivi. Il identifiait correctement deux symptômes réels (accès Prisma direct dans les pages, `AdminShell` mixte) mais restait générique, sourcé sur des articles de blog SaaS plutôt que sur le code, et passait à côté des sujets les plus lourds : dérive de périmètre architecturale non gouvernée, trous de traçabilité de sécurité, absence totale de pagination, bug d'encodage visible en production, pipeline commercial (leads) incomplet. Ce document le remplace.

---

## Résumé exécutif

Le projet est **structurellement sain à sa fondation** : gouvernance écrite et respectée (`AGENTS.md`), séparation domaine/application/infrastructure réellement propre pour les modules d'origine (`access`, `content`, `enquiries`, `worlds`, une bonne partie de `billing`), typage strict sans `any`, tests comportementaux de bonne qualité sur ce périmètre, schéma Prisma soigné (index, cascades, concurrence optimiste). Ce n'est pas un projet bâclé.

Mais **deux systèmes coexistent dans le même dépôt** : le système gouverné (modules `src/modules/*`, architecture en couches, tests, erreurs typées) et un système parallèle construit plus vite, en dehors du périmètre documenté — Organisation, Projets, Tâches, une partie de la Facturation — qui accède à Prisma directement depuis les pages, avale les erreurs en silence, n'écrit aucune trace d'audit, ne pagine jamais ses listes. `docs/05-architecture/DOMAIN_BOUNDARIES.md` classe explicitement Projets/Tâches/Facturation comme **domaines différés**, nécessitant "une décision de périmètre et une revue de frontière avant introduction" — cette revue n'a pas eu lieu. C'est le constat le plus important de cet audit : ce n'est pas un problème de qualité de code isolé, c'est une dérive de gouvernance qui a produit, de fait, la moitié du schéma de données actuel hors du cadre que le projet s'est lui-même fixé.

Côté usage quotidien du Workspace : l'outil est utilisable mais reste un tableau de bord d'informations plutôt qu'un outil de travail personnalisé. Aucune recherche globale, aucun raccourci clavier, un dashboard qui affiche l'état du monde entier au lieu du travail de la personne connectée, des formulaires à deux standards UX différents selon le module, aucun état de succès/erreur visible pour la majorité des mutations, aucune pagination. Sur 8h/jour, ces frictions s'accumulent vite.

Côté site public : la base de marque et de motion est réelle et bien pensée (thématisation par marque, `HeroParallax`, `useReducedMotion` correctement géré, formulaire de contact partagé et robuste). Mais l'exécution trahit la promesse : un bug d'encodage UTF-8 casse le français visible sur mobile et dans le bandeau du hero, Kwaliti Print — censé être une identité blanche/tactile/photographique selon son propre brand bible — est livré comme un simple reskin noir du gabarit Pixel&Digital, aucune preuve sociale (témoignages, réalisations) n'existe nulle part dans le code, et les pages publiques n'ont aucun filet de secours si la base de données est indisponible (une capture d'écran du dépôt le montre littéralement en échec : `home-check.png`).

**Répartition des recommandations :** 8 critiques, 7 importantes, 4 d'amélioration, 5 d'innovation — détail section 4 et 5.

---

## 1. Architecture, logique métier, qualité du code

### 1.1. Ce qui fonctionne réellement bien (à ne pas casser)

- **La couche domaine est propre.** Aucun import de Prisma, Next.js ou de tout framework dans `src/modules/*/domain/**` — vérifié par recherche exhaustive. C'est exactement ce qu'exige `ARCHITECTURE_BASELINE.md` §4.
- **Le pattern d'erreurs typées est réel et suivi**, pas juste documenté : `src/app/(marketing)/contact/actions.ts:80-112` fait correspondre `result.error.code` (`RATE_LIMITED`, `NOT_FOUND`, `VALIDATION_ERROR`) à des messages utilisateur sans jamais exposer les détails internes — conforme à `APPLICATION_CONTRACTS.md` §4.
- **Zéro `any` dans tout `src/`** (hors client Prisma généré). Le mode `strict` de `tsconfig.json` n'est affaibli nulle part, et `next.config.ts` ne désactive ni le lint ni le typecheck au build — un signal de discipline rare et positif.
- **Le schéma Prisma est sérieux** : cascades différenciées correctement (`Cascade` pour les entités possédées, `Restrict` pour les entités de référence), colonnes `version` pour la concurrence optimiste sur les entités éditoriales/commerciales, index systématiques sur les clés étrangères et les filtres réels (`[worldKey, status]`). Le risque de N+1 est bas : les usages `findMany + include` observés restent à un seul niveau, Prisma les traite en requêtes plates, pas en boucle.
- **Les tests existants sont comportementaux, pas décoratifs** : `src/modules/billing/domain/invoice.test.ts` vérifie l'ordre de calcul remise/taxe, les transitions d'état interdites (annuler une facture payée), les statuts de paiement partiel. `src/modules/enquiries/application/submit-general-contact.test.ts` couvre le rejeu d'idempotence, le honeypot, le rate-limiting, les mondes inconnus. Aucune assertion décorative (`toBeDefined()` seul) trouvée dans l'échantillon.

### 1.2. Le vrai sujet critique : deux architectures dans un seul dépôt

Sur 27 fichiers `page.tsx`/`actions.ts` dans `src/app/**`, **14 (52%) appellent Prisma directement** au lieu de passer par un cas d'usage applicatif : `src/app/workspace/page.tsx:60-106`, `organization/page.tsx:23-37` + `organization/actions.ts:35-123`, `billing/page.tsx:49-63`, `site-content/page.tsx:58-70` + `site-content/actions.ts:32-256`, `(marketing)/[slug]/page.tsx:13-56`, `clients/page.tsx:29-43`, `editorial/page.tsx:68-78`, `projects/page.tsx:42-55`, `tasks/page.tsx:21-157` + `tasks/actions.ts:26-115`. C'est une violation directe de `ARCHITECTURE_BASELINE.md` §4.

Ce n'est pas un oubli isolé : **Organisation, Projets, Tâches et une partie de la Facturation n'ont tout simplement pas d'équivalent dans `src/modules/`**. Quinze des vingt-neuf modèles du schéma Prisma (`Department`, `Team`, `JobPosition`, `TeamMembership`, `Project`, `Task`, `Quote`, `Invoice`, etc.) n'apparaissent nulle part dans `docs/05-architecture/DATA_MODEL.md`, qui ne documente qu'Accès/Monde/Contenu/Média/Enquête/Audit. `DOMAIN_BOUNDARIES.md` §5 liste explicitement "projets/tâches, dossiers de production, devis comme documents commerciaux, facturation, paiements, planification" comme **domaines différés**, à ne pas construire sans revue de frontière. Cette revue n'existe pas dans le dépôt. À l'inverse, un domaine documenté — les **Leads** — n'a lui aucune table dans le schéma réel : la dérive va donc dans les deux sens (ajouts non gouvernés d'un côté, promesse non tenue de l'autre).

Conséquence directe et mesurable : ces modules non gouvernés avalent leurs erreurs en silence. `src/app/workspace/organization/actions.ts:34-42, 54-66, 77-85, 97-116` enveloppe chaque mutation dans un `catch` nu qui retourne un message générique en français sans code d'erreur, sans identifiant de corrélation, sans log — violation directe de `APPLICATION_CONTRACTS.md` §4 ("les logs conservent le code d'erreur et l'identifiant de corrélation"). Chaque fichier réinvente aussi sa propre vérification de rôle (`organization/actions.ts:18-21`, `projects/actions.ts:19`, `tasks/actions.ts:19`) au lieu de partager une politique centrale comme le font `content/application/content-authorization.ts`, `worlds/application/world-authorization.ts`, `billing/application/billing-authorization.ts` et `enquiries/application/enquiry-authorization.ts`. Aucune route trouvée sans contrôle d'accès, mais la logique est éparpillée et donc impossible à vérifier statiquement en un seul point.

**C'est une décision propriétaire/CTO, pas un simple ticket technique** (au sens de `AGENTS.md` : "changement majeur d'objectif produit... modification majeure de roadmap métier"). Trois options honnêtes : (a) acter que Projets/Tâches/Facturation/Organisation entrent officiellement dans le périmètre produit et les faire rentrer dans l'architecture DDD comme les autres modules ; (b) les geler et les réduire au strict nécessaire en attendant une revue ; (c) les extraire dans un module dédié avec sa propre frontière documentée. Voir Prompt C2.

### 1.3. Traçabilité et sécurité

`SECURITY_AND_PERMISSIONS.md` §7 exige un audit trail pour "publication/planification/archivage, réglages sensibles d'un monde, changements de droits média, assignation/statut d'un lead, exports commerciaux, actions destructrices". En réalité, **les événements d'audit ne sont écrits qu'à quatre endroits, tous dans `access/actions.ts`** (lignes 85, 102, 130, 147) — c'est-à-dire uniquement pour la gestion des comptes et des rôles. Publier/archiver/supprimer une page (`site-content/actions.ts`), publier un service (`services/actions.ts`), émettre/annuler une facture ou enregistrer un paiement (`billing/actions.ts`), et toutes les mutations de `clients`, `organization`, `projects`, `tasks` — n'écrivent **aucune** trace. Le module `audit` lui-même n'a pas de quoi le faire : `src/modules/audit/application/audit-event.ts:3-9` code en dur une liste d'actions limitée aux cinq actions d'accès ; il n'existe ni couche domaine, ni dépôt, ni infrastructure pour représenter un autre type d'événement, et zéro test.

Les vérifications de rôle elles-mêmes sont solides là où elles existent (`getWorkspaceRequestContext()` appelé systématiquement en tête de chaque page/action workspace), mais dupliquées en logique ad hoc pour les modules non gouvernés — voir 1.2.

### 1.4. Absence systémique de pagination

Aucun des 32 appels `prisma.*.findMany` du workspace ne borne ses résultats (`grep -c "take:"` → 0 occurrence). Contradiction directe avec `APPLICATION_CONTRACTS.md` §7 ("la pagination est bornée et déterministe"). Pas encore un bug au volume de données actuel, mais un risque de dégradation et de déni de service dès que `Client`, `Project`, `Task`, `Invoice` grossissent — sans aucune limite, un simple chargement de page pourra un jour tenter de rapatrier des dizaines de milliers de lignes en une requête.

### 1.5. Composants et duplication

Il n'y a pas un unique "god component" démesuré — `AdminShell` (`src/app/workspace/_components/admin-shell.tsx`, 275 lignes) reste raisonnable — mais plusieurs **pages** mélangent accès données + logique + rendu sur des centaines de lignes : `site-content/page.tsx` (762 lignes), `billing/page.tsx` (521 lignes), `editorial/page.tsx` (386 lignes, avec son propre `formatDate` local). Au moins **six implémentations indépendantes de formatage de date** coexistent (`workspace/page.tsx:332`, `enquiries/page.tsx:88`, `editorial/page.tsx:381`, plus des `.toLocaleDateString("fr-FR")` dispersés dans `billing`, `projects`, `tasks`) sans utilitaire partagé. Un composant `status-badge.tsx` existe bien mais est sous-utilisé : huit fichiers réimplémentent leur propre table de libellés/couleurs de statut au lieu de l'utiliser. Deux conventions de formulaire coexistent sans réconciliation : `useActionState` + retour visuel (`client-forms.tsx`, `access-forms.tsx`) contre formulaires bruts intégrés en page sans aucun retour (`billing`, `editorial`, `projects`, `services`, `tasks`, `site-content`).

### 1.6. Signal d'alerte : scripts Python de patch dans un dépôt TypeScript

`scripts/fix-cms-public.py`, `fix-home.py`, `fix-site-content.py`, `fix-site-content-actions.py`, `add-media-model.py`, `add-site-content-nav.py` sont des scripts Python de quelques lignes qui font de la substitution de texte brute dans des fichiers `.tsx`/`.ts` (recherche d'index de chaîne, réécriture). Ils ne sont référencés dans aucun script `package.json`, donc hors CI/pipeline normal. `fix-home.py` en particulier réencode un fichier de `latin1` vers `utf-8` et corrige un mot corrompu au caractère près — preuve directe qu'un fichier a été corrompu par un enregistrement non-UTF‑8‑safe et rafistolé après coup plutôt que la cause racine corrigée. Ce sont des patches artisanaux appliqués hors de la boucle édition/lint/typecheck normale, fragiles par construction (une édition par index de caractère casse silencieusement si le fichier bouge), et contraires au principe `AGENTS.md` de "diff propre, aucun changement inexpliqué". Voir le lien direct avec le bug d'encodage constaté en section 3.6.

---

## 2. UX/UI du Workspace — évalué comme outil quotidien (8h/jour)

### 2.1. Navigation

Un seul `AdminShell` partagé, cohérent, avec barre latérale **repliable et persistée** en `localStorage` (`admin-shell.tsx:46-51, 164-174`) — bon réflexe pour un usage répété. Deux niveaux de profondeur seulement, pas de sous-menus. Mais :
- **Aucune recherche globale, aucune Command Palette** (Cmd+K) nulle part dans le code — alors que `ADMIN_JOURNEYS.md:112-114` et `INFORMATION_ARCHITECTURE.md:61` la prescrivent explicitement.
- **Aucun fil d'Ariane.** Sur un flux à 3 niveaux comme l'éditeur de contenu (page → section → mode JSON), le seul repère est un lien "← Toutes les pages" (`site-content/page.tsx:393-396`) — perte d'orientation réelle en usage prolongé.
- **La navigation n'est pas adaptée par rôle**, seulement filtrée grossièrement : un `CONTRIBUTOR` ou un `SALES` voit encore les entrées "Projets" ou "Clients" dans le menu alors qu'il n'y a pas accès — il atterrit sur une page d'erreur texte après avoir cliqué (`projects/page.tsx:33-37`, `clients/page.tsx:17-24`). Des impasses répétées, cumulées sur 8h/jour, sont une vraie friction.

### 2.2. Dashboard : un mur de métriques, pas un poste de travail personnel

`workspace/page.tsx` affiche 6 cartes de métriques mondiales (projets en retard, tâches bloquées, contenu à valider…) puis 4-5 panneaux de listes — **tout est filtré par `worldKey`, jamais par l'utilisateur connecté**. "Tâches bloquées" et "projets en retard" montrent le total de l'agence quel que soit qui regarde ; "charge par collaborateur" est un classement de toute l'équipe, pas "mes tâches à moi". C'est l'inverse exact de ce que prescrit `WIREFRAME_SPECIFICATIONS.md:47-48` ("montrer d'abord le travail actionnable : file de revue, leads assignés, prochaines actions dues... éviter les métriques décoratives") et de `INFORMATION_ARCHITECTURE.md:47`. Aucune vérification de rôle ne module le contenu (à l'exception des chiffres de facturation) : un `READER` voit exactement le même tableau qu'un `ADMIN`, moins les montants.

### 2.3. Formulaires

Toujours en page complète, jamais en modale ni en tiroir latéral — au moins c'est **cohérent** dans son choix. Mais deux qualités d'expérience coexistent : les formulaires `clients` et `access` utilisent `useActionState`/`useFormStatus` avec un retour visuel de succès/erreur explicite ; tous les autres (`projects`, `tasks`, `editorial`, `billing`, `organization`, `services`, `site-content`) sont des `<form action={...}>` serveur bruts, **sans aucun état "en cours", sans confirmation visible de succès ou d'échec** — la mutation part, la page se revalide, et l'utilisateur doit deviner si ça a marché. Les champs sont denses et non groupés visuellement (le formulaire client a 11 champs sur deux grilles, le formulaire tâche propose un sélecteur "tâche dépendante" qui liste *toutes* les tâches existantes sans filtre — inutilisable dès qu'un projet dépasse quelques dizaines de tâches). Des actions sensibles comme révoquer un rôle ou suspendre un utilisateur (`access-forms.tsx:118-134, 153-164`) sont de simples boutons en un clic, sans confirmation — alors que `ROLES_AND_PERMISSIONS.md:70-81` classe explicitement la modification des permissions comme nécessitant une "confirmation renforcée".

### 2.4. Listes et tables

Pas de composant `<Table>` partagé : chaque page réutilise la même classe CSS `admin-table` à la main. Cohérent visuellement, pas architecturalement (toute évolution — tri, sélection de ligne — doit être recopiée manuellement dans 5+ fichiers). Aucun tri ni filtre côté utilisateur nulle part, et — répétition du constat 1.4 — aucune pagination. Les états vides sont présents et bien formulés, mais rarement actionnables (ex. "Aucun projet." sans lien vers la création), ce qui contredit la règle "pas d'impasse" de `INFORMATION_ARCHITECTURE.md:94`.

### 2.5. Cohérence visuelle

Bon point réel : zéro couleur hexadécimale codée en dur dans les composants du workspace — tout passe par les tokens CSS de `globals.css:2-51`. Mais ces tokens vivent dans un **fichier CSS unique de 4 846 lignes**, et les sélecteurs propres à l'admin sont dupliqués deux fois dans le même fichier (`.admin-shell` défini en ligne 831 *et* 4082, `.admin-sidebar` en 838 et 4086, `.dashboard-metric-card` en 1945 et 4322) — signe que l'habillage admin a été greffé après coup sur la feuille de style du site public plutôt que pensé comme son propre système, avec un vrai risque de divergence future même si le rendu actuel reste cohérent.

### 2.6. Feedback et états

Aucun `loading.tsx`, aucun squelette de chargement, aucun spinner nulle part dans `src/app/workspace`. Aucun `error.tsx`. Aucun système de toast. Les seules mutations à retour "optimiste" instantané sont les deux tableaux kanban avec `useOptimistic` (`tasks/task-board.tsx`, `editorial/pipeline-board.tsx`) — tout le reste de l'application se comporte en rechargement de page classique. Le contraste d'expérience entre "glisser une carte kanban" (fluide) et "changer un statut de facture" (rechargement complet, sans confirmation) sera perceptible et incohérent à l'usage quotidien.

### 2.7. Accessibilité

Base correcte mais fine : lien d'évitement présent, bouton de repli de la barre latérale correctement étiqueté (`aria-label` + `title`). Les poignées de glisser-déposer du tableau de tâches (`task-board.tsx:120-123`) n'ont pas d'alternative clavier documentée. L'association label/champ est globalement bonne (labels natifs partout).

### 2.8. Adaptation par rôle : binaire, pas granulaire

L'accès est géré en tout ou rien — page entière autorisée ou message d'erreur en texte brut — jamais en masquage granulaire de champs (ex. cacher les montants financiers à un rôle qui peut voir un projet mais pas son budget). Le cas le plus concret : `ROLES_AND_PERMISSIONS.md:38-40` prévoit qu'un Collaborateur ne voit que "les contenus ou dossiers qui lui sont affectés" — en réalité, `tasks/page.tsx` affiche le tableau de tâches complet du projet à tous les rôles non-`READER`, sans filtre par assignation. Constat le plus significatif de cette section : le **module Enquiries/Leads n'a que deux cas d'usage implémentés — `list` et `submit`** (`src/modules/enquiries/*`). Aucune qualification, assignation, note, prochaine action ou conversion — alors que c'est l'un des trois parcours phares explicitement priorisés ("traiter une demande commerciale", `ADMIN_JOURNEYS.md:118`, détaillé lignes 49-60). La page correspondante (`enquiries/page.tsx:53-82`) est un simple tableau en lecture seule.

---

## 3. Site public — expérience et immersion

### 3.1. Architecture de l'information

Header Pixel&Digital sobre (3 liens + sélecteur d'univers + CTA), menu mobile réel via `<details>/<summary>` (`site-header.tsx:29-34`). Le sélecteur d'univers (`world-switcher.tsx`) est une implémentation honnête de l'exigence "entrée permanente vers nos univers" (`BRAND_ARCHITECTURE.md` §8). Mais côté Kwaliti Print, le header **n'a aucun menu mobile** : à `globals.css:3258-3264`, la règle `@media (max-width: 720px)` masque simplement les liens de navigation sans proposer de remplacement — confirmé par la capture `mobile-kp.png`, où seuls le logo et le bouton "Demander un devis" restent visibles. Le lien "Possibilités" (`kwaliti-header.tsx:14`) pointe vers une ancre `#possibilites` qui n'existe pas — la section réelle a l'id `capacites-kp` (`kwaliti-print/page.tsx:115`) — le lien est mort. Aucune route publique de portfolio/réalisations n'existe (seul `workspace/projects`, interne, existe), alors que c'est central aux parcours 1, 2, 3 et 7 de `PUBLIC_JOURNEYS.md`.

### 3.2. Premier impact

Le hero Pixel&Digital est net, avec une hiérarchie CTA claire (un bouton primaire, un lien secondaire), fidèle à la promesse de "restraint premium" de la marque. Mais le visuel du hero n'est **pas une photographie** — ce sont deux cercles CSS plats sur fond noir (`page.tsx:88-105`), alors que `PIXEL_DIGITAL_ART_DIRECTION_BRIEF.md` §3 priorise explicitement "de vraies personnes, du vrai travail, de vrais process" plutôt que de l'abstraction décorative. Le hero Kwaliti Print suit le même principe purement géométrique (cercle jaune, carré magenta pivoté, cercle bleu) — esthétique CMYK confiante, mais sans aucune photographie produit malgré la prescription explicite du brand bible (voir 3.5).

### 3.3. Motion et immersion : la promesse dépasse le livré

Les briques techniques existent et sont bien construites : `HeroParallax`, `MagneticButton`, `Reveal` (fade/slide au scroll) — toutes correctement neutralisées par `useReducedMotion`, un vrai bon point d'accessibilité. Mais :
- **`KineticHeading`, le composant de typographie cinétique mot-par-mot, est câblé nulle part** dans l'application — le hero utilise un simple `Reveal`. C'est une capacité déjà construite mais jamais branchée, alors que `BRAND_ARCHITECTURE.md` §4 en fait un élément d'identité explicite.
- **Aucune transition entre pages ou entre univers** : pas d'`AnimatePresence`, aucun mécanisme de transition. Passer de `/` à `/kwaliti-print` est un changement de route brut, alors que `PUBLIC_JOURNEYS.md` (Parcours 4) demande une "transition immersive... spectaculaire mais réversible" pour ce changement de monde précis.
- **Défaut concret observé** : la section "manifeste" en fond noir (`globals.css:2202-2205`, contenu `<Reveal>`) apparaît **entièrement vide** sur la capture `home-check-2.png`, juste sous le bandeau du hero — cohérent avec un texte resté à `opacity: 0` faute de déclenchement de l'`IntersectionObserver` dans l'état capturé. C'est exactement le piège que `MOTION_AND_IMMERSION_GUIDELINES.md` §3 et §7 mettent en garde contre : le contenu essentiel ne doit jamais dépendre d'une animation pour devenir visible.
- Le rythme de mouvement spécifique promis pour Kwaliti Print ("couches, découpe, pliage, impression") n'a aucune implémentation distincte — les mêmes primitives génériques sont réutilisées, seulement recolorées.

### 3.4. Conversion (contact / devis)

Bon point d'ingénierie : un seul composant `ContactForm` partagé et paramétré, avec validation par champ, rate-limiting, clé d'idempotence et accusé de réception — un flux à friction basse et solide (4 champs visibles + consentement). Mais la promesse spécifique au devis Kwaliti Print n'est pas tenue : la copie annonce explicitement recueillir "Quantité, format, matière, délai, finition" (`devis/page.tsx:39`), alors que le formulaire est **rigoureusement identique** au formulaire de contact général — un simple champ de message libre, aucun champ structuré. Pour une activité d'impression où ces paramètres déterminent le prix et le délai, c'est une occasion manquée concrète, pas un détail cosmétique.

### 3.5. Kwaliti Print : un reskin, pas une sous-marque

Le mécanisme technique de thématisation est réel et propre (`[data-brand="kwaliti-print"]`, deux polices Google distinctes, palette magenta). Mais le brand bible décrit une identité "**majoritairement blanche**... accents neutres profonds... gros plans sur matières, surfaces, encres et tranches... photographie produit de haute qualité... repères techniques et de mesure" (`BRAND_ARCHITECTURE.md` §5). Ce qui est livré est l'inverse : fond noir, formes géométriques plates façon poster CMYK, zéro photographie produit ou matière. La structure de page (hero → bandeau → groupes de capacités → bande qualité → CTA final) et les composants (`Reveal`, `HeroParallax`, `MagneticButton`, formes de boutons) sont identiques à Pixel&Digital, simplement recolorés. Combiné à l'absence de rythme de mouvement distinct (3.3), l'impression nette est celle d'un habillage du même gabarit, contredisant directement la frontière fixée par le brief de direction artistique lui-même (§6).

> **Mise à jour du 25 juillet 2026 (C3 traité) :** vérification faite directement sur `src/app/(marketing)/page.tsx` : le fichier source est aujourd'hui propre, aucun octet corrompu. `mobile-home.png`/`home-check-2.png` sont des captures **antérieures** à un correctif déjà appliqué dans une session précédente (`scripts/fix-home.py`, qui a corrigé `'lexécution'` → `'l'exécution'`) ; `mobile-home-final.png` montre l'état correct actuel. Une recherche exhaustive de motifs de mojibake (`Ã©`, `â€™`, `Ã¢â‚¬...`, etc.) sur tout `src/` confirme zéro occurrence — le bug n'est **pas** en vie dans le code applicatif. En revanche, la même classe de corruption (encodage UTF-8 relu comme Windows-1252, parfois deux fois de suite) était bien réelle et active dans quatre documents de gouvernance : `docs/04-content/drafts/OWNER_REVIEW_PACKET.md`, `docs/04-content/drafts/CONTENT_TO_PAGE_MAPPING_DRAFT.md`, `docs/04-content/drafts/SERVICE_TAXONOMY_DRAFT.md` (corrompu deux fois de suite) et `docs/04-content/PIXEL_DIGITAL_SERVICE_CATALOGUE_TEMPLATE.md`/`KWALITI_PRINT_CAPABILITY_CATALOGUE_TEMPLATE.md` — corrigés par restauration ciblée des octets d'origine (vérifiée ligne à ligne via `git diff`, aucune perte). `scripts/fix-home.py` est maintenant obsolète (son correctif est déjà dans le fichier) et a été supprimé. Les captures d'écran périmées (`home-check*.png`, `mobile-home.png`, `kwaliti-check.png`, etc.) restent dans le dépôt et datent d'un état antérieur du site — à régénérer avant de les réutiliser comme preuve, elles ne reflètent plus l'état actuel de `page.tsx`. Le reste de la section 3.6 (hiérarchie mobile, etc.) reste valable, seule la lecture "bug d'encodage en direct" est corrigée.

### 3.6. Mobile — et un bug concret de rendu

Hiérarchie mobile globalement bien construite (`mobile-contact.png` : pile linéaire propre, cibles tactiles confortables). Mais deux captures du même dépôt, `mobile-home.png` et `mobile-home-final.png`, montrent **la même phrase avec deux rendus différents** : l'une en mojibake ("crÃ©dibles... Ã oublier de la stratÃ©gie Ã lexÃ©cution"), l'autre correcte ("crédibles... à oublier de la stratégie à l'exécution"). Preuve directe et reproductible d'un bug d'encodage intermittent — cohérent avec ce que révèle déjà `scripts/fix-home.py` (voir 1.6), qui rafistole un cas précis de corruption sans traiter la cause. Le bandeau défilant du hero (construit à partir d'entités HTML nommées plutôt que de caractères UTF-8 littéraux, `page.tsx:109`) montre la même corruption sur `home-check-2.png` ("RATÃ%GIE" pour "STRATÉGIE"). Sur un site francophone dont la promesse de marque est la précision, un texte français cassé et visible à l'écran est un défaut qui se voit immédiatement par n'importe quel visiteur.

### 3.7. Preuve sociale : absente, pas juste faible

Recherche exhaustive : aucun type de section "témoignage" ou "étude de cas" n'existe dans le rendu de contenu CMS (`[slug]/page.tsx:80-129` ne gère que `HERO`, `MEDIA`, `CTA`, avec un repli texte générique). Aucune trace du mot "témoignage"/"portfolio"/"case study" nulle part dans le code. Conséquence visible : la section "Ce qu'on sait faire" affiche, dans l'état capturé, uniquement "Notre catalogue arrive bientôt." (`page.tsx:144-145`) juste avant l'appel à l'action principal — zéro preuve avant l'engagement, alors que c'est le principe UX numéro un de `PUBLIC_JOURNEYS.md` ("les preuves apparaissent avant les demandes d'engagement fortes") et le sujet entier du Parcours 7.

### 3.8. Performance et SEO

`next/image` n'est utilisé **nulle part** dans l'application — toutes les images passent par `<img>` brut avec un commentaire d'exemption ESLint, donc pas de `srcset` responsive, pas de négociation de format, pas de lazy-loading par défaut, en contradiction directe avec `PIXEL_DIGITAL_VISUAL_FOUNDATIONS.md` §4. Les métadonnées sont incohérentes selon les routes (page d'accueil publique : aucun export `metadata` du tout, hérite du générique). Aucun `sitemap.ts`, aucune donnée structurée JSON-LD nulle part. `robots.ts` exclut correctement `/workspace`, `/login`, `/api` — bon point. Toutes les pages publiques utilisent `export const dynamic = "force-dynamic"` : aucune génération statique ni ISR, chaque requête refait un aller-retour Prisma — et la capture `home-check.png` montre littéralement un échec d'authentification PostgreSQL ("SASL: SCRAM-SERVER-FIRST-MESSAGE") faisant planter la page. Sans filet statique, une indisponibilité base de données fait tomber le site vitrine entier, y compris ses pages presque intégralement statiques dans le fond.

---

## 4. Recommandations — synthèse priorisée

| # | Recommandation | Priorité | Domaine | Statut |
|---|---|---|---|---|
| C1 | Combler le trou de traçabilité d'audit (publication, facturation, accès) | Critique | Sécurité/Archi | Ouvert |
| C2 | Trancher la dérive de périmètre architecturale (Organisation/Projets/Tâches/Facturation) | Critique | Archi/Gouvernance | ✅ décision documentée (ODR-025), tranche propriétaire en attente |
| C3 | Corriger le bug d'encodage UTF-8 (mojibake FR) | Critique | Qualité/Brand | ✅ traité 2026-07-25 |
| C4 | Introduire la pagination bornée sur toutes les listes | Critique | Archi/Perf | ✅ traité 2026-07-25 (listes principales) |
| C5 | Compléter le pipeline Leads/Enquiries (qualification → conversion) | Critique | Produit/UX | ✅ traité 2026-07-25 |
| C6 | Retour utilisateur explicite sur chaque mutation (fin des échecs silencieux) | Critique | UX | ✅ traité 2026-07-26 (8/8 pages) |
| C7 | Résilience du site public face à l'indisponibilité base de données | Critique | Archi/Fiabilité | Ouvert |
| C8 | Réparer la navigation mobile Kwaliti Print (menu, ancre, retour marque mère) | Critique | UX public | Ouvert |
| I1 | Command Palette + recherche globale (Cmd+K) | Important | UX Workspace | Ouvert |
| I2 | Dashboard personnalisé par rôle ("mon travail" plutôt que mur de métriques) | Important | UX Workspace | Ouvert |
| I3 | Unifier les formulaires (un seul standard, confirmations sur actions sensibles) | Important | UX Workspace | Ouvert |
| I4 | Isoler les accès Prisma dans des Query Services + centraliser badges/dates | Important | Archi | Ouvert |
| I5 | Module de preuve sociale (réalisations/témoignages) côté public | Important | Produit/UX public | Ouvert |
| I6 | Refonte de l'identité visuelle Kwaliti Print conforme à son brand bible | Important | Brand/UX public | Ouvert |
| I7 | `next/image`, sitemap, JSON-LD, métadonnées cohérentes | Important | Perf/SEO | Ouvert |
| A1 | Brancher `KineticHeading` + transitions immersives entre univers | Amélioration | UX public | Ouvert |
| A2 | États de chargement/succès systématiques (skeletons, toasts) | Amélioration | UX Workspace | Ouvert |
| A3 | Formulaire devis Kwaliti Print avec champs métier structurés | Amélioration | Produit/UX public | Ouvert |
| A4 | Modularisation de `globals.css` | Amélioration | Archi | Ouvert |
| N1 | Command Palette IA à commandes en langage naturel | Innovation | UX Workspace | Ouvert |
| N2 | Copilote contextuel invisible (triage leads, pré-remplissage devis) | Innovation | Produit/IA | Ouvert |
| N3 | Transition immersive inter-univers (View Transitions) | Innovation | UX public | Ouvert |
| N4 | Présence collaborative temps réel dans le Workspace | Innovation | UX Workspace | Ouvert |
| N5 | Module de preuve interactif pour Kwaliti Print (matières, survol vidéo) | Innovation | UX public | Ouvert |

---

## 5. Prompts prêts à l'emploi pour Claude Code

Chaque prompt est rédigé pour être collé tel quel. Il respecte le format attendu par `AGENTS.md` : contexte, objectif, périmètre autorisé, contraintes, résultat attendu — et n'autorise jamais de refactoring opportuniste hors périmètre.

### Priorité Critique

**C1 — Combler le trou de traçabilité d'audit**
```text
Contexte : SECURITY_AND_PERMISSIONS.md §7 exige un audit trail pour la publication/archivage de contenu, les changements de facturation et les actions destructrices. En réalité, src/modules/audit/application/audit-event.ts ne modélise que les 5 actions d'accès (voir AccessAuditAction) et seul src/app/workspace/access/actions.ts écrit des événements d'audit. Aucune des mutations dans site-content/actions.ts (publication/archivage/suppression de page), services/actions.ts (publication/archivage), billing/actions.ts (émission/annulation de facture, paiement) ou clients/actions.ts n'écrit de trace.

Objectif : Généraliser le module audit pour qu'il puisse représenter n'importe quel événement métier sensible, pas seulement les actions d'accès, puis instrumenter les mutations listées ci-dessus.

Périmètre autorisé :
- Étendre le type d'action dans src/modules/audit/application/audit-event.ts pour accepter des unions par domaine (ou un type générique avec un champ "domain" + "action") sans casser les usages existants côté access.
- Ajouter (si absent) un dépôt d'infrastructure pour persister ces événements, cohérent avec le pattern déjà utilisé par les autres modules (voir src/modules/access/infrastructure pour le précédent).
- Appeler l'écriture d'un événement d'audit à la fin de chaque mutation sensible listée dans site-content/actions.ts, services/actions.ts, billing/actions.ts (émission facture, annulation, paiement enregistré), après confirmation du succès de l'opération métier.

Contraintes :
- Ne pas modifier la logique métier existante des mutations, uniquement ajouter l'appel d'audit après succès.
- L'échec d'écriture de l'audit ne doit jamais faire échouer la mutation métier elle-même (logger l'échec, ne pas la bloquer) — mais ne doit pas non plus être silencieux.
- Suivre le pattern Result<T,E> déjà en place dans le projet (voir src/modules/billing/application/application-error.ts) plutôt qu'introduire un nouveau style d'erreur.
- Ajouter des tests couvrant : l'événement est bien écrit après un succès, l'action métier réussit même si l'écriture d'audit échoue.

Résultat attendu : Un module audit générique, testé, capable de tracer toute action sensible du Workspace, avec les mutations de contenu et de facturation effectivement instrumentées.
```

**C2 — Trancher la dérive de périmètre architecturale**
```text
Contexte : docs/05-architecture/DOMAIN_BOUNDARIES.md §5 liste explicitement "projets/tâches, dossiers de production, devis comme documents commerciaux, facturation, paiements, planification" comme des domaines DIFFÉRÉS nécessitant une décision de périmètre et une revue de frontière avant introduction. Or 15 des 29 modèles de prisma/schema.prisma (Department, Team, JobPosition, TeamMembership, Project, Task, Quote, Invoice, etc.) existent déjà en production de code, avec un module billing complet (domain/application/infrastructure) et des pages workspace/organization, workspace/projects, workspace/tasks qui accèdent à Prisma directement depuis les Server Components et Server Actions (14 fichiers sur 27 dans src/app/**), sans passer par une couche applicative, sans tests, et avec des vérifications de rôle dupliquées ad hoc dans chaque fichier d'actions.

Objectif : Ce prompt ne doit PAS écrire de code de refactoring immédiatement. Il doit produire un document de décision d'architecture (ADR) au format des documents existants dans docs/08-governance/, qui :
1. Documente précisément l'écart entre DOMAIN_BOUNDARIES.md et l'état réel du schéma/code (liste des 15 modèles concernés, liste des 14 fichiers en accès Prisma direct).
2. Propose 2-3 options tranchées (ex : "acter le périmètre étendu et migrer vers l'architecture DDD standard du projet" vs "geler l'existant et limiter les nouvelles fonctionnalités" vs "extraire dans un module séparé avec sa propre gouvernance"), avec pour chaque option : effort estimé, risques, ce qui doit changer dans DATA_MODEL.md et DOMAIN_BOUNDARIES.md.
3. Recommande une option avec justification technique claire, sans trancher au nom du propriétaire produit sur les aspects métier (budget, priorité commerciale).

Périmètre autorisé : Un seul nouveau fichier dans docs/08-governance/, aucune modification de code source.

Contraintes :
- S'appuyer uniquement sur des preuves du dépôt (fichiers, lignes) citées dans le document, pas sur des suppositions.
- Ne pas presenter une option comme déjà décidée.
- Respecter le format des autres documents ODR/décision du dossier docs/08-governance/.

Résultat attendu : Un document de décision exploitable par le propriétaire produit et le CTO pour trancher formellement, avant toute nouvelle fonctionnalité sur Projets/Tâches/Facturation/Organisation.
```

**C3 — Corriger le bug d'encodage UTF-8** — ✅ traité le 25 juillet 2026 : `src/app/(marketing)/page.tsx` était déjà propre (correctif d'une session antérieure) ; la corruption réelle et active se trouvait dans quatre documents de gouvernance (`docs/04-content/**`), corrigés par restauration ciblée des octets d'origine ; `scripts/fix-home.py` supprimé (obsolète). Voir la mise à jour en section 3.6. Prompt d'origine conservé ci-dessous pour mémoire — ne pas ré-exécuter tel quel.
```text
Contexte : Deux captures d'écran présentes dans le dépôt (mobile-home.png vs mobile-home-final.png) montrent la même phrase du contenu public rendue différemment : une fois en mojibake ("crÃ©dibles... stratÃ©gie Ã lexÃ©cution"), une fois correctement ("crédibles... stratégie à l'exécution"). Le bandeau défilant du hero (src/app/(marketing)/page.tsx ligne ~109, construit avec des entités HTML nommées) montre la même corruption sur la capture home-check-2.png. scripts/fix-home.py existe déjà dans le dépôt et documente un rafistolage ponctuel de ce même type de bug (réencodage latin1→utf-8 d'un fichier) sans corriger la cause racine.

Objectif : Identifier la cause racine de la corruption d'encodage (probable : contenu CMS stocké ou transmis avec un mauvais charset, ou construction de chaînes via entités HTML nommées mélangées à de l'UTF-8 littéral) et la corriger à la source plutôt que patcher le symptôme.

Périmètre autorisé :
- Inspecter la chaîne complète : d'où vient le contenu affiché (base de données via Prisma, fichier CMS, ou chaîne littérale dans le code) jusqu'au rendu HTML.
- Corriger l'encodage à la source (déclaration de charset des réponses, configuration de connexion PostgreSQL/Prisma si le problème vient de la lecture DB, ou remplacement des entités HTML nommées par des caractères UTF-8 littéraux dans le code source).
- Supprimer scripts/fix-home.py une fois la cause racine corrigée, puisqu'il devient obsolète.

Contraintes :
- Ne pas simplement remplacer les occurrences visibles du bug par du texte correct sans comprendre le mécanisme — le bug doit être structurellement impossible après la correction.
- Vérifier que la correction fonctionne aussi bien en rendu serveur qu'en rendu client (le bug semble intermittent selon les captures).
- Ajouter un test ou une vérification qui aurait détecté ce problème (ex : test de rendu vérifiant qu'aucune séquence mojibake connue n'apparaît dans le HTML généré).

Résultat attendu : Plus aucune corruption de caractères accentués français sur le site public, cause racine corrigée et documentée, script de rafistolage devenu inutile supprimé.
```

**C4 — Pagination bornée sur toutes les listes** — ✅ traité le 25 juillet 2026, avec un périmètre resserré par rapport au prompt d'origine :
- Ajouté `src/shared/pagination.ts` (utilitaire framework-agnostique : `parsePage`, `toSkipTake`, `buildPaginatedResult`, testé) et `src/app/workspace/_components/pagination.tsx` (composant `<Pagination>` réutilisable, liens `?page=`).
- Paginé les vraies listes parcourables et non bornées : Clients, Projets, Devis, Factures, Pages du site, Médiathèque, Utilisateurs (`?page=`, 20 par page).
- Tableau de bord (`workspace/page.tsx`) : remplacé le pattern "charger toutes les lignes puis compter/trancher en JS" par des requêtes `count()` bornées pour les chiffres exacts et des `findMany({take:6})` séparées pour les aperçus — même résultat affiché, sans plus jamais charger l'intégralité des projets/tâches/contenus éditoriaux du monde à chaque vue du dashboard.
- **Exclu délibérément de ce périmètre**, avec justification : Tâches (`tasks/page.tsx`, tableau kanban `TaskBoard` par projet — déjà borné par projet, la pagination casserait le glisser-déposer par position) ; Éditorial (`editorial/page.tsx`, tableau kanban `EditorialPipeline` — même raison ; un vrai correctif futur serait un filtre par fenêtre de dates, pas une pagination classique, à traiter séparément) ; Organisation (départements/postes/équipes — structure interne naturellement petite, pagination non justifiée par le principe AGENTS.md "aucune complexité sans besoin démontré").
- Non résolu dans ce lot, noté pour un futur correctif dédié : `billing/page.tsx` calcule toujours les soldes clients (`clientBalances`) et le tableau de bord calcule `sentAmount`/`paidAmount` en sommant les lignes de facture en JS sur l'intégralité des factures filtrées — une vraie agrégation, pas une liste à parcourir ; la pagination ne s'y applique pas, la bonne correction serait une agrégation SQL (`_sum`/`groupBy`) côté Prisma.
- Vérifié : `tsc --noEmit` propre, `eslint` propre, suite de tests complète (487 tests) toujours verte, 9 nouveaux tests unitaires sur l'utilitaire de pagination.

Prompt d'origine conservé ci-dessous pour mémoire — le périmètre réellement couvert diffère (voir ci-dessus).
```text
Contexte : Aucun des appels prisma.*.findMany du Workspace (32 occurrences dans src/app/workspace/**) ne borne ses résultats avec take/skip — contraire à docs/05-architecture/APPLICATION_CONTRACTS.md §7 qui exige une pagination bornée et déterministe. Concerné notamment : workspace/clients/page.tsx, workspace/enquiries/page.tsx, workspace/billing/page.tsx (clients, devis, factures, catalogue), workspace/tasks/page.tsx, workspace/organization/page.tsx.

Objectif : Introduire une pagination cohérente et réutilisable sur les listes du Workspace, en commençant par les entités les plus susceptibles de croître vite (Clients, Factures, Tâches, Enquêtes).

Périmètre autorisé :
- Créer un utilitaire de pagination partagé (paramètres page/pageSize par défaut raisonnables, curseur ou offset selon ce qui est déjà idiomatique dans le projet) dans src/shared ou l'emplacement approprié selon les conventions existantes.
- Modifier les requêtes findMany concernées pour utiliser take/skip (ou curseur) plus un compte total.
- Ajouter un composant de pagination UI réutilisable dans src/app/workspace/_components, utilisé par les pages listées.

Contraintes :
- Ne pas changer le tri ni les filtres existants, uniquement ajouter la borne de pagination.
- Les query params d'URL doivent piloter la page courante (?page=2) pour rester navigable/partageable.
- Ajouter des tests vérifiant que la borne est bien appliquée et que le total retourné est correct.

Résultat attendu : Plus aucune liste du Workspace ne charge un nombre non borné de lignes, avec un composant de pagination réutilisé de façon cohérente.
```

**C5 — Compléter le pipeline Leads/Enquiries** — ✅ traité le 25 juillet 2026 :
- Nouveau module `src/modules/leads/` complet (domain/application/infrastructure), respectant strictement la frontière `DOMAIN_BOUNDARIES.md` §2 : Leads ne mute jamais l'Enquiry d'origine, cycle `NEW → IN_REVIEW → QUALIFIED/UNQUALIFIED → CLOSED` (un seul aller, clôture définitive), assignation de propriétaire, notes, prochaines actions (créer/compléter/annuler), journal d'activité append-only.
- Migration Prisma `20260725130000_add_leads` (`Lead`, `LeadEnquiry`, `LeadNote`, `NextAction`, `LeadActivity` + 3 enums) — générée par diff schéma-à-schéma (sans dépendre d'une base vivante), appliquée et vérifiée sur une base PostgreSQL réelle (pglite), et rejouée avec succès par la suite d'intégration officielle du projet (`npm run test:integration:db`, 16 fichiers / 86 tests).
- Un formulaire public (contact général ou devis Kwaliti Print) crée désormais automatiquement un Lead `NEW` lié à l'Enquiry — idempotent (une resoumission ne duplique pas), et un échec de cette création ne bloque jamais l'accusé de réception au visiteur (conforme à la règle DOMAIN_BOUNDARIES.md : « notification failure cannot erase the submission »).
- Page `workspace/enquiries` enrichie : colonne statut du lead, panneau de détail (`?lead=<id>`) avec changement de statut, assignation, ajout de note, planification/complétion de prochaine action, historique d'activité — tout passe par la couche application (autorisation + `expectedVersion` vérifiés côté serveur), aucun accès Prisma direct depuis la page.
- Vérifié : `tsc` propre, `eslint` propre, 50 nouveaux tests unitaires (domaine + cas d'usage) + 8 tests d'intégration Prisma réels, suite complète du projet toujours verte (537 tests unitaires, 86 tests d'intégration).
- Non fait dans ce lot (hors périmètre C5) : écriture d'un événement d'audit générique pour les actions sur un lead (dépend de C1, non traité) ; dé-duplication floue par email (l'audit du domaine mentionne un dédoublonnage conservateur au-delà du simple lien par enquiryId — resterait à faire si un besoin réel apparaît) ; page dédiée `/workspace/leads` (le pipeline vit pour l'instant dans la page Enquiries, un choix délibéré pour garder le lien enquête↔lead visible).

Prompt d'origine conservé ci-dessous pour mémoire — le périmètre réellement couvert diffère (voir ci-dessus).
```text
Contexte : src/modules/enquiries n'implémente que deux cas d'usage : list et submit (voir src/modules/enquiries/application). La page workspace/enquiries/page.tsx est un tableau strictement en lecture seule (lignes 53-82). Or "traiter une demande commerciale" est explicitement l'un des parcours prioritaires du CTO (docs/03-ux/ADMIN_JOURNEYS.md ligne 118, détaillé lignes 49-60), qui décrit un cycle qualification → assignation → note/prochaine action → conversion.

Objectif : Implémenter le cycle de vie complet d'une enquête commerciale côté application et UI, dans le respect strict de l'architecture DDD déjà en place pour ce module (domain/application/infrastructure).

Périmètre autorisé :
- Ajouter dans src/modules/enquiries/domain les états et transitions nécessaires (ex : NEW → QUALIFIED → ASSIGNED → CONVERTED/CLOSED), avec des règles de transition explicites et des erreurs typées pour les transitions invalides (suivre le pattern déjà utilisé dans src/modules/billing/domain/invoice.ts pour les transitions d'état).
- Ajouter les cas d'usage applicatifs correspondants (qualifyEnquiry, assignEnquiry, addNote, convertEnquiry) avec vérification d'autorisation via enquiry-authorization.ts existant.
- Étendre workspace/enquiries/page.tsx et actions.ts pour exposer ces actions dans l'UI (assignation à un membre de l'équipe, ajout de note, changement de statut), en respectant le pattern de formulaire avec retour visuel déjà utilisé dans client-forms.tsx.
- Écrire l'événement d'audit correspondant pour chaque changement de statut (dépend de C1 si déjà fait, sinon utiliser le mécanisme d'audit access existant comme référence).

Contraintes :
- Ne pas construire une notion de "conversion en projet" complète si le module Projets n'est pas encore statué (voir C2) — se limiter à marquer l'enquête comme convertie, sans créer automatiquement un projet tant que C2 n'est pas tranché.
- Suivre strictement le pattern Result<T,E> et les tests comportementaux déjà en place dans ce module (voir submit-general-contact.test.ts comme référence de qualité de test).

Résultat attendu : Une enquête peut être qualifiée, assignée, commentée et marquée convertie/fermée depuis le Workspace, avec autorisation, traçabilité et tests couvrant chaque transition.
```

**C6 — Retour utilisateur explicite sur chaque mutation** — ✅ traité le 26 juillet 2026, 8/8 pages Workspace, en 5 commits séquentiels (un par page ou paire de pages) :
- Composant partagé `src/app/workspace/_components/feedback.tsx` (`Feedback`, `SubmitButton`, `ActionState`) — remplace les copies locales dupliquées dans `clients/client-forms.tsx` et `access/access-forms.tsx`.
- **Projects, Tasks, Editorial** : actions converties de `void` vers `useActionState`, avec `try/catch` ajouté là où il manquait. Les déplacements en glisser-déposer (`moveTaskAction`, `moveEditorialItemAction`) retournent maintenant un résultat exploitable au lieu de `void` — un échec de déplacement affiche un message au lieu de silencieusement revenir en arrière sans explication.
- **Billing, Services** : les cas d'usage applicatifs renvoyaient déjà un `Result<T, error>` typé — les actions ne faisaient que `console.error` et jetaient l'information. Corrigé pour renvoyer ce message déjà calculé à l'utilisateur.
- **Organization** : 4 des 5 actions avaient déjà le motif ; seule `endMembershipAction` restait silencieuse — corrigée, plus migration des doublons locaux `Feedback`/`SubmitButton` vers le composant partagé.
- **Site-content** : le fichier le plus à risque du lot — `actorFor()` et plusieurs règles métier (page pas en brouillon, JSON de section invalide, fichier manquant, échec Supabase) levaient une exception jamais interceptée nulle part, donc **plantaient** dans l'écran d'erreur par défaut de Next.js au lieu d'échouer proprement. Les 8 actions attrapent maintenant l'erreur et la traduisent en message clair.
- Chaque page validée séparément (`tsc`, `eslint`, suite complète) avant de passer à la suivante ; suite complète (537 tests) verte à la fin, aucune régression.

Prompt d'origine conservé ci-dessous pour mémoire — le périmètre réellement couvert (8/8 pages, remontée d'erreur typée plutôt que template générique) dépasse ce qui était esquissé initialement.
```text
Contexte : La majorité des formulaires du Workspace (projects, tasks, editorial, billing, organization, services, site-content) sont de simples <form action={...}> serveur, sans aucun état "en cours" ni confirmation visible de succès/échec — contrairement à clients/client-forms.tsx et access/access-forms.tsx qui utilisent useActionState + un composant Feedback partagé. Une mutation échouée dans organization/actions.ts, projects/actions.ts, etc. retourne silencieusement, sans que l'utilisateur ne voie jamais l'échec.

Objectif : Généraliser le pattern useActionState + retour visuel déjà éprouvé dans client-forms.tsx et access-forms.tsx à tous les formulaires du Workspace qui ne l'ont pas encore.

Périmètre autorisé :
- Extraire le composant Feedback de client-forms.tsx (ou access-forms.tsx) vers un emplacement partagé dans src/app/workspace/_components s'il n'y est pas déjà, sans changer son comportement.
- Convertir les formulaires de projects/page.tsx, tasks/page.tsx, editorial/page.tsx, billing/page.tsx, organization/*, services/page.tsx, site-content/page.tsx vers des composants client dédiés utilisant useActionState, suivant exactement le pattern de client-forms.tsx.
- Les Server Actions existantes ne doivent pas changer de signature métier, seulement retourner un état de succès/erreur exploitable par useActionState si ce n'est pas déjà le cas.

Contraintes :
- Aucun changement de logique métier, uniquement l'ajout du retour visuel et de l'état de soumission.
- Garder chaque conversion de formulaire comme un changement isolé et testable (préférer plusieurs petits commits/PRs à un big-bang si la taille du diff le justifie).
- Ajouter au moins un test par formulaire converti vérifiant que l'échec est bien affiché à l'utilisateur.

Résultat attendu : Tous les formulaires du Workspace donnent un retour visuel cohérent (en cours / succès / erreur), sur le modèle déjà validé par clients et access.
```

**C7 — Résilience du site public face à l'indisponibilité base de données**
```text
Contexte : Toutes les pages publiques (accueil, [slug], services, contact, Kwaliti Print, devis) utilisent export const dynamic = "force-dynamic" et font un aller-retour Prisma à chaque requête, sans génération statique ni ISR. La capture home-check.png montre un échec réel de connexion PostgreSQL ("SASL: SCRAM-SERVER-FIRST-MESSAGE") faisant planter la page d'accueil publique.

Objectif : Donner au site public un filet de secours qui évite une page d'erreur brute Next.js quand la base de données est indisponible, et réduire la dépendance systématique à un aller-retour DB pour du contenu qui change rarement.

Périmètre autorisé :
- Ajouter des error.tsx dédiés et soignés (pas le défaut Next.js) pour les segments (marketing) et kwaliti-print, avec un message cohérent avec la marque plutôt qu'une page d'erreur technique.
- Évaluer et proposer (sans forcément tout migrer dans ce prompt) l'usage d'ISR (revalidate) pour les pages dont le contenu ne change pas à chaque requête (accueil, pages CMS [slug], pages de service), en conservant force-dynamic uniquement là où c'est réellement nécessaire (ex : formulaires avec état serveur).
- Documenter dans docs/05-architecture/DELIVERY_AND_OPERATIONS.md la stratégie de rendu retenue et sa justification.

Contraintes :
- Ne pas casser le comportement des formulaires (contact, devis) qui doivent rester dynamiques pour la validation et le rate-limiting.
- Toute page migrée vers ISR doit avoir une revalidation cohérente avec la fraîcheur attendue du contenu CMS (à documenter, pas à deviner).

Résultat attendu : Une indisponibilité base de données dégrade gracieusement (page d'erreur de marque, pas un plantage runtime brut), et les pages à contenu stable ne dépendent plus d'un aller-retour DB à chaque requête.
```

**C8 — Réparer la navigation mobile Kwaliti Print**
```text
Contexte : src/app/kwaliti-print/_components/kwaliti-header.tsx (lignes 13-19) ne fournit aucun repli mobile — globals.css (règle @media max-width: 720px, lignes ~3258-3264) masque simplement les liens de navigation sans proposer de menu de remplacement, contrairement au header Pixel&Digital qui a un vrai menu <details>/<summary> (site-header.tsx:29-34). Confirmé par la capture mobile-kp.png : seuls le logo et le CTA "Demander un devis" restent visibles sur mobile, y compris le lien de retour vers Pixel&Digital. De plus, le lien "Possibilités" (kwaliti-header.tsx:14) pointe vers l'ancre #possibilites qui n'existe pas — la section réelle a l'id capacites-kp (kwaliti-print/page.tsx ligne 115).

Objectif : Donner à Kwaliti Print un menu mobile fonctionnel équivalent à celui de Pixel&Digital, et corriger le lien d'ancrage mort.

Périmètre autorisé :
- Répliquer le pattern <details>/<summary> de site-header.tsx dans kwaliti-header.tsx, adapté au thème visuel Kwaliti Print (couleurs/typographie déjà définies par [data-brand="kwaliti-print"]).
- S'assurer que le lien de retour vers Pixel&Digital reste accessible dans ce menu mobile, conformément à l'exigence de BRAND_ARCHITECTURE.md §8 (repère permanent et réversible vers la marque mère).
- Corriger href="/kwaliti-print/#possibilites" vers href="/kwaliti-print/#capacites-kp" (ou renommer l'id de section pour plus de clarté, au choix, mais les deux doivent correspondre).

Contraintes :
- Ne pas dupliquer bêtement le composant : factoriser la logique de menu mobile commune si cela reste simple, sinon accepter la duplication ciblée plutôt que sur-abstraire prématurément.
- Vérifier au clavier et au lecteur d'écran que le menu est utilisable (le <details>/<summary> natif est nativement accessible, ne pas le remplacer par un composant JS custom sans raison).

Résultat attendu : Un menu mobile Kwaliti Print fonctionnel avec accès permanent au retour vers Pixel&Digital, et plus aucun lien d'ancrage mort.
```

### Priorité Importante

**I1 — Command Palette + recherche globale**
```text
Contexte : Aucune recherche globale ni raccourci clavier n'existe dans le Workspace (aucune occurrence de "cmd+k", "command palette" ou équivalent dans le code). docs/03-ux/ADMIN_JOURNEYS.md (lignes 112-114) et INFORMATION_ARCHITECTURE.md (ligne 61) prescrivent une recherche globale progressive. Pour un outil utilisé 8h/jour, l'absence de navigation clavier ralentit systématiquement les utilisateurs expérimentés.

Objectif : Implémenter une Command Palette accessible via Cmd/Ctrl+K permettant de naviguer instantanément vers les pages principales et de déclencher les actions de création les plus fréquentes.

Périmètre autorisé :
- Créer un composant src/app/workspace/_components/command-palette.tsx (dialog modal, piégeage du focus, fermeture à l'Échap et au clic extérieur).
- L'intégrer dans le layout du Workspace (à côté d'AdminShell), écoute globale du raccourci clavier.
- Première version : liste statique des routes principales (Projets, Tâches, Clients, Enquêtes, Facturation, Contenu du site) filtrable par frappe, plus 2-3 actions rapides ("Nouveau projet", "Nouvelle tâche") qui naviguent vers le formulaire de création correspondant.

Contraintes :
- Ne pas construire d'indexation de recherche plein-texte dans ce prompt — se limiter à la navigation/actions statiques, en laissant la structure prête pour brancher une recherche serveur plus tard (voir I1 comme fondation, N1 comme extension IA).
- Respecter les tokens de design existants (globals.css), pas de nouvelles couleurs ad hoc.
- Accessibilité : focus trap, aria-labels, navigation clavier complète (flèches, entrée, échap).

Résultat attendu : Un composant modulaire et testé, un raccourci clavier fonctionnel depuis n'importe quelle page du Workspace, prêt à être étendu avec une recherche serveur.
```

**I2 — Dashboard personnalisé par rôle**
```text
Contexte : src/app/workspace/page.tsx (lignes 60-268) affiche des métriques et listes mondiales pour tout le monde (projets en retard, tâches bloquées, charge par collaborateur), jamais filtrées par l'utilisateur connecté — contraire à docs/03-ux/WIREFRAME_SPECIFICATIONS.md (lignes 47-48) qui demande de montrer d'abord le travail actionnable de la personne connectée (file de revue, leads assignés, prochaines actions dues) avant les métriques globales.

Objectif : Restructurer le tableau de bord pour mettre en avant "mon travail" (tâches assignées à moi, contenus que j'ai à valider, enquêtes qui me sont assignées si applicable après C5) avant les métriques globales de l'agence, qui passent en divulgation progressive (section repliable ou secondaire).

Périmètre autorisé :
- Modifier src/app/workspace/page.tsx : ajouter une requête filtrée par l'identifiant de l'utilisateur courant (déjà disponible via getWorkspaceRequestContext()) pour les tâches/contenus assignés.
- Découper le rendu en sous-composants distincts (ex : MyWorkPanel, TeamMetricsSummary) plutôt que tout garder dans un seul fichier.
- Les métriques globales existantes restent accessibles mais en dessous de la vue personnelle, ou dans une section explicitement "vue d'ensemble de l'agence" repliable par défaut.

Contraintes :
- Conserver toutes les données déjà récupérées (ne rien supprimer côté métier), changer uniquement la priorité de présentation.
- Le comportement doit rester correct pour un rôle sans tâches assignées (état vide clair, pas une page cassée).
- Ajouter un test vérifiant que la vue "mon travail" filtre bien par utilisateur et pas par le monde entier.

Résultat attendu : Un dashboard qui répond d'abord à "qu'est-ce que je dois faire aujourd'hui", avec les métriques globales reléguées en second plan.
```

**I3 — Unifier les formulaires et sécuriser les actions sensibles**
```text
Contexte : Deux conventions de formulaire coexistent (voir C6 pour le détail du retour visuel). En complément, des actions destructrices ou sensibles comme révoquer un rôle ou suspendre un utilisateur (src/app/workspace/access/access-forms.tsx, RevokeRoleForm lignes 153-164, UserStatusForm lignes 118-134) sont de simples boutons en un clic sans confirmation, alors que docs/02-product/ROLES_AND_PERMISSIONS.md (lignes 70-81) classe la modification des permissions comme nécessitant une "confirmation renforcée".

Objectif : Ajouter une étape de confirmation explicite (pas nécessairement une modale complexe — une confirmation native ou un composant de confirmation léger suffit) sur toutes les actions destructrices/sensibles du Workspace : révocation de rôle, suspension de compte, annulation de facture, archivage/suppression de page ou de service.

Périmètre autorisé :
- Créer un composant de confirmation réutilisable (ex : src/app/workspace/_components/confirm-action.tsx) — bouton qui demande une confirmation explicite avant de soumettre réellement l'action, avec un texte qui rappelle la conséquence.
- L'appliquer aux formulaires identifiés dans access-forms.tsx, et aux actions équivalentes de billing/actions.ts (annulation facture) et site-content/actions.ts (suppression/archivage de page) une fois C6 en place pour ces formulaires.

Contraintes :
- Ne pas complexifier au-delà du nécessaire : pas de librairie de modale lourde si un pattern natif (ex : confirmation avant soumission via état local) suffit.
- Garder la cohérence visuelle avec le composant Feedback introduit en C6.

Résultat attendu : Aucune action destructrice ou sensible du Workspace n'est déclenchable en un seul clic accidentel.
```

**I4 — Query Services + centralisation badges/dates**
```text
Contexte : 14 fichiers sur 27 dans src/app/** appellent Prisma directement (voir section 1.2). Séparément, au moins 6 implémentations indépendantes de formatage de date coexistent (workspace/page.tsx:332, enquiries/page.tsx:88, editorial/page.tsx:381, plus des appels inline dans billing, projects, tasks), et 8 fichiers réimplémentent leur propre table de libellés/couleurs de statut malgré l'existence de src/app/workspace/_components/status-badge.tsx.

Objectif : Réduire la duplication et améliorer la testabilité en (a) créant des services de lecture dédiés pour la présentation, sans forcément déplacer toute la logique métier si C2 n'est pas encore tranché — se concentrer sur les lectures pures (pas de business logic), (b) centralisant le formatage de date et les badges de statut.

Périmètre autorisé :
- Créer src/shared/format.ts (ou emplacement cohérent avec les conventions existantes) avec formatDate/formatDateTime/formatCurrency, utilisé partout où une implémentation locale existe actuellement.
- Étendre status-badge.tsx pour couvrir tous les types de statut utilisés dans le Workspace (projet, tâche, facture, service, contenu éditorial), et remplacer les tables de libellés locales par ce composant.
- Pour les modules déjà dotés d'une couche application (billing, content, enquiries, worlds, access) : créer des fonctions de lecture dédiées (ex : listBillingSummary) qui encapsulent les requêtes Prisma utilisées uniquement pour l'affichage, retournant des DTOs simples.

Contraintes :
- Ne pas toucher aux modules non gouvernés (organization, projects, tasks) tant que C2 n'a pas tranché leur périmètre — ce prompt se limite aux modules déjà dans src/modules/*.
- Chaque remplacement de formatage de date/badge doit être vérifié visuellement (aucun changement de format affiché à l'utilisateur, seulement de la déduplication).

Résultat attendu : Une seule source de vérité pour le formatage de date et les badges de statut, des services de lecture dédiés pour les modules déjà gouvernés, sans régression visuelle.
```

**I5 — Module de preuve sociale côté public**
```text
Contexte : Aucun type de section "témoignage" ou "étude de cas" n'existe dans le rendu CMS (src/app/(marketing)/[slug]/page.tsx lignes 80-129 ne gère que HERO, MEDIA, CTA). docs/03-ux/PUBLIC_JOURNEYS.md fait de la preuve (études de cas, témoignages) une étape nommée des parcours 1, 2, 3 et le sujet entier du parcours 7 ("visiteur orienté preuve"). docs/02-product/EVIDENCE_AND_CASE_STUDY_FRAMEWORK.md définit déjà probablement le cadre attendu — le lire avant de commencer.

Objectif : Ajouter un type de section CMS "étude de cas" et "témoignage" au système de contenu existant, avec son rendu public.

Périmètre autorisé :
- Lire d'abord docs/02-product/EVIDENCE_AND_CASE_STUDY_FRAMEWORK.md pour respecter le cadre déjà défini par la gouvernance produit (ne pas inventer un format concurrent).
- Étendre le modèle de section de contenu (src/modules/content/domain, voir page-section.ts mentionné dans le code) avec un ou deux nouveaux sectionType (CASE_STUDY, TESTIMONIAL).
- Ajouter le rendu correspondant dans [slug]/page.tsx et, si pertinent, un composant dédié dans src/app/(marketing)/_components.
- Adapter l'éditeur de contenu du Workspace (site-content) pour permettre la création/édition de ce type de section.

Contraintes :
- Respecter strictement le cadre déjà documenté dans EVIDENCE_AND_CASE_STUDY_FRAMEWORK.md (champs requis, niveau de preuve).
- Ne pas introduire de contenu factice ou d'exemple non fourni par le propriétaire produit — se limiter à l'infrastructure technique, le contenu réel reste une décision propriétaire.

Résultat attendu : Le CMS peut porter des études de cas et témoignages, rendus publiquement, prêts à être remplis dès que le contenu réel est fourni.
```

**I6 — Refonte de l'identité visuelle Kwaliti Print**
```text
Contexte : docs/01-brand/BRAND_ARCHITECTURE.md §5 décrit Kwaliti Print comme une identité "majoritairement blanche, accents neutres profonds, gros plans sur matières/surfaces/encres/tranches, photographie produit de haute qualité, repères techniques et de mesure". L'implémentation actuelle (src/app/kwaliti-print/page.tsx, hero notamment) est un fond noir avec des formes géométriques plates façon poster CMYK, structurellement identique au gabarit Pixel&Digital juste recoloré (mêmes composants Reveal/HeroParallax/MagneticButton, même rythme de section).

Objectif : Faire évoluer le hero et les sections clés de Kwaliti Print vers l'identité réellement documentée — fond clair, accents neutres, mise en avant de matière/texture plutôt que de formes géométriques abstraites — sans casser le mécanisme de thématisation par attribut data-brand déjà en place.

Périmètre autorisé :
- Modifier les styles spécifiques à [data-brand="kwaliti-print"] dans globals.css pour un fond clair/blanc et une palette d'accents neutres, en conservant le magenta comme accent signature ponctuel plutôt que dominant.
- Remplacer les formes géométriques du hero (kwaliti-print/page.tsx) par une mise en page prévoyant un emplacement pour de la photographie produit/matière réelle (avec un repli propre et honnête tant qu'aucune photo n'est fournie — pas un placeholder générique qui a l'air cassé).
- Ne pas dupliquer les composants de motion : les réutiliser, mais ajuster leurs paramètres (easing, distance, timing) si docs/03-ux/MOTION_AND_IMMERSION_GUIDELINES.md prescrit un rythme différent pour ce monde.

Contraintes :
- Ce chantier touche à l'identité de marque : présenter le résultat pour validation avant application large, ne pas le pousser comme définitif sans retour du propriétaire de marque.
- Ne pas modifier le thème Pixel&Digital dans ce prompt, périmètre strictement limité à data-brand="kwaliti-print".
- Vérifier le contraste et l'accessibilité (WCAG AA) du nouveau schéma de couleurs clair.

Résultat attendu : Kwaliti Print visuellement distinct de Pixel&Digital selon sa propre identité documentée, pas un simple reskin coloré du même gabarit.
```

**I7 — next/image, sitemap, JSON-LD, métadonnées**
```text
Contexte : Aucun usage de next/image dans tout src/app (toutes les images sont en <img> brut avec exemption ESLint). Aucun sitemap.ts. Aucune donnée structurée JSON-LD. Les métadonnées sont incohérentes : la page d'accueil publique (src/app/(marketing)/page.tsx) n'a aucun export metadata, les pages CMS [slug]/page.tsx ne définissent que le titre, kwaliti-print/layout.tsx n'a pas de description ni d'OpenGraph propre.

Objectif : Mettre le site public aux standards SEO/performance de base attendus pour un site vitrine d'agence.

Périmètre autorisé :
- Remplacer les <img> par next/image sur les images CMS et de hero, avec dimensions réservées (éviter le CLS) — vérifier la configuration next.config.ts pour les domaines d'images distants autorisés si nécessaire.
- Ajouter un export metadata ou generateMetadata cohérent (title, description, OpenGraph) sur la page d'accueil, les pages [slug], les pages de service, et le layout Kwaliti Print.
- Créer src/app/sitemap.ts générant dynamiquement les URLs publiques (pages CMS publiées, services publiés) à partir des mêmes sources que le rendu public.
- Ajouter des données structurées JSON-LD de type Organization (et LocalBusiness si pertinent) sur les pages d'accueil de chaque monde.

Contraintes :
- Ne toucher à aucune image du Workspace (interne, hors périmètre SEO).
- generateMetadata doit gérer proprement le cas où le contenu CMS n'existe pas (pas de crash, repli sur les valeurs par défaut).
- Vérifier que robots.ts continue d'exclure correctement /workspace, /login, /api du sitemap généré.

Résultat attendu : Images optimisées via next/image, métadonnées cohérentes sur toutes les routes publiques, sitemap généré dynamiquement, données structurées de base présentes.
```

### Priorité Amélioration

**A1 — Brancher KineticHeading + transitions immersives**
```text
Contexte : src/app/(marketing)/_components/kinetic-heading.tsx existe, implémente une révélation typographique mot-par-mot avec gestion de useReducedMotion, mais n'est importé nulle part ailleurs dans le code — le hero de la page d'accueil utilise un simple Reveal. docs/01-brand/BRAND_ARCHITECTURE.md §4 mentionne explicitement la typographie cinétique comme élément d'identité de mouvement Pixel&Digital. Par ailleurs, aucune transition n'existe entre les pages ou entre les univers (aucun AnimatePresence dans le code), alors que docs/03-ux/PUBLIC_JOURNEYS.md (Parcours 4) demande une transition "spectaculaire mais réversible" au changement d'univers.

Objectif : Utiliser KineticHeading sur le titre du hero de la page d'accueil Pixel&Digital, et ajouter une transition de page dédiée au changement d'univers (Pixel&Digital ↔ Kwaliti Print).

Périmètre autorisé :
- Remplacer le Reveal du titre principal dans src/app/(marketing)/page.tsx par KineticHeading.
- Ajouter un mécanisme de transition (AnimatePresence + template.tsx du groupe de routes, ou équivalent Next.js App Router) déclenché spécifiquement sur la navigation entre (marketing) et kwaliti-print via le sélecteur d'univers (world-switcher.tsx).

Contraintes :
- Respecter useReducedMotion partout — la transition doit se réduire à un changement instantané si l'utilisateur préfère moins de mouvement.
- Ne pas ajouter de transition sur la navigation interne normale (entre pages du même univers), seulement sur le changement d'univers explicite, pour ne pas ralentir la navigation courante.
- Tester la performance perçue (pas de jank, transition sous 400-600ms).

Résultat attendu : Le hero utilise la typographie cinétique déjà construite, et changer d'univers devient un moment de transition perceptible et cohérent avec la marque, réversible et accessible.
```

**A2 — États de chargement/succès systématiques**
```text
Contexte : Aucun loading.tsx ni squelette de chargement dans src/app/workspace. Aucun système de toast. Seuls les deux tableaux kanban (task-board.tsx, pipeline-board.tsx) ont un retour optimiste instantané via useOptimistic ; tout le reste se comporte en rechargement de page classique, créant une expérience incohérente.

Objectif : Ajouter des états de chargement de base (loading.tsx par route) et un système de notification de succès léger (toast) réutilisable, complémentaire au composant Feedback introduit en C6 pour les formulaires.

Périmètre autorisé :
- Ajouter des loading.tsx aux routes principales du Workspace (clients, projects, tasks, billing, enquiries, editorial, site-content) avec un squelette simple cohérent avec les tokens de design existants.
- Créer un système de toast léger (sans dépendance lourde si possible, ou une librairie légère déjà dans l'écosystème Next.js/React 19 si le projet en accepte une nouvelle — à confirmer avant d'ajouter une dépendance) pour les confirmations de succès qui ne nécessitent pas un Feedback inline permanent.

Contraintes :
- Ne pas dupliquer C6 : le toast est complémentaire au retour inline des formulaires, pas un remplacement.
- Toute nouvelle dépendance doit être justifiée et validée (le projet est actuellement très économe en dépendances — vérifier package.json avant d'en ajouter une).

Résultat attendu : Chaque navigation et chaque action a un retour visuel clair et cohérent, sans dépendance excessive ajoutée.
```

**A3 — Formulaire devis Kwaliti Print structuré**
```text
Contexte : src/app/kwaliti-print/devis/page.tsx (ligne 39) promet explicitement de recueillir "Quantité, format, matière, délai, finition", mais le formulaire réel (partagé avec le contact général via contact-form.tsx) ne contient qu'un champ message libre en plus de nom/email/téléphone — aucun champ structuré pour ces paramètres.

Objectif : Ajouter des champs structurés spécifiques au devis Kwaliti Print (quantité, format, matière, délai souhaité, finition) sans casser la réutilisation du composant de contact pour le flux Pixel&Digital général.

Périmètre autorisé :
- Étendre contact-form.tsx pour accepter un jeu de champs additionnels optionnel, activé uniquement quand worldKey correspond à Kwaliti Print (ou créer un variant dédié qui compose par-dessus le formulaire de base, selon ce qui reste le plus simple).
- Adapter le Server Action (actions.ts) et la validation correspondante pour ces nouveaux champs, en conservant le pattern d'erreurs par champ déjà en place.
- Adapter le catalogue de services si le champ "matière" ou "format" doit être piloté par une liste plutôt qu'un champ libre — vérifier d'abord si src/modules/content ou un catalogue équivalent existe déjà pour ces valeurs avant d'en inventer un nouveau.

Contraintes :
- Le formulaire de contact général (Pixel&Digital) ne doit voir aucun changement de comportement.
- Les nouveaux champs doivent rester optionnels si l'information n'est pas toujours connue au moment de la demande, mais visibles et clairement associés à leur label.

Résultat attendu : Le formulaire devis Kwaliti Print recueille réellement ce que sa propre copie promet, sans dupliquer tout le composant de contact.
```

**A4 — Modularisation de globals.css**
```text
Contexte : src/app/globals.css fait 4 846 lignes et contient des sélecteurs admin dupliqués deux fois dans le même fichier (.admin-shell aux lignes ~831 et ~4082, .admin-sidebar aux lignes ~838 et ~4086, .dashboard-metric-card aux lignes ~1945 et ~4322) — signe que le style admin a été ajouté après coup plutôt que pensé comme un système, avec un risque de divergence future.

Objectif : Découper globals.css en fichiers thématiques cohérents (tokens, site public, Workspace, composants partagés) sans changer le rendu visuel, et supprimer les définitions dupliquées.

Périmètre autorisé :
- Identifier et fusionner les règles dupliquées (.admin-shell, .admin-sidebar, .dashboard-metric-card et toute autre duplication trouvée lors de l'audit du fichier), en gardant la version la plus récente/complète.
- Découper le fichier en modules importés (ex : tokens.css, marketing.css, workspace.css) via les imports CSS natifs ou le mécanisme déjà utilisé par le projet pour les styles globaux.

Contraintes :
- Aucune régression visuelle : comparer un rendu avant/après sur les pages principales (accueil, Kwaliti Print, dashboard Workspace) avant de considérer le travail terminé.
- Ne pas renommer de classes existantes dans ce prompt (risque de casser des références dispersées) — se limiter à la réorganisation et à la déduplication.

Résultat attendu : Une feuille de style organisée en modules clairs, sans duplication, avec un rendu visuel strictement identique à avant.
```

### Priorité Innovation

**N1 — Command Palette IA à commandes en langage naturel**
```text
Contexte : I1 aura posé les fondations d'une Command Palette statique (navigation + actions rapides). Pour un outil utilisé 8h/jour par une petite équipe agence, le prochain palier naturel des SaaS modernes (Linear, Notion, Height) est une commande en langage naturel plutôt qu'une liste filtrée manuellement.

Objectif : Étendre la Command Palette de I1 pour interpréter des requêtes en langage naturel simples ("nouvelle tâche pour le projet X", "montre les factures en retard") et les traduire en navigation ou pré-remplissage de formulaire, sans prétendre à une IA généraliste.

Périmètre autorisé :
- Définir un jeu fermé d'intentions reconnaissables (créer X, aller à Y, filtrer Z) avec une résolution simple par mots-clés/patterns dans un premier temps — ne pas brancher un LLM externe sans validation explicite du propriétaire produit sur le coût et la confidentialité des données envoyées.
- Si un LLM est validé par le propriétaire : isoler l'appel dans une couche d'infrastructure dédiée (ex : src/infrastructure/shared/ai/), jamais appelé directement depuis un composant UI, avec un timeout et un repli propre vers la recherche simple de I1 en cas d'échec.

Contraintes :
- Ne jamais envoyer de données personnelles (email/téléphone client) à un service externe sans anonymisation ni validation explicite du propriétaire.
- Le repli sans IA (recherche/navigation simple de I1) doit toujours fonctionner même si la résolution en langage naturel échoue ou n'est pas activée.

Résultat attendu : Une Command Palette qui comprend des commandes formulées naturellement, avec un chemin de repli robuste et une couche IA isolée et gouvernée.
```

**N2 — Copilote contextuel invisible**
```text
Contexte : Le Workspace n'a aucune assistance intelligente. Les meilleurs SaaS 2026 intègrent l'IA de façon discrète et contextuelle (pré-remplissage, suggestion) plutôt que via un bouton "Générer avec l'IA" intrusif. Deux points d'entrée concrets déjà identifiés dans ce dépôt : le message libre du formulaire de contact/devis (une fois C5 et A3 en place) pourrait pré-remplir les champs structurés d'une enquête ; la charge de travail par collaborateur (dashboard) pourrait suggérer une meilleure assignation de tâche.

Objectif : Ajouter une suggestion contextuelle non intrusive à un point d'entrée précis — recommandé : pré-remplissage des champs qualifiés d'une enquête entrante (type de besoin, urgence estimée) à partir du message libre, présenté comme une suggestion éditable, jamais appliquée automatiquement sans validation humaine.

Périmètre autorisé :
- Isoler l'appel au modèle dans une couche d'infrastructure dédiée, avec repli sans IA si le service est indisponible (le formulaire/l'enquête doit rester pleinement utilisable sans cette fonctionnalité).
- L'UI doit toujours présenter la suggestion comme une proposition à valider (pas un remplissage automatique silencieux), avec une action explicite pour l'accepter ou l'ignorer.

Contraintes :
- Nécessite une décision propriétaire explicite avant implémentation (fournisseur IA, coût, politique de confidentialité sur les données de contact/enquêtes) — ce prompt ne doit pas être exécuté sans cette validation préalable, conformément à AGENTS.md sur les décisions propriétaires (budget, fournisseur payant).
- Aucune donnée personnelle identifiable ne doit être loguée dans les prompts envoyés au modèle au-delà du strict nécessaire.

Résultat attendu : Une suggestion IA contextuelle et optionnelle sur le tri des enquêtes entrantes, gouvernée et avec repli robuste, jamais bloquante pour l'utilisateur.
```

**N3 — Transition immersive inter-univers**
```text
Contexte : A1 introduit une transition de base au changement d'univers. Ce prompt va plus loin en utilisant la View Transitions API (supportée par Next.js App Router en configuration expérimentale/stable selon la version) pour un effet de morph réellement immersif entre l'identité Pixel&Digital et Kwaliti Print, conformément à l'exigence "spectaculaire mais réversible" de PUBLIC_JOURNEYS.md Parcours 4.

Objectif : Remplacer ou enrichir la transition Framer Motion de A1 par une transition utilisant la View Transitions API native du navigateur là où elle est supportée, avec repli propre sur le comportement de A1 sinon.

Périmètre autorisé :
- Vérifier la compatibilité de la version de Next.js du projet (16.2.10) avec la View Transitions API et son statut expérimental éventuel avant de s'engager sur cette approche.
- Implémenter la transition uniquement sur le point d'entrée du sélecteur d'univers (world-switcher.tsx), pas sur la navigation générale.
- Prévoir un repli total et invisible (l'utilisateur ne doit jamais voir d'échec ou de flash) sur les navigateurs sans support.

Contraintes :
- Ne jamais bloquer ou ralentir perceptiblement la navigation si l'API n'est pas disponible.
- Respecter useReducedMotion.

Résultat attendu : Un changement d'univers visuellement mémorable sur navigateurs compatibles, strictement identique en fonctionnalité (juste sans effet) ailleurs.
```

**N4 — Présence collaborative temps réel**
```text
Contexte : Le Workspace est un outil multi-utilisateur (rôles Admin, World Manager, Éditorial, Commerce, Contributeur) mais n'a aucune notion de présence — deux personnes peuvent éditer la même page de contenu ou le même projet sans le savoir. Les colonnes "version" présentes sur plusieurs modèles Prisma (Page, Service, Client, Project, Invoice — voir prisma/schema.prisma) suggèrent qu'un conflit d'édition concurrente est déjà anticipé côté données mais pas communiqué côté UX.

Objectif : Afficher un indicateur simple "qui regarde/édite actuellement cette fiche" sur les pages d'édition à plus fort risque de collision (édition de contenu, fiche projet), sans construire un système de collaboration temps réel complet type Figma.

Périmètre autorisé :
- Évaluer d'abord une solution simple (heartbeat périodique côté client qui enregistre "utilisateur X consulte l'entité Y" dans une table légère ou un stockage éphémère, sans introduire de nouvelle infrastructure lourde comme un serveur WebSocket dédié si le projet ne PowerShell) — respecter la règle AGENTS.md "aucune complexité distribuée sans justification".
- Afficher un simple badge "Aussi consulté par [nom]" sur la page d'édition concernée.
- En cas de tentative de sauvegarde concurrente, s'appuyer sur la colonne version déjà existante pour détecter le conflit et informer clairement l'utilisateur (pas de résolution automatique silencieuse).

Contraintes :
- Ne pas introduire de dépendance à un service tiers de collaboration temps réel sans validation explicite du coût/complexité par le propriétaire.
- La détection de conflit de sauvegarde (via version) est plus prioritaire et plus simple que l'indicateur de présence en direct — livrer les deux, mais s'assurer que la détection de conflit fonctionne même si l'indicateur de présence est désactivé.

Résultat attendu : Les utilisateurs savent quand ils éditent en même temps que quelqu'un d'autre, et un conflit de sauvegarde est détecté et signalé clairement plutôt que silencieusement écrasé.
```

**N5 — Module de preuve interactif pour Kwaliti Print**
```text
Contexte : I5 introduit le module de preuve sociale générique (études de cas, témoignages). Pour Kwaliti Print spécifiquement, dont l'identité documentée est "tactile, gros plans sur matières/surfaces/encres" (BRAND_ARCHITECTURE.md §5), une preuve purement textuelle ne suffit pas à transmettre la qualité d'impression — c'est un métier où le rendu se juge à l'œil et au grain de la matière.

Objectif : Une fois I5 et I6 en place, ajouter à Kwaliti Print un composant de preuve spécifique : aperçu vidéo ou zoom haute résolution au survol sur les visuels de réalisation, éventuellement un comparateur avant/après pour les finitions (ex : mat vs brillant, découpe standard vs sur-mesure).

Périmètre autorisé :
- Construire un composant src/app/kwaliti-print/_components/material-showcase.tsx réutilisant le type de section CASE_STUDY/TESTIMONIAL introduit en I5, avec un mode d'affichage spécifique (zoom au survol, comparateur avant/après par glissière).
- Prévoir un repli statique propre (image simple) si le média vidéo/haute résolution n'est pas disponible ou sur mobile/tactile où le survol n'existe pas.

Contraintes :
- Respecter next/image (I7) pour toute image utilisée, pas de nouvelles images en <img> brut.
- Le contenu réel (photos/vidéos de matière) reste une fourniture propriétaire — ce prompt construit l'infrastructure d'affichage, pas le contenu lui-même.
- Tester explicitement le comportement sur mobile/tactile (pas de survol) pour s'assurer qu'aucune information n'est perdue sans souris.

Résultat attendu : Un module de preuve visuel et tactile propre à Kwaliti Print, cohérent avec son identité documentée, avec repli mobile et statique robuste.
```

---

## Annexe — Méthode et limites de cet audit

Cet audit a été produit par lecture directe du code source et des documents de gouvernance du dépôt, avec trois recherches ciblées (architecture/qualité de code, UX Workspace, UX/brand site public) recoupées entre elles et avec les captures d'écran déjà présentes dans le dépôt. Il n'inclut pas d'exécution du serveur de développement ni de nouvelle session de navigation — les observations visuelles s'appuient sur les captures existantes (`home-check*.png`, `kwaliti-check.png`, `contact-check.png`, `quote-check.png`, `mobile-*.png`), dont certaines montrent explicitement un environnement de développement (indicateur Next.js visible) plutôt qu'un build de production. Les recommandations de priorité Innovation impliquant un fournisseur IA externe (N1, N2) nécessitent une décision propriétaire préalable (coût, confidentialité) avant toute implémentation, conformément à `AGENTS.md`.
