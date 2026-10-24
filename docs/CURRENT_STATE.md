# PubRush - État Réel du Projet & Limitations Connues

Ce document reflète l'état exact et vérifié du dépôt et de l'infrastructure au **24 octobre 2026** suite aux corrections issues de la contre-expertise Codex.

---

## 1. Synthèse par Composant

### 🟢 Backend (`backend/`)
- **Statut** : Stable, durci et vérifié sur SQLite et PostgreSQL réel.
- **Tests** : **69 tests automatisés (`pytest`), 100% passants en ~4.6s** :
  - 57 tests initiaux.
  - 9 tests P0 (`backend/tests/test_p0_fixes.py`) : refus GPS hors started, expiration des positions (60s), fermeture des sockets terminées, purge intégrale en RAM, purge proactive périodique (`purge_expired_locations`), purge synchrone des reset tokens, fermeture immédiate des sockets d'un compte supprimé, cycle de vie complet d'un barathon.
  - 3 tests d'intégration PostgreSQL réels (`backend/tests/test_postgres_real_integration.py`) : suppression en cascade, intégrité foreign keys, relations SET NULL sur tickets, et invariant strict RGPD (aucune colonne de géolocalisation utilisateur dans le schéma SQL).
- **Cycle de vie GPS & Tâches d'arrière-plan** :
  - [`backend/app/core/lifespan.py`](file:///Users/baptistebriziou/Projects/pubrush/backend/app/core/lifespan.py) intègre `location_expiry_watcher` (cycle de 15s) purgeant proactivement les positions > 60s et émettant `FRIEND_LOCATION_EXPIRED` aux salons actifs sans attendre de snapshot.
  - Purge immédiate en mémoire vive lors de tout arrêt (`POST /{id}/stop`), complétion (`POST /{id}/finish`), retrait de participant ou suppression de compte.
- **Déploiement & CI/CD** :
  - Workflow GitHub Actions durci avec images immuables par digest (`baptistebriziou/pubrush-backend@sha256:...`) pour les conteneurs `backend` et `migration` (`initContainers`).
  - Capture du digest réel en sortie de build Docker et transmission directe au déploiement.
  - Sauvegarde préalable des références actives (y compris la résolution du digest réel de l'image ID en cours d'exécution si `:latest` était utilisé).
  - Rollback explicite des deux conteneurs sans dépendre aveuglément de `rollout undo`, avec contrôle d'intégrité de schéma Alembic (migrations additives, aucun downgrade destructif).
  - Contrôles stricts de sécurité Kubernetes : `--context` et `--namespace` transmis à chaque commande, vérification d'intégrité du cluster distant (`default`), et contrôles de convergence bloquants (0 pod terminant, pods et endpoints Ready vérifiés).

### 🟢 Mobile (`mobile/`)
- **Statut** : Complètement fonctionnel, typecheck TypeScript strict validé (`npx tsc --noEmit` à 0 erreur).
- **Environnement de Test et d'Exploitation (30 octobre)** : **Expo Go**.
  - `npx expo-doctor` validé à **100% (21/21 checks passed, aucun avertissement ni incompatibilité)**.
  - L'application communique directement en HTTPS et WSS avec `api.pubrush.com` (`EXPO_PUBLIC_API_URL=https://api.pubrush.com`).
  - **Gestion de la divergence SDK Expo Go (iPhone)** : Le propriétaire a observé que l'application Expo Go sur son iPhone indique SDK 58, alors que le projet utilise SDK 57 stable. La vérification factuelle au scan avec `npx expo start --go --tunnel` est la démarche prescrite avant toute décision (pas de migration préventive non démontrée).
- **Améliorations de synchronisation & GPS intégrées** :
  - **Remplacement complet du snapshot** : Dans [`ActiveBarathonScreen.tsx`](file:///Users/baptistebriziou/Projects/pubrush/mobile/src/features/active_barathon/screens/ActiveBarathonScreen.tsx#L301), la réception de `FRIENDS_LOCATIONS_SNAPSHOT` remplace intégralement l'état des amis (élimine tout participant expiré ou déconnecté).
  - **Effacement temps réel** : Prise en charge de `FRIEND_LOCATION_EXPIRED` pour retirer instantanément un ami de la carte.
  - **Resynchronisation REST à la reconnexion** : Dans `onOpen`, un appel systématique à `fetchBarathon` réaligne les étapes complétées, remplacées ou ajoutées pendant une perte de 4G/tunnel.

### 🟢 Web (`web/`)
- **Statut** : Opérationnel (`pubrush.com`), compilation TypeScript valide (`npx tsc --noEmit` à 0 erreur).
- **Fonctionnalités** : Landing page, mentions légales, CGU, politique de confidentialité, suppression autonome de compte (`/delete-account`), redirection des invitations, administration.

### 🟡 Infrastructure & Kubernetes (`pubrush-k8s/`)
- **Cluster actuel** : VPS K3s / Traefik v3 avec TLS Let's Encrypt.
- **Déploiement actuel en production** :
  - StatefulSet PostgreSQL avec PVC.
  - Deployment `pubrush-backend` : 2 réplicas gérés par HPA (2 à 5 pods).
- **Outillage Monopod & Rollback Sécurisé (Prêt pour validation)** :
  - Centralisé dans [`pubrush-k8s/monopod/`](file:///Users/baptistebriziou/Projects/pubrush/pubrush-k8s/monopod) :
    - [`switch-to-monopod.sh`](file:///Users/baptistebriziou/Projects/pubrush/pubrush-k8s/monopod/switch-to-monopod.sh) : bascule sécurisée avec contrôle de contexte/cluster, sauvegarde d'état horodatée (`monopod_state_*.env`), stratégie `Recreate`, HPA 1/1, attente de 0 pod terminant, vérification d'exactement 1 pod Ready et 1 endpoint Ready (IP matching), préservation stricte de `pubrush-web-hpa`.
    - [`restore-multipod.sh`](file:///Users/baptistebriziou/Projects/pubrush/pubrush-k8s/monopod/restore-multipod.sh) : rétablissement du mode nominal (2 à 5 pods, RollingUpdate) via manifest backend dédié ([`hpa-backend-nominal.yaml`](file:///Users/baptistebriziou/Projects/pubrush/pubrush-k8s/monopod/hpa-backend-nominal.yaml)) ou sauvegarde explicite, sans jamais toucher à `pubrush-web-hpa`.
    - [`rollback-backend.sh`](file:///Users/baptistebriziou/Projects/pubrush/pubrush-k8s/monopod/rollback-backend.sh) : rollback applicatif explicite des deux conteneurs (`backend` et `migration`) vers un digest ou fichier d'état sauvegardé, garantissant la conservation du mode monopod pendant l'événement sans altération Alembic destructive.
  - N'est pas encore appliqué en production, en attente de l'accord final du propriétaire.

---

## 2. Étude Technique & Limitations Résiduelles du Mode Monopod

Le passage à 1 réplica unique sur le backend FastAPI résout immédiatement le problème d'isolation des WebSockets entre participants pour la soirée du 30 octobre sans recourir à un Redis précipité.

### Analyse des Risques et Limitations
1. **Disponibilité (Point Unique de Défaillance)** :
   - En cas de crash du processus conteneur (OOM, panic), Kubernetes redémarre le pod via ses probes en 5 à 10 secondes.
   - *Mitigation active* : L'application mobile dispose d'un mécanisme de reconnexion automatique avec backoff exponentiel (1 à 15 s), d'une resynchronisation REST dans `onOpen` et d'un polling HTTP silencieux toutes les 30 secondes (`ActiveBarathonScreen.tsx:321`). La reprise s'effectue automatiquement sans intervention utilisateur.
2. **Capacité & Charge** :
   - Consommation observée d'un pod : ~75 Mo RAM, ~1% CPU.
   - Limites Kubernetes allouées : 1 000m CPU, 512 Mi RAM.
   - Capacité démontrée : > 1 500 connexions WebSockets simultanées, largement suffisante pour un barathon de 10 à 50 participants (< 5% CPU).
3. **Absence de Haute Disponibilité Multi-Zone** :
   - Le serveur est hébergé sur un unique VPS K3s. La redondance multi-zone n'existe de toute façon pas au niveau de l'infrastructure matérielle.
4. **Attention sur le retour Multi-Pod** :
   - Le script [`restore-multipod.sh`](file:///Users/baptistebriziou/Projects/pubrush/pubrush-k8s/monopod/restore-multipod.sh) rétablit la redondance d'infrastructure, mais **ne répare pas le partage des WebSockets** (qui exige Redis).

---

## 3. Procédure de Retour Arrière Vérifiée (Rollback)

### A. Rollback Backend (K8s)

1. **Rollback applicatif explicite (deux conteneurs, préservation du Monopod pendant l'événement)** :
   ```bash
   # Depuis la sauvegarde générée avant la bascule :
   ./pubrush-k8s/monopod/rollback-backend.sh --from-env pubrush-k8s/monopod/backups/latest_pre_monopod_backup.env
   
   # Ou vers un digest immuable explicite :
   ./pubrush-k8s/monopod/rollback-backend.sh --image baptistebriziou/pubrush-backend@sha256:<digest>
   ```
2. **Rétablissement du mode nominal Multi-Pod (après l'événement ou en cas de repli complet)** :
   ```bash
   ./pubrush-k8s/monopod/restore-multipod.sh
   ```

### B. Rollback Mobile (EAS Update - Syntaxe Officielle)
Sur la branche `preview` (Runtime Version 1.0.0) :

1. **Republication immédiate du groupe stable bi-plateforme (Android + iOS)** :
   ```bash
   cd mobile
   eas update:republish --group 25042505-4e4d-4f6c-97db-4a7a35d6174a --destination-branch preview --non-interactive
   ```
2. **Republication du groupe Android spécifique (Build #59)** :
   ```bash
   cd mobile
   eas update:republish --group 5df374a7-6573-46b7-885c-42a3ed3e3f42 --destination-branch preview --platform android --non-interactive
   ```

---

## 4. Commandes de Validation Vérifiées

### Backend
```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest
```
*Résultat : `69 passed in 4.63s` (SQLite et PostgreSQL réel).*

### Mobile
```bash
cd mobile
npx tsc --noEmit
```
*Résultat : Code 0 (aucune erreur).*

### Web
```bash
cd web
npx tsc --noEmit
```
*Résultat : Code 0 (aucune erreur).*
