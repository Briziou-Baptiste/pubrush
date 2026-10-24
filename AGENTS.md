# Instructions pour les Agents IA (Codex, Antigravity, etc.)

Bienvenue sur le dépôt **PubRush**. Ce document résume les règles opérationnelles et pointe vers la documentation détaillée.

---

## 1. Documentation de Référence
Avant toute tâche d'ampleur, consultez les documents du dossier `docs/` :
- **[docs/PROJECT.md](file:///Users/baptistebriziou/Projects/pubrush/docs/PROJECT.md)** : Objectifs, fonctionnalités, architecture et composants essentiels.
- **[docs/CURRENT_STATE.md](file:///Users/baptistebriziou/Projects/pubrush/docs/CURRENT_STATE.md)** : État réel vérifié, services déployés et limitations techniques connues.
- **[docs/DECISIONS.md](file:///Users/baptistebriziou/Projects/pubrush/docs/DECISIONS.md)** : Choix d'architecture structurants (ADR).
- **[docs/BACKLOG.md](file:///Users/baptistebriziou/Projects/pubrush/docs/BACKLOG.md)** : Tâches prioritaires et arbitrages en attente.
- **[docs/store/RELEASE_CHECKLIST.md](file:///Users/baptistebriziou/Projects/pubrush/docs/store/RELEASE_CHECKLIST.md)** : Procédure de soumission et conformité pour les stores.

---

## 2. Invariants et Règles Critiques

1. **Aucun commit ou déploiement sans validation explicite** :
   - Tout push sur la branche `main` déclenche le déploiement continu en production (backend K8s) et une mise à jour EAS preview (mobile). Ne jamais pousser sur `main` sans validation de l'utilisateur.
2. **Confidentialité et Respect du RGPD** :
   - Ne jamais persister les positions GPS des utilisateurs en base de données. La diffusion GPS se fait exclusivement par WebSockets et en mémoire vive pendant un barathon actif.
3. **Conformité Apple & Google** :
   - La suppression de compte via l'API (`DELETE /me`) et la page web dédiée (`/delete-account`) doit rester opérationnelle et accessible sans l'application mobile.
4. **Sécurité des Conteneurs** :
   - Conserver l'exécution non-root sur Docker (`pubrush` UID 10000, `nextjs` UID 1001). Ne jamais commiter de secrets ou de clés API.

---

## 3. Commandes de Validation Obligatoires

Avant de proposer ou de valider une modification, exécutez les vérifications associées :

```bash
# Backend (tous les tests doivent passer)
cd backend && PYTHONPATH=. .venv/bin/pytest

# Mobile (validation stricte des types TypeScript)
cd mobile && npx tsc --noEmit

# Web (validation TypeScript)
cd web && npx tsc --noEmit
```

---

## 4. Conventions Git
- Travailler sur des branches thématiques (`feat/...`, `fix/...`, `docs/...`).
- Format des commits : [Conventional Commits](https://www.conventionalcommits.org/) (ex. `feat(mobile): add QR scanner`, `fix(backend): validate join code`).
