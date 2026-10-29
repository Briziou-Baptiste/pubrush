# PHOTO-001 — Sécurité des photos, conservation et protection des personnes

Conception du 27 octobre 2026. **Aucune conformité juridique ni sécurité absolue n'est attestée.** Le service photo n'existe pas encore. Ce document fixe des contrôles et leurs preuves de recette ; le responsable du traitement et l'opérateur doivent confirmer les éléments contractuels inconnus avant activation.

## 1. Garantie visée et limites

Une photo doit être obtenue uniquement par l'API HTTPS après vérification serveur de la session, de la participation actuelle, de l'audience figée et de la validité du média. Ni identifiant UUID, ni code QR, ni rôle admin global, ni ancienne URL ne suffisent. Aucun endpoint statique, bucket public ou lien présigné n'est fourni aux clients.

La révocation prend effet au commit de retrait du droit : toute **nouvelle** requête de lecture doit ensuite échouer, même avec une ancienne URL et un JWT toujours valide. Un téléchargement déjà autorisé peut avoir livré des octets ; un destinataire peut faire une capture d'écran ou utiliser un autre appareil. L'effacement serveur n'efface pas ces copies. Le chiffrement au repos n'empêche pas un backend compromis ou un opérateur disposant de la clé de lire une photo.

## 2. Risques concrets et contrôles attendus

### S01 — Accès horizontal / IDOR — risque critique de la nouvelle fonctionnalité

Changer barathon_id/challenge_id, réutiliser une URL issue d'un autre groupe, demander HEAD/Range, lire le résultat via une liste : toutes ces voies doivent utiliser la même politique. Requêtes SQL contraintes au couple barathon/challenge et au membre courant ; UUID v4 mais jamais utilisé comme autorisation. Un admin extérieur reçoit 404 pour lire. Tests SEC-01/02/03.

### S02 — Invité usurpé — défaut existant démontré

`join-guest` peut réémettre un JWT sur code + pseudo d'un invité existant ; [AUDIT.md](AUDIT.md) fournit les preuves. Les invités sont exclus **en SQL** de toutes les routes Photo, compteurs et destinataires WS, même si leur JWT omet/falsifie un claim `is_guest`. Garder leur accès ordinaire au barathon hors de ce lot ; ne pas prétendre corriger le défaut existant en masquant le bouton. Si le jeu doit inclure ces invités : correction de réauthentification séparée et nouvelle revue obligatoires.

### S03 — Départ, exclusion, compte supprimé, réadhésion — critique

L'audience mémorise l'identité du lien de participation. Révocation transactionnelle avant le commit des suppressions ; comparaison systématique au lien courant. Une réadhésion avec le même compte ne récupère pas les anciennes photos. Suppression du compte revalidée par `get_current_user`. Défis ouverts annulés lors du retrait d'un membre de leur audience, purge des photos de l'auteur retiré, aucune confiance dans un socket encore ouvert. Tests concurrents, pas seulement séquentiels.

### S04 — URLs publiques, prévisibles ou réutilisées — critique

La clé de stockage n'est jamais une URL, ni un nom soumis par l'utilisateur. Pas de `StaticFiles`/Next public/CDN. Pas de signed GET au MVP : un lien présigné est un droit porteur réutilisable jusqu'à expiration, indépendamment d'une suppression de participation côté application ([S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)). Une ancienne URL API reste soumise à l'autorisation et aux TTL à chaque GET. HTTP redirigé vers HTTPS ; aucune mise en cache publique, même sur erreurs ou HEAD.

### S05 — Jetons et liens dans les logs — chemin de fuite démontré, fuite historique non vérifiée

Le transport WS existant place le JWT dans la query string. Le code Uvicorn installé (`websockets_impl.py`, `get_path_with_query_string`) peut journaliser cette URL à la connexion. Aucune lecture de logs contenant potentiellement des jetons n'a été faite. Il faut traiter la configuration réelle, pas affirmer qu'une compromission s'est produite.

Avant activation : filtrer/retirer query strings et Authorization au logger Uvicorn **y compris ses lignes WebSocket et refus**, Traefik, gestionnaires d'erreurs et outils d'observabilité. Un simple `--no-access-log` peut ne pas couvrir toutes les lignes WS : vérifier avec un jeton synthétique marqué. Aucun corps Photo ou exception contenant le corps dans logs/Sentry. Si des JWT historiques sont effectivement présents, l'opérateur doit en limiter l'accès, les purger selon sa politique et traiter leur révocation/rotation avant d'introduire les photos ; ne pas exposer les jetons dans le rapport. Ne pas ajouter un token d'image dans une URL pour résoudre un souci d'affichage mobile.

### S06 — Upload déguisé, polyglotte, contenu actif — élevé

Le Content-Type fourni et la signature magique sont des indices, pas une validation suffisante. Détecter le format réel, vérifier le fichier, rouvrir et décoder complètement avec décodeur JPEG/PNG autorisé ; rejeter fichier tronqué, animé/APNG, multi-image, SVG, GIF, WebP, HEIC serveur, PDF, ZIP et formats non nécessaires. Recréer des pixels RGB dans une image vierge puis réencoder JPEG sans reprendre le fichier entrant. Un fichier accepté est toujours servi sous le MIME fixe JPEG, nosniff, jamais sous son nom original. Pas de téléchargement d'URL fourni par utilisateur (évite SSRF).

Ces mesures suivent les principes [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Aucun antivirus ou service d'analyse externe facturable proposé. Le réencodage réduit certaines charges cachées, il ne garantit pas l'absence de faille du décodeur : Pillow maintenu/épinglé et fixtures adverses restent obligatoires.

### S07 — Gros fichiers, bombes de décompression et blocage du monopod — élevé

Limiter les octets pendant `request.stream()`, pas après `await request.body()` illimité. Refuser Content-Encoding compressé, taille >2 MiB avec ou sans Content-Length ; délai de transfert 15 s. Autoriser et limiter avant consommation/parsing. Route Ingress Photo dédiée : même chaîne sécurité/TLS, maximum et buffer mémoire tous deux 2 MiB pour éviter le spill d'originaux sur disque ; la limite applicative reste obligatoire si Traefik est contourné.

Pillow : définir `MAX_IMAGE_PIXELS=6_000_000`, convertir `DecompressionBombWarning` en erreur, vérifier côtés ≤4096 **avant load**, frames=1, décodage complet. [Pillow documente les seuils et avertissements](https://pillow.readthedocs.io/en/stable/reference/Image.html). Un sous-processus borné, un seul à la fois, reçoit les octets par pipe ; budget cible 192 MiB d'espace mémoire, CPU/temps borné, timeout mur 5 s, kill + reap effectifs. Valider ces limites sous Linux et conteneur 512 Mi ; adapter les limites vers le bas si nécessaire, jamais enlever la borne. Un `wait_for` sur un thread n'interrompt pas un décodeur natif : ce n'est pas une protection suffisante.

Le parent ne doit pas bloquer l'event loop, ni conserver tous les buffers après traitement. Pas de file d'attente CPU non bornée. Saturation 429/Retry-After, disque bas ou quota atteint 503/429 ; GPS/health/réponses ordinaires doivent rester disponibles. Tester plusieurs appareils sous le même NAT à cause du rate limit Traefik existant.

### S08 — EXIF, GPS et autres métadonnées — élevé

Les fichiers entrants peuvent contenir des positions GPS malgré `exif:false` dans Expo. Les originaux restent uniquement dans un buffer borné et le cache temporaire du téléphone. Corriger l'orientation, créer une image RGB vierge et encoder sans EXIF/XMP/IPTC/ICC/commentaire/thumbnails/nom de fichier. [ImageOps.exif_transpose](https://pillow.readthedocs.io/en/stable/reference/ImageOps.html) aide pour l'orientation mais ne remplace pas l'élimination de toutes les métadonnées.

Vérifier les **octets finaux déchiffrés** avec un parseur indépendant : aucune coordonnée, tag de date/auteur, modèle de téléphone ou vignette embarquée. Une image peut montrer une adresse ou un visage dans ses pixels : supprimer les métadonnées ne masque pas ces informations. Aucune colonne GPS utilisateur, aucun enregistrement GPS extrait, aucune photo analysée par une IA externe.

### S09 — Stockage, snapshots et clés — élevé, garanties opérationnelles non vérifiées

PVC dédié, non accessible au web ; accès OS 0700/0600, UID10000/GID10001 ; pas de hostPath arbitraire. Chiffrement applicatif détaillé ci-dessous, et chiffrement disque si disponible. Restreindre exec/RBAC/backups et accès au nœud. Les Secrets Kubernetes encodés en base64 ne constituent pas à eux seuls un chiffrement au repos. Vérifier protection d'etcd et snapshots, et la séparation réelle des clés/fichiers. Aucun secret dans Git, logs, image Docker, app.json ou EXPO_PUBLIC.

### S10 — Suppression incomplète, crash, orphan files — élevé

Le registre `photo_media` survit à la cascade du défi. Le retrait logique précède toujours l'effacement physique et ferme l'API même si unlink échoue. Retry durable, contrôle d'absence, scan borné des orphelins ; test du crash à chaque étape. L'effacement Unix ne prouve pas l'effacement physique de blocs SSD ou snapshots. Ne pas appeler une ligne SQL supprimée « fichier définitivement détruit ».

### S11 — WebSocket non autorisé — élevé

Pas de photo, question, réponse ni résultat dans les sockets de salon. Invalidations minimales via `/ws/me`, filtrées par droits courants non invités. Une socket authentifiée autrefois ne donne aucun accès média ; REST réauthentifie. Les requêtes client `PHOTO_*` via WS ne peuvent pas soumettre/clôturer un défi : ces opérations passent uniquement par REST. Ne pas journaliser les erreurs brutes des objets WebSocket RN qui peuvent inclure une URL.

### S12 — Bonne réponse dévoilée avant clôture — critique pour l'intégrité du jeu

DTO publics explicitement déclarés ; pas de `from_attributes` automatique sur l'ORM contenant correct_index. Pas de correction dans les réponses POST/PUT, listes, validation errors, logs, notifications ou state global partagé. Les erreurs Pydantic ne doivent pas réémettre `input` ni corps avec correct_index. Tester aussi les clés mal orthographiées/extra qui pourraient refléter le corps. L'auteur connaît nécessairement sa propre saisie ; les autres ne la reçoivent qu'en `closed`. Les réponses des autres restent privées même après clôture dans ce MVP minimisé.

### S13 — Doubles réponses et clôtures, courses de droits — élevé

PK de réponse, résultat unique, locks SQL et ordre commun avec les routes de fin/retrait. Tests PostgreSQL avec sessions/connexions distinctes et barrières synchronisées. Des tests SQLite séquentiels ou un verrou Python ne prouvent pas l'intégrité après restart ni les courses du serveur.

### S14 — Cache mobile, captures et sauvegarde téléphone — résiduel important

`expo-image cachePolicy=none`, pas de prefetch ; vider les écrans en arrière-plan et sur perte de droit, pas d'image dans SecureStore/offline queue/params/router. Répertoire cache photo dédié à nettoyer au prochain démarrage. Pas de copie en photothèque. Tester sur deux OS qu'une reconnexion avec un autre compte ne montre aucun fichier ancien. Les originaux capturés, copies OS temporaires et captures d'écran ne sont pas contrôlables absolument ; expliquer cette limite et ne pas promettre la suppression des copies personnelles.

### S15 — Sauvegarde/restauration et rollback — élevé

Ne pas sauvegarder le volume photo pour l'essai. Vérifier que les snapshots VPS ne le réintroduisent pas en incluant tout le disque ; si l'exclusion ne peut être établie, ne pas activer sous cette politique. Exclure les **données** des tables `photo_*` des sauvegardes logiques ordinaires si possible, conserver leur schéma. Si des sauvegardes globales de DB contiennent les textes/résultats : durée maximale proposée 7 jours, chiffrées, accès restreint, notice exacte. Aucune affirmation que cette politique est déjà appliquée.

Après toute restauration DB/snapshot de l'essai, avant ouverture du trafic : désactiver Photo et **purger toutes les données Photo restaurées et tous les fichiers Photo**, pas seulement ceux au TTL dépassé. Cela empêche de ressusciter un retrait effectué après la sauvegarde, sans introduire un nouveau journal externe d'effacement. Les autres données PubRush ne sont pas concernées. Le rollback applicatif conserve le schéma et la purge ; il n'est pas une restauration de données.

## 3. Pipeline stockage et crash consistency

### Écriture privée

1. Authentifier l'auteur courant non invité, état started/draft, quotas et santé stockage. Acquérir la place unique d'upload, avec rejet immédiat si occupée. Transfert et traitement hors transaction longue.
2. Sous les locks définis dans ARCHITECTURE, réserver une ligne media `staged` avec storage_key aléatoire et échéance dure `created_at+6h` ; commit. Vérifier aussi l'unicité par challenge ; ne pas remplacer une image déjà prête.
3. Lire au maximum 2 MiB en mémoire, traiter dans le worker borné. Réencoder JPEG, si >512 KiB réduire qualité/dimension selon une séquence bornée (1600→1280→1024, qualité 80→65) ; si toujours trop grand, refuser. Pas de boucle sans borne ni dégradation illisible silencieuse.
4. Chiffrer la **sortie nettoyée uniquement** via `cryptography` déjà présent. AES-256-GCM, clé serveur aléatoire dédiée, nonce aléatoire 96 bits neuf à chaque chiffrement, unicité DB `(key_id,nonce)`. AAD canonique `photo001:v1:<media_uuid>` empêche l'échange de deux objets. [La documentation AEAD](https://cryptography.io/en/latest/hazmat/primitives/aead/) rappelle l'exigence de non-réutilisation des nonces et l'échec d'authentification si le contenu change. Pas d'algorithme maison.
5. Enveloppe versionnée contenant key_id/nonce/ciphertext+tag, jamais la clé. Écrire dans un fichier temporaire **déjà chiffré** sous le même répertoire privé, O_EXCL/O_NOFOLLOW, 0600 ; fsync fichier, rename atomique vers `<storage_uuid>.enc`, fsync dossier. N'accepter aucun segment de chemin client. Vérifier le format de clé serveur et la racine résolue.
6. Reprendre les locks et revalider auteur/lien/statut/expiration/flag. Si l'auteur est parti, la partie terminée ou le draft retiré pendant le traitement : ne jamais passer ready, marquer delete_pending. Sinon stocker dimensions/tailles/hash interne et state ready, incrémenter version, commit.
7. Libérer buffers, fichiers temporaires mobile et slot ; aucune notification collective avant publication. Échec de commit après écriture : ligne staged/scan d'orphelins permet le nettoyage ; aucun média n'est servable sans état ready lié à un défi autorisé.

Configurer une clé dédiée via Secret monté en lecture seule, pas une réutilisation du JWT secret. Le déploiement avec flag off fonctionne sans clé ; flag on sans clé/montage doit échouer **pour Photo seulement**. Rotation : nouvelles écritures sur nouvelle key_id ; ancienne clé conservée uniquement jusqu'à purge des objets encore présents, pas de rotation improvisée pendant la soirée. Pas de promesse de crypto-effacement si des sauvegardes de clés inconnues existent.

### Lecture privée

Vérification SQL des droits et TTL à chaque appel ; charger seulement le fichier chiffré désigné par la ligne media ready. Rejeter symlink, absence, taille incohérente, tag invalide. Déchiffrer le petit objet en mémoire, répondre avec headers non cachables, sans redirection. Sur anomalie : 503 générique au membre autorisé, aucune clé/trace interne ; marquer le média indisponible et retirer le contenu si nécessaire. Ne jamais servir l'original en fallback.

### Purge automatique

- Toutes les 30 s et au démarrage, scanner les lignes dues : state delete_pending, challenge absent, draft expiré, barathon terminal, échéance photo dépassée. Verrouiller en petits lots et respecter l'ordre barathon/challenge avant media lorsque les lignes existent.
- Retrait logique et mark delete_pending dans la transaction métier ; unlink après commit, ENOENT vaut succès. Reprendre les échecs avec backoff borné 30 s/60 s/120 s puis 5 min, persistant en SQL. `deleted` seulement après absence vérifiée.
- Scan périodique du dossier : ne considérer que clés et suffixes attendus, pas de suivi symlink ; supprimer les fichiers sans ligne correspondante et temporaires vieux de >15 min. Une réservation staged récente ne doit pas être supprimée pendant l'upload. Un staged >15 min est abandonné et purgé.
- Alerte si une purge attend depuis >5 min, si volume libre <256 MiB, quota proche, clé manquante ou compteur d'échecs en hausse. Bloquer les nouveaux uploads si la purge n'est plus fiable. Indiquer le retard ; ne pas annoncer un effacement physique réussi.
- L'opérateur de l'essai vérifie la santé avant et après événement ; en cas de backend indisponible, procédure de purge opérateur sur volume privé et registre SQL, sans attendre un cron externe supposé existant. Aucun redémarrage ne rend un objet retiré accessible.

## 4. Politique de conservation proposée pour l'essai privé

Les durées sont des choix de minimisation pour cette finalité, pas des délais imposés par le RGPD. La [CNIL demande une durée déterminée selon la finalité](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees).

- **Original entrant** : en mémoire serveur pendant traitement ≤20 s cible, jamais écrit durablement ; cache téléphone temporaire nettoyé après action ou au prochain démarrage. Traefik doit respecter la même absence de spill disque pour cette route.
- **Draft non publié** : accès auteur seulement, expiration 15 min après création ; retrait immédiat de l'accès à l'expiration, fichier purgeable dans la minute en fonctionnement normal.
- **Photo publiée** : accès jusqu'au premier de `upload_at+6h`, `terminal_at+15min`, fin/arrêt/suppression du barathon, retrait explicite ou départ de l'auteur. Annulation/expiration sans résultat : accès coupé immédiatement. Le délai terminal+15min concerne seulement `closed`. Le TTL dur 6h ne dépend pas d'un watcher réussi et ne se prolonge jamais par lecture/retry.
- **Questions/options/bonne réponse/réponses/résultats** : au plus 24 h après création du défi, puis purge ; retrait explicite ou suppression de compte peut avancer l'effacement. Aucun historique permanent, classement ou export photo.
- **Tombstones quotas/idempotence** : minimum d'identifiants pseudonymes et timestamps, au plus 24 h après création. Aucune image, texte ou réponse ; effacement des liens personnels lors de suppression de compte.
- **Logs techniques** : 7 jours maximum proposé, sans corps/image/JWT/URL complète ni coordonnées ; métriques agrégées possibles ensuite. Les UUID de corrélation sont par requête, pas des identifiants de compte.
- **Sauvegardes** : photos exclues ; métadonnées si sauvegarde globale inévitable ≤7 jours avec restriction d'accès et purge complète Photo avant restauration en service. Ces garanties doivent être attestées opérationnellement avant essai.

Une demande d'effacement rend immédiatement le contenu inaccessible après commit, puis purge physique visée <60 s en service normal, alerte à 5 min. Si panne, le retard doit être traité et documenté. Pas de promesse de récupération de copies chez les participants, ni de destruction instantanée de tout support physique.

## 5. RGPD : données, finalités et base légale à décider

### Données et minimisation

Les IDs de comptes/participations, photo, question, propositions, bonne réponse, choix individuel, résultat/gage facultatif, dates et éléments de consentement éventuels sont des données personnelles dès qu'ils se rapportent à une personne. Une photo d'objet peut révéler un visage en arrière-plan, un nom sur un reçu ou un lieu. Pas de reconnaissance faciale, biométrie, score de consommation, données médicales ou localisation extraite. Finalité unique : jouer ensemble et afficher un résultat éphémère au groupe restreint.

Ne recopier ni email, nom complet, pseudo historique ou coordonnées dans les nouvelles tables. Pas d'utilisation pour publicité, profilage, entraînement de modèles ou statistiques de personnes. Les permissions OS n'établissent pas une base légale RGPD.

### Bases légales possibles, à documenter par finalité

Le consentement n'est pas automatiquement requis pour tout traitement et n'est pas interchangeable avec les autres bases ([CNIL, consentement](https://www.cnil.fr/les-bases-legales/consentement)). Pour ce jeu facultatif, une démarche de consentement spécifique, libre, éclairé et retirable est une option plausible pour la publication et la participation ; elle exige un choix réel et un retrait sans pénalité. La confirmation technique de publication ne suffit pas à prouver tout cela.

L'exécution du contrat ne peut couvrir que des traitements objectivement nécessaires au service demandé ; l'inscription générale à PubRush ne rend pas toute photo nécessaire. Un intérêt légitime pour la sécurité technique demande une analyse séparée de nécessité et de mise en balance, sans s'étendre automatiquement au partage des images ([CNIL, intérêt légitime](https://www.cnil.fr/fr/les-bases-legales/interet-legitime)). Identifier responsable de traitement réel, base retenue par finalité, destinataires, durée, droits et procédure avant activation. La consultation du groupe ou une case de l'auteur ne recueille pas le consentement d'un tiers photographié.

### Règle de contenu pour vendredi

**Objets et scènes sans personne identifiable uniquement.** Interdire visages, corps identifiables/tatouages, mineurs, tiers en arrière-plan identifiables, documents, plaques, écrans privés, tickets nominatifs, éléments intimes ou sensibles. L'auteur vérifie l'aperçu et cadre à nouveau. Aucune détection automatique n'est promise. Si une personne ou donnée apparaît malgré la règle : retirer immédiatement le défi ; tout membre de l'audience dispose d'une action de retrait. Le droit à l'image est à examiner séparément du RGPD. Une future version autorisant des personnes exige une politique et une analyse supplémentaires.

### Information préalable proposée

> Photo Mystère est facultatif. Photographiez uniquement des objets, sans personne identifiable ni document personnel. La photo sera visible par les comptes participants éligibles présents au moment de sa publication. Elle sera retirée à la fin du barathon, à votre demande, ou au plus tard selon la durée indiquée ci-dessous. Les résultats sont conservés au maximum 24 heures. Les autres participants peuvent faire des captures : ne partagez rien de sensible. Les gages sont facultatifs, sans obligation d'alcool ; vous pouvez toujours passer.

Compléter l'écran avec les valeurs précises de la politique : photo jusqu'à 15 min après clôture, maximum 6 h, retrait dès fin du barathon ; lien politique et contact vérifié. Ajouter une confirmation non précochée de la règle « aucun tiers identifiable ». Si le consentement est la base choisie, distinguer son texte et sa preuve (version/date/action) de la simple acceptation d'une règle. Répondre ou passer ne conditionne jamais la participation au reste du barathon.

### Droits et demandes

Retrait dans le jeu, suppression de compte via `DELETE /me` et page `/delete-account` maintenues. Un tiers non inscrit doit disposer d'un contact opérationnel vérifié pour demander retrait ; ne pas demander la photo par email ni créer une autre copie. L'organisateur peut identifier le défi par ID opaque et le retirer sans exposer une galerie admin. Prévoir accès/export des données encore conservées, rectification par retrait/recréation avant publication, opposition/retrait selon la base, effacement et information sur les sauvegardes. Le délai de traitement juridique et l'identification proportionnée du demandeur doivent être définis par l'exploitant.

Ne pas reprendre la phrase actuelle « toutes vos données ... immédiatement détruites » pour les fichiers, caches ou sauvegardes. Adapter les notices et le message de suppression à la réalité opérationnelle sans fragiliser la route existante.

### Sous-traitants, hébergement et transferts

- Backend/PVC : cluster VPS observé ; fournisseur contractuel, pays, DPA et snapshots non vérifiés. Le texte web Vercel/AWS n'est pas une preuve du lieu de ces données.
- Expo/EAS : distribution du code/binaire ; ne pas y envoyer les photos. Vérifier configuration des logs, télémétrie et plugins natifs. Aucun push provider introduit au MVP.
- QRServer : reçoit déjà le lien d'invitation, pas de photo prévue ; ne pas le considérer comme prestataire média.
- GitHub/Docker registry : code et images techniques, jamais données de test réelles/images de participants ou secrets.
- Support email : contact actuellement affiché à vérifier, juridiction et sous-traitance à inventorier si des demandes personnelles y transitent.

Confirmer lieux de traitement et accès hors EEE, encadrement des transferts éventuels, sous-traitants ultérieurs et mesures supplémentaires si applicables. Ne pas inventer une région UE, un DPA ou un contrat sur la base d'une adresse IP. Si ces informations et la politique de sauvegardes ne peuvent être établies avant l'essai, garder Photo désactivé.

### AIPD et responsabilité

La [CNIL](https://www.cnil.fr/fr/ce-quil-faut-savoir-sur-lanalyse-dimpact-relative-la-protection-des-donnees-aipd) demande une AIPD pour les traitements susceptibles de présenter un risque élevé. Documenter un screening : petite échelle privée, objets, pas de personnes autorisées, pas de biométrie/surveillance/classement, rétention courte réduisent le risque ; alcool/contexte festif, vulnérabilité des personnes, tiers involontaires et diffusion non maîtrisée l'augmentent. Pas de conclusion automatique « AIPD inutile ». Réexaminer avant galerie publique, mineurs, visage, statistiques, grande échelle ou autre finalité. Si le screening conclut à risque élevé, réaliser l'AIPD avant déploiement.

Prévoir un responsable joignable pendant l'essai et un processus d'incident : désactivation Photo, restriction accès, préservation minimale de preuves sans recopier les images, évaluation de la violation et des obligations de notification par l'exploitant. Ne pas créer une collecte extensive « au cas où ».

## 6. Conditions de sécurité non négociables

SEC-01 à SEC-18 de [TEST_PLAN.md](TEST_PLAN.md) passants, aucun invité accepté, aucune bonne réponse prématurée, aucun original ou jeton dans les logs/disques temporaires serveur, stockage privé/chiffré/purge démontrés, effacement après restauration défini, permissions/cache validés sur les deux OS, information et responsabilités établies. Un seul défaut critique ouvert suffit à **NO_GO photo**, même si le jeu semble fonctionner visuellement.
