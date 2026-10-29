# PHOTO-001 — préparation de livraison du 30 octobre 2026

Ce document prépare les opérations ; aucune commande de mutation ci-dessous n’a été exécutée. Le candidat source et ses tests passent. Le correctif du nettoyage post-rollback et ses preuves sont décrits dans `ROLLBACK_CLEANUP_VALIDATION.md`. Toute écriture distante, commit, tag ou publication exige l’autorisation de livraison du propriétaire ; l’approbation du plan ne prouve pas encore l’émission du certificat web ni le succès d’un déploiement réel.

## 1. Références vérifiées

- Source distante stable : `aa70e6330172bddb87b95f876e23cbdca8c7318f` ; `main` est toujours identique à cette référence.
- HEAD de travail : `ae74d7f0c128fa082d9d8101267742ed14fe792e`, avec changements locaux conservés.
- Candidat sélectionné : SHA-256 `9f36634f47eacfd894c258f8bb281903cb823d040a910dbc466f709a1b7bf37f`. Les 53 fichiers modifiés contre main et leurs empreintes sont dans `RELEASE_MANIFEST.json`.
- Backend ET initContainer migration réellement déployés : `baptistebriziou/pubrush-backend@sha256:f80fc4665d1dc06a9a98e40b302a7eb51971aea48f9ec0cea491c718f03b10b0`. Le digest a aussi été téléchargé et testé localement ; ce n’est pas une ancienne référence documentaire.
- Production : SQL `a7b8c9d0e1f2`, PostgreSQL 15.18, Deployment `Recreate`, HPA backend 1/1, un pod Ready et un endpoint.
- Après PHOTO : SQL `b1c2d3e4f5a6`, migration additive de 7 tables Photo.
- Web : aucun Deployment/Service PubRush web trouvé dans Kubernetes. Aucun digest applicatif web de repli à annoncer. `pubrush.com` présente actuellement un certificat auto-signé `TRAEFIK DEFAULT CERT` ; `api.pubrush.com` possède un certificat Let's Encrypt valide.

## 2. Impact réel de la CI/CD

L’API GitHub confirme un seul workflow actif, `.github/workflows/deploy.yml`. Le dernier run main `40529820249`, sur `aa70e63`, est terminé avec succès.

Un push ou merge sur main déclenche, sans filtre de chemins :

1. Tests backend sur Python 3.9, URL SQLite ; cette CI ne fournit pas les bases PostgreSQL de la qualification de ce dossier.
2. Build/push backend Docker (`latest` et SHA), récupération du digest.
3. Sauvegarde des références puis mise à jour des images `backend` ET `migration` avec le même nouveau digest. **La CI n’applique pas les nouveaux env, volumes, secrets ou ConfigMaps.**
4. Après succès backend, publication automatique de DEUX EAS Update sur la branche partagée `preview`, iOS puis Android. Ce n’est ni une publication atomique ni une diffusion du serveur Metro Expo Go.

Le workflow ne construit ni ne déploie le web. En cas d’échec backend, il restaure normalement les deux anciennes images. Ce repli est inadapté après migration Photo : l’ancien Alembic ne connaît pas `b1c2d3e4f5a6` (échec reproduit).

**Ne pas pousser/merger main pour cette livraison en l’état.** Route recommandée après autorisation : commit sélectif sur la branche dédiée, build/push Docker et déploiement opérateur explicites, sans OTA. Une future intégration main devra auparavant neutraliser/autoriser explicitement l’OTA et rendre le rollback conscient de la révision SQL. Aucun changement de workflow n’est appliqué ici.

## 3. Mobile : Expo Go seulement

Le propriétaire a confirmé que tous les essais/livraisons du 30 se font via Expo Go. La source utilise SDK 58, Expo `^58.0.0`, React Native 0.88.0 et `expo-clipboard` verrouillé en 58.0.4. L’iPhone Expo Go a été validé par le propriétaire sur staging.

Les lectures EAS du projet `dd7be54d-4672-4fed-b273-1d72d0fc2d15` ne retournent aucun build terminé, y compris sans filtre de profil. Elles ne prouvent aucune compatibilité d’un ancien binaire installé. Les artefacts iOS locaux ignorés par Git ne constituent pas une preuve liée à un build distribué.

Verdict : **Expo Go SDK 58 : voie retenue, aucun nouveau build EAS nécessaire. EAS/OTA : non qualifié, aucune OTA à publier.** `runtimeVersion.policy=appVersion` produit toujours 1.0.0 ; cela ne garantit pas la présence d’ExpoClipboard dans un ancien binaire. `requireNativeModule('ExpoClipboard')` est obligatoire à l’import, même feature OFF.

Si des binaires EAS redeviennent une cible : exiger des artefacts/probes iOS ET Android prouvant le module, sinon nouveaux builds avec runtime distinct. Alternative proposée seulement, non appliquée : retirer l’import/dépendance Clipboard et utiliser le `Text selectable` natif pour la copie manuelle ; cette alternative impose un nouveau gel et de nouveaux tests. Elle n’est pas nécessaire pour Expo Go.

Prévoir un hôte Metro alimenté et disponible pendant l’événement. Depuis le checkout figé, Node 24, sans charger de dotenv de recette :

```bash
EXPO_NO_DOTENV=1 \
EXPO_PUBLIC_API_URL=https://api.pubrush.com \
EXPO_PUBLIC_WEB_URL=https://pubrush.com/photo-capture \
node node_modules/expo/bin/cli start --go --tunnel --port 19011
```

Ce tunnel n’a pas été ouvert pendant la préparation. Vérifier sa disponibilité sur les téléphones avant diffusion du QR code ; utiliser Expo Go SDK 58 sur chaque plateforme effectivement utilisée. Ne pas arrêter les serveurs/tunnels staging existants.

## 4. Sauvegarde et commit sélectif — après autorisation

Une sauvegarde privée locale existe déjà : bundle Git complet vérifié, diff du worktree/index et archive des fichiers non suivis. Son chemin figure dans `evidence/workspace-preservation.json` et le compte rendu de préparation. Elle reste hors du lot de release et contient potentiellement des travaux privés. Les fichiers ignorés `.env`, volumes et médias staging restent à leur emplacement ; rien n’a été supprimé.

Avant toute nouvelle opération, refaire une sauvegarde privée avec umask 077 : `git bundle create <backup>.bundle --all`, `git diff --binary HEAD > <worktree>.patch`, `git diff --cached --binary > <index>.patch`, et une archive de la liste NUL des fichiers non suivis. Ne pas publier ces sauvegardes.

Préconditions : branche `feat/photo-001-fast-track`, HEAD ae74d7f, index vide, sources du manifeste inchangées, main distant encore aa70e63. Sinon arrêter et refaire le manifeste.

Le patch sélectif a été contrôlé sans modifier l’index :

```bash
git apply --cached --check docs/photo-001/release-2026-10-30-codex/candidate-vs-head.patch
```

Après autorisation, `git apply --cached .../candidate-vs-head.patch` prépare uniquement les blobs sélectionnés, puis vérifier le diff indexé et committer avec un message Conventional Commits. Cela inclut les trois modules Photo et les deux fichiers de tests montés sans embarquer auth/Metro/mocks, le CORS staging local de main.py ou les autres travaux. L’application à l’index ne remplace aucun fichier de travail. Ne pas utiliser de reset/stash/clean ni d’ajout global.

Un push de la seule branche dédiée ne déclenche pas le workflow main constaté. Il reste soumis à l’autorisation de publication. Ne pas merger main pendant ce parcours opérateur.

Tag stable proposé, **non créé, non poussé** : `pubrush-pre-photo-001-2026-10-28`, annoté sur `aa70e6330172bddb87b95f876e23cbdca8c7318f` avec `STABLE_TAG_MESSAGE.txt`. Vérifier d’abord son absence locale/distante. L’autorisation devra couvrir séparément la création/publication demandée ; aucune commande de tag n’a été exécutée ici.

## 5. Prérequis production à mettre en place avant activation

Les fichiers `prepared-not-applied/` sont des paramètres proposés, pas un déploiement réalisé.

1. Construire backend et web depuis le commit sélectif correspondant exactement au candidat, pour `linux/amd64`. Capturer les digests produits par les métadonnées buildx ; ne pas utiliser `latest` pour le déploiement ou le rollback. Le build web doit recevoir `--build-arg NEXT_PUBLIC_API_URL=https://api.pubrush.com`. L’image de base `node:22.23.4-alpine` a été vérifiée disponible.
2. Sauvegarder en privé les Deployment, HPA, ConfigMap, références de secrets et images actives, ainsi qu’un dump PostgreSQL cohérent et protégé, avant la migration. Ne jamais afficher les valeurs des secrets dans les logs. Le snapshot d’images présent ici ne remplace pas un backup des données juste avant livraison.
3. Préparer une clé AES aléatoire de 32 octets (64 caractères hexadécimaux), privée, dans la seule nouvelle entrée `PHOTO_AES_KEY` du Secret existant `pubrush-secrets`. Utiliser un patch de la seule clé, jamais une application globale du template de Secret. Ne pas committer la clé, ne pas la passer dans une URL/commande visible. Conserver la même clé durant la rétention des médias.
4. Préparer le ConfigMap avec `PHOTO_MYSTERY_ENABLED=false` et allowlist vide. Le patch JSON fourni ne touche que ces champs.
5. Appliquer, après autorisation, le patch stratégique `backend-photo.patch.json` à `deployment/pubrush-backend`. Il relie les cinq variables Photo dans backend et migration, impose `/tmp` en `emptyDir.medium=Memory`, taille 64Mi et quota applicatif 32MiB. **Il ne modifie ni replicas, ni stratégie, ni HPA.** Ne pas appliquer le manifeste backend complet : sa configuration nominale 2/RollingUpdate ne doit pas remplacer le monopod actif.
6. Déployer le nouveau backend et l’image de migration compatible, flag OFF. Le changement de pod ou de volume est un rollout monopod avec interruption brève ; le planifier hors défi en cours. Contrôler la révision SQL réelle après la migration, les deux imageIDs, le pod Ready et l’endpoint unique.
7. Rendre `web-deployment.template.yaml` avec `PHOTO_WEB_IMAGE` fixé à un digest, puis créer le service/web et les deux nouveaux Ingress nommés `pubrush-web-http` et `pubrush-web-https`. Ces objets sont distincts de l’Ingress API. Le resolver Traefik `le` est celui déjà utilisé pour l’API ; attendre une émission réussie, ne pas accepter le certificat par défaut et ne pas désactiver la vérification TLS.

Pour chaque template avec `${PHOTO_*_IMAGE}`, rendre uniquement les variables explicitement attendues, puis refuser tout placeholder non substitué. Le Job de rollback nécessite aussi `${PHOTO_ROLLBACK_STORAGE_LOST_BEFORE}`, selon la procédure de la section 7. Ne pas substituer globalement les références Kubernetes `$(_DB_USER)` et équivalentes. Aucune valeur de digest candidat n’est inventée dans ce dossier : les nouveaux builds/push restent à effectuer après autorisation.

## 6. Santé et activation progressive

Avant flag ON :

- GET `https://api.pubrush.com/health` = 200 ; un seul backend Ready, HPA 1/1, stratégie Recreate, un endpoint correspondant ; aucun initContainer en échec.
- SQL = b1c2d3e4f5a6 ; transactions du runtime et de la migration conformes aux droits prévus.
- `/tmp` bien monté en RAM 64Mi, répertoire privé accessible à UID 10000, quota photo 32MiB et limite mémoire du conteneur préservée.
- Clé AES présente et valide sans afficher sa valeur ; flag OFF, allowlist vide, aucun média privé servi à tort.
- `https://pubrush.com/photo-capture` répond 200 avec certificat valide, `Referrer-Policy: no-referrer`, absence de paramètres secrets dans l’URL, page construite pour l’API de production. Aucun URL staging/cloudflare dans le bundle de capture. La présence de l’API de production a déjà été vérifiée dans le chunk du build de préparation.
- Préflight CORS pour Origin `https://pubrush.com`, POST et headers authorization/content-type accepté ; le préflight public actuel a déjà répondu 200 avec la bonne origine.
- Serveur Metro du candidat prêt ; QR Expo Go distribué seulement aux participants pilotes.

Jeudi 29 : allowlist limitée à un barathon pilote synthétique ; ne jamais exécuter le seed staging sur la production. Après activation et redémarrage contrôlé, vérifier uniquement le parcours pilote et la santé. Vendredi 30 avant l’événement, utiliser la liste explicite des IDs autorisés, sans `*`.

Les variables injectées par ConfigMap sont lues au démarrage du processus : modifier un ConfigMap seul ne suffit pas. Chaque activation/changement d’allowlist implique un redémarrage ; l’emptyDir RAM est perdu lors d’un remplacement de pod. Faire ces changements avant les parties, ou après clôture/annulation consentie du pilote, jamais pendant un défi actif. Recontrôler les variables effectives et la santé après redémarrage.

## 7. Rollback réellement compatible

Test effectué sur la base jetable b1 : l’ancien ORM du digest f80 lit les tables historiques et son `/health` répond 200 ; en revanche son Alembic renvoie `Can't locate revision identified by 'b1c2d3e4f5a6'`. La migration du candidat reconnaît b1 et son upgrade head est idempotent, testé en lecture seule sur la base déjà migrée.

1. Couper les nouvelles parties Photo et arrêter la diffusion du nouveau QR. Sauvegarder les diagnostics sans secrets. Garder le schéma SQL ; aucun downgrade destructif des tables Photo en production.
2. Lire la révision SQL réelle. Si elle est encore a7 (échec transactionnel de migration), les deux images stables peuvent être restaurées. Si elle est b1, utiliser **backend f80 + image de migration compatible b1**. Ne pas utiliser un simple rollout undo ni restaurer les deux images f80.
3. Exemple pour une base confirmée b1, après autorisation et définition du nouveau digest réellement construit :

```bash
bash pubrush-k8s/monopod/rollback-backend.sh \
  --context default --namespace default --expected-cluster default \
  --image baptistebriziou/pubrush-backend@sha256:f80fc4665d1dc06a9a98e40b302a7eb51971aea48f9ec0cea491c718f03b10b0 \
  --migration-image "$PHOTO_BACKEND_IMAGE"
```

Ce script conserve Recreate/HPA 1/1 et vérifie la convergence. `PHOTO_BACKEND_IMAGE` doit être une référence immuable qualifiée contenant b1, jamais un tag flottant. Si la migration a échoué, diagnostiquer le SQL avant de choisir l’image initContainer ; ne pas tenter d’appliquer automatiquement une migration défaillante à répétition.

4. Garder Photo OFF, restaurer le bundle Expo Go stable depuis une exportation séparée de aa70e63 ; ne pas réinitialiser le worktree de développement. Faire recharger les téléphones. Aucune republication EAS n’est requise pour cette voie Expo Go.
5. Il n’existe pas d’ancien digest web PubRush dans le cluster. Pour le premier déploiement, le repli web consiste à retirer uniquement les objets web créés par cette livraison, si nécessaire, et à restaurer tout objet préexistant sauvegardé. Ne pas supprimer les Ingress/API, les secrets existants ou l’état ACME global.
6. Le remplacement du pod Photo détruit son `emptyDir` et donc ses fichiers chiffrés ; un Job distinct ne peut pas récupérer ce volume. Après rollback, il reste éventuellement des entrées `photo_media` non marquées supprimées. Le Job ponctuel corrigé ne traite que ces métadonnées SQL, sans accès à un ancien volume, sans attente des dates d’expiration et sans service permanent. Il conserve les défis, résultats, utilisateurs et barathons.
7. Avant ce nettoyage, confirmer Photo OFF et allowlist vide dans le ConfigMap **et** l’environnement effectif, le backend f80 Ready, la migration compatible b1, le HPA 1/1, et l’absence de tout ancien pod Photo, y compris terminant, ou autre producteur Photo. Conserver les UID des pods disparus dans les diagnostics. Si ces conditions ne sont pas vérifiées, arrêter : ce Job ne convient pas à un simple redémarrage de conteneur qui conserverait l’`emptyDir`.
8. Après ces confirmations, relever `SELECT CURRENT_TIMESTAMP` sur PostgreSQL en lecture seule. Conserver cette date avec fuseau en `PHOTO_ROLLBACK_STORAGE_LOST_BEFORE` : elle borne les médias du volume perdu. Vérifier les entrées `photo_media` non `deleted` créées au plus tard à cette date. S’il n’y en a aucune, aucun Job n’est nécessaire. La clé AES reste dans le Secret existant ; ce nettoyage SQL ne la lit pas et n’a pas besoin du JWT. Ne supprimer ni Secret, ni table, ni données de barathon.
9. Après autorisation, rendre le template en substituant **uniquement** `PHOTO_BACKEND_IMAGE` (digest compatible b1) et `PHOTO_ROLLBACK_STORAGE_LOST_BEFORE` (date avec fuseau, non future). Par exemple, avec ces deux variables exportées :

```bash
envsubst '${PHOTO_BACKEND_IMAGE} ${PHOTO_ROLLBACK_STORAGE_LOST_BEFORE}' \
  < docs/photo-001/release-2026-10-30-codex/prepared-not-applied/rollback-purge-job.template.yaml \
  > "$PRIVATE_RELEASE_DIR/rollback-purge-job.yaml"
```

Valider le rendu et refuser tout `${...}` résiduel ou digest flottant. Le Job doit être nouveau ; ne pas écraser un Job actif. Il charge explicitement les deux modules de modèles, exige la révision b1, puis met à jour uniquement les médias non `deleted` dont `created_at <= PHOTO_ROLLBACK_STORAGE_LOST_BEFORE`. Les timestamps de suppression sont inscrits, sans suppression de ligne ni modification d’une autre table. La vérification et la mise à jour sont dans une transaction ; une erreur renvoie 1 et annule cette transaction. Une nouvelle exécution avec la même borne ne réécrit pas les lignes déjà traitées.
10. Le Job a `restartPolicy: Never`, `backoffLimit: 0`, un délai maximal de 120 s, des timeouts SQL, et aucune reprise silencieuse. Attendre son état `Complete` et son exit code 0, puis vérifier zéro média non `deleted` dans la borne. Un état `Failed`, `DeadlineExceeded`, un code non nul ou des lignes restantes est un échec ; conserver les logs et diagnostiquer avant toute relance explicite. Les médias plus récents restent hors périmètre et exigent d’identifier leur volume/producteur avant un autre nettoyage. Ne pas lancer ce Job contre a7.

Ne pas restaurer un dump ancien pour un simple repli applicatif : cela perdrait les écritures des barathons. Aucune étape du nettoyage ne modifie les Ingress API ou l’état ACME.

## 8. État du dossier et décision

Prêts : source figée et diff sélectif, tests PostgreSQL/Alembic sans SKIP, rôles non superutilisateur, dépendances/lock, build web, route Expo Go, digests stables réels, backup Git privé vérifié, templates monopod et rollback compatible.

À réaliser seulement après autorisation pour une livraison Photo complète : web HTTPS de production, branchement des secrets/env/tmpfs et parcours manuel évitant la CI main actuelle. Les commandes de provisionnement n’ont pas été exécutées. Ces étapes conservent leurs contrôles et points d’arrêt ; aucun certificat futur ou déploiement n’est présenté comme déjà validé.

La décision ciblée après correction du P1 figure dans `ROLLBACK_CLEANUP_VALIDATION.md`. Les anciens fichiers `VALIDATION.json` et `FINAL_CHECK.json` restent les preuves datées du gel source initial ; ils ne sont pas réécrits pour simuler une validation de production. Aucune livraison n’est autorisée implicitement par cette mise à jour documentaire.
