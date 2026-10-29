# PHOTO-001 — Plan exécutable et décision de livraison

## 1. Décision, charge et chemin critique

**Verdict au 27 octobre 2026 : NO_GO pour activer Photo Mystère vendredi dans le calendrier actuellement documenté.** Ce n'est pas un refus d'implémenter ultérieurement : le dossier décrit un MVP cohérent, mais aucun pipeline média, ACL Photo, test de concurrence ou rollback après migration Photo n'existe aujourd'hui. BUGFIX-018 a été intégré et son backend déployé en parallèle pendant la rédaction (`98d9773`, relevé final d'AUDIT.md) ; des modifications locales UX-019 recoupent maintenant les écrans concernés.

Estimation pour une personne maîtrisant déjà FastAPI, PostgreSQL et Expo, avec assistance de développement et infrastructure accessible : **35–49 h de travail effectif**, marge d'incertitude incluse dans les fourchettes, mais hors attente d'autorisation, disponibilité des appareils et imprévu contractuel fournisseur.

- Conception détaillée appliquée/modèle : 4–5 h.
- Stockage/upload sécurisé : 7–10 h.
- API métier et intégration cycle de vie : 4–6 h.
- Temps réel/resync : 2–3 h.
- Interface mobile et compatibilité native : 5–7 h.
- Tests sécurité/non-régression : 6–8 h.
- Recette deux appareils : 4–6 h.
- Préparation/déploiement contrôlé/rollback : 3–4 h.

Soit développement lots1–5 **22–31 h**, automatisation critique **6–8 h**, recette humaine **4–6 h**, opérations **3–4 h**. Un build natif nécessaire, un stockage objet à créer ou une correction de l'identité invitée ajouterait plusieurs heures à plusieurs jours, non inclus. Aucune ressource humaine additionnelle ni travail continu de nuit n'est présumé.

Chemin critique : identité/périmètre validé → stockage privé et purge → schéma/transactions → API → appareil réel avec capture/auth image → course/revocation/rollback vérifiés → recette complète → autorisation explicite de livraison. Les fixtures/UI sur mocks peuvent être préparées pendant certains travaux, mais ne suppriment ni l'intégration ni les tests réels.

Le backlog prévoit gel **mercredi 28 à 18 h**, recette générale jeudi, décision **jeudi 29 à 20 h**. La charge ci-dessus dépasse une fenêtre de travail ordinaire avant ce gel. **Ne pas déplacer ce gel ou réduire la recette générale implicitement pour Photo.** La décision raisonnable à ce stade est de préparer la fonctionnalité désactivée pour une livraison ultérieure et de préserver la soirée.

### Requalification exceptionnelle, sur preuves seulement

Si une capacité réelle permet malgré tout d'achever le MVP sans déstabiliser les correctifs prioritaires, l'auditeur peut réévaluer le verdict :

- **G0, avant début d'implémentation** : base Git propre à ce lot et responsabilités connues ; périmètre comptes non invités, objets seuls, absence de galerie/push accepté dans la notice ; absence de coût/souscription.
- **G1, au plus tard mercredi 28 à 12 h** : stockage privé réellement provisionnable, capacité/clé/sauvegardes/hébergeur établis, test autorisation/revocation et purge de bout en bout en qualification ; deux clients SDK58 disponibles. Sinon arrêter la candidature vendredi.
- **G2, mercredi 28 à 18 h** : gel du candidat complet, migrations et retour arrière qualifiés, tests automatiques P0 passants. Aucun simple prototype UI ne valide ce jalon.
- **G3, jeudi 29 avant 16 h** : recette deux appareils terminée, régressions critiques corrigées et suites concernées rejouées.
- **G4, jeudi 29 avant 18 h** : sécurité opérationnelle, notice, DPA/hébergement/sauvegardes, logs et screening AIPD documentés ; pas de blocage juridique/opérationnel présumé réglé.
- **G5, jeudi 29 à 20 h** : décision finale documentée, opérateur disponible, digests/versions exacts et rollback prêts ; autorisation utilisateur distincte avant toute publication/déploiement.
- **G6, après livraison autorisée, avant activation** : postchecks monopod/health/migration/compatibilité mobile réussis, flag encore off.
- **G7, avant essai** : autorisation d'activer pour le seul barathon ciblé, tous appareils installés/chargés et notice comprise ; aucun correctif risqué le vendredi pendant la soirée.

Un seul gate manquant, test critique ignoré ou stockage/auth incomplet → **NO_GO photo**. Les heures ci-dessus sont des coupes de décision, pas une réservation implicite de personnes ni une automatisation programmée.

## 2. Deux périmètres

### A. MVP candidat vendredi

Caméra uniquement, objets sans personnes, comptes non invités (2–20), un défi publié, question courte et 2–4 choix, 3 min, réponse unique/Passer, clôture serveur, gage facultatif sans alcool, photos privées courtes, retrait/purge, bannière et badge dans l'app, resync REST, test de concurrence PG, feature flag/allowlist, repli compatible.

**Canal d'essai proposé : Expo Go SDK58 réellement validé sur les deux téléphones.** Ne pas assimiler à une distribution EAS preview : les binaires preview installés ne sont pas établis compatibles avec les nouveaux modules. L'essai dépend de la disponibilité effective du bundle/Metro sur les appareils ; cette disponibilité fait partie de REAL et G7. Si un nouveau build payant ou une souscription devient nécessaire, ne pas le lancer : conserver le NO_GO jusqu'à décision distincte.

Les utilisateurs QR invités continuent à participer au barathon mais pas au jeu. Si ce compromis ne correspond pas à l'essai souhaité, le MVP décrit ne satisfait pas la soirée : corriger l'auth invité dans un lot séparé, sans l'ajouter furtivement au chemin critique.

### B. Version ultérieure

Galerie avec sélection minimale et politique tiers, invitations à identité renforcée, builds natifs distribués, push APNs/FCM testés avec opt-in, stockage objet privé si justifié, historique enrichi explicitement retenu, statistiques/classes de scores volontaires, animations, plusieurs défis simultanés, modération/signalement et AIPD réévalués. Pas de réutilisation des photos pour classement ou reconnaissance de personnes sans une décision produit/juridique nouvelle.

## 3. Préparation de la base et protection du travail existant

Avant code : relire `AGENTS.md`, les six documents PHOTO-001, status/diff/log et les corrections BUGFIX-018. Archiver un inventaire d'empreintes des changements existants, sans recopier de secrets. Ne pas commiter, stasher, réinitialiser, supprimer ou déplacer ces changements. Ne pas réutiliser `main` comme branche de travail.

Créer une branche thématique `feat/photo-001` dans un checkout isolé de la **base explicitement retenue**, si possible. Le dernier HEAD observé inclut BUGFIX-018 (`98d9773`) mais pas les modifications UX-019 en cours : ne pas supposer qu'un worktree créé depuis HEAD les inclut. Relire les nouvelles références au début du lot, faire des changements ciblés compatibles, puis présenter les conflits/dépendances à l'intégration finale ; ne pas fusionner des travaux tiers pour rendre son lot vert. L'autorisation future « implémenter Photo » ne vaut pas autorisation de commit/déploiement ni de publication des correctifs existants.

## 4. Lots ordonnés

### Lot 1 — Contrats métier et données — 4–5 h

**Objectif** : figer règles, DTO explicites, contraintes, timestamps UTC, audience liée à participation, idempotence et registre média qui survit aux cascades.

**Fichiers probables** : `backend/app/models.py`, nouveaux `app/photo_schemas.py`, `app/services/photo_mystery_service.py`, `app/api/deps/photo_mystery.py`, `backend/alembic/versions/<nouvelle_revision>_photo_mystery.py`, premiers tests Photo. Mise à jour des documents si un détail technique est précisé, sans assouplir une règle silencieusement.

**Dépendances** : G0, tête Alembic connue, compte non invité, base Git protégée. Les quotas d'auteur doivent survivre à la suppression d'un barathon, voir `photo_rate_events` dans ARCHITECTURE.

**Acceptation** : migration additive depuis `a7b8c9d0e1f2`/tête courante retenue ; uniques de défi publié/draft/réponse/résultat ; permissions non héritées du bypass admin ; corps stricts ; aucune réponse correcte dans un DTO pré-clôture.

**Tests** : OPS-01, BIZ-01/02/03/04/05, SEC-03/04. PG vide et PG au head, écritures SQL volontairement invalides.

**Risques** : ambiguïté entre lien courant et simple user_id, quotas contournés par delete, caches ORM avant lock, états JSON souples, erreur de timezone.

**GO** : schéma et DTO vérifiables, tests de contraintes passants. **NO_GO** : plusieurs têtes, migration destructive, snapshot réadhésion ambigu, permission déléguée au client.

### Lot 2 — Stockage privé et upload — 7–10 h

**Objectif** : pipeline borné, réencodage propre, chiffrement, écriture atomique, accès protégé et purge durable.

**Fichiers probables** : nouveaux `app/services/photo_storage.py`, `app/services/photo_image_worker.py`, `app/core/photo_settings.py`, `app/services/photo_cleanup.py`, `backend/requirements.txt`, `backend/Dockerfile` si dépendances nécessaires, manifests dédiés `pubrush-k8s/photo-001/` (PVC, configuration, middleware upload, modèle de Secret sans valeur), `app/core/lifespan.py` pour purge. Ne pas éditer un Secret réel dans Git.

**Dépendances** : lot1 pour registre et droits, capacité/PVC/hébergeur/snapshots vérifiés ; aucune souscription S3 ; crypto existante, nouvelle dépendance Pillow épinglée et avis de sécurité vérifiés.

**Acceptation** : aucune URL publique ; aucun original durable ; rôle admin extérieur refusé ; MIME réel + limites bytes/pixels + métadonnées éliminées ; CPU hors event loop ; suppression immédiatement logique et <60s physique en service normal ; retries après crash ; échec stockage coupe Photo seulement.

**Tests** : SEC-01/02/05–10/13–17, OPS-03/04/05/08. Corpus synthétique, scan disque, marqueurs logs, injection d'erreurs SQL/unlink et perte de worker.

**Risques** : spill Traefik, images décompressées dans le parent, clé et snapshot coprésents, volume local-path non réellement limité, nonce réutilisé, thread timeout qui continue, purge perdue par cascade.

**GO** : démonstration bout en bout privée avec purge et ressources bornées. **NO_GO** : bucket/URL publique, signature non révocable, stockage/sauvegardes inconnus, clé insuffisamment protégée, fuite EXIF, crash du monopod. Ne pas remplacer ce lot par « photo dans /tmp et on verra ».

### Lot 3 — API et cycle de vie atomique — 4–6 h

**Objectif** : création/publication, réponse/abstention unique, finalisation atomique et raccords complets aux suppressions.

**Fichiers probables** : nouveau `app/api/routes/photo_mystery.py`, service/DTO du lot1, `app/main.py` (router, gestion erreurs Photo, `_delete_user_data`), `app/api/routes/barathons.py` (finish/stop/delete/remove), `app/core/lifespan.py` (échéances), `app/services/websocket_service.py` pour le point d'émission après commit.

**Dépendances** : lots1–2, base contenant la version retenue de BUGFIX-018. Ne pas changer les permissions existantes de finish hors ce qui a été autorisé dans le lot correctif ; éviter les conflits avec UX-019 côté récapitulatif.

**Acceptation** : contrat ARCHITECTURE exhaustif, auteur dérivé JWT, transactions courtes, résultat unique, rétention vérifiée à la lecture, retry stable, départ/fin/suppression gérés avant commit ; compte supprimable si stockage indisponible.

**Tests** : SEC-01–04/10–12, BIZ-05–10/13, NR-03/04/05/08. Courses PG indépendantes avec ordres de commit contrôlés.

**Risques** : verrou Python tenant lieu de transaction, `now()` périmé après attente, deadlock entre compte/barathon, réponse tardive acceptée, sérialisation ORM secrète, nouveau résultat après fin.

**GO** : API testable complètement sans UI, aucune incohérence sous concurrence. **NO_GO** : test SQLite seul, défaut de révocation, conflit non maîtrisé avec travail existant, cascade qui perd la purge.

### Lot 4 — Temps réel et resynchronisation — 2–3 h

**Objectif** : notification dans l'application sans garantie de push ; état reconstituable même si aucun message WS n'arrive.

**Fichiers probables** : `websocket_service.py`, nouveau service/store Photo mobile, `_layout.tsx`, `active_barathon/types/webSocker.types.ts`, intégration limitée aux callbacks existants `onOpen`/AppState. Pas de nouveau singleton socket.

**Dépendances** : lot3, log redaction de la chaîne WS vérifiée. N'utilise pas `offlineSync` pour réponses/photos.

**Acceptation** : invalidations ciblées `/ws/me`, sans contenu, invités exclus ; snapshot REST cohérent et borné ; badge calculé serveur ; une requête en vol, pas de navigation forcée ; réponses tardives d'une ancienne session ignorées.

**Tests** : SEC-09/12/13, BIZ-11/12, NR-06/07/09. Perte/doublon/inversion d'événements, WS off, app background, deux sessions même utilisateur.

**Risques** : socket active coupée par un écran, cache restant après logout, badge local optimiste, JWT dans errors du client natif.

**GO** : sans WS, reprise en entrée d'écran/polling restitue les mêmes données. **NO_GO** : WS source de vérité, contenu envoyé aux invités, obligation de notifications système pour jouer.

### Lot 5 — Interface mobile et information — 5–7 h

**Objectif** : capturer, publier consciemment, répondre une fois, voir son résultat et retirer du contenu avec un parcours court accessible.

**Fichiers probables** : `mobile/src/features/photo_mystery/**`, trois nouvelles routes `mobile/src/app/photo-mystery*.tsx`, `ActiveBarathonHeader.tsx`, `ActiveBarathonScreen.tsx`, récapitulatif (lien lecture seule), navigation helpers, `mobile/package.json`/lockfile/`app.json` ; `web/src/app/privacy/page.tsx` et `legal/page.tsx` uniquement pour informations vérifiées.

**Dépendances** : lots3–4, caméra/manipulator/file-system via `npx expo install` version SDK58 et lock vérifié, `expo-image` existant ; deux clients réels. Ne pas installer image-picker au MVP.

**Acceptation** : flag off invisible, invités informés/exclus, capture seule, aperçu et confirmation, overlay lisible, quatre choix max, erreur sans perte inexpliquée, pas de réponse offline, Passer distinct, no-cache auth header, fichiers temporaires nettoyés, zéro permission inutile.

**Tests** : typecheck, tests comportement helpers/store, BIZ-12, SEC-13/18, REAL-01 à08, NR-01/02/05/07. Prouver le rendu et les permissions avec vrai binaire/client.

**Risques** : crash au chargement d'un module absent d'un preview, caméra montée en arrière-plan, import natif même flag off, layout header saturé, conservation cache Android/iOS.

**GO** : deux OS fonctionnent et aucun ancien preview ne reçoit ce JS incompatible. **NO_GO** : nécessité d'une build non autorisée/facturable ou appareil incompatible. Un fallback vers galerie/URL publique n'est pas permis.

### Lot 6 — Sécurité et non-régression — 6–8 h

**Objectif** : transformer chaque garantie en preuve et intégrer les tests critiques au flux de validation.

**Fichiers probables** : nouveaux tests `backend/tests/test_photo_mystery_*.py`, fixtures synthétiques, `mobile/tests/photo-mystery.test.cjs`, tests `pubrush-k8s/monopod/tests/`, workflow CI de validation branche/PR et conditions de livraison dans `.github/workflows/deploy.yml`, preuves locales nettoyées.

**Dépendances** : lots1–5 ; beaucoup de tests sont écrits au fil des lots, la durée ici inclut consolidation, injection de pannes et corrections. Ne pas repousser les tests d'autorisations à ce seul lot.

**Acceptation** : tous P0 automatisables de TEST_PLAN, baseline complète, PostgreSQL obligatoire sans skip, Python3.11 aligné avec Docker, tests mobiles et typechecks requis ; aucune donnée réelle dans fixtures/logs.

**Tests** : matrice SEC/BIZ/NR/OPS entière, qualification de charge limitée au besoin réel 20 comptes. Tester migrations depuis vide et depuis head.

**Risques** : CI verte avec PG ignoré, mocks trop permissifs, test qui vérifie un nom de fonction sans son effet, auto-déploiement involontaire d'un push documentaire.

**GO** : preuves des références exactes et aucun P0 restant. **NO_GO** : test flakey/skip ou autorisation seulement simulée, défaut de purge/non-régression.

### Lot 7 — Recette deux appareils — 4–6 h

**Objectif** : valider réellement caméra, transport authentifié, cache, reconnexion et jeu sans dégrader la tournée.

**Fichiers probables** : `docs/photo-001/proofs/REAL_DEVICE_REPORT.md` et résultats synthétiques ; code concerné uniquement si correction nécessaire, puis rejouer les tests affectés.

**Dépendances** : candidat gelé, lots1–6 verts, API de qualification et clients SDK58 disponibles, deux appareils et opérateurs. Pas de compte utilisateur réel modifié dans l'audit.

**Acceptation/tests** : REAL-01–08, inversion iOS/Android, réseau mobile, identité extérieure et révocation, variante sans alcool/Passer, non-régression QR/fin/dépenses/GPS. Rapport signé des versions et résultats ; les cas à plusieurs répondants ont aussi leurs preuves PG.

**Risques** : essai limité au happy path, mauvais bundle/API, confusion Expo Go/OTA/binaire, permission déjà accordée cachant un défaut.

**GO** : aucun incident critique ou défaut de cache, recette générale PubRush conservée. **NO_GO** : un seul OS testé, mauvais client, fin/QR/GPS dégradé, résultats non reproductibles.

### Lot 8 — Déploiement contrôlé et repli — 3–4 h hors attente d'approbation

**Objectif** : rendre l'action finale concrète et réversible sans exposer de photo avant validation.

**Fichiers probables** : manifestes `pubrush-k8s/photo-001/`, `monopod/rollback-backend.sh` et tests pour sélectionner un repli compatible, `deployment-common.sh` si nécessaire, `.github/workflows/deploy.yml` (conditions CI/OTA/repli), `docs/photo-001/proofs/RELEASE.md` et `ROLLBACK.md`. Aucun `kubectl apply`, push ou EAS update sans autorisation explicite.

**Dépendances** : G0–G5, notice validée, volumes/secrets disponibles, référence de repli réellement construite et testée ; autorisation distincte pour registre/build payant si nécessaire, sinon ne pas l'effectuer.

**Préparation obligatoire avant demande d'approbation** :

1. Capturer base Git, digests backend/migration actifs, révision Alembic, HPA/stratégie/pods/endpoints, config sans secrets et références mobiles réellement installées. Ne pas recopier des références de 2026-10-24 sans relecture.
2. Préparer le candidat **D_photo** et un repli **D_safe** : ancien cœur PubRush retenu, nouveau schéma connu, code de maintenance/purge, aucune activation du jeu. Les deux images doivent connaître la nouvelle révision. En qualification, D_safe doit démarrer sur la DB après migration D_photo. Les placeholders ne sont remplacés par des digests que lorsqu'ils existent réellement.
3. Adapter/tester le rollback automatique de ce déploiement pour utiliser **D_safe pour backend et migration**, y compris si le premier rollout Photo échoue après une migration réussie. Ne pas attendre une panne pour constater que le snapshot historique pointe sur un Alembic trop ancien. Ne jamais stamp/downgrade la base pour faire démarrer une ancienne image.
4. Vérifier le PVC et la configuration en qualification ; le rollback doit restaurer aussi les réglages nécessaires au cœur. Si un montage bloqué empêche tout démarrage, prévoir un manifeste de repli sans dépendance média pour rétablir le cœur, avec Photo interdit et procédure opérateur de purge du volume inaccessible. Ce mode dégradé ne vaut pas réussite de la purge et interdit la réactivation.
5. Préparer le manifeste candidat avec `PHOTO_MYSTERY_ENABLED=false`, allowlist vide, secrets via références, upload route bornée, rootfs/UID/monopod préservés. Préparer le diff de politique/notice exact et la feuille de tests signée.
6. **Isoler la livraison mobile** : l'app utilise actuellement runtimeVersion `appVersion`/version1.0.0. Attribuer une version/runtime distincte au code contenant de nouveaux modules ; ne pas envoyer cette OTA aux previews1.0.0 existantes. Suspendre/conditionner explicitement l'étape auto `deploy-mobile` pour ce lot tant que les binaires correspondants ne sont pas vérifiés. Une dépendance importée peut crasher avant même le test du flag. L'essai Expo Go ne prouve pas les previews.

**Après autorisation seulement** : déployer configuration/migration/candidat flag off selon runbook ; attendre convergence 1Ready/1endpoint/HPA1/1/Recreate, vérifier `/health`, révision SQL, logs filtrés, cœur PubRush et purge. S'il manque une preuve, rester off et revenir D_safe. Aucun déploiement pendant un barathon actif.

**Activation séparée** : autorisation de l'utilisateur sur ce résultat concret, ID du barathon explicitement autorisé côté serveur, responsable d'essai présent. Pas de création/modification de données utilisateurs réelles à titre de test implicite. Définir le moment de fermeture/purge de l'essai et contrôler son exécution ; la purge automatique ne dépend pas d'une intervention du créateur.

**Rollback opérationnel** : d'abord flag off (avec rollout si lu au démarrage), aucune photo nouvellement servie, ouverts annulés, purge maintenue ; si nécessaire D_safe backend+initContainer, configuration saine et monopod conservés. Le module mobile compatible masque le jeu via REST ; un retour de bundle/OTA n'est possible que dans une runtime compatible et sur références fraîchement vérifiées, avec autorisation. Le repli Expo Go utilise le bundle stable déjà éprouvé et Photo off. Ne pas déclencher `restore-multipod.sh`.

**Tests** : OPS-02/03/06/07/08 en qualification avant autorisation, puis checks read-only de production autorisée. **GO** : rollback et purge mesurés, références exactes, accord explicite. **NO_GO** : ancien initContainer seul comme repli, binaires incompatibles ciblés, flag client seulement, changement HPA/multipod, image/tag flottant ou accord manquant.

## 5. Critères de fin pour Antigravity

Livrer un diff ciblé et révisable, tests/proofs nettoyés, versions et instructions reproductibles, liste des décisions réellement validées, risques résiduels, verdict réévalué. Aucun P0 masqué derrière un « à faire ». Garder le flag désactivé tant que tous les gates et l'autorisation d'activation ne sont pas acquis.

S'il devient évident que le jalon vendredi est manqué, arrêter les tentatives de livraison photo pour cette date, préserver le travail local et produire le rapport de blocage. Continuer la conception ou l'implémentation hors activation uniquement dans le périmètre autorisé. Ne pas casser les parcours existants pour sauver la fonctionnalité photo, et ne pas livrer une variante publique ou sans tests.
