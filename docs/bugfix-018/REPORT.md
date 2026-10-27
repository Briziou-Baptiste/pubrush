# BUGFIX-018 — Invitations, suppression et résultats

Date : 27 octobre 2026. Base vérifiée : `b61b31173f11d64f824e6412cdca16f6faad58bd`.
Branche : `fix/bugfix-018-invitations-deletion-results`.
Verdict : **READY pour revue/intégration**, avec recette iPhone et scan physique **NOT_RUN**.
Lot local unique, sans commit, push, OTA ni déploiement. Aucun barathon réel consulté ou modifié.

## 1. Invitation avant démarrage

Divergence sur la base : `ManageParticipantsModal.tsx:203` présente une fenêtre native, puis `:363` présente un second `InviteFriendsModal` frère lorsque le bouton `:242` est pressé. Le parcours actif présente directement une seule fenêtre (`ActiveBarathonScreen.tsx:677`). L’état React changeait bien ; la superposition des présentations natives est la cause structurelle identifiée pour le parcours iPhone. Son effet visuel exact reste à confirmer sur appareil : les tests de composants ne simulent pas UIKit.

Le contrat serveur autorise déjà `planned` et `started` : création du `join_code`, aperçu public par code, puis `/barathons/join-guest`. Il refuse `completed`, `stopped`, `failed` avec HTTP 400 et un identifiant supprimé avec HTTP 404 (`backend/app/api/routes/barathons.py:1190`, `:1220`). Aucune modification de ce contrat n’était nécessaire.

Corrections :

- [ManageParticipantsModal.tsx](../../mobile/src/features/planned/components/ManageParticipantsModal.tsx), lignes 131 et 220 : réinterroger le serveur avant invitation, vérifier statut et code, puis afficher le contenu QR **dans la fenêtre native existante**. Retour depuis le QR vers les participants, en conservant les ajouts non validés.
- [InviteFriendsModal.tsx](../../mobile/src/features/active_barathon/components/InviteFriendsModal.tsx), lignes 26 et 129 : contenu partagé entre parcours prévu et actif. URL `https://pubrush.com/join/<join_code>`, même URL dans le QR et le partage. Suppression du faux code de secours `RUSH-CODE`. Une erreur de chargement d’image arrête le spinner et propose le code/lien.
- [ActiveBarathonScreen.tsx](../../mobile/src/features/active_barathon/screens/ActiveBarathonScreen.tsx), ligne 494 : revérifier aussi le statut actif et le code avant d’ouvrir le QR. Un barathon clos/supprimé donne un message d’invitation indisponible.

L’affichage/génération du QR n’utilise aucune permission caméra ou GPS. La production de son image utilise toujours le prestataire externe existant `api.qrserver.com`. Un lien déjà partagé n’est pas révoqué physiquement : le serveur refuse toute nouvelle adhésion après clôture/suppression. L’aperçu des sessions closes reste accessible, comme auparavant.

Preuve isolée : un second utilisateur invité rejoint le **même identifiant** depuis le code de l’API, avant et après démarrage, puis son propre JWT permet de lire les détails et les deux participants. Un test enchaîne invitation prévue → démarrage → validation des étapes → fin normale → refus d’adhésion tardive → suppression.

## 2. Suppression et rafraîchissement

Le serveur était correct : `DELETE /barathons/{id}` effectue `db.delete`, puis `db.commit`, puis répond 204 (`backend/app/api/routes/barathons.py:323`). Le service mobile attendait déjà la réponse HTTP ; le succès n’était pas affiché avant la réponse.

Défaut reproduit sur la base : `PlannedScreen.tsx:50-54` remplace la liste avec chaque réponse GET, sans invalider une réponse devenue obsolète. Après le retrait local `:89`, une réponse plus ancienne peut réinsérer l’élément supprimé. Exemple : suppression en cours, sortie/retour déclenchant un GET, confirmation du DELETE, puis arrivée tardive du GET. Un autre test démontre que deux callbacks de confirmation envoient deux DELETE : l’état React seul n’est pas un verrou synchrone.

Cette course est démontrée par les tests ; aucun enregistrement réseau de l’incident iPhone n’a été fourni permettant d’affirmer qu’elle en était l’unique cause.

Corrections :

- [PlannedScreen.tsx](../../mobile/src/features/planned/screens/PlannedScreen.tsx), lignes 32, 56, 80 et 93 : numérotation des chargements et invalidation au blur, filtrage des identifiants supprimés après confirmation, verrou synchrone anti-double-suppression, état occupé transmis aux cartes. Retour au focus et rafraîchissement manuel relisent le serveur. Le succès suit le 204 ; les erreurs gardent la carte et permettent une nouvelle tentative.
- [planned.service.ts](../../mobile/src/features/planned/services/planned.service.ts), ligne 42 : exiger le 204 contractuel ; une réponse 202 ne constitue pas une confirmation.
- [PastScreen.tsx](../../mobile/src/features/past/screens/PastScreen.tsx), lignes 24 et 41 : actualisation au focus et manuelle, réponses obsolètes ignorées. Les listes ne partagent pas de cache applicatif ; elles relisent leurs routes respectives.

## 3. Résultats : cause et règle finale

Trois causes distinctes sur la base :

1. `ActiveBarathonScreen.tsx:494` et `:552` : « Terminer le barathon » au dernier arrêt ouvrait le même dialogue que l’arrêt anticipé, puis appelait systématiquement `/stop`. Le serveur enregistrait donc **stopped**, même pour une tournée parcourue entièrement.
2. `BarathonCard.tsx:59-76` : seul `completed` était un succès ; tout autre statut, sauf un `cancelled` absent du modèle SQL, devenait « Mission failed ».
3. `BarathonStopSummaryScreen.tsx:288` : le récapitulatif ignorait le statut et annonçait « Tournée accomplie » à partir de 70 % d’étapes. De plus, un échec de l’API des dépenses empêchait de relire les détails.

Le modèle ne contient **aucun résultat persistant de missions individuelles** : les « missions » sont des descriptions de rôles. Le seuil de 70 % existait uniquement dans le récapitulatif. Ce n’est pas un critère serveur de clôture.

La règle finale sépare explicitement deux notions :

- **Cycle de vie**, source de vérité : `status` de l’API. `completed` = « Tournée terminée » ; `stopped` = « Tournée interrompue » ; `failed` = « Non démarré à temps » (watcher : départ dépassé de 15 minutes, jamais démarré). Un statut absent/inconnu reste « Statut indisponible ».
- **Objectif d’étapes**, affiché séparément sur les deux écrans : ratio exact `étapes réalisées / étapes totales >= 0.7`. On conserve le seuil existant, en explicitant sa nature. Il ne transforme jamais `stopped` en `completed`. Un tableau vide ou des indicateurs d’étapes manquants donnent un résultat indisponible, sans inventer réussite ou échec. L’arrondi à l’écran ne décide pas du résultat.

Corrections :

- [ActiveBarathonScreen.tsx](../../mobile/src/features/active_barathon/screens/ActiveBarathonScreen.tsx), lignes 51, 512 et 547 : intention explicite `finish` ou `stop`. Le dernier arrêt utilise `/finish` après validation confirmée de l’étape ; un échec de validation empêche la clôture normale. Le bouton d’arrêt du bandeau utilise `/stop`, y compris au dernier arrêt. Verrou contre les confirmations multiples et navigation après réponse.
- [barathons.py](../../backend/app/api/routes/barathons.py), ligne 601 : permettre aussi au Capitaine/Maître du trajet de terminer, avec le contrôle exact déjà utilisé pour passer à l’étape suivante. Droits créateur/admin conservés ; participants ordinaires et Maître des comptes refusés.
- [barathon.status.ts](../../mobile/src/features/barathon_past_planned/utils/barathon.status.ts), lignes 1 et 25 : source commune de présentation utilisée par la carte et le récapitulatif.
- [BarathonStopSummaryScreen.tsx](../../mobile/src/features/active_barathon/screens/BarathonStopSummaryScreen.tsx), lignes 217 et 299 : statut chargé depuis l’API, détails chargés même si les dépenses échouent, erreur d’actualisation explicite, données historiques incomplètes affichées comme inconnues. Le statut de liste est passé à la navigation pour l’affichage initial depuis l’historique, puis actualisé par REST.

Aucune migration ni réécriture historique. Un ancien `stopped` à 100 % reste interrompu avec objectif d’étapes atteint. Il est impossible de distinguer automatiquement une ancienne fin normale mal enregistrée d’un arrêt explicite ; toute requalification automatique serait hasardeuse. De même, les données présentes ne permettent pas d’évaluer des missions individuelles non enregistrées.

## Validation finale

- **PASS — 34 tests mobiles ciblés**, [journal](mobile-targeted.txt), [tests](../../mobile/tests/bugfix-018.test.cjs).
- **PASS — 109 tests mobiles**, y compris les parcours de navigation existants, [journal](mobile-suite.txt). Deux anciens mocks ont été adaptés au composant partagé et aux refs persistantes.
- **PASS — 25 tests backend ciblés**, dont 20 BUGFIX-018 et 5 invitations existantes, [journal](backend-targeted.txt), [tests](../../backend/tests/test_bugfix_018.py).
- **PASS — 124 tests backend**, aucun skip, incluant les 3 tests PostgreSQL existants sur `pubrush_test` local, [journal](backend-suite.txt). Les nouveaux tests de transition utilisent SQLite en mémoire et uniquement leurs propres fixtures. Aucun accès au compte ou aux barathons de production.
- **PASS — TypeScript mobile et web**, `npx tsc --noEmit`, codes de sortie 0 : [mobile](mobile-typescript.txt), [web](web-typescript.txt).
- **PASS — contrat API** : code/identifiant, JWT du second participant, statuts, autorisations de clôture, 204/403/404, disparition des listes/détails/invitations et cascades. Pas de nouvelle route ni de champ obligatoire.
- **PASS — `git diff --check`**.
- **Témoin négatif attendu** : quatre scénarios exécutés contre les sources `b61b311` échouent, puis passent sur le lot corrigé : structure QR, double DELETE, GET ressuscitant un élément supprimé, fin normale envoyée comme arrêt. [Journal témoin](mobile-baseline-regression.txt). Ce sont des échecs attendus de l’ancienne version, pas du lot final.
- **NOT_RUN — visuel natif iPhone, scan physique et partage iOS réel** : aucun appareil/simulateur démarré avec l’application disponible dans cette session. Les tests exécutent les composants/handlers avec les frontières natives et réseau simulées ; ils ne remplacent pas une recette UIKit/Expo Go.

L’avertissement pytest sur la clé JWT de développement concerne l’environnement local de test ; aucune configuration de production n’a été chargée ou modifiée.

## Risques et intégration

Le lot inclut le changement serveur d’autorisation de `/finish` : intégrer le backend avant ou avec le mobile pour que les capitaines ne rencontrent pas de 403 avec l’ancien serveur. Aucune action de livraison n’a été exécutée.

Risques résiduels : disponibilité du prestataire QR externe, confirmation native à effectuer sur iPhone, impossibilité de requalifier les anciens `stopped` sans information métier supplémentaire. Une clôture concurrente à l’ouverture d’un QR reste contrôlée au moment de l’adhésion par le backend.

Les fichiers non suivis présents au démarrage ont été laissés en place. Aucun changement à Overpass, au routage piéton, à Kubernetes, au GPS ou aux WebSockets. La branche contient uniquement les corrections, tests et preuves BUGFIX-018.
