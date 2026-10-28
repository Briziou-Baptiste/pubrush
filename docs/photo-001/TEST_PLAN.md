# PHOTO-001 — Matrice de validation et recette

**Les tests PHOTO ci-dessous sont à écrire et exécuter, ils ne sont pas passants à ce jour.** La baseline exécutée pendant l'audit est détaillée dans [AUDIT.md](AUDIT.md) : 121 tests backend + 3 PostgreSQL isolés, 109 tests mobile et deux typechecks réussis. Le contrôle final après changements UX-019 en parallèle donne 118 tests mobiles et typecheck réussis. Ces observations datées ne valident aucune garantie du nouveau jeu.

## 1. Environnement et qualité des preuves

- Comptes et images synthétiques exclusivement. Photographier des objets neutres en recette, sans tiers, document ni donnée réelle sensible. Ne pas appeler des routes de mutation production pendant l'audit.
- Backend unitaire : SQLite isolé avec FK actives, horloge injectable ; tests images avec corpus généré et métadonnées factices. Désactiver dotenv et toute intégration externe ; clé et JWT de test indépendants.
- Intégration : PostgreSQL 15 jetable dédié, migrations réelles et sessions séparées ; conteneurs sans accès à la production. Les tests existants PG font des commits : **ne jamais leur fournir une base utilisateur**. Exiger `PG_TEST_DATABASE_URL` explicitement et vérifier nom/identité de cible. Une indisponibilité PG doit faire échouer le job critique, pas produire un skip vert.
- Infra : environnement de qualification avec mêmes UID10000/GID10001, rootfs read-only, Recreate, 1 worker Uvicorn, 1 pod, 512 Mi/1 CPU, Traefik et PVC privé. Ne pas inférer de SQLite ou de macOS les garanties Linux.
- Mobile : iPhone + Android physiques, SDK/client exact enregistré, réseaux Wi-Fi puis mobile, second compte extérieur. Au moins trois identités logiques pour les contrôles de confidentialité, même si deux appareils suffisent aux permutations du jeu.
- Chaque preuve indique commit candidat, diff résiduel, hash lockfile, révision Alembic, digests backend/migration/repli, versions OS/client, scénario, attendu/observé, commande, code retour et date. Logs sans jeton, image ou contenu personnel ; aucune capture d'écran de vraie personne.
- Noms de fichiers proposés : `backend/tests/test_photo_mystery_*.py`, `mobile/tests/photo-mystery.test.cjs`, preuves sous `docs/photo-001/proofs/` lors de l'implémentation. Ne pas écraser les preuves BUGFIX-018. Les tests de source seuls ne suffisent pas pour les endpoints, la concurrence, le cache ou les permissions.

## 2. Sécurité — tous P0, bloquants

### SEC-01 — Extérieur et admin extérieur

Avec deux groupes distincts, même JWT valide, varier barathon_id/challenge_id sur liste, détail, photo, HEAD, réponse, résultat et result-seen. Anonyme → 401 ; compte extérieur et admin non membre → 404 sans octets, dimensions, question ou différence révélant l'existence. L'admin peut effectuer seulement la procédure de retrait aveugle prévue. Tester aussi un UUID valide inexistant.

### SEC-02 — Révocation effective

Lire une photo, retirer le membre via l'API réelle, puis réutiliser le même JWT et URL. Nouvelle lecture → 404 immédiatement après commit, y compris en réutilisant la connexion HTTP. Rejoindre à nouveau avec le même compte ne restaure pas l'ancienne audience. Couper le WS avant retrait : REST reste interdit. Ne pas prétendre rappeler les octets déjà téléchargés.

### SEC-03 — Identité, invité et nouveaux membres

Guest avec et sans claim is_guest, guest usurpé par le mécanisme existant, utilisateur arrivé après publication : aucun droit Photo ancien. L'éligibilité utilise la valeur SQL. Envoyer `user_id`, `audience_id`, `is_creator`, rôle/admin dans le corps → 422 sans prise en compte. Le créateur ne peut pas répondre à son défi. Autres rôles n'étendent pas les droits.

### SEC-04 — Bonne réponse et réponses individuelles

Inspecter les octets JSON/WS de création, liste, détail, publication, upload, réponse, erreurs de validation et retries, pour chaque rôle. Avant closed : pas de correct_index/is_correct/résultat, hors la saisie envoyée volontairement par l'auteur ; jamais le choix d'un autre membre. Injecter champs extra, mauvais types et payload volontairement invalide : l'erreur ne doit pas refléter le secret. cancelled/expired ne révèlent rien. Closed n'expose que agrégats + résultat du demandeur.

### SEC-05 — Formats malveillants

JPEG/PNG valides acceptés ; HTML/SVG/PDF/ZIP/script renommé `.jpg`, magic trompeuse, polyglotte avec charge ajoutée, JPEG tronqué, APNG/multiframe, GIF/HEIC/WebP refusés ou réencodés uniquement selon la règle JPEG/PNG fixe. Vérifier absence de charge ajoutée dans la sortie acceptée. Mauvais MIME et format réel discordant refusés. Aucun fallback vers original.

### SEC-06 — Limites d'upload avant allocation

2 MiB exacts et +1 octet, Content-Length absent/faux, transfert chunked, Content-Encoding gzip, body infini/lent, dimensions 4096/4097, pixels 6M/+1, compression extrême. Statut contrôlé 413/415/422/timeout ; mémoire et durée bornées, pas de crash du pod ni de fichier original temporaire. Tester par l'Ingress et directement sur l'API en qualification.

### SEC-07 — Métadonnées

Fixtures EXIF GPS/date/appareil/orientation, XMP, ICC, IPTC/commentaires et thumbnails avec marqueurs uniques. Photo orientée correctement ; sortie déchiffrée ne contient aucun marqueur ni tag privé ; aucun GPS en SQL/logs. Lire les octets indépendamment de Pillow, pas seulement `image.info`. Vérifier également les temporaires Traefik/worker.

### SEC-08 — Stockage strictement privé

Essayer HTTP(s) direct par storage_key, chemins voisins, traversées, double encodage et symlinks ; aucun service static/Ingress sur le répertoire. Fichier au repos non décodable en JPEG, permissions attendues ; le web et un compte OS non autorisé ne le lisent pas. Clé absente/incorrecte, tag chiffré altéré, swap de deux fichiers : refus contrôlé, jamais données en clair ou fallback. Inspection RBAC et sauvegardes avec opérateur, sans copier les clés.

### SEC-09 — Logs et observabilité

Jeton synthétique contenant un marqueur, URI WS réussie/refusée, Authorization HTTP, correct_index et métadonnées factices. Aucun marqueur sensible dans stdout/stderr, Uvicorn, Traefik, exceptions, crash reports et logs mobile, ni dans l'artefact CI. Vérifier les lignes WS indépendamment d'access_log. Tester erreurs 401/422/500 et timeout de décodeur. La suppression de `console.log` seule ne valide pas ce test.

### SEC-10 — Suppression physique et logique

DELETE auteur, retrait membre habilité et retrait support ; immédiatement GET photo interdit. Puis objet absent ≤60 s en service normal ; DELETE répété sans erreur destructive. Simuler unlink en échec : accès reste interdit, ligne delete_pending conservée et retry effectif. Alerte après 5 min. Absence de ligne média ne suffit pas : vérifier le volume.

### SEC-11 — Compte et barathon supprimés

Exercer `DELETE /me`, suppression admin du compte, DELETE barathon, créateur réattribué et auteur différent de l'organisateur. Plus aucun accès au média, purges survivent aux cascades. Les autres dépenses/rôles/étapes et règles de réattribution existantes restent corrects. L'échec de stockage ne bloque pas la suppression de compte et ne promet pas à tort une purge physique accomplie.

### SEC-12 — WebSocket

Socket extérieure refusée pour le salon existant ; guest présent dans le salon ne reçoit aucun événement Photo. `/ws/me` ne reçoit que ses invalidations minimales. Révocation avant envoi : destinataire exclu ; si course après contrôle, aucun contenu/secret ne peut être révélé. Injection de messages client `PHOTO_ANSWER`/`PHOTO_CLOSE` n'a aucun effet. Déduplication des événements répétés.

### SEC-13 — Cache, changement de compte et ancienne URL

Voir photo compte A, background/logout, compte B extérieur ; pas d'ancienne frame ni fichier dans cache photo de l'app. Accès réseau B refusé, cachePolicy none. Pas de prefetch, Shared/MediaLibrary/SecureStore ni payload route contenant l'image. Une ancienne URL après expiration/suppression ne retourne ni 304 ni cache valide. Vérifier iOS et Android, pas seulement les headers serveur.

### SEC-14 — Quotas et refus de service

Rafale comptes/requests, publication concurrente, drafts abandonnés, retries, suppression/recréation de barathon : pas de contournement des quotas d'auteur par suppression de contenu ; une requête idempotente n'incrémente pas deux fois le quota. Un upload actif, autres refusés ; plafond octets/fichiers et marge disque appliqués. Pas de croissance RAM non bornée après 100 refus. Vérifier le redémarrage : compteurs persistants encore effectifs.

### SEC-15 — Crash aux frontières fichiers/SQL

Stopper le processus entre réservation staged, écriture temporaire, rename, commit ready, publication, retrait logique et unlink. Au redémarrage : jamais de média non autorisé, aucun défi published avec succès mensonger, récupération/purge des staged et orphelins. Aucune opération ne rend accessible un original.

### SEC-16 — Conservation et restauration

Horloge avancée : draft15min, closed+15min, upload+6h, données24h, fin immédiate ; accès expiré sans attendre le watcher. Stop watcher, redémarrer : rattrapage. Restaurer une sauvegarde de qualification antérieure à un retrait : Photo désactivé, purge complète Photo avant trafic, aucune réapparition. Attestation d'exclusion du volume média des snapshots et de protection/rétention des sauvegardes DB.

### SEC-17 — Feature flag et échec fermé

Flag absent/false, allowlist vide, guest, mauvais barathon, clé/montage absents, purge unhealthy : pas de nouvel accès image ou publication. Routes ordinaires et health restent fonctionnelles. Off après publication annule les ouverts et continue la purge ; DELETE/retrait et suppression de compte restent utilisables. Ancien client non compatible ne peut activer la fonctionnalité.

### SEC-18 — Information et contenu

Notice réellement accessible avant transfert/publication, règle objets seuls, exclusion explicite des invités, conservation exacte, contact vérifié, retrait simple. Aucun consentement précoché ou gage imposé ; Passer le défi et Passer le gage disponibles, variante sans alcool. Matérialiser screening AIPD et validation responsable/hébergeur/sauvegardes ; pas de case « RGPD conforme » sans pièces.

## 3. Métier, transactions et reprises — P0 sauf indication

- **BIZ-01** : toutes les transitions autorisées et interdites, y compris réouverture d'un terminal et published sans photo/audience. Vérifier le schéma SQL direct pour FK/CHECK/uniques.
- **BIZ-02** : auteur seul → publication refusée ; un répondant → jeu valide ; 20 comptes total → accepté, 21 → refus ; invités exclus du calcul. Snapshot stable malgré ajout ultérieur.
- **BIZ-03** : questions 2/3/180/181, choix 1/2/4/5, longueurs 0/1/60/61, doublons trim/casse/NFKC, index -1/hors liste/string/bool/float → validations définies ; texte rendu comme texte.
- **BIZ-04** : jeu de vérité C/W/P/U : tous corrects → auteur ; au moins un faux → seuls faux ; corrects+absent → personne ; passes/absents seulement → expired. Aucun gage sur non-réponse, pass ou annulation.
- **BIZ-05** : double appui même corps/clé (draft, upload, publication, answer, result-seen, DELETE), réponse HTTP perdue après commit, retry après fermeture → une seule mutation et réponse stable selon contrat. Même clé/corps différent →409.
- **BIZ-06** : deux connexions PG répondent simultanément pour le même membre, choix identiques puis différents : une ligne, un résultat de replay ou409, jamais deux votes/500. Barrière de départ, sessions indépendantes.
- **BIZ-07** : dernier répondant contre watcher, deux watchers, deux finalisations simultanées : une ligne photo_results, un terminal_at, aucun résultat contradictoire. Répéter 50 courses contrôlées, pas une seule exécution chanceuse.
- **BIZ-08** : attente sur verrou au-delà de deadline ; lecture de l'horloge après acquisition empêche la réponse tardive. Réponse juste avant/à/après deadline, sans sleeps fragiles en test unitaire.
- **BIZ-09** : publication simultanée par deux membres : une seule published, autre409. Quota global d'auteur sur deux barathons en parallèle reste appliqué.
- **BIZ-10** : dernière réponse contre fin/retrait/suppression compte ; les deux ordres de commit donnent les seuls résultats permis. Pas de deadlock durable (timeout contrôlé si contention), aucune lecture après révocation effective.
- **BIZ-11** : perte WS, app background, réseau coupé, restart backend : REST restitue défis/son vote/résultat ; pas de replay offline après expiration. Un échec WS après commit ne transforme pas un vote accepté en échec métier.
- **BIZ-12** : badge cohérent : auteur exclu des en attente, vue seule ne décrémente pas, vote/pass décrémente, résultat vu décrémente unseen, expiration/retrait remet à jour, réponses REST arrivées hors ordre/ancien compte ignorées. Unknown WS event sans crash.
- **BIZ-13** : suppression individuelle après résultat retire son choix/identité et conserve seulement agrégats figés jusqu'au TTL ; suppression du contenu retire le résultat complet. Les tombstones closed n'exposent pas des résultats supprimés.

## 4. Non-régression ciblée — P0

- **NR-01 Création** : création/confirmation barathon, annulation, double tap et protection navigation UX-015/016, routes choisies, pas de nouveau crash NavigationContainer.
- **NR-02 QR/participation** : invitation avant/après start, QR indisponible, code vide, modale iOS unique, nouveaux membres et retrait ; conserver le comportement BUGFIX-018. L'exclusion Photo des guests ne casse pas leur barathon.
- **NR-03 États** : planned→started via deux routes, completed/stop/failed, permissions existantes et correction locale de finish si retenue ; ne pas implémenter une fin à end_datetime non prévue.
- **NR-04 Suppression** : confirmation DELETE, erreur serveur, listes/détails/QR invalidés, suppression compte web et mobile, réattribution créateur. L'activation Photo off ne doit ajouter aucune dépendance stockage à ces parcours.
- **NR-05 Résultats/missions** : 70 % d'étapes et état réel correctement distingués ; aucun gage Photo ne devient une mission/score d'étape, aucune modification des résumés existants hors lien lecture seule défini.
- **NR-06 GPS** : refus hors started, purge60s, snapshot remplace l'état, révocation/fin purgent RAM ; aucune nouvelle colonne de coordonnées utilisateur ; watcher GPS continue pendant upload malformé.
- **NR-07 WS** : connexion salon et utilisateur, ping/reconnect, remplacements/ajouts/étapes reçus pendant consultation Photo ; navigation entre nouveaux écrans ne ferme pas la socket active par un deuxième singleton.
- **NR-08 Dépenses/rôles** : création dépenses/bénéficiaires/remboursements, permissions et affichage rôles inchangés. Une réponse photo ne modifie aucune table dépenses/rôles.
- **NR-09 Ancien client** : application sans Photo utilise nouvelle API normalement ; flag off masque tout et les événements inconnus sont tolérés. Aucun champ obligatoire ajouté aux DTO existants.
- **NR-10 Web** : `/delete-account`, `/privacy`, `/join/[code]`, admin suppression ; ajout de notice sans galerie admin ni route publique média. Typecheck web obligatoire si notices modifiées.

## 5. Exploitation, migrations et performance — P0

- **OPS-01 Migration** : base PG vide→head, base au head audit→nouvelle révision, migration rejouée ; FK/CHECK/index présents, pas de drop/rename ni réécriture massive de tables existantes ; timings et locks enregistrés. Schema drift détecté, une seule tête Alembic.
- **OPS-02 Retour arrière** : simuler la révision nouvelle avec ancien initContainer et constater/documenter le risque de révision inconnue ; démontrer le digest de repli compatible qui démarre, sert le cœur PubRush et poursuit purge flag off. Tester restauration des deux références et monopod ; aucun downgrade/stamp destructif.
- **OPS-03 Docker/K8s** : UID10000, read-only rootfs, droits média, capacité réelle, HPA1/1/Recreate et un seul processus applicatif ; aucune réapplication du manifeste multipod ; restart avec votes persistés.
- **OPS-04 Charge réaliste** : 20 clients logiques, 1 publication, 19 réponses rapprochées, 20 lectures JPEG512KiB, refresh30s et flux GPS existant ; ajouter rafale d'uploads refusés. Durée 10min, appareil réel en parallèle. Cibles de qualification : pas de 5xx/OOM/restart, RSS total <400Mi au pic, boucle événementielle p95<100ms, /health p95<500ms ; routes ordinaires locales p95 dégradées de moins de20% par rapport à baseline identique. Ces seuils sont proposés, non mesurés aujourd'hui. Toute saturation qui compromet le barathon est NO_GO.
- **OPS-05 Réseau/Ingress** : HTTPS/WSS, caches/headers, limite taille sans spill, NAT commun ne bloque pas toute la soirée ; aucun élargissement global de rate limit pour contourner un problème Photo sans mesure.
- **OPS-06 CI** : Python3.11 cohérent avec Docker, tests PostgreSQL critiques sans skip, typechecks et tests mobiles requis avant livraison ; branche/PR testée sans déclencher déploiement. Vérifier qu'un push main déclenche backend et OTA même si documentaire.
- **OPS-07 Runtime mobile** : ancien preview sans caméra ne reçoit pas une OTA réclamant ce module ; runtimeVersion/appVersion compatibles documentées. Expo Go testé séparément des builds preview ; ni expo-doctor ni TypeScript ne prouvent la compatibilité binaire. Aucun build payant dans cette mission.
- **OPS-08 Purge après incident** : kill flag, backend down puis retour, fichier unlink refusé, disque plein, clé absente et restauration ; le cœur reste disponible et le média inaccessible ; runbook effectivement répétable par l'opérateur.

## 6. Recette sur deux appareils réels

Enregistrer les OS, modèle, version exacte Expo Go ou build, hash JS chargé, URL API de qualification et révision serveur. Deux personnes sont préférables : les confirmations ne sont pas simultanées si un seul opérateur alterne les appareils.

1. **REAL-01** : A iPhone créateur, B Android répondant. Caméra autorisée/refusée, bonne orientation et aperçu, publication, bannière B, badge, overlay lisible, B correct → seul A reçoit le gage facultatif. Passer le gage sans effet secondaire.
2. **REAL-02** : inverser créateur/répondant et prendre mauvaise réponse ; seul répondant reçoit le gage. Vérifier question longue, quatre choix, gros texte et clavier.
3. **REAL-03** : Passer le défi, aucune réponse et deadline ; aucun gage automatique ; bonne réponse non dévoilée si expired.
4. **REAL-04** : création caméra sans permission photothèque/microphone, refus permanent → Réglages ; annuler et reprendre, pas de fichier durable au prochain lancement.
5. **REAL-05** : couper réseau B après choix avant accusé, remettre réseau ; GET récupère une éventuelle réponse déjà commise et aucun doublon. Background puis retour après expiration ; aucun vote tardif.
6. **REAL-06** : B exclu pendant photo ouverte, UI effacée au contrôle et nouvelle requête refusée ; logout B puis compte extérieur, aucun cache. Rejoindre à nouveau n'ouvre pas l'ancien défi.
7. **REAL-07** : fin/arrêt/suppression par A pendant draft, upload, défi publié ; annulation propre, photo inaccessible, GPS et écran de fin corrects ; tester aussi challenge déjà clos.
8. **REAL-08** : naviguer jeu→carte→rôles/dépenses/invitations, retour Android, iOS sans modale double, WS d'étapes et GPS encore actifs. Au moins une répétition en réseau mobile dégradé.

Les cas à plusieurs répondants sont couverts par PG/API avec trois/quatre identités synthétiques ; compléter avec trois téléphones si disponibles, sans en faire une excuse pour omettre la preuve logique des résultats.

## 7. Commandes et décision de passage

Commandes obligatoires de baseline, dans un environnement de test explicitement isolé :

```bash
cd backend
PYTHONPATH=. .venv/bin/pytest
```

```bash
cd mobile
npx tsc --noEmit
node --test tests/*.test.cjs
```

```bash
cd web
npx tsc --noEmit
```

Pour la CI Photo ajouter les jobs de migrations/concurrence sur PostgreSQL dédié ; ne pas compter les trois tests existants comme tests de votes. Répéter les suites concernées après une correction, sans multiplier les essais identiques après succès.

**Passage final** : tous les SEC, BIZ, NR, OPS et REAL ci-dessus réussis ou, pour un contrôle opérationnel, preuve équivalente explicite acceptée par l'auditeur ; aucun P0 ignoré/skippé. Une adaptation d'OS/transport ne peut pas enlever une assertion d'autorisation ou de purge. Signer les références exactes testées, obtenir l'autorisation de déploiement séparément. Si une porte manque avant le gel retenu, **NO_GO photo**, barathon existant préservé.
