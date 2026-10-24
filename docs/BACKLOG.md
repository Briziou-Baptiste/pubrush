# PubRush - Backlog Priorisé & Décisions en Attente

Ce backlog recense les chantiers en cours, les priorités opérationnelles et les arbitrages techniques à trancher avec le propriétaire.

---

## 1. Tâches Prioritaires — Barathon du 30 Octobre 2026

### 🔴 Priorité 0 : Fonctionnement du Barathon & Conformité

**État d'avancement au 24 octobre 2026 :**

1. [x] **P0-1 — Configuration Monopod Sécurisée, Rollback Explicite & CI/CD.** `[PASS - PRÊT POUR VALIDATION]`
   - Stratégie `Recreate` et HPA (`min=1, max=1`) garantissant zéro chevauchement de pods (`pubrush-k8s/monopod/`).
   - Scripts idempotents durcis (`switch-to-monopod.sh`, `restore-multipod.sh`, `rollback-backend.sh`) avec contrôle strict du contexte et du cluster (`--context`, `--namespace`, `--expected-cluster`), sauvegarde d'état horodatée (`monopod_state_*.env`), manifest backend nominal dédié (`hpa-backend-nominal.yaml`) sans jamais toucher à `pubrush-web-hpa`, et conservation stricte du mode monopod en cas de rollback applicatif.
   - Contrôles de convergence bloquants : attente active de 0 pod terminant, vérification d'exactement 1 pod Ready, 1 endpoint Ready correspondant (vérification concordance IP pod / endpoint), stratégie `Recreate` et HPA 1/1.
   - CI/CD durcie dans `.github/workflows/deploy.yml` avec images immuables par digest (`@sha256:...`) pour les conteneurs `backend` et `migration` (`initContainers`), capture du digest produit par le build, sauvegarde des références actives, rollback explicite des deux conteneurs sans dépendance aveugle à `rollout undo`, et règle de non-destructivité Alembic.

2. [x] **P0-2 — Cycle de vie GPS & Tâche Proactive.** `[PASS]`
   - Tâche périodique proactive d'arrière-plan (`location_expiry_watcher` / `purge_expired_locations`) dans `lifespan.py` purgeant les positions en RAM à 60s et émettant `FRIEND_LOCATION_EXPIRED` sans attendre de snapshot.
   - Remplacement complet de l'état des amis côté mobile lors de `FRIENDS_LOCATIONS_SNAPSHOT` (élimine tout état fantôme).
   - Effacement en temps réel côté client et purge immédiate à la fin du barathon et au démontage du composant.
   - Validé par 6 tests ciblés unitaires + 3 tests PostgreSQL réels.

3. [x] **P0-3 — Suppression complète de compte & RGPD.** `[PASS]`
   - Purge synchrone de tous les `PasswordResetToken` associés à l'adresse email supprimée (`DELETE /me` et admin).
   - Déconnexion et fermeture immédiate (code WS 1008) de toutes les WebSockets ouvertes (`/ws/me` et salons barathons).
   - Purge intégrale des positions en mémoire vive.
   - Réassignation propre du créateur sur les barathons partagés.
   - Validé sur SQLite et sur PostgreSQL réel (relations CASCADE et SET NULL vérifiées).

4. [x] **P0-4 — Reprise WebSocket & Validation Expo Go.** `[PASS]`
   - Resynchronisation REST systématique (`fetchBarathon`) dans le callback `onOpen` de la socket lors d'une connexion ou reconnexion pour rattraper toute étape modifiée ou barathon clos pendant une perte réseau.
   - Environnement Expo Go SDK 57 validé par `expo-doctor` (21/21 checks sans erreur). Protocole de test à froid multiclient intégré.
   - Procédure de rollback OTA corrigée avec la syntaxe officielle `eas update:republish`.

5. [ ] **P0-5 — Gel et Recette sur Téléphones Réels via Expo Go.** `[EN COURS / PLANIFIÉ]`
   - **Mercredi 28 octobre (18h00)** : Gel du code et de la configuration (`1.0.0-rc1`). Revue ciblée par Codex avant déploiement K8s.
   - **Jeudi 29 octobre** : Recette complète sur smartphones réels via Expo Go (`docs/PROTOCOLE_RECETTE_29_OCTOBRE.md`, 16 parcours TC-01 à TC-16).
   - **Jeudi 29 octobre (20h00)** : Décision définitive GO / NO-GO pour le barathon du vendredi 30 octobre.

---

## 2. Décisions et Arbitrages en Attente du Propriétaire

1. **Revue Ciblée par Codex** :
   - Présentation des corrections backend (GPS, suppression, monopod) à Codex pour contre-expertise avant tout déploiement sur le cluster.
2. **Validation du Déploiement Monopod sur K8s** :
   - Autorisation d'appliquer `pubrush-k8s/monopod/switch-to-monopod.sh` sur le VPS K3s pour fixer le backend à 1 pod unique pour la recette de jeudi et l'événement de vendredi.

---

## 3. Backlog Secondaire (Post-Barathon)

### 🔵 Priorité 0 bis : Chantier Stores & Builds Natifs (Suspendu jusqu'à l'après-barathon)
- [ ] **EAS Build & Credentials** : Configuration de l'Apple Team sur le compte `pubrush-tester`, enregistrement des UDID et génération des binaires de production (`eas build --profile production`).
- [ ] **Soumission Stores** : Publication sur l'App Store et Google Play selon `docs/store/RELEASE_CHECKLIST.md`.

### 🟠 Priorité 1 : Intégration Continue Web & Qualité de Code
- [ ] **CI Web** : Ajouter un job de build et de déploiement automatique du conteneur `pubrush-web` dans `.github/workflows/deploy.yml`.
- [ ] **Nettoyage ESLint Mobile** : Résoudre les avertissements `react-hooks/set-state-in-effect` dans les composants du barathon actif (`ActiveBarathonMap`, `ReplaceOrAddStopModal`, `useActiveBarathonTracking`).
- [ ] **Nettoyage ESLint Web** : Remplacer les entités non échappées (`&apos;`) et typer les structures `any` dans les écrans admin.

### 🟡 Priorité 2 : Évolutivité Long Terme
- [ ] **Redis Pub/Sub & Limiteur distribué** : Déployer Redis pour le multi-pod scalable à grande échelle (> 1 000 utilisateurs simultanés).
- [ ] **Observabilité** : Configurer Sentry DSN et Prometheus metrics sur l'API FastAPI.
