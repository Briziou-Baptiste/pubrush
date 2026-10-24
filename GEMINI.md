# Configuration & Contexte Antigravity / Gemini

Ce fichier sert de point d'entrée contextuel pour Antigravity / Gemini sur le projet **PubRush**.

---

## 1. Vue d'Ensemble & Rôle
PubRush est une plateforme collaborative de gestion de barathons (FastAPI + React Native Expo + Next.js + K3s).
Pour les détails complets, reportez-vous aux documents maîtres :
- **[AGENTS.md](file:///Users/baptistebriziou/Projects/pubrush/AGENTS.md)** : Guide d'orientation et règles globales pour les agents IA.
- **[docs/PROJECT.md](file:///Users/baptistebriziou/Projects/pubrush/docs/PROJECT.md)** : Architecture et fonctionnalités.
- **[docs/CURRENT_STATE.md](file:///Users/baptistebriziou/Projects/pubrush/docs/CURRENT_STATE.md)** : État réel, environnement de test et limitations connues.
- **[docs/BACKLOG.md](file:///Users/baptistebriziou/Projects/pubrush/docs/BACKLOG.md)** : Priorités courantes.

---

## 2. Règles Opérationnelles Spécifiques
- Ne jamais modifier le code applicatif ou déclencher de déploiement sans demande explicite du propriétaire.
- Toujours valider les modifications avec :
  - `cd backend && PYTHONPATH=. .venv/bin/pytest`
  - `cd mobile && npx tsc --noEmit`
  - `cd web && npx tsc --noEmit`
- Respecter l'invariant de non-persistance des données de géolocalisation GPS.
