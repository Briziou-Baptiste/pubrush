# PHOTO-001 — candidat figé pour le 30 octobre 2026

Statut : **BLOCKED pour la livraison en production**, code et migration validés.

- Base distante vérifiée : `main@aa70e6330172bddb87b95f876e23cbdca8c7318f`.
- HEAD local inchangé : `ae74d7f0c128fa082d9d8101267742ed14fe792e`.
- Empreinte SHA-256 de la sélection source : `9f36634f47eacfd894c258f8bb281903cb823d040a910dbc466f709a1b7bf37f`.
- 53 fichiers diffèrent de main. Aucun commit, tag, push, OTA, build EAS ou déploiement effectué.
- Le candidat est une sélection figée des sources, pas la totalité du worktree sale.
- Les trois modules Photo auparavant non suivis et les deux fichiers de tests montés sont inclus.

## Validation

- Backend : 197 PASS, 0 FAIL, 0 SKIP, PostgreSQL 15.19 isolé, migrations et seed réels.
- Mobile : 149 PASS, 0 FAIL, 0 SKIP, sur dépendances réinstallées depuis le lock.
- Scripts de déploiement : 27 PASS. TypeScript mobile/web et build web : PASS.
- Les types Expo standard ignorés par Git sont régénérés avant le typecheck autonome.
- PostgreSQL : rôle applicatif non superutilisateur, 19 index, 24 contraintes, DML autorisée sur les 7 tables Photo.
- La production utilise PostgreSQL 15.18 ; les tests portent sur le même majeur 15.
- Les premières erreurs de lancement provenaient du harnais Linux (venv et URL Alembic), corrigé sans changer les sources.

## Périmètre exact

### backend

- `backend/alembic/env.py` — SHA-256 `f5b2a4098369f692305b5454545fa48ab694693bc6314ff7748ddbeb6e1f366f`
- `backend/alembic/versions/b1c2d3e4f5a6_add_photo_mystery_tables.py` — SHA-256 `8108ec2fae87baea98910e37c83757322b6beb9caac26b1594f49b2193ea95b6`
- `backend/app/api/routes/barathons.py` — SHA-256 `7e762dcf2858a13918fa374cb2c2bf73646fcc037dd54a144e82bdfc2f83d789`
- `backend/app/api/routes/photo_mystery.py` — SHA-256 `07189c2281e610909dc7ded3370424feba9a5477b6da4ce2c67b537d0f789f54`
- `backend/app/core/lifespan.py` — SHA-256 `7fba1e1bec8c20ec1cd150b53511ae96d017fe2dbe2516377af346630fa54ee2`
- `backend/app/core/logging_filter.py` — SHA-256 `1177212618ecbbdc4734aa50c956927758fdbe70aa516edb742e4c1c8eb76bb7`
- `backend/app/main.py` — SHA-256 `e904140bfe085c7ab13174a9261cc373210fdff309fc8da522e1583ed1d8902e`
- `backend/app/models.py` — SHA-256 `062c297fa9649962e736405ed5ceccd477600fcb017bc05843c8da33ac87f818`
- `backend/app/photo_models.py` — SHA-256 `1c6bc00c127542bd13d1449975c270745ffb85c027eb35c47a15cfc826737fb1`
- `backend/app/photo_schemas.py` — SHA-256 `684a4c203c3cc59e0b6f79c98e893b2793cdac0b6893f3b690cd1f16d1d69fd8`
- `backend/app/security.py` — SHA-256 `5bbe1670f2f0068ad62cb88214d5c5d58e2c8e258a040686f865fb34f27b3b93`
- `backend/app/services/photo_processor.py` — SHA-256 `f7f96e5e21298333f5d4617699fbeae0e9f3df37d6dba6f3ac34b2837797a1bf`
- `backend/app/services/photo_purge.py` — SHA-256 `6c3cd01e30106b3f4addaf5ff61747bd75416853e99f5d3f67e5d7e9acbd5aac`
- `backend/app/services/photo_service.py` — SHA-256 `f01954f404c948a1f0e0d554ebbaab649f8fba36c22a890d72b5988358270660`
- `backend/app/services/photo_storage.py` — SHA-256 `59e457c70b19b4fd1d9ef511f0dd7e06edc385fc5fa420f61fb511433aa8c01f`
- `backend/app/websocket/auth.py` — SHA-256 `85f14f8d3a05f2c2fd41f67df3eff221ea68eda278c6d84e9dd20f92bb60e519`
- `backend/requirements.txt` — SHA-256 `05ee960094e39aeb9207073076bca462f658caf2fab8d320027a0fe0760646d4`

### mobile

- `mobile/package-lock.json` — SHA-256 `9b393a06e8b7d950f1d2a8e8ab14285fd73fe4c079424b10e58a5dcd3ff2ed2b`
- `mobile/package.json` — SHA-256 `c74af5118c528d92070508906bc0c9cfbf4d86eada7f3970ad65524a92f292a7`
- `mobile/src/features/active_barathon/components/ActiveBarathonHeader.tsx` — SHA-256 `61b14399575849218736e09b036c4cf74bb8cbba78405a572f1b293783546a15`
- `mobile/src/features/active_barathon/components/PhotoMysteryModal.tsx` — SHA-256 `f67c58619a6328276493eb5914442f06fe812d052f02aba23fb0da1aab5bb6dd`
- `mobile/src/features/active_barathon/screens/ActiveBarathonScreen.tsx` — SHA-256 `e5bfdef113e60d3779574149db54e930bd0b85a81627fd365fa8294f4cf27900`
- `mobile/src/features/active_barathon/services/photoMysteryEvents.ts` — SHA-256 `a762eeb16cebcf102ca233018d3359eb134a8a31c0edbbcd6e8db2debc896e82`
- `mobile/src/features/active_barathon/services/photoMysteryService.ts` — SHA-256 `9fd6689e5e4d46f4f683f1374b967054de15f460f19fe441e79710575288cac0`
- `mobile/src/features/active_barathon/services/webSocket.service.ts` — SHA-256 `f4e101f3949219c42e97b39b74a9aa2a26c4850003e7d215d4364de3fccada03`
- `mobile/src/features/active_barathon/types/photoMystery.types.ts` — SHA-256 `95bd1f672d9e9bf118cd3d002d81af9e9cadbd41d586f2f9b7f81f35383f9da5`
- `mobile/src/features/active_barathon/types/webSocker.types.ts` — SHA-256 `eeed79c7ddde5ed377d4a806d46308639a5c4202eac910701b339e40f6c10a32`
- `mobile/src/features/active_barathon/utils/photoMysteryPayload.ts` — SHA-256 `43cff1dc74fe287cd352d9fb8875961a33fac45654455d5dcc51aa7393dd3ff0`
- `mobile/src/features/active_barathon/utils/photoMysteryState.ts` — SHA-256 `cecef2573b4e7fa688d8f31d5f302db5acdcec51c5d189ce0dc0818b72d221c3`

### web

- `web/Dockerfile` — SHA-256 `6ab795757de591eaa9ba9e2af08cd01fb006ebbd9702d8ba23fbefc5cf4cd046`
- `web/next.config.ts` — SHA-256 `5380aa21fe36b86d40bee638b6c7eefd2cc98bbc9fd0401e238418c7fd3bf828`
- `web/src/app/photo-capture/page.tsx` — SHA-256 `2857180e7b00c476cd36fc7b8a26866d13b5328a3941879ff19a06edb7eeb433`

### deployment

- `pubrush-k8s/backend-deployment.yaml` — SHA-256 `1342465855c17a80ec64749dab161edca3711a3d030bdeda3ca009e1183e0212`
- `pubrush-k8s/monopod/deployment-common.sh` — SHA-256 `beb4036031cd5af2110a2890d057ffe7d25f8d149f73c138e1e02b84eb213171`
- `pubrush-k8s/monopod/rollback-backend.sh` — SHA-256 `59c98d1714d0a77dd923d1cb6d7409fb322888544939faaef181fe2a75b1d389`
- `pubrush-k8s/pubrush-config.yaml` — SHA-256 `072f67451d44478e73f7144e4fc61c926b743c1df38a9486859e19738f9bb4e4`
- `pubrush-k8s/pubrush-secrets.template.yaml` — SHA-256 `94908af0e6ecb078c495e86fea263603e37ba65ab82542f4830183777d5d0e30`

### tests

- `backend/tests/test_alembic_staging_isolation.py` — SHA-256 `06eefac3b28698694a625251c2b9536d440c2b5a173ace1a443076362fa14d71`
- `backend/tests/test_barathon_guest_invitation.py` — SHA-256 `2b23c7513be51672934fb6f59fac6aab05373e052e830c446763adc1214dfdcf`
- `backend/tests/test_photo_adversarial_pg.py` — SHA-256 `06e80eec72f3212f8172d6f4218538fdcf3a9f6158f8ce1284cf49988b0616bf`
- `backend/tests/test_photo_alembic.py` — SHA-256 `92ff512835ab9bc171ad6b23c9213091ac27ba20a7252a2ccd0f4b00d34268aa`
- `backend/tests/test_photo_codex_blockers.py` — SHA-256 `db0cac3f399dc27c7172562a24ffc51c175211e591f9ae294d8b31acb02381b5`
- `backend/tests/test_photo_game.py` — SHA-256 `530091de560d95599419793dce58f9dc68f69e2b4c00767b8863a9621ef0ae4f`
- `backend/tests/test_photo_security.py` — SHA-256 `d6dfd2ab98c42bc7d501e7842e3558735f3277363d6d4831f5e78a863a367444`
- `backend/tests/test_photo_staging_seed.py` — SHA-256 `85710db6f684d3b5a1091f15fe2efbee96c8577da06d04c6cb0d12475a4aa745`
- `backend/tests/test_photo_storage.py` — SHA-256 `623dd92b4236d2ec90f3e9aa5e5d5d77a0aa4673b31cc1c2fbdea6029f40d3c1`
- `mobile/tests/bugfix-018.test.cjs` — SHA-256 `7e560c26467c716703ed39ddb49628c78f4b94a016d1b1a8377ef7af97f919ac`
- `mobile/tests/helpers/photoMysteryHarness.cjs` — SHA-256 `6e769e4f29758c1c0b5b7c7ad34115ed927b5cc24ac2645e89ff3bbb8403295e`
- `mobile/tests/photo-001-p1.test.cjs` — SHA-256 `d7ecbdef4d299b4527b44b984f5739157d527a2d3b0dd85ffca601886252cf20`
- `mobile/tests/photo-sync-mounted.test.cjs` — SHA-256 `914d00121f20ef2b1a5031cddf5e3c58b2037cd0ba930c6fca87d176260c19b4`

### staging-tooling

- `backend/scripts/seed_staging_photo.py` — SHA-256 `b7a80870b8ec023c74e343b6a46a6185df216df185780d4091c02fc85340d984`
- `pubrush-k8s/staging/docker-compose.staging.yml` — SHA-256 `de9ef50c82252265f3b39479b9e93fc2c3a8606b0ce9ab56eb286c97767d3de5`
- `pubrush-k8s/staging/staging.sh` — SHA-256 `5848eda216a843dba2a46ef8fe0adfb48a99db829e601dccd84ff32f3d89e026`

## Exclus de la sélection locale

- `backend/app/main.py (staging CORS regex only; HEAD kept)`
- `mobile/src/features/auth/screens/LoginScreen.tsx`
- `mobile/src/features/auth/screens/RegisterScreen.tsx`
- `mobile/src/lib/authStorage.ts`
- `mobile/metro.config.js`
- `mobile/src/components/MapMockWeb.tsx`
- `mobile/src/components/SecureStoreMockWeb.ts`
- `web/AGENTS.md`
- `scripts/player_b_cli.mjs`
- `private .env, captured media and historical local reports`

Les outils staging déjà versionnés restent dans Git pour la reproductibilité ; ils ne doivent pas être appliqués à la production et ne sont pas copiés dans les images runtime.

## Utilisation des pièces

- `candidate-vs-main.patch` : diff complet contre la référence stable.
- `candidate-vs-head.patch` : sélection locale exacte, applicable à l’index après autorisation ; contrôle `git apply --cached --check` réussi sans modifier l’index.
- `SOURCE_HASHES.json` : empreintes de toutes les sources de l’export, hors fichiers générés et node_modules.
- `prepared-not-applied/` : paramètres d’exploitation proposés, non appliqués et distincts des sources figées.
- `OPERATIONS.md` : sauvegarde, séquençage et rollback tenant compte d’Alembic.
- Aucun prompt de livraison immédiate : les prérequis de production ne sont pas satisfaits.
