# PHOTO-001 — Audit de préparation de Photo Mystère

Date : 27 octobre 2026, Europe/Paris. Audit et conception uniquement. **Cette mission** n'a modifié aucun code métier ni donnée utilisateur réelle, ni effectué commit, merge, push, déploiement, OTA ou abonnement. Une autre activité a modifié Git et déployé BUGFIX-018 pendant la rédaction : les deux relevés ci-dessous distinguent ces faits.

## Verdict

**NO_GO pour une activation vendredi 30 octobre dans le planning actuellement documenté.** Le MVP proposé est techniquement réalisable, mais représente **35 à 49 heures de travail et de recette**, avec plusieurs prérequis de sécurité non réalisés. Le gel du mercredi 28 à 18 h et la recette générale du jeudi sont déjà prévus dans [BACKLOG.md](../BACKLOG.md). Il serait imprudent de faire dépendre le barathon réel d'un nouveau pipeline média et d'un nouveau rollback non éprouvés.

Ce verdict ne signifie pas que la fonctionnalité est irréalisable. Une requalification est possible uniquement sur les preuves des portes G0–G7 de [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), sans raccourcir les tests de sécurité ni présumer une disponibilité humaine continue. L'absence de preuve vaut NO_GO pour l'activation ; la fonctionnalité reste désactivée. Le périmètre « MVP vendredi » est une proposition minimale de requalification, pas une promesse de livraison.

Les principaux obstacles sont :

1. Aucun stockage privé de médias n'est provisionné ou intégré au backend.
2. L'identité des invités QR n'est pas suffisamment protégée pour donner accès aux photos : le même code et pseudo permettent de récupérer la même identité invitée.
3. Les JWT WebSocket passent dans l'URL ; les logs d'Uvicorn peuvent inclure cette URL. L'absence effective de jetons dans toute la chaîne de logs reste à prouver.
4. Une migration additive nouvelle rend le rollback actuel des **deux** images vers l'ancien digest insuffisant : l'ancien Alembic ne connaît pas la nouvelle révision.
5. Ni les courses PostgreSQL, ni la chaîne photo, ni les nouveaux modules natifs ne sont testés aujourd'hui sur deux appareils.

## 1. Méthode et portée des preuves

Les mentions **Démontré** désignent une lecture du code ou une observation durant cet audit. **Non vérifié** désigne une information que ni le dépôt ni les lectures autorisées ne permettent d'établir. **Proposé** désigne un contrat à implémenter, jamais une capacité existante.

Lectures effectuées : documentation de référence, Git local, diff non commité, fichiers backend/mobile/web ciblés, dépendances installées, migrations, tests, manifests et workflow ; lectures Kubernetes ciblées ; deux requêtes SQL en transaction `READ ONLY`, limitées à la version Alembic et aux noms de tables. Aucun contenu utilisateur ni Secret Kubernetes lu. Pas de collecte de logs de production susceptible d'exposer des jetons. Les tests ont utilisé SQLite en mémoire et PostgreSQL jetable en RAM, sans accès réseau externe.

Les références de lignes ci-dessous concernent la copie locale auditée ; les symboles sont les repères durables. Le registre des preuves est inclus ici pour que le dossier reste autonome. Les sorties complètes de validation de cette session sont temporaires dans `/private/tmp/photo001-audit/` et ne sont pas un prérequis à la lecture du dossier.

## 2. Git et production : ne pas confondre les états

### État le plus récent, revérifié vers 16 h le 27 octobre

Une activité parallèle a livré BUGFIX-018 après le premier relevé. **Le point de départ le plus récent est désormais `98d977380ce026fefc9d3c5f85d0e8c90d4f4b8a`**, HEAD/main/origin-main locaux. Branche courante `fix/ux-019-barathon-summary`, avec cinq fichiers mobiles modifiés et un nouveau test UX-019 non suivi. PHOTO-001 n'a ni effectué ce changement de branche, ni ce commit, ni ce déploiement.

Lecture finale indépendante du cluster : backend1/1 Ready, Recreate ; les deux images backend/migration utilisent maintenant `sha256:68572bfd2628276595245fdffa0437f4a50f24985b53a76f39912c11e422f4eb`. L'empreinte du fichier routes en production est `7f59dcf04c2e40717ced7c763a9ca49ec07f279a3d75c71adcaa676dacc21edb`, identique à `98d9773` : **le correctif de permission finish est maintenant présent**. Le modèle reste identique à l'empreinte ci-dessous ; Alembic reste `a7b8c9d0e1f2`.

Le nouveau [rapport BUGFIX-018](../bugfix-018/DEPLOYMENT.md) rapporte workflow75 réussi et groupes EAS iOS `bb937a65-d43c-45f2-82ce-c741df249fe1`, Android `9bfd60be-9483-4654-8927-06a94a326706`, runtime1.0.0. Ce sont des **preuves rapportées par l'autre livraison**, pas des vérifications EAS directes effectuées par PHOTO-001. Le rapport laisse lui-même la recette visuelle iPhone à faire. Aucune preuve d'installation de ces updates sur les téléphones n'est déduite.

UX-019 travaille maintenant sur `_layout.tsx`, `BarathonStopSummaryScreen.tsx`, ses styles, `barathon.status.ts`, `PastScreen.tsx`. Ces fichiers recoupent les futures intégrations Photo ; relire leur version finale avant lot5. Une seconde exécution mobile a donné **118/118 tests et typecheck code0** sur cet état en cours. Ce constat n'est ni une revue UX-019 ni une validation physique.

Le contrôle d'empreintes a trouvé trois fichiers déjà modifiés au début qui ont changé à nouveau pendant la mission (summary, helper de statut, PastScreen). Aucun n'a été réécrit par PHOTO-001 ; ils ont été laissés intacts. Il n'est donc pas exact de prétendre que tout le workspace est resté byte-identique. **Les seules écritures de cette mission dans le dépôt sont les six documents `docs/photo-001/`.**

### Premier relevé, conservé comme provenance des analyses initiales

Les points suivants décrivent le début de l'audit ; leur statut Git/déploiement est remplacé par le relevé final ci-dessus lorsqu'il diffère.

**Démontré localement au premier relevé** :

- HEAD : `b61b31173f11d64f824e6412cdca16f6faad58bd`.
- Branche active : `fix/bugfix-018-invitations-deletion-results`.
- `main` et la référence locale `origin/main` pointent aussi sur ce commit. Pas de fetch ni de modification des références pendant l'audit.
- 13 fichiers suivis modifiés, 198 insertions et 115 suppressions au relevé ; tests BUGFIX-018 et nombreux rapports non suivis déjà présents. 83 fichiers modifiés/non suivis ont été fingerprintés avant rédaction. Ne pas faire `reset`, `stash`, `clean`, reformatage global ou commit englobant.
- La migration SDK 58 est dans Git : `0e53b64`, ancêtre de HEAD. `docs/CURRENT_STATE.md`, daté du 24, décrit encore SDK 57 et un ancien état multipod : ces passages sont périmés.

**Démontré sur le cluster**, contexte/namespace `default` :

- Deployment backend : 1 réplica, 1 Ready ; stratégie `Recreate` ; HPA min=1/max=1.
- Pod observé : `pubrush-backend-75b65f6fb7-c8qf8`, Running, Ready ; endpoint observé `10.42.0.200`.
- Images backend et initContainer migration : `baptistebriziou/pubrush-backend@sha256:886e41a0641e9d17d44178e680312a43f2814acf57f03454a64fc3b5889e9499`.
- Les empreintes de `app/api/routes/barathons.py` et `app/models.py` dans le pod correspondent exactement aux fichiers de `b61b311`, **pas** au changement local de `finish_barathon` :
  - routes : `62840b25fd02ed5cc460482195c0df32f818abd0fd3ed7a1dbcebfeb3011722a` ;
  - modèles : `7b0c7e6511523d6c7166eec3f9f9046e018c409f3c9d359641ca6f604ef0ce2b`.
- Révision SQL : `a7b8c9d0e1f2`. Aucune table du schéma courant dont le nom contient `photo`.
- PostgreSQL est réellement un **Deployment** `pubrush-db`, image `postgres:15-alpine`, pas le StatefulSet décrit dans certains documents. Le PVC `postgres-pvc` est Bound, 5 Gi, RWO, StorageClass `local-path`.
- Backend : seul volume déclaré `tmp-volume`, `emptyDir`. Aucun PVC photo monté.

Le connecteur GitHub a également retourné `backend/app/api/routes/barathons.py` sur `main` avec l'ancienne autorisation de clôture, blob `1498e0a6d03aa2b903e5eece5d4968cdd51701f1`. La vérification de deux fichiers du pod ne prouve pas l'identité intégrale d'une image avec un commit. Les groupes EAS et les binaires effectivement installés n'ont **pas** été revérifiés durant cet audit ; aucune affirmation de déploiement mobile BUGFIX-018 n'en découle.

### Corrections récentes présentes au premier relevé

- Invitations : refonte locale d'`InviteFriendsModal` pour éviter les modales natives imbriquées, code vide refusé, erreurs QR visibles ; [ManageParticipantsModal](../../mobile/src/features/planned/components/ManageParticipantsModal.tsx) réutilise le contenu. Non commité.
- Suppressions : changements locaux dans les listes et services pour attendre/répercuter le succès. L'endpoint serveur DELETE préexistait à HEAD. Non commité côté UI.
- Résultats : correction locale des statuts et distinction cycle de vie / objectif d'étapes, chargement de données serveur ; permissions de `finish` élargies au Maître du trajet/Capitaine. Non commité et ce changement backend est absent du pod.
- [test_bugfix_018.py](../../backend/tests/test_bugfix_018.py) et [bugfix-018.test.cjs](../../mobile/tests/bugfix-018.test.cjs) sont non suivis. Le succès des tests de la copie de travail n'est pas une preuve de leur livraison.

Ces modifications et tests ont depuis été intégrés dans `98d9773`, comme indiqué au relevé final. La vulnérabilité d'identité invitée et les besoins spécifiques Photo restent inchangés par cette livraison.

## 3. Authentification, membres et cycle de vie

### Authentification et autorisations

[security.py](../../backend/app/security.py) utilise des JWT HS256, durée 7 jours, et Argon2 via `pwdlib`. [get_current_user](../../backend/app/api/deps/auth.py) valide le jeton puis recharge le compte SQL. La suppression du compte invalide donc les futurs appels authentifiés même si le JWT n'a pas expiré. Aucun mécanisme de sessions révocables par jeton n'a été trouvé.

[get_barathon_with_access](../../backend/app/api/deps/barathons.py) accepte créateur, participant **ou admin global**. Il n'est pas adapté tel quel à une photo réservée aux membres : PHOTO-001 doit avoir une dépendance dédiée, sans lecture automatique pour un admin extérieur, et refuser les invités par la valeur SQL `User.is_guest`.

[models.py](../../backend/app/models.py:124) : participation unique `(barathon_id, user_id)`, identifiant de lien, rôles `creator/participant/co_host`, date d'arrivée. Les rôles ludiques sont distincts dans `barathon_participant_roles`. Les permissions de gestion du trajet sont basées sur créateur ou certains noms de rôles. Elles ne doivent pas définir les droits du jeu.

### Risque d'usurpation d'invité — démontré par le code et le test existant

[join_barathon_as_guest](../../backend/app/api/routes/barathons.py:1221) ne requiert pas d'authentification. Lorsqu'un invité du barathon porte déjà le pseudo demandé, le code réutilise son `User`, puis signe un nouveau JWT pour lui. [test_join_guest_rejoin_same_barathon](../../backend/tests/test_barathon_guest_invitation.py) vérifie explicitement que deux appels avec le même code/pseudo récupèrent le même identifiant ; ce test est dans la suite passée durant l'audit.

Conséquence pour PHOTO-001 : accepter indistinctement tous les membres permettrait à un détenteur du code de se présenter comme un invité éligible. **MVP proposé : comptes non invités uniquement, ajoutés via les flux authentifiés existants.** Aucune conversion automatique invité → compte. Si la soirée doit absolument fonctionner avec les invités QR pour ce jeu, NO_GO tant que leur réauthentification n'est pas corrigée et auditée. La vulnérabilité préexistante mérite une correction séparée ; elle n'est pas exploitée sur des utilisateurs réels ici.

Le QR est généré via `api.qrserver.com` avec le lien d'invitation en paramètre. Ce service connaît donc le code. Ne jamais réutiliser cette chaîne pour une photo, un jeton ou un lien média. Le code d'invitation n'est pas un secret d'authentification photo.

### Cycle de vie effectif

- États SQL : `planned`, `started`, `completed`, `stopped`, `failed` ; il n'existe ni statut SQL `active`, ni statut `deleted`.
- Démarrage : `/start` et `/assign-roles-and-start`, créateur/admin selon la route ; `started_at` et `has_started`.
- Fin normale : `/finish` → `completed`. Arrêt : `/stop` → `stopped`. La dernière étape n'équivaut pas à une nouvelle clôture implicite de Photo Mystère : raccorder les routes de cycle de vie réellement utilisées.
- [barathon_status_watcher](../../backend/app/services/barathon_service.py) fait passer les `planned` non commencés à `failed` après 15 minutes de retard. Pas de clôture automatique d'un `started` à `end_datetime` démontrée.
- Suppression : DELETE physique, cascades SQL/ORM ; fermeture des sockets. Aucun tombstone métier existant.
- Retrait d'un membre : créateur/admin, interdiction de retirer le créateur ; suppression du lien et du rôle, purge GPS, fermeture de sa socket de salon. Pas d'endpoint générique de départ volontaire trouvé. Le bouton « Quitter » du header active actuellement l'arrêt : ne pas l'interpréter comme un simple départ individuel.
- Suppression de compte : [_delete_user_data](../../backend/app/main.py:353) réattribue les barathons partagés ou les supprime, retire les liens et reset tokens ; `/me` et la suppression admin appellent cette logique. PHOTO-001 doit s'y raccorder avant les cascades.

## 4. Temps réel, notifications et mobile réutilisables

[WSManager](../../backend/app/websocket/manager.py) conserve connexions et positions en mémoire. `/ws/me` et `/ws/barathons/{id}` sont authentifiés par `?token=...`. Le salon vérifie l'appartenance à la connexion, refuse les états terminaux et revalide les émissions GPS. Le broadcast de salon ne revérifie pas chaque destinataire avant chaque envoi.

Événements existants vérifiés dans [websocket_service.py](../../backend/app/services/websocket_service.py), [ws.py](../../backend/app/api/routes/ws.py) et [webSocker.types.ts](../../mobile/src/features/active_barathon/types/webSocker.types.ts) : `BARATHON_STARTED`, `BARATHON_STOPPED`, `BARATHON_LIST_REFRESH`, `BARATHON_NEXT_STEP`, remplacements/ajouts d'étapes, `BARATHON_PARTICIPANT_JOINED`, messages GPS et expiration. Le type mobile prévoit aussi des variantes dont il ne faut pas présumer une émission systématique. `finish` réutilise notamment `BARATHON_STOPPED`.

Pas de journal d'événements durable, replay, accusé de réception ou garantie de livraison. [lifespan.py](../../backend/app/core/lifespan.py) fournit le modèle de tâche périodique avec arrêt propre. Le watcher GPS purge à 60 s, toutes les 15 s. Ce modèle est réutilisable, pas sa mémoire comme source de vérité des votes.

[webSocket.service.ts](../../mobile/src/features/active_barathon/services/webSocket.service.ts) maintient deux singletons, ping 15 s, reconnexion progressive 1–15 s. Reconnecter depuis un nouvel écran ferme la socket de salon précédente. **Ne pas créer une socket Photo par écran.** Le layout gère `/ws/me`, l'écran actif le salon. [ActiveBarathonScreen](../../mobile/src/features/active_barathon/screens/ActiveBarathonScreen.tsx) refetch le barathon dans `onOpen` et vérifie sa fin toutes les 30 s. Étendre par un store Photo indépendant et des invalidations REST.

Réutilisables avec adaptation limitée : Expo Router, `SafeArea`, styles/boutons du header actif, guards de navigation, `SecureStore` et écoute du changement de session, helper JSON authentifié, `expo-image`, callbacks WS. Le helper JSON force `Content-Type: application/json` : **ne pas l'utiliser pour les octets photo**. Le cache et la file de [offlineSync.service.ts](../../mobile/src/features/active_barathon/services/offlineSync.service.ts) concernent les étapes ; n'y ajouter ni photos, ni réponses différées.

[activeBarathonNotifications.service.ts](../../mobile/src/features/active_barathon/services/activeBarathonNotifications.service.ts) programme des rappels locaux de fin d'étape. Aucun registre de push tokens ni envoi push backend trouvé. Ce n'est pas une notification collective de défi. Socle proposé : bannière dans l'application, invalidation WS et badge dérivé de REST, avec récupération au retour au premier plan.

Les « missions » sont des descriptions de rôles. Aucun moteur de réponses, gages, scores photo ou résultats individuels persistants n'a été trouvé. Ne pas réutiliser l'objectif historique de 70 % d'étapes pour calculer le jeu.

## 5. Expo SDK 58 et nouvelles dépendances

[package.json](../../mobile/package.json) : Expo `^58.0.0`, React Native `0.88.0`, React `19.3.0`, TypeScript `~6.0.3`, `expo-image ~58.0.17`, `expo-notifications ~58.1.6`. Le catalogue installé `expo/bundledNativeModules.json` annonce caméra `~58.0.12`, image-manipulator `~58.0.15`, image-picker `~58.0.10`, file-system `~58.0.11`.

Pas de capture photo, de permission caméra/photos dans `app.json`, ni de dépendance directe caméra/picker/manipulator. `expo-file-system` est transitif : le déclarer directement si importé. Le mot « camera » dans les rôles ou la carte n'est pas une capture ; le scanner de l'écran événements comporte une simulation.

MVP proposé : `expo-camera`, `expo-image-manipulator`, `expo-file-system` direct ; `expo-image` existant. Caméra uniquement, pas de galerie. Les docs SDK 58 indiquent la disponibilité de [Camera](https://docs.expo.dev/versions/v58.0.0/sdk/camera/), [ImageManipulator](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/) et [ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/) dans Expo Go. Cela ne prouve pas leur fonctionnement sur les appareils de vendredi. Les permissions natives et nouveaux modules exigent un binaire compatible ; une OTA ne les ajoute pas à un ancien binaire EAS.

Les [notifications SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) excluent le push distant d'Expo Go Android depuis SDK 53 ; la [FAQ des development builds](https://docs.expo.dev/develop/development-builds/faq/) recommande les builds dédiés pour le push. Aucune promesse de notification système pour l'essai. Vérifier le client Expo Go réellement installé ; les pages Expo relatives à sa distribution évoluent et ne remplacent pas une recette physique.

Backend : `python-multipart` et `cryptography` existent, mais aucun décodeur/réencodeur d'images ni SDK S3. **Pillow** est une nouvelle dépendance à épingler sur une version maintenue compatible Python 3.11 ; vérifier ses avis de sécurité au moment de l'installation. Le simple contrôle du MIME n'est pas un pipeline média.

## 6. Stockage, base, CI et monopod

Pas d'upload, `StaticFiles`, `FileResponse` photo, bucket S3, fournisseur média, politique de cycle de vie ou purge média trouvés dans le périmètre inspecté. Cela ne prouve pas l'absence d'un compte de stockage hors dépôt. Aucun inventaire de facturation effectué.

Le PVC PostgreSQL de 5 Gi ne doit pas devenir le dossier photo du backend. La proposition est un **PVC privé séparé sur l'infrastructure existante**, sous conditions de capacité, chiffrement, exclusion des sauvegardes, droits Unix et rétention ; comparaison détaillée dans [ARCHITECTURE.md](ARCHITECTURE.md). Le stockage temporaire actuel perdrait les photos à chaque remplacement de pod.

[backend-deployment.yaml](../../pubrush-k8s/backend-deployment.yaml) impose UID 10000/GID 10001, racine en lecture seule, `/tmp` writable, limites 1 CPU/512 Mi. Le manifeste de base reste multipod/RollingUpdate : ne pas le réappliquer aveuglément. Les overlays/scripts monopod et l'état réel font foi pour l'exploitation actuelle. Aucun benchmark photo n'existe. Les affirmations anciennes de capacité WS ne mesurent pas le coût du décodage d'images.

[traefik-middlewares.yaml](../../pubrush-k8s/traefik-middlewares.yaml) déclare 10 MiB maximum et 2 MiB de buffering mémoire, plus un débit global par IP (100/min, burst 50). Non suffisant comme contrôle photo : limiter avant parsing et éviter le spill des originaux sur disque ; tester les téléphones derrière un même NAT. La configuration effective de Traefik, ses logs, ses sauvegardes et le chiffrement du disque n'ont pas été audités intégralement.

Les modèles SQLAlchemy sont synchrones ; ne pas bloquer la boucle asyncio avec du décodage CPU. Les états existants utilisent souvent des datetime UTC naïfs : les nouvelles tables doivent employer `timestamptz` et leurs propres conversions UTC explicites.

Alembic a une tête unique `a7b8c9d0e1f2`. Les fichiers au titre apparemment dupliqué `a234f451c325` et `cd06f254cf8b` sont des no-op ; ce n'est pas une erreur de double création. Un `upgrade head` depuis une base PostgreSQL vide a réussi durant l'audit.

[deploy.yml](../../.github/workflows/deploy.yml) : push main → tests → image Docker → backend → deux EAS preview. Pas de filtre de chemins : même un push documentaire déclenche la chaîne. Python CI 3.9 contre Docker 3.11 ; les tests PG peuvent être ignorés si aucune base n'est disponible. Pas de job obligatoire de typecheck mobile/web, de test de concurrence PG ou de branche/PR dans ce workflow. Ces lacunes sont des dépendances de livraison PHOTO-001, pas une invitation à refondre toute la CI.

[rollback-backend.sh](../../pubrush-k8s/monopod/rollback-backend.sh) remet backend ET migration à l'ancien digest. Après une nouvelle révision PHOTO-001, l'ancien initContainer peut échouer sur une révision inconnue. Il faut préparer et tester un digest de repli qui connaît le schéma et conserve la purge, avec le jeu désactivé. « Additif » ne suffit pas à rendre ce rollback sûr.

## 7. Résultats de validation de l'existant

Exécutés le 27 octobre sur la copie de travail, donc avec BUGFIX-018 local :

- Backend : **121 passed, 3 skipped, 6,80 s**. `.venv/bin/pytest -q -p no:cacheprovider`, `PYTHONPATH=.`, `DATABASE_URL=sqlite:///:memory:`, dotenv désactivé, JWT de test ; cible PG volontairement inaccessible pour ne toucher aucune base existante.
- PostgreSQL : **3 passed, 0,14 s**, après `alembic upgrade head` sur PostgreSQL 15 jetable en RAM, image locale existante, réseau Docker sans sortie ; backend monté read-only. Conteneur ensuite arrêté et supprimé. Les trois tests existants ne testent pas la concurrence Photo.
- Mobile : **109/109**, `node --test tests/*.test.cjs` ; majorité de contrats/helpers/inspection de source, pas des tests UI natifs.
- Mobile : `npx --no-install tsc --noEmit`, code 0.
- Web : `npx --no-install tsc --noEmit --incremental false`, code 0 ; incremental désactivé pour ne pas réécrire le cache du projet.

Contrôle final après évolution parallèle du mobile : `npx --no-install tsc --noEmit`, code0 ; suite mobile **118 passed, 0 failed**, incluant les nouveaux tests locaux UX-019. Le backend et ses modèles n'ont pas changé par rapport au contenu local déjà testé au premier relevé ; aucune répétition de la suite PG n'était nécessaire pour ces changements UI.

Non exécutés : recette caméra physique, essais photo, tests de charge photo, tests de course photo, contrôle EAS installé, simulation rollback après migration Photo. Aucune de ces capacités n'existe encore. Les tests ci-dessus sont une **baseline**, pas une validation de PHOTO-001.

## 8. Risques de non-régression ciblés

- Création/confirmation et QR : mêmes fichiers d'écrans déjà modifiés ; conserver les guards et modales BUGFIX-018, ne pas ajouter une seconde navigation automatique.
- Cycle de vie/suppression : intégrer les annulations avant commit et les purges après, sans empêcher la suppression d'un compte en cas de panne média.
- Résultats/missions : DTO et tables séparés ; aucun impact sur les 70 % d'étapes, les dépenses ou les rôles.
- GPS : aucun champ GPS de participant, EXIF exclu des objets stockés, tâches Photo isolées du watcher GPS.
- WebSockets : pas de seconde socket singleton ; notification privée ciblée, jamais image/réponse dans les messages de salon.
- Performance : borner uploads, décodage et stockage ; aucune file d'attente non bornée, pas de transaction gardée pendant le transfert réseau.
- Migrations/CI : PostgreSQL réel et rollback testés avant main ; ne pas exécuter la suite PG sur une base utilisateur.
- Expo : modules et permissions natifs vérifiés par appareil ; ne pas partager la même runtimeVersion OTA entre binaires incompatibles.

## 9. Incertitudes à lever avant toute activation

Identité et région contractuelles de l'hébergeur, accès opérateurs, DPA/sous-traitance, chiffrement disque/etcd, politique de snapshots, restauration et purge : **non vérifiés**. [web/legal](../../web/src/app/legal/page.tsx) mentionne Vercel/AWS tandis que l'API est opérée via ce cluster VPS ; ce texte ne prouve ni le fournisseur ni le lieu du VPS. La politique actuelle ne décrit pas les photos et promet des suppressions trop absolues pour la future chaîne média. Les informations exactes doivent être validées, pas inventées.

Voir [SECURITY-RGPD.md](SECURITY-RGPD.md) pour les garanties testables et les limites ; [TEST_PLAN.md](TEST_PLAN.md) pour les preuves attendues ; [PROMPT_ANTIGRAVITY.md](PROMPT_ANTIGRAVITY.md) pour l'exécution future.
