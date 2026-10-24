# PubRush - Registre des Décisions d'Architecture (ADR)

Ce document consigne les choix structurants pris sur le projet, leur contexte et leurs justifications pour guider les futurs développements.

---

### ADR-01 : Architecture Monorepo
- **Décision** : Regrouper le backend FastAPI, l'application mobile Expo, le site web Next.js et les manifestes Kubernetes dans un seul dépôt Git.
- **Raison** : Simplifie l'alignement des contrats d'API (DTOs, modèles, endpoints), unifie la gestion de version et centralise la CI/CD pour une équipe resserrée.

---

### ADR-02 : Confidentialité et Traitement Éphémère du GPS
- **Décision** : Ne jamais stocker l'historique complet des positions GPS des utilisateurs en base de données.
- **Raison** : Respect strict du RGPD et des politiques de confidentialité d'Apple et Google. La localisation en direct n'est diffusée qu'en mémoire vive via WebSockets aux participants d'un même barathon en cours, et s'interrompt dès la fin de la session.

---

### ADR-03 : Choix de FastAPI, SQLAlchemy 2.0 et Psycopg 3
- **Décision** : Utiliser Python 3.11 avec FastAPI asynchrone, SQLAlchemy 2.0 en mode déclaratif typé et le pilote PostgreSQL Psycopg 3.
- **Raison** : Performance élevée, documentation OpenAPI/Swagger native, validation stricte des données avec Pydantic v2, et compatibilité avec l'écosystème de tests `pytest`.

---

### ADR-04 : Expo SDK 57 et Expo Router pour le Mobile
- **Décision** : Migrer sur Expo 57 avec Expo Router (routage basé sur le système de fichiers) et Expo Application Services (EAS).
- **Raison** : Mises à jour Over-The-Air (OTA) immédiates via EAS Update pour corriger des bugs critiques sans repasser par le processus complet de validation des stores. Unification du code iOS et Android.

---

### ADR-05 : Next.js 16 Standalone pour le Web
- **Décision** : Déployer le front web avec Next.js 16 configuré en `output: "standalone"`.
- **Raison** : Réduit l'empreinte de l'image Docker de plus de 1 Go à moins de 180 Mo en n'embarquant que les dépendances nécessaires. Permet d'héberger le back-office admin, la landing page et la page obligatoire de suppression de compte sur la même plateforme.

---

### ADR-06 : Traefik v3 et Conteneurs Durcis sur Kubernetes
- **Décision** : Gérer le routage d'entrée avec Traefik v3 (CRD Kubernetes) et exécuter tous les conteneurs sous des utilisateurs non-root dédiés (`pubrush` UID 10000, `nextjs` UID 1001).
- **Raison** : Traefik gère automatiquement les certificats Let's Encrypt TLS et offre des middlewares natifs efficaces (compression, limitation de débit, buffering anti-DDoS, en-têtes HTTP de sécurité). L'exécution non-root limite l'impact en cas de compromission.

---

### ADR-07 : Stratégie de Transition WebSockets & Rate Limiting (In-Memory -> Redis)
- **Décision** : Conserver pour la phase actuelle une gestion en mémoire vive (`InMemoryRateLimiter` et `ConnectionManager`), puis basculer vers Redis lors de l'activation du multi-pod intensif.
- **Raison** : Réduit les coûts et la complexité d'exploitation initiale. La transition vers Redis Pub/Sub est déjà anticipée dans l'architecture modulaire du backend.
