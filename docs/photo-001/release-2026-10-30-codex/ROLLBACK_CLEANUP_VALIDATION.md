# PHOTO-001 — correctif ponctuel du nettoyage post-rollback

Date : 28 octobre 2026. Verdict ciblé : **READY_FOR_DEPLOYMENT_APPROVAL**.

Le P1 du Job est corrigé et testé. Cette décision porte sur la préparation du plan ; aucune opération de production, aucun commit, tag, push, déploiement ou OTA n’a été effectué. L’émission du certificat web, les images finales, les secrets et le déploiement restent des opérations à autoriser avec les points d’arrêt d’`OPERATIONS.md`.

## Cause et mécanisme retenu

L’ancien processus n’importait pas `app.models` avant les opérations ORM Photo : le mapper ne trouvait pas `Barathon`. Le watcher interceptait ensuite cette erreur dans sa boucle infinie. `activeDeadlineSeconds: 90000` terminait le Job en échec après 25 h sans garantir un nettoyage.

Un remplacement de pod détruit son `emptyDir` RAM. Après retour au backend f80, les éventuelles entrées SQL `photo_media` encore actives doivent seulement refléter cette perte physique. Attendre leur expiration ou essayer de retrouver les fichiers depuis un autre pod est inutile. Aucun Job n’est nécessaire si ces entrées sont déjà toutes `deleted`.

Le Job corrigé exécute une transaction SQL unique, sans code backend ajouté :

- Import explicite d’`app.models` et `app.photo_models`, puis validation des mappers.
- Exigence de PostgreSQL, révision exacte b1, flag OFF et borne temporelle avec fuseau non future.
- Mise à jour des seuls médias non `deleted`, créés avant ou à la borne de perte du stockage : `state`, `delete_requested_at`, `deleted_at`, `next_attempt_at`. Ni suppression de ligne, ni modification d’autre table, ni accès au système de fichiers Photo.
- Vérification de zéro média restant dans ce périmètre, puis commit et exit 0. Exception : rollback de transaction et exit 1, message sans URL, paramètres SQL ou identifiants.
- Délai global 120 s, connexion 10 s, requête 30 s, verrou 5 s ; aucun retry automatique, aucune boucle. UID 10000, racine en lecture seule, capacités supprimées, limites 250m/256Mi conservées, jeton de ServiceAccount désactivé. Le Job ne reçoit plus les secrets AES/JWT inutiles ; le Secret de production reste préservé.

Ce nettoyage nécessite la confirmation préalable que l’ancien pod Photo a disparu, que le seul backend est f80 et qu’aucun autre producteur Photo n’existe. Il ne convient pas à un redémarrage de conteneur conservant son volume. La date de coupure est relevée sur PostgreSQL après ces confirmations. Les médias postérieurs restent intacts et doivent être examinés séparément.

## Preuves exécutées

Tests : `tests/test_rollback_cleanup.py`. Ils extraient et exécutent la commande exacte du YAML dans des processus Python neufs.

- PostgreSQL 15.19 jetable, migré réellement jusqu’à b1 ; rôle `photo_cleanup` non-superutilisateur avec droits DML, sans droits DDL.
- Réseau Docker `none`, aucun port publié, PGDATA en tmpfs. Le conteneur de tests partage uniquement cet espace réseau isolé, utilise le candidat backend figé en lecture seule et applique UID 10000, CPU 250m, RAM 256Mi et racine en lecture seule.
- **11 PASS, 0 FAIL, 0 SKIP**, en 52,802 s.
- Ancienne commande : erreur mapper reproduite, processus toujours actif après 8 s, arrêté uniquement par le banc de test.
- Nouvelle commande : média lié, orphelin sans volume, périmètre vide, réexécution sans changement des timestamps, exclusion d’un média plus récent, rejets des bornes invalides et du flag ON.
- Échec SQL réel via transaction PostgreSQL read-only : exit 1, aucune modification persistée, aucun secret dans stdout/stderr.
- Les 25 autres tables, y compris utilisateurs, barathons, défis et résultats, sont inchangées après nettoyage.
- Validation `kubectl create --dry-run=client --validate=true` du manifeste rendu : PASS. Digest factice réservé à cette validation ; aucun objet créé, aucun dry-run serveur.

Un premier essai avait 10 PASS et 1 FAIL dans le banc de test : le délai de 2 s interrompait les imports à froid avant le message attendu sous limite CPU 250m. Ce délai de reproduction a été porté à 8 s ; aucune modification supplémentaire du Job n’a été nécessaire. La commande corrigée est bornée à 10 s par chaque contre-test et termine effectivement.

Le log final est dans `evidence/rollback-cleanup-postgres.log`, le résumé dans `evidence/rollback-cleanup-validation.json` et le diff dans `evidence/rollback-cleanup.patch`. Les 53 fichiers du candidat applicatif initial ne sont pas modifiés par ce correctif documentaire/opérationnel. Les preuves historiques 197 backend / 149 mobile / 27 déploiement ne sont pas présentées comme réexécutées ici.

## Retour arrière et autorisations restantes

Conserver backend f80 avec une image de migration compatible b1 après migration, aucun downgrade, Photo OFF et allowlist vide, Secret AES existant et Ingress API inchangés. La procédure détaillée et le rendu limité à l’image et à la date de coupure figurent en section 7 d’`OPERATIONS.md`.

Toute création du Job, modification de ConfigMap/Secret, sauvegarde de base réelle, construction/publication d’images, modification de Deployment/Service/Ingress, activation ou rollback exige une autorisation explicite. Les commits/tags et leur publication restent également à autoriser. Aucun build EAS, OTA ou push main n’est prévu par la voie manuelle Expo Go.
