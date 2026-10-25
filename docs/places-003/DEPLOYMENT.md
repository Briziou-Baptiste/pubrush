# PLACES-003 — Lot minimal, intégration et retour arrière

READY pour intégrer les corrections de parcours **sans activer FOSSGIS**. Aucun commit, merge, push, déploiement ou OTA n’est autorisé par cette procédure seule.

## Garanties et configuration

- Backend : moteur désactivé sans `WALKING_ROUTING_ENABLED=true`, et toujours désactivé avec `ENVIRONMENT=production`. Cache séparé par mode/fournisseur.
- Mobile : moteur désactivé sans flag ; il requiert `__DEV__` et `EXPO_PUBLIC_WALKING_ROUTING_ENABLED=true`. Les bundles de release/OTA restent désactivés même si EAS porte accidentellement le flag.
- Sans routeur : distances explicitement à vol d’oiseau, durée inconnue, aucun appel FOSSGIS ; la création reste possible avec des dates/participants valides et deux étapes. L’API PubRush doit rester joignable.
- Aucun changement de dépendances Expo SDK 58, runtime, manifeste Kubernetes ou workflow. Ne pas ajouter les flags à EAS preview/production, au déploiement backend ou à un `.env` commité.

## Séquence après autorisations

1. Relire la liste exacte [git-paths.txt](git-paths.txt), sélectionner ces seuls chemins et obtenir l’autorisation de commit. Préserver les autres changements. Sur un candidat différent, revalider le code et la base. Commandes : `node --test mobile/tests/routing.test.cjs`, puis `cd mobile && npx tsc --noEmit`, et `cd backend && PYTHONPATH=. .venv/bin/pytest`.
2. Avant tout déploiement autorisé, vérifier `ENVIRONMENT=production`, les prérequis du workflow existant et l’absence d’activation volontaire. Enregistrer les digests backend/migration et les groupes EAS stables réellement actifs pour iOS et Android. Les configurations distantes ne sont pas certifiées par les tests locaux.
3. Obtenir l’autorisation couvrant le push/intégration vers `main` **et** ses effets : déploiement backend puis publication OTA preview iOS/Android. Le workflow actuel déclenche ces opérations après un push sur `main` ; ne pas traiter ce push comme une simple sauvegarde.
4. Après déploiement autorisé, vérifier sur téléphone les libellés géométriques, l’absence d’appels FOSSGIS, la création, le remplacement et l’ordre des étapes. Aucun essai piéton n’est activé par ce lot.

## Essai privé séparé

Usage privé non commercial seulement. Sur le poste de test, Expo Go/Metro en développement avec le flag mobile explicite ; matrice sur un backend **local** avec `ENVIRONMENT=development` et le flag backend explicite. Pointer le téléphone vers cette API locale selon la configuration existante. Séquencer un seul client actif et les appels mobile/backend ; les limiteurs sont indépendants et ne garantissent aucun débit agrégé. Vérifier attribution, User-Agent natif et praticabilité sur place. Respecter les conditions FOSSGIS ; ni offre commerciale ni activation de production.

## Retour arrière

- Essai local : retirer les flags et redémarrer backend et Metro ; recharger l’app, vider le cache Metro si nécessaire. La variable publique Expo est intégrée au bundle.
- Avant intégration : garder le diff ; désélectionner uniquement les chemins concernés si besoin. Aucun reset global ou suppression des autres travaux.
- Après déploiement : sur autorisation, restaurer les deux digests backend/migration enregistrés via le mécanisme de rollback existant, et republier les groupes EAS stables réellement enregistrés pour les deux plateformes/runtime attendus. Tout revert/push sur `main` relance la CI/CD et doit être autorisé. Aucun downgrade SQL requis.

## Validation et limites

PLACES-003 : 23 tests mobiles PASS (21 conservés + 2 ciblés), TypeScript PASS ; backend 82 PASS et 3 PostgreSQL SKIPPED. Tests API : création HTTP 201 moteur désactivé et après timeout. Configuration de release et production testée avec un flag hérité à `true`. Appareils, bundle OTA réel, PostgreSQL réel et terrain NOT_RUN. Disponibilité publique, entrées OSM et débit multiclient restent non garantis. Les distances à vol d’oiseau ne garantissent aucun temps de marche réel.
