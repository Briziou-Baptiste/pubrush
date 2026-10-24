# PubRush - Présentation et Architecture du Projet

## 1. Vision et Objectifs
**PubRush** est une application collaborative mobile et web dédiée à l'organisation, au suivi et à la convivialité des barathons (tournées des bars entre amis ou lors d'événements partenaires).

L'application résout les frictions classiques des sorties en groupe :
- Définition d'un parcours optimisé (temps réel, algorithme TSP, tracé piéton OSRM).
- Synchronisation continue du groupe en temps réel (WebSockets, localisation en direct sur la carte, détection d'arrivée).
- Gestion des aléas de la soirée (remplacement ou ajout dynamique de bars, mode sous-sol hors-ligne).
- Gestion simplifiée des dépenses (qui paie quoi, calcul des remboursements).
- Événements partenaires sponsorisés avec filtres dynamiques, génération de billets et QR codes.

---

## 2. Fonctionnalités Clés

### Application Mobile (`mobile/`)
- **Création et personnalisation de parcours** : sélection manuelle ou auto-génération intelligente de bars selon un point de départ, rayon et critères, optimisation du parcours (TSP piéton via OSRM).
- **Suivi en direct (Active Barathon)** :
  - Carte interactive fluide avec étapes numérotées et recentrage intelligent.
  - Hystérésis GPS pour intérieur / mode sous-sol pour éviter les sauts de géolocalisation intempestifs.
  - Affichage en temps réel des amis connectés via WebSocket.
  - Remplacement ou ajout dynamique d'étapes en direct.
- **Invitations et rôles** : invitation spontanée via QR Code et `join_code`, support des utilisateurs invités (`is_guest`), attribution de rôles festifs (ex. Capitaine, Trésorier).
- **Comptabilité de groupe** : ajout des dépenses par étape, sélection des bénéficiaires et calcul automatique des soldes.
- **Historique & Sauvegardes** : parcours planifiés, favoris et barathons passés.

### Back-office et Portail Web (`web/`)
- **Portail public** : landing page, conditions générales (CGU), politique de confidentialité et mentions légales.
- **Conformité App Store & Google Play** : page dédiée à la suppression de compte en libre-service (`/delete-account`).
- **Deep links** : redirection et intégration d'invitations (`/join/[code]`).
- **Dashboard Admin & Partenaires** (`/admin`) :
  - Gestion des utilisateurs (promotions admin, blocages).
  - Gestion des événements partenaires et sponsors (spots, dates, quotas).
  - Génération de billets sécurisés avec QR Codes.
  - Statistiques d'usage et métriques d'inscription.

### API Backend (`backend/`)
- API RESTful FastAPI avec documentation Swagger automatique (`/docs`).
- Système d'authentification robuste (JWT, Argon2, gestion des sessions, réinitialisation de mot de passe par code email temporaire).
- Passerelle WebSocket avec gestionnaire de présence (`WebSocketService`, `ConnectionManager`) pour synchroniser en direct la position GPS et les événements du barathon.
- Limiteur de débit applicatif (`InMemoryRateLimiter`) et en-têtes de sécurité HTTP.

---

## 3. Structure du Dépôt (Monorepo)

```
pubrush/
├── backend/          # API FastAPI, SQLAlchemy 2.0, Alembic, WebSockets
│   ├── app/          # Code applicatif (api, core, models, schemas, websocket)
│   ├── alembic/      # Migrations de base de données PostgreSQL
│   └── tests/        # Suite de tests automatisés pytest (57 tests)
├── mobile/           # Application React Native Expo (Expo SDK 57, Expo Router)
│   ├── src/          # Écrans, composants, hooks, contextes et logiques métiers
│   └── assets/       # Ressources graphiques, logos et icônes
├── web/              # Application Next.js 16 (App Router, Tailwind CSS, Leaflet)
│   └── src/app/      # Pages publiques, suppression de compte et dashboard admin
├── pubrush-k8s/      # Manifestes Kubernetes (Traefik, PostgreSQL, Backend, Web, HPA)
├── docs/             # Documentation d'ingénierie et conformité stores
│   └── store/        # Politiques de confidentialité, métadonnées iOS & Android
├── .github/          # Workflows CI/CD GitHub Actions (déploiement automatisé)
└── docker-compose.yml# Environnement local PostgreSQL + Backend
```

---

## 4. Technologies et Dépendances Majeures

| Composant | Stack / Outils | Rôle |
| :--- | :--- | :--- |
| **Backend** | Python 3.11, FastAPI 0.128, SQLAlchemy 2.0, Pydantic v2 | API haute performance, sérialisation et validation stricte |
| **Base de Données**| PostgreSQL 15, Psycopg 3, Alembic | Stockage relationnel et versioning du schéma |
| **Temps Réel** | WebSockets natifs (`websockets 15.0`) | Diffusion d'événements et positions GPS entre participants |
| **Mobile** | React Native 0.86, Expo 57, Expo Router, Reanimated, react-native-maps | Application multiplateforme iOS / Android |
| **Web** | Next.js 16.4 (standalone), React 19, Tailwind CSS v4, Leaflet | Vitrine, suppression de compte et back-office partenaires |
| **Infra & Déploiement**| K3s/Kubernetes, Traefik v3, Docker multi-stage, EAS Update | Hébergement VPS, résilience, rolling updates et OTA mobile |

---

## 5. Invariants et Règles d'Or du Projet

1. **Confidentialité GPS & Données personnelles** :
   - Les coordonnées GPS des utilisateurs ne sont jamais stockées de manière permanente dans la base de données.
   - La diffusion GPS n'intervient que de façon éphémère via WebSockets et uniquement pendant un barathon actif.
2. **Conformité stricte avec les Stores (Apple & Google)** :
   - La suppression de compte doit impérativement rester accessible sans l'application via le Web (`/delete-account` appelant `DELETE /me`).
   - L'autorisation de localisation reste strictement restreinte au premier plan ("when in use").
3. **Sécurité des conteneurs & K8s** :
   - Exécution non-root obligatoire dans les images Docker (`pubrush` UID 10000, `nextjs` UID 1001).
   - Les secrets ne doivent jamais être commités dans Git (utiliser `.env` et les K8s Secrets).
4. **Intégrité CI/CD** :
   - Tout push sur la branche `main` déclenche le déploiement automatique sur le cluster K8s et sur le canal EAS preview.
   - Ne jamais pousser sur `main` sans validation préalable des tests locaux (`pytest` et `tsc`).
