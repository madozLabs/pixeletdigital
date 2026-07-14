# Rôles et permissions — Pixel&Digital Platform

## Objectif

Définir un modèle d'accès simple, extensible et sécurisé pour le Workspace interne. Le principe directeur est le moindre privilège : chaque utilisateur accède uniquement aux données et actions nécessaires à son travail.

## Principes

- Les permissions sont attribuées à des rôles, pas directement aux utilisateurs, sauf exception documentée.
- Les actions sensibles sont journalisées.
- Les accès sont limités par univers métier lorsque nécessaire.
- La suppression destructive est réservée au Super Admin ; les autres rôles archivent.
- Les contenus suivent le cycle canonique : Brouillon, En revue, Planifié si nécessaire, Publié, Archivé. Un refus renvoie au Brouillon avec une note de revue.
- Les permissions doivent rester lisibles ; aucun rôle ne doit devenir un fourre-tout.

## Rôles du MVP

### Super Admin

Contrôle total de la plateforme : utilisateurs, rôles, paramètres, contenus, prospects, médias, univers, publications et journaux d'activité.

### Administrateur

Pilote les opérations courantes, les contenus, les équipes et les prospects, sans pouvoir modifier les paramètres critiques de sécurité ni supprimer définitivement les données.

### Responsable de marque

Gère un univers précis — Pixel&Digital, Kwaliti Print, Studio ou Formation — ainsi que ses contenus, médias, offres, réalisations et demandes entrantes.

### Éditeur

Crée et modifie les contenus éditoriaux, études de cas, services, articles, témoignages et médias. Il soumet à validation mais ne publie pas nécessairement.

### Commercial

Consulte et traite les leads, ajoute des notes, affecte des statuts, planifie les prochaines actions et transforme un prospect en opportunité qualifiée.

### Collaborateur

Accède aux informations utiles à ses missions et aux contenus ou dossiers qui lui sont affectés. Aucun accès global aux paramètres, utilisateurs ou données commerciales sensibles.

### Lecteur

Consultation uniquement sur un périmètre défini.

## Rôles métier futurs

Community Manager, Graphiste, Motion Designer, Vidéaste, Photographe, Responsable Studio, Responsable Kwaliti Print, Formateur, Responsable Formation, Finance, Freelance et Client.

Ces rôles seront introduits lorsque les modules opérationnels correspondants existeront réellement.

## Matrice MVP

| Domaine | Super Admin | Admin | Responsable marque | Éditeur | Commercial | Collaborateur | Lecteur |
|---|---|---|---|---|---|---|---|
| Utilisateurs | gérer | consulter/gérer hors super admin | non | non | non | non | non |
| Rôles et sécurité | gérer | consulter | non | non | non | non | non |
| Paramètres globaux | gérer | modifier partiellement | non | non | non | non | non |
| Univers de marque | gérer | gérer | gérer son univers | consulter | consulter | consulter | consulter |
| Pages et services | publier | publier | publier son univers | créer/modifier | consulter | consulter | consulter |
| Études de cas | publier | publier | publier son univers | créer/modifier | consulter | contribuer si affecté | consulter |
| Blog et ressources | publier | publier | publier son univers | créer/modifier | consulter | contribuer si affecté | consulter |
| Médias | gérer | gérer | gérer son univers | importer/utiliser | consulter | importer si autorisé | consulter |
| Leads et demandes | gérer | gérer | gérer son univers | consulter si autorisé | gérer | consulter si affecté | non |
| Notes commerciales | gérer | gérer | gérer son univers | non | gérer | consulter si affecté | non |
| Journal d'activité | consulter | consulter partiellement | consulter son univers | non | non | non | non |

La prévisualisation est une action, pas un état. Le passage de En revue à Publié ou Planifié est réservé au Super Admin, à l'Administrateur ou au Responsable de marque dans son univers. Planifié est optionnel ; à l'échéance, le contenu devient Publié et l'action est journalisée.

## Actions sensibles

Les actions suivantes exigent une confirmation renforcée et un journal d'audit :

- création ou suppression d'un compte administrateur ;
- modification des permissions ;
- changement des paramètres de sécurité ;
- publication ou dépublication massive ;
- export de données commerciales ;
- suppression définitive ;
- changement d'identité d'un univers ;
- modification des intégrations externes.

## Règles de périmètre

Un responsable Kwaliti Print ne voit pas automatiquement les données Studio. Un commercial global peut voir les leads de plusieurs univers si son périmètre le permet. Le Super Admin peut déléguer un accès multi-univers sans créer un rôle entièrement nouveau.

## Décision CTO

Le MVP utilisera un modèle RBAC simple, complété par un périmètre d'univers. Les permissions fines par champ ou les politiques dynamiques complexes sont reportées jusqu'à l'apparition d'un besoin réel.
