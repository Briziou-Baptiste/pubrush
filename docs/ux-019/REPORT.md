# UX-019 — Refonte du bilan de barathon

Date : 27 octobre 2026.
Base vérifiée : `98d977380ce026fefc9d3c5f85d0e8c90d4f4b8a` (BUGFIX-018 sur `main`).
Branche : `fix/ux-019-barathon-summary`.

## 1. Causes identifiées et corrections apportées

1. **Statut et progression** :
   - Le statut serveur enregistré (« Tournée interrompue ») est maintenant affiché avec un badge dédié et explicite (`Statut : Tournée interrompue`).
   - La progression réelle des étapes est affichée clairement (`4 étapes sur 4 — 100 %`) avec une jauge de progression élégante colorée selon le ratio.
   - L'objectif d'étapes au seuil de 70 % est affiché distinctement (`Objectif atteint — seuil requis : 70 %`).
   - Aucun statut historique n'est modifié ou requalifié automatiquement.

2. **Bouton retour** :
   - Remplacement du bloc sombre opaque de 48 × 48 pt par un bouton circulaire discret de 44 × 44 pt avec zone tactile conforme aux recommandations Apple/Android (>= 44 × 44 pt).
   - Navigation sécurisée : conservation du routage vers la source d'origine (`past`, `planned` ou repli `home`).

3. **Bouton paramètres flottant (Dev Menu FAB)** :
   - Masquage programmatique via `expo-dev-menu` (`setToolsButtonVisible(false)`) au montage du bilan, avec réactivation propre au démontage (`setToolsButtonVisible(true)`).
   - Prise en charge résiliente si le module est absent ou lève une exception (mode production, web).
   - Augmentation de l'espacement inférieur (`paddingBottom: 48`) pour éliminer tout risque de chevauchement sur petits écrans.

4. **Durée du barathon** :
   - Utilisation prioritaire des timestamps effectifs `started_at` et `ended_at`.
   - Si les timestamps sont identiques (différence de 0 ms provenant de placeholders) ou absents, affichage strict de « Non disponible » (aucun faux « 0h 0min » ni durée inventée).

5. **Distance estimée** :
   - Étiquetage honnête et précis en « Distance estimée (vol d’oiseau) » basée sur la formule géodésique de Haversine. Aucune mention trompeuse de « distance à pied ».

## 2. Références de rollback pré-déploiement

- Git stable : `98d977380ce026fefc9d3c5f85d0e8c90d4f4b8a`
- Image backend : `baptistebriziou/pubrush-backend@sha256:68572bfd2628276595245fdffa0437f4a50f24985b53a76f39912c11e422f4eb`
- Pod backend : `pubrush-backend-8fcf76999-55pnt` (1/1 Ready, HPA min=1 / max=1, Recreate)
- EAS Preview Android : groupe `9bfd60be-9483-4654-8927-06a94a326706`
- EAS Preview iOS : groupe `bb937a65-d43c-45f2-82ce-c741df249fe1`

## 3. Résultats de validation

- Tests mobiles : **PASS** (119/119 tests réussis).
- Tests backend : **PASS** (124/124 tests réussis).
- TypeScript Mobile : **PASS** (0 erreur).
- TypeScript Web : **PASS** (0 erreur).
- Fichiers non suivis (y compris `docs/photo-001/`) : **Préservés**.
