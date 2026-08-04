# Images des sites publics

Ces deux sites (pixeldigital.com, kwalitiprint.com) sont codés en dur — plus
de médiathèque CMS à uploader. Pour ajouter une image : dépose le fichier
sous le nom exact indiqué ci-dessous, dans le bon dossier. Rafraîchis la
page, elle apparaît. Aucun redéploiement de code requis, aucun champ à
remplir ailleurs. Tant qu'un fichier n'existe pas, la section affiche un
état de substitution conçu pour ça (pas une image cassée).

Formats : `.jpg`/`.webp` pour les photos, `.mp4` pour la vidéo. Poids
raisonnable (< 2 Mo photo, < 8 Mo vidéo) — pas de compression appliquée
automatiquement.

## pixel-digital/

| Fichier | Emplacement | Type | Style |
|---|---|---|---|
| `hero/hero-bg.jpg` | Fond du hero d'accueil | Plan large, espace de travail créatif en activité | Documentaire, lumière naturelle, légèrement désaturé |
| `case-study/before-after.jpg` | Étude de cas phare | Mockup site/campagne réelle | Sobre, fond neutre, pas d'ombre exagérée |
| `bridge/kwaliti-bridge.jpg` | Section pont vers Kwaliti Print | Macro objet imprimé (tranche carte, pliage) | Contraste fort, éclairage dirigé |
| `portfolio/portfolio-1.jpg` … `portfolio-6.jpg` | Grille portfolio (6 vignettes) | Une image signature par projet | Cadrage cohérent entre les 6 |

## kwaliti-print/

| Fichier | Emplacement | Type | Style |
|---|---|---|---|
| `hero/hero-bg.mp4` (+ `hero/hero-bg.jpg` en repli/poster) | Fond du hero d'accueil | Geste de production en boucle 6–8s (massicot, presse, pliage) | Muet, contraste marqué |
| `matiere/matiere-1.jpg` … `matiere-6.jpg` | Galerie « La matière » | Macro texture papier/finition | Lumière rasante, fond neutre |
| `produits/cartes.jpg`, `produits/grand-format.jpg`, `produits/packaging.jpg`, `produits/papeterie.jpg` | Familles de produits (4 cartes) | Plan produit serré | Fond neutre ou usage réel, cohérent entre les 4 |
| `realisations/realisation-1.jpg` … `realisation-6.jpg` | Carrousel réalisations | Pièce finie, idéalement en situation | Lumière naturelle, cadrage serré |

La vidéo hero de Kwaliti Print retombe automatiquement sur `hero-bg.jpg`
pour les visiteurs en `prefers-reduced-motion`, ou si la vidéo est absente.
