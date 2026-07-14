# Parcours internes — Pixel&Digital Workspace

## Objectif

Décrire la manière dont les équipes utiliseront la plateforme pour réduire les pertes d'information, accélérer les transmissions et rendre les responsabilités visibles.

## Principes du Workspace

- Le Workspace est un environnement de travail, pas une collection de tableaux de bord.
- Chaque utilisateur voit d'abord les actions et informations utiles à son rôle.
- Les données sont saisies une fois puis réutilisées dans les workflows autorisés.
- Les transitions importantes disposent d'un propriétaire, d'un statut et d'un historique.
- Le MVP privilégie les workflows simples et observables aux automatisations complexes.

## Parcours 1 — Super Admin

1. Se connecter de manière sécurisée.
2. Consulter la santé générale du Workspace : contenus en attente, nouveaux leads, activité récente et alertes.
3. Gérer les utilisateurs, rôles et périmètres d'univers.
4. Administrer les identités et paramètres des univers.
5. Contrôler les publications sensibles.
6. Consulter le journal d'activité.
7. Intervenir sur les erreurs de configuration ou conflits de permissions.

Le Super Admin ne doit pas devenir l'opérateur obligatoire de chaque action courante. Son rôle est de gouverner et débloquer.

## Parcours 2 — Responsable de marque

1. Ouvrir son univers.
2. Consulter les contenus, leads et indicateurs qui lui appartiennent.
3. Organiser les services, offres et réalisations.
4. Réviser les contenus soumis par les éditeurs.
5. Publier ou planifier les contenus autorisés.
6. Affecter les demandes entrantes au bon commercial ou collaborateur.
7. Suivre les actions en retard et les contenus à actualiser.

## Parcours 3 — Éditeur

1. Consulter son espace de travail éditorial.
2. Créer un contenu à partir d'un modèle structuré.
3. Ajouter les médias validés.
4. Compléter les métadonnées, le SEO et les associations avec services ou études de cas.
5. Prévisualiser dans le bon univers et sur plusieurs formats d'écran.
6. Soumettre à validation.
7. Recevoir des commentaires, corriger puis soumettre à nouveau.

L'éditeur ne peut pas casser la composition globale du site avec un constructeur de page libre.

## Parcours 4 — Commercial traitant un lead

1. Recevoir une nouvelle demande avec sa source et son univers.
2. Vérifier les coordonnées, le besoin et les pièces jointes.
3. Qualifier le lead : nouveau, à contacter, qualifié, non qualifié, gagné ou perdu.
4. Ajouter une note et définir la prochaine action.
5. Affecter ou transférer le lead si nécessaire.
6. Associer les services ou univers concernés.
7. Convertir le lead en opportunité lorsque le besoin est réel.
8. Conserver l'historique des interactions.

Le MVP ne nécessite pas encore un moteur de devis complet, mais il doit préserver la trajectoire vers ce module.

## Parcours 5 — Demande multi-univers

Exemple : un client souhaite une campagne, une vidéo et des supports imprimés.

1. Le commercial qualifie le besoin global.
2. Il associe Pixel&Digital, Studio et Kwaliti Print à la même opportunité.
3. Chaque responsable voit uniquement les éléments nécessaires à son univers.
4. Les contributions sont regroupées dans une vue de synthèse.
5. Un responsable principal reste propriétaire de la relation client.

Cette logique évite de créer trois prospects isolés pour un même client.

## Parcours 6 — Gestion des médias

1. Importer un média dans une bibliothèque partagée ou liée à un univers.
2. Ajouter titre, description, droits, auteur, projet, client et texte alternatif.
3. Générer ou fournir les variantes nécessaires.
4. Utiliser le média dans un contenu autorisé.
5. Identifier les usages avant archivage ou suppression.

Les droits d'utilisation et la traçabilité doivent être prévus dès le MVP, même si la gestion juridique avancée viendra plus tard.

## Parcours 7 — Publication

1. Création à l'état Brouillon.
2. Prévisualisation puis soumission à l'état En revue.
3. Contrôle par un rôle autorisé.
4. En cas de refus, retour à Brouillon avec une note de revue.
5. En cas d'accord, passage à Publié immédiatement ou à Planifié pour une publication différée.
6. Journalisation du changement d'état et de l'identité des intervenants.
7. Passage ultérieur à Archivé lorsque le contenu n'est plus public.

Un contenu publié doit conserver l'identité de son auteur, de son validateur et de sa dernière modification.

## Parcours 8 — Collaborateur opérationnel futur

Les modules de production futurs couvriront : brief, affectation, tâches, livrables, validation interne, validation client et clôture. Ils ne seront pas simulés par des champs génériques dans le MVP.

## Notifications MVP

Les notifications seront limitées aux événements réellement actionnables :

- contenu soumis ou refusé ;
- lead nouvellement affecté ;
- prochaine action commerciale échue ;
- changement sensible de permission ;
- échec de publication ou d'import.

Une messagerie interne complète est explicitement exclue.

## Recherche globale

La recherche devra progressivement couvrir contenus, services, études de cas, prospects et médias, avec respect strict des permissions. Elle constitue une capacité transversale importante, mais peut être livrée par étapes.

## Décision CTO

Le premier Workspace devra exceller sur trois flux : publier du contenu, traiter une demande commerciale et administrer les accès. Les workflows de production avancés seront ajoutés seulement après observation des pratiques réelles des équipes.
