# PHOTO-001 — Requalification FAST TRACK pour vendredi 30 octobre

27 octobre 2026, Europe/Paris. **Addendum de planification, sans implémentation.** Il complète les six livrables existants ; il ne refait pas leur audit. Les changements de contrat proposés ci-dessous sont explicites. Les garanties de sécurité de [SECURITY-RGPD.md](SECURITY-RGPD.md) restent applicables.

## 1. Verdict et décision recommandée

**CONDITIONAL_GO pour préparer un MVP vendredi ; aucune autorisation d'activation ou de déploiement.** La candidature dépend d'une capture web sur les builds actuels, de photos volontairement éphémères et d'une capacité de travail effectivement disponible. Ces choix sont recommandés, pas présentés comme déjà acceptés ou implémentés.

**Avec le gel actuel du mercredi 28 à 18 h maintenu et sans capacité supplémentaire confirmée : NO_GO dans le planning ordinaire.** Le FAST TRACK ne permet pas de promettre la sécurité ni la recette dans les quelques heures ouvrées restantes. Le périmètre initial excluait déjà push, historique permanent et classement : les supprimer à nouveau ne procure pas un nouveau gain.

La trajectoire conditionnelle proposée consiste à conserver aa70e63 comme version stable, à isoler le candidat Photo et à proposer un gel Photo **jeudi 29 à 12 h au plus tard**, puis une recette dédiée de 4–6 h et une décision avant 20 h. Cette exception au gel documenté doit être explicitement retenue par le propriétaire ; elle n'est ni appliquée ni intégrée au BACKLOG par cette mission. Elle est impossible si elle consomme les personnes ou les téléphones nécessaires à la recette générale PubRush. Une correction de sécurité après ce gel retire le candidat du vendredi, sauf requalification complète encore réalisable avant la décision.

Recommandation produit : **question, choix, badge, réponses et résultats dans PubRush ; capture seulement dans une page web HTTPS dédiée**, puis confirmation de l'aperçu dans PubRush. Pas de nouvel écran de classement, de gage, d'historique, de résultat à acquitter ni d'animation. Une indisponibilité Photo laisse le barathon utilisable.

Conditions de passage : capture réelle et retour à l'app prouvés, invités fiabilisés, logs sans secrets, accès privés et purge démontrés, courses PostgreSQL passantes, repli aa70e63 sur base migrée démontré, deux téléphones qualifiés. **À ce jour ces preuves Photo manquent : aucune activation n'est qualifiée.**

## 2. Vérifications ciblées et réutilisation

Constats locaux de cette requalification, sans nouvelle inspection de production :

- HEAD/main/origin-main locaux au départ : `aa70e6330172bddb87b95f876e23cbdca8c7318f`, UX-019 intégré. Aucun fichier métier suivi modifié au départ. Les nombreux rapports non suivis, dont les six documents Photo, ont été conservés. Les anciens relevés Git d'AUDIT restent des informations historiques.
- `mobile/package.json` et `app.json` : Expo 58, `expo-web-browser`, `expo-image`, SecureStore, Router et Updates déjà déclarés ; runtime par `appVersion`, version `1.0.0`. Caméra, image-picker et image-manipulator absents des dépendances directes. File-system est transitif ; la mention optionnelle de WebView dans le lock n'établit pas sa présence dans un binaire.
- `ProfileScreen.tsx`, `RegisterScreen.tsx` et `external-link.tsx` utilisent déjà WebBrowser. Cela soutient la voie web ; cela ne prouve pas la composition de chaque ancien build installé.
- La reprise invitée publique de `join_barathon_as_guest` réémet toujours un JWT pour un invité existant sur code + pseudo. Le test `test_join_guest_rejoin_same_barathon` attend toujours ce comportement. Il faut changer ce contrat et son test ; exclure les invités ne satisfait plus la présente mission.
- Le JWT WS reste lu dans la query string. Le traitement de tous les logs, y compris refus WS, reste obligatoire ; changer seulement l'affichage mobile ne traite pas ce point.
- Les tâches lifespan, JWT + relecture SQL, participations, connexions `/ws/me`, REST/reconnexion/AppState et tests existants sont réutilisables. Ni les votes, ni la correction, ni un média ne vont dans les positions RAM GPS ou la file offline.
- Le manifeste backend propose déjà UID 10000, rootfs en lecture seule, 512 MiB et un `emptyDir` pour `/tmp`. **Ce volume existant n'est pas déclaré en RAM** : la variante ci-dessous demande un volume dédié explicite, pas une réutilisation aveugle de `/tmp`.
- Le workflow main déploie backend puis EAS preview, sans filtre documentaire ; il ne déploie pas le web. La page de capture exige donc une livraison web distincte, avec ses preuves et son rollback. Le script de repli courant remet backend et migration à l'ancienne image : il ne suffit pas après une nouvelle révision Alembic.

### EAS OTA sans nouveau module natif

**Possible en principe pour la variante web ; non démontré sur les builds des testeurs.** L'OTA n'ajoute que le JS de l'interface Photo, ses appels REST, la bannière et l'ouverture de la page avec le WebBrowser existant. Aucun changement SDK, plugin, permission native, scheme, version/runtime ou dépendance native n'est nécessaire dans ce chemin. Les photos ne transitent jamais par EAS.

La capture native par ajout de `expo-camera` ou `expo-image-picker` ne bénéficie pas de cette conclusion. Une bibliothèque absente du binaire nécessite un nouveau build ; un flag off n'empêche pas nécessairement un crash d'import. L'égalité de la chaîne `1.0.0` n'établit pas la compatibilité, notamment pour un ancien binaire d'un autre SDK. Voir [Expo : runtimes et mises à jour](https://docs.expo.dev/eas-update/runtime-versions/).

Le premier test doit identifier, sur chaque téléphone, OS, build, SDK natif, channel, runtime et update effectivement chargé, puis vérifier le WebBrowser et les modules déjà utilisés. Pas de publication globale preview si cette runtime rassemble des binaires incompatibles. Une branche EAS seule n'isole pas les appareils qui suivent déjà le même channel. Expo Go est un canal différent ; sa réussite ne prouve pas une OTA.

### Capture web : une capacité d'envoi, pas une seconde session de compte

Proposition minimale à spécifier et tester avant les écrans :

1. Dans PubRush, l'auteur authentifié crée le draft avec question/choix/correction. Le serveur crée, sous quotas, un code aléatoire d'au moins **50 bits d'entropie**, valable **2 minutes**, pour ce draft et cette participation seulement. Un seul code actif ; régénération invalide le précédent. Stocker son empreinte, jamais sa valeur.
2. Ouvrir une URL HTTPS fixe, sans JWT, code ou secret en query ou fragment. La coque de page peut être publique ; **aucune photo ni donnée de défi ne l'est**. L'auteur recopie le code affiché dans PubRush et le soumet par POST. Ne pas ajouter Clipboard, WebView, AuthSession ou un autre module pour ce passage.
3. Échange atomique, usage unique, rate limits par tentative/IP et limite globale, TTL et absence d'oracle. Il délivre une capacité d'upload de courte durée, conservée uniquement en mémoire du navigateur, liée au draft, à l'auteur et à la génération serveur. Aucun droit de lire une photo, la question, la correction, de répondre ou de publier. Pas de JWT de compte, cookie de compte ou stockage local persistant dans ce navigateur.
4. Capturer via `getUserMedia({video:..., audio:false})`, aperçu et conversion canvas en JPEG borné ; arrêter les pistes caméra au retrait/blur. Envoyer par HTTPS avec Authorization. Le serveur revalide appartenance, draft, TTL, flag et quotas avant/après traitement. À chaque suppression, révocation, redémarrage ou kill flag, la capacité devient inutilisable.
5. Revenir manuellement dans PubRush ; AppState/polling retrouve le draft et son aperçu via l'API authentifiée. **Seul le JWT de l'auteur dans PubRush peut confirmer et publier.** Aucun deep link contenant un secret. Abandon/code expiré : réessai ou nouveau code, jamais publication implicite.

La page n'embarque ni analytics, ni script tiers, ni service worker de cache ; appliquer CSP, no-store et une politique de referrer restrictive. Filtrer code/capacité/corps dans proxy, API, validation errors et télémétrie. Tester vol/rejeu/expiration et double échange du code. Une erreur de claim ou d'upload ne dévoile jamais le contenu.

[WebBrowser utilise le navigateur système](https://docs.expo.dev/versions/latest/sdk/webbrowser/) ; la disponibilité de la caméra dans ce contexte doit être testée. [getUserMedia exige HTTPS et l'autorisation utilisateur](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). L'attribut HTML [capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) n'impose pas partout une capture seule : ne pas introduire un sélecteur de galerie de secours dans ce MVP. Si le navigateur intégré ne convient pas, un navigateur système externe peut être qualifié dans le même premier jalon ; pas de changement de voie tardif après le gel.

## 3. Réductions qui préservent les protections

### Invités : corriger l'identité avant d'ouvrir les photos

Réutiliser les comptes invités, JWT et SecureStore, mais **supprimer la récupération d'une identité par code + pseudo**. Une requête publique crée une nouvelle identité ou refuse une collision ; elle ne signe jamais un jeton pour une identité existante. La reprise utilise le jeton déjà détenu, validé côté serveur ; aucune récupération de compte invité par son nom. Perte du jeton : nouvelle identité et nouvelle participation, sans accès aux anciens défis.

Les invités antérieurs à la correction ne deviennent pas fiables simplement parce qu'ils présentent un ancien JWT : un tiers a pu l'obtenir. Marquer en SQL les identités créées par le nouveau flux, sans backfill ni promotion à partir d'un ancien jeton ; seules ces identités invitées sont éligibles Photo. Les anciens invités rejoignent sous une nouvelle identité sécurisée pour les prochains défis. Pas de nouvelle table globale de sessions si un petit registre Photo suffit. Rejouer les parcours QR et web existants, y compris accès avec token conservé, token perdu et collisions concurrentes.

L'audience reste figée sur les liens de participation, désormais comptes enregistrés **et invités sécurisés** ; autorisation à chaque lecture, aucune exception pour admin extérieur. Les WS ne portent que des invalidations ciblées, jamais du contenu privé.

### Médias éphémères : enlever la persistance, pas les contrôles

**Option recommandée pour l'essai, à accepter comme limite produit** : nouveau volume `emptyDir` dédié avec `medium: Memory`, `sizeLimit: 32Mi`, quota applicatif global de **20 MiB / 40 médias maximum**. Ne pas utiliser le PVC PostgreSQL ni écrire les octets image dans la DB. Chiffrement AES-GCM avec `cryptography` existant, clé aléatoire propre au processus, non persistée et non incluse dans ses logs. Une génération média identifie ce processus.

Les votes, états, audience, deadlines et résultats restent dans PostgreSQL. À chaque démarrage, avant toute disponibilité Photo : invalider les anciennes capacités, annuler les drafts/défis ouverts sans média récupérable, retirer les anciens médias et nettoyer le répertoire dédié. Un résultat déjà clos reste figé, mais sa photo peut être perdue. Un simple crash de conteneur peut conserver l'emptyDir : il faut donc tester aussi ce cas, pas seulement la suppression d'un pod. Voir [Kubernetes : emptyDir en mémoire et cycle de vie](https://kubernetes.io/docs/concepts/storage/volumes/#emptydir).

Pas de promesse de disponibilité des photos après redémarrage. Le client affiche une annulation et permet un nouveau défi. C'est une réduction de disponibilité explicitement annoncée, pas une perte silencieuse de votes ou un recalcul des résultats.

Conserver le pipeline serveur : source ≤2 MiB, JPEG/PNG fixes réels, ≤6 MP et côté ≤4096 ; réencodage dans un worker séparé borné, un traitement actif ; sortie RGB ≤1600 et ≤512 KiB, sans EXIF/GPS/métadonnées. Original jamais sur disque, y compris via Traefik. GET authentifié, `private,no-store`, cache mobile none, écriture chiffrée atomique et registre de purge. La caméra et la conversion navigateur ne remplacent aucun de ces contrôles.

Vérifier swap, core dumps et sauvegardes/snapshots mémoire : **tmpfs ne prouve pas à lui seul l'absence de copie durable**. Photos exclues des sauvegardes ; métadonnées SQL selon la politique existante du dossier. Si ces points ne peuvent être établis, ne pas annoncer un gain de stockage acquis. Le mode persistant privé initial reste une solution ultérieure, pas un remplacement improvisé vendredi.

Conservation : draft 15 min, défi 3 min ; photo retirée au premier de fin/arrêt/retrait, 15 min après clôture ou 6 h après upload ; expiration/annulation coupe immédiatement l'accès. Purge physique visée <60 s en service normal, alerte à 5 min ; TTL vérifié même si watcher arrêté. Questions/correction/réponses/résultats et registre invité Photo au plus 24 h selon leur finalité, sans retirer l'accès ordinaire au barathon. Purger les marqueurs invités seulement quand ils ne sont plus nécessaires à un jeu en cours, au plus 24 h après leur création ; au-delà, nouvel enrôlement invité requis. Suppression compte et retrait restent opérationnels. Photos d'objets sans personne identifiable ; limites des captures personnelles toujours expliquées.

### Métier et interface

Un défi publié à la fois, 2–20 participants fiables, auteur exclu des réponses ; question 3–180 caractères et 2–4 choix uniques. Réponse immuable ou Passer, deadline et bonne réponse côté serveur. Résultats limités à sa réponse, sa correction après clôture et les totaux ; pas de gage, classement ou résultat à acquitter. Après expiration sans réponse, pas de correction publiée. Auteur connaît nécessairement sa saisie ; aucun autre participant ne la reçoit avant clôture.

Réutiliser les verrous/contraintes/idempotence conçus dans ARCHITECTURE : un vote par audience, un résultat atomique, courses réponse/échéance/fin/retrait testées sur PostgreSQL. Garder le registre média et les quotas, même si le schéma des résultats est simplifié. La réduction d'écrans n'autorise pas la suppression de contraintes SQL.

Badge rouge = nombre de défis auxquels le membre doit encore répondre. Liste = défis en attente ; après réponse, accès temporaire au résultat du défi. Pas de compteur « résultats non vus ». Bannière au premier plan via la socket existante, REST sur événement/reconnexion/focus/AppState et polling 30 s borné. Sans WS, le polling assure le rattrapage ; les votes ne sont jamais différés offline.

## 4. Charge, chemin critique et travail en parallèle

**Estimation de planification, non benchmark d'agents : 28–40 h cumulées**, incluant intégration, revue, corrections usuelles, recette et préparation de livraison ; hors attente humaine, nouveau build, provisionnement non prévu ou incident d'hébergement.

- **Antigravity : 18–25 h**. Identité invitée/logs 2–3 h ; données/API/transactions 3–4 h ; média borné/purge/tmpfs 4–5 h ; page capture/capacité 3–4 h ; interface JS/temps réel 2–3 h ; migration/repli/livraison web préparée 2–3 h ; corrections d'intégration 2–3 h.
- **Codex indépendant : 6–9 h**. Contrats et risques nouveaux 1 h ; revue identité/accès/logs/capacité 2–3 h ; vérification indépendante PG/média/purge/repli 2–3 h ; clôture de revue 1–2 h. Antigravity écrit les tests de ses lots ; Codex ne se limite pas à relire leur résultat.
- **Opérateur/testeurs : 4–6 h**. Deux téléphones réels, observations, recette croisée, preuves des versions et exercice de repli en qualification. Leur disponibilité est un prérequis, pas du temps remplacé par l'IA.

En chevauchant la revue avec les lots suivants et le premier essai téléphone avec la préparation : **environ 22–32 h de travail sur le chemin critique**, selon corrections et disponibilité. Ce chiffre n'est pas 22–32 h calendaires garanties, ni une division par deux de l'audit. Il faut réserver de vrais créneaux avant jeudi midi puis pour la recette. La fourchette haute ne tient pas dans deux journées ordinaires depuis mardi fin d'après-midi. Aucun travail de nuit humain n'est présumé.

Ordre utile :

1. **Premier lot, 2–3 h maximum de qualification de faisabilité** : capture HTTPS sur les deux OS avec le client de distribution prévu ; fixation des contrats invité/capacité ; inventaire des références aa70e63 ; décision sur tmpfs/sauvegardes et créneaux de recette. Réutiliser une partie du travail dans les lots ci-dessus ; ne pas additionner ce temps une seconde fois. Sans preuve de faisabilité, arrêter la candidature vendredi avant de construire les écrans.
2. **Fondations serveur** : identité invitée + logs → schéma/ACL/pipeline/purge → publication/réponse/clôture. Une tranche privée de bout en bout doit passer **mercredi 28 à 12 h** : code+nom ne récupère plus un invité ; photo non lisible hors audience ; purge effective ; aucune correction prématurée ; premier test réel de capture. Si le démarrage ne permet plus ce jalon, NO_GO vendredi.
3. **Pendant le lot serveur suivant**, Codex révise le lot précédent et construit ses scénarios négatifs indépendants. Les contrats/UI sur mocks et l'inventaire de repli peuvent avancer avant l'API complète ; leur intégration attend le contrat stabilisé. Deux agents n'écrivent pas simultanément les mêmes fichiers.
4. **Intégration** : badge/bannière/resync et page web + confirmation dans l'app ; courses PG, décodage hostile, purge après crash, charge réaliste et non-régression. Revue au fil des lots ; pas une découverte des P0 jeudi soir.
5. **Gel du candidat et repli prouvé** : mercredi 18 h si possible ; extension proposée jeudi 12 h seulement si explicitement retenue et compatible avec la recette générale. Tous tests automatiques P0 verts et aucun correctif critique restant.
6. **Jeudi, recette réelle complète de 4–6 h**, puis revue finale et décision avant 20 h. Vendredi : activation d'un candidat déjà qualifié après autorisation ; aucune séance d'intégration ou correction risquée pendant le barathon.

Peuvent se chevaucher : revue du backend livré / développement UI ; tests négatifs indépendants / implémentation du lot suivant ; rédaction notice vérifiée et runbook / développement ; préparation des appareils / tests API. Ne peuvent pas se chevaucher pour gagner artificiellement du temps : tests de concurrence avec schéma instable, preuve de repli sans migrations finales, recette finale avant candidat complet, correction et approbation du même lot par le même auteur.

## 5. Rollback exact vers aa70e63 et migrations compatibles

Le repli demandé est **l'application stable aa70e63**, pas seulement une nouvelle image Photo avec flag off. Les digests et groupes EAS correspondants restent à identifier et vérifier ; cette mission n'en invente aucun et n'affirme pas avoir exécuté le repli.

Préparer une migration uniquement additive, sans colonne existante obligatoire, renommage ou changement de sémantique du cœur. Préparer **deux références distinctes** pour le repli : image applicative aa70e63 et image de migration « pont » qui connaît l'ancienne et la nouvelle révision. Le backend stable ne doit pas recevoir les imports Photo. L'initContainer pont peut être issu de la base stable avec les scripts de migration nécessaires ; sa commande et ses dépendances sont testées sur la base migrée. **Remettre l'ancienne image aa70e63 dans les deux conteneurs est interdit tant que sa connaissance de la nouvelle révision n'est pas démontrée.** Aucun stamp ou downgrade pour contourner cela.

Le couple de repli différent backend/migration doit être pris en charge par le runbook et par le rollback automatique du premier déploiement, pas seulement par une commande manuelle future. Conserver monopod/Recreate/HPA 1/1 et UID non-root. Ne pas exécuter restore-multipod.

Démonstration isolée obligatoire, sur PostgreSQL jetable :

1. Démarrer le cœur aa70e63 et sa base à la tête initiale ; relever les références réelles et faire les parcours de contrôle.
2. Migrer vers Photo, créer média/votes synthétiques, terminer un défi et laisser un autre ouvert. Démontrer les contraintes et résultats avant repli.
3. Couper Photo, empêcher écritures/lectures/claims, révoquer les capacités et purger toutes les données Photo de l'essai. Prévoir une commande de maintenance indépendante de l'API si le candidat ne démarre plus ; ne pas faire dépendre la purge du code stable qui ne connaît pas Photo.
4. Revenir à l'image applicative aa70e63 avec l'initContainer pont, sans effacer la nouvelle révision ; retirer le pod Photo détruit son volume RAM, puis vérifier absence des médias et des données Photo. Si la purge préalable échoue, restaurer le cœur avec Photo inaccessible puis exécuter la maintenance ; le gate reste en échec tant que l'effacement n'est pas prouvé.
5. Tester login, invité ordinaire, création/join, GPS/WS, dépenses, fin et `DELETE /me` avec le stable sur ce schéma. Le stable conserve son comportement historique invité ; il n'offre plus aucun accès Photo, et aucune donnée Photo ne doit rester à purger par lui.
6. Provoquer aussi l'échec du candidat **après migration réussie** et démontrer le même repli automatique. Enregistrer les deux digests, révision SQL, configuration et résultats, sans secrets.
7. Revenir au bundle stable aa70e63 sur les **deux plateformes**, dans leur runtime compatible, en qualification autorisée. Une OTA n'est pas instantanée : relancement/chargement effectif à contrôler. Le flag serveur interdit Photo même si un téléphone conserve le nouveau JS. Rétablir aussi le web stable, vérifier `/delete-account`, et confirmer que la page de capture abandonnée ne donne aucun droit.

Un « repli démontré » ne peut pas résulter de la seule lecture du script existant. L'estimation inclut sa préparation et son exercice, pas une déclaration de succès aujourd'hui.

## 6. Blocages et critères d'arrêt

Avant tout déploiement, **STOP / NO_GO vendredi** si un seul point subsiste :

- Refus ou échec de la capture web sur les deux clients cibles ; nécessité d'un nouveau module natif sans binaire autorisé déjà qualifié. Ne pas importer une caméra absente sous runtime 1.0.0 pour tenir la date.
- Ancien invité réutilisable par code+pseudo, promotion d'un JWT ancien en identité fiable, ou possibilité de récupérer le contenu d'un ancien lien de participation. Pas de mode « invités non sécurisés ».
- JWT, code ou capacité d'upload dans logs, URL, télémétrie, erreurs ou artefacts. Vérification par marqueurs synthétiques incluant les connexions et refus WS ; pas de collecte de vrais JWT pour faire la preuve.
- Accès extérieur/admin non membre, photo publique/URL signée comme raccourci, cache persistant, EXIF, worker non borné, original spillé sur disque ou panne Photo dégradant GPS/health.
- Correction ou réponses d'autrui avant clôture ; double vote, résultat contradictoire, réponse tardive, course de révocation non maîtrisée. SQLite seul ou PG critique skippé ne passe pas.
- Durées non appliquées à la lecture, purge qui s'arrête avec le flag, données remises en service après restauration, politique de sauvegardes/ram/swap inconnue ou responsabilités/notice/hébergement non établis. Conserver les exigences de SECURITY-RGPD ; aucune certification juridique nouvelle n'est prononcée ici.
- Flag serveur non désactivé par défaut, allowlist non vide par défaut, absence de coupe-circuit ou chemin qui permet à la page web de publier seule.
- Repli aa70e63 + migration pont + web + mobile non exercé ; digests/groupes non identifiés ; rollback automatique revenant à un Alembic incapable de démarrer ; absence de maintenance de purge indépendante.
- Tests de non-régression QR, création, fin, suppression compte, dépenses, GPS/WS en échec ; candidat différent des références revues ; deux téléphones ou créneau de recette indisponibles ; jalon raté sans calendrier explicitement requalifié.
- Permission de déploiement absente. AGENTS.md impose « Aucun commit ou déploiement sans validation explicite ». Le présent rapport et le prompt ne l'accordent pas.

Validation future obligatoire : backend `PYTHONPATH=. .venv/bin/pytest`, mobile et web `npx tsc --noEmit`, suite mobile existante, PostgreSQL réel migrations/concurrence sans skip, SEC/BIZ/NR/OPS pertinents du TEST_PLAN, puis recette deux appareils. Adapter uniquement les assertions retirées du produit : gages, résultats non vus, capture native et persistance média après crash sont remplacés par les contrats ci-dessus ; **aucune assertion d'accès, de logs, d'intégrité ou de suppression n'est retirée**.

Après livraison explicitement autorisée, vérifier encore flag off, santé, migration, monopod, installation OTA réelle, page web et purge avant toute activation du seul barathon choisi. Une recette sur environnement isolé ne remplace pas ces postchecks. Le jeu reste désactivé si un contrôle manque.

### Portée des preuves de cette mission

Relecture des six livrables et des documents de référence ; contrôles locaux ciblés des dépendances, flux invité, WS, workflow et repli ; documentation officielle Expo/Kubernetes et API navigateur consultée. **Pas de tests Photo, d'essai téléphones, d'inventaire live EAS/K8s ou de rollback exécuté.** Aucun code métier modifié, commit, push, publication, déploiement ou activation. Les suites applicatives ne sont pas relancées pour cet addendum documentaire ; leurs anciens résultats ne sont pas présentés comme des preuves Photo actuelles.

Prompt exécutable proposé : [PROMPT_ANTIGRAVITY_FAST_TRACK.md](PROMPT_ANTIGRAVITY_FAST_TRACK.md).
