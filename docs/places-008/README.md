# PLACES-008 — recherche et visibilité des bars voisins

**Verdict : PARTIAL pour intégration.** Les corrections et validations locales passent. La recette physique iPhone/Apple Maps et Android/Google Maps reste NOT_RUN ; les tests de composant simulent les primitives natives et ne prouvent pas le nombre de pins réellement visibles sur téléphone.

Branche : `fix/places-008-nearby-reliability`, créée depuis `origin/main@7aec88bc7b49a1a2b34d2ffd03842c13003dcd4b`. Aucun commit, push, déploiement ou OTA. Les fichiers préexistants, preuves de déploiement et références de rollback ont été préservés. Aucun changement Kubernetes, GPS, WebSockets, routeur piéton ou fournisseur payant ; FOSSGIS reste désactivé en production.

## Correctifs

- **Carte de création** : remplacement des caméras dépendant de `zoom` par des régions explicites pour la sélection et par `fitToCoordinates` pour les suggestions. Attente de la disponibilité native de la carte, de sa taille mesurée et de la mesure des panneaux. Marges tenant compte des safe areas latérales/basse et des panneaux ; le header natif est déjà hors de la scène mesurée. Arrondi des marges en entiers requis par le binding Android.
- **Exploration** : un seul cadrage à l'arrivée des résultats d'une nouvelle sélection, d'un filtre ou d'une relance. Toucher/déplacer la carte annule le cadrage en attente. Aucun abonnement aux changements de région. Les changements ultérieurs de panneaux ne recentrent pas. « Voir » cadre les suggestions à la demande, sans requête réseau.
- **Écrans courts** : si la zone libre est insuffisante, le récapitulatif est replié, puis la recherche est compactée si nécessaire. Les mesures natives suivantes déclenchent le cadrage. Le bouton loupe rouvre la recherche, les données et le parcours restent montés/conservés. Aucun nouveau composant React.
- **Lisibilité** : compteur de lieux proposés après exclusion des étapes déjà choisies, état de recherche, « Voir » et « Relancer » avec cibles d'au moins 44 points. Les résultats limités et les erreurs réseau sont distingués d'un résultat vide complet. Recherche par nom toujours disponible. Le centre reste le dernier établissement choisi.
- **Overpass** : tout `remark` non vide est rejeté, y compris avec des éléments exploitables. Une réponse complète vide est acceptée sans repli. Un seul miroir de secours existant peut être appelé, séquentiellement, puis un seul appel Photon. Suppression de l'éventail de quatre appels concurrents. Pas de fusion d'une réponse partielle avec un autre inventaire.
- **Délais** : requête QL à 2 s pour un timeout HTTP d'au plus 3 s par fournisseur ; budget de lancement total de 9 s partagé avec le repli. Ce budget n'est pas une garantie absolue de durée murale : urllib applique des délais de socket, et DNS/lecture peuvent dépasser l'objectif. Le mobile abandonne réellement la requête à 12 s ; changement de centre/filtre et démontage annulent la requête de la carte. Les autres consommateurs Nearby disposent aussi d'un timeout de 12 s.
- **Photon** : filtres existants et plafonds 15 bruts / 10 candidats conservés ; distance appliquée ensuite. Fournisseur identifié comme `photon`, état limité systématique. Aucune augmentation de rayon, requête supplémentaire ou création d'établissement. Les résultats limités ne sont pas mis en cache Nearby, afin qu'une relance puisse tenter à nouveau Overpass.
- **Modale d'ajout/remplacement** : reçoit aussi l'état limité et affiche l'avertissement avec relance manuelle. La logique de modification du parcours et son choix de centre restent inchangés.
- **Compatibilité** : `/bars/nearby` conserve son tableau JSON. Métadonnées dans les headers `X-Places-Provider`, `Raw-Count`, `Filtered-Count`, `Returned-Count`, `Limited`, `Reason` (avec le préfixe `X-Places-` pour chacun). Le wrapper mobile historique renvoie toujours un tableau.

## Rejeu public Tito Mojito, Toulouse

Centre : **Tito Mojito Merly, OSM node/7700449713**, budget 12 min, filtre Bars, rayon 960 m. Réemploi du diagnostic AUDIT-PLACES-007 et des fixtures PLACES-005 ; aucun nouvel audit général ni nouvel appel à la production ou aux fournisseurs publics.

- **Overpass complet** : 673 objets → 117 bars catégorisés → 116 dans le rayon après dédoublonnage → **50 transmis** → **49 suggestions / éléments Marker**, après retrait du Tito déjà sélectionné.
- **Primaire partiel, secours complet** : les 3 objets synthétiques du primaire sont rejetés ; le secours complet restitue les mêmes **50 / 49**, sans état limité final.
- **Deux réponses Overpass partielles, repli Photon** : fragments rejetés → Photon 15 objets → plafond 10 → **3 dans le rayon / transmis / marqueurs**. Message « Résultats limités. Relancez ou recherchez un lieu par son nom. » Aucun mélange avec les fragments Overpass.
- **Tous fournisseurs indisponibles** : tableau vide avec `provider=none`, `limited=true`, `reason=providers_unavailable` ; possibilité de relance/recherche par nom. Un vide complet Overpass reste distinguable de cette panne.

Ce sont des relectures hors réseau des réponses capturées le 26 octobre 2026 pendant AUDIT-PLACES-007. La base OSM du serveur français était datée du 10 août 2026 ; ces comptes ne constituent pas un nouvel inventaire en direct. Les 673 objets ont été conservés avec leurs coordonnées publiques ; seuls les tags utiles au parseur sont archivés. Données © OpenStreetMap contributors, ODbL 1.0 : https://www.openstreetmap.org/copyright. Photon conserve son GeoJSON public capturé lors du même audit. Aucune position ou identité d'utilisateur.

Rejeu reproductible, sans réseau ni SQL :

```sh
PYTHONPATH=backend PYTHON_DOTENV_DISABLED=1 DATABASE_URL=sqlite:///:memory: backend/.venv/bin/python docs/places-008/replay.py
```

## Diagnostic technique

Backend : une ligne `places.nearby` par réponse avec fournisseur, brut reçu, conservé après filtrage géographique/dédoublonnage, transmis après plafond, état limité, motif énuméré et indicateur de cache. Les fragments rejetés ont une ligne `places.provider` avec compte brut et `accepted=0 reason=partial` (au plus deux lignes). Aucun nom, coordonnées, identifiant, token, URL de requête ou texte d'exception dans ces nouvelles lignes.

Mobile de création : une ligne `[places.nearby]` par résultat accepté avec fournisseur, brut/filtré/transmis backend, filtré mobile et nombre d'éléments Marker créés. Ce dernier compte mesure les éléments React, pas leur visibilité native. Les anciens logs Nearby contenant l'établissement et ses coordonnées ont été retirés. Pas d'envoi de télémétrie ni de stockage supplémentaire.

## Validation

- **PASS** — backend complet : **95 passed, 3 skipped**. Les trois tests PostgreSQL réels nécessitent leur environnement dédié ; pas de nouvelle base démarrée. Neuf nouveaux cas couvrent comptes Tito, JSON/headers, anonymisation, vide complet, rejet partiel et secours, Photon, timeouts, panne totale, budget épuisé et payload invalide.
- **PASS** — mobile complet : **64 tests**, dont **20 nouveaux** PLACES-008. Cadrage de 2/10/50 suggestions pour iOS et Android simulés, attente map/layout, 49 Marker Tito, absence de recadrage après gestes/panneaux, geste pendant requête, relance manuelle, écran court/très court, requête obsolète ignorée, timeout client, en-têtes, ancien wrapper tableau, centre du dernier bar et avertissement dans la modale.
- **PASS** — `npx tsc --noEmit` mobile et web.
- **PASS** — lint ciblé des quatre fichiers TypeScript modifiés : **0 erreur, aucun nouvel avertissement** ; 10 avertissements préexistants conservés. Comparaison avec HEAD dans `lint-comparison.json`.
- **PASS** — export Expo SDK 58 iOS et Android, Hermes, bundles locaux dans `/private/tmp/places-008-export`. Cet export assemble le JS et les ressources ; il ne compile pas une nouvelle application native et ne publie aucune mise à jour.
- **PASS** — `git diff --check`. Vérification du diff limitée aux cinq fichiers applicatifs et aux tests/preuves PLACES-008.
- **PASS / vérification du binding** — API native installée react-native-maps 1.29.11 : iOS `AIRMapManager.m:333` délègue à `fitToCoordinates:edgePadding:animated:` ; Android `MapView.java:1575` construit des bounds avec marges converties selon la densité. Les régions explicites évitent la différence de prise en compte de `camera.zoom` Apple/Google.
- **NOT_RUN** — rendu, gestes et animations sur iPhone et Android physiques ; latence réseau réelle avec ces nouveaux délais ; déploiement/OTA. Aucun serveur de développement lancé pour essayer l'app.

Preuves : `backend-tests.txt`, `mobile-tests.txt`, `mobile-types.txt`, `web-types.txt`, `lint-comparison.json`, `expo-export.txt`, `replay.json`, `validation.json`. Les fichiers TypeScript de sortie sont vides lorsque la commande réussit.

## Recette physique restante et risques

1. Sur iPhone puis Android : sélectionner Tito Merly, budget 12 min/Bars. Comparer compteur, pins et ligne de diagnostic ; vérifier que le dernier bar et les voisins sont cadrés au-dessus du récapitulatif et sous la recherche. Le nombre live dépend du fournisseur, il n'est pas fixé à 49 dans le produit.
2. Déplacer/pincer pendant une recherche : aucune reprise automatique du cadrage ; « Voir » doit fonctionner. Ouvrir/replier/glisser le récapitulatif, puis rouvrir la recherche sur petit écran. Conserver le parcours après retour/récapitulatif.
3. Vérifier les cibles tactiles, l'encoche et l'indicateur d'accueil, l'orientation, les animations et les pins rapprochés. Les tests locaux n'assurent pas la séparation visuelle de marqueurs superposés. Une scène extrême laissant moins de 96 points libres après compaction conserve la carte sans forcer un cadrage ; le portrait reste à vérifier sur les petits appareils.
4. Tester un réseau lent/coupé : fin du chargement, message approprié, relance unique et recherche par nom. Aucun test réseau public supplémentaire n'a été lancé pour simuler une panne.

Photon peut toujours ne proposer que quelques lieux ; il est maintenant explicitement limité, sans prétendre remplacer un inventaire local. La disponibilité des serveurs Overpass et les délais urllib restent des risques externes. Le secours est volontairement borné à un miroir pour limiter charge et latence ; son efficacité réelle devra être observée après une intégration autorisée. L'avertissement et les compteurs fournisseur exigent le backend et le mobile de cette correction ; les anciens clients restent compatibles avec le tableau JSON mais n'afficheront pas ces informations.

La cause historique des deux pins vus par l'utilisateur reste non démontrée ; les défauts confirmés ont été corrigés et instrumentés sans réattribuer cette session à une cause non prouvée.

## Références principales

- Backend : `backend/app/api/routes/bars.py:24` (métadonnées), `:34` (compteurs), `:430` (réponse compatible/tri/50), `:539` (budget), `:551` (rejet partiel), `:565` (repli).
- Mobile : `mobile/src/lib/api.ts:293` (lecture des diagnostics), `:309` (requête), `mobile/src/features/create_barathon/services/mapLayout.service.ts:23` (marges mesurées), `screens/CreateBarathonMapScreen.tsx:326` (chargement), `:381` (cadrage), `:745` (compteurs).
- Autre consommateur Nearby : `mobile/src/features/active_barathon/components/ReplaceOrAddStopModal.tsx:99` et `:409` (état limité).
