# PLACES-005 — bars voisins, repli de navigation et ergonomie

26 octobre 2026. Base `main@de86a86`, branche locale `fix/places-005-map-and-nearby`, Expo SDK 58.

**Verdict PARTIAL : corrections prêtes à intégrer et à recetter dans Expo Go.** Le routage piéton intégré en production reste BLOCKED en attente d’un fournisseur et d’un compte validés. Le repli sans routeur est opérationnel. Aucun commit, merge, push, déploiement, OTA, appel facturable ou changement Kubernetes. Les fichiers non suivis PLACES-002/003/004 présents au démarrage sont préservés et exclus du lot.

## P0 — cause des établissements manquants

Reprise ciblée d’AUDIT-PLACES-001 (A2, A5, A6, A7/A8) et des garanties PLACES-002/003/004 ; aucun nouvel audit général.

Le [snapshot Overpass archivé](toulouse-overpass.json), demandé autour du **Délirium Café, node/5289461810**, confirme ces objets OSM :

- Délirium : `43.6070791, 1.4512943`, `amenity=bar`, numéro 54 dans `contact:housenumber` et allées Jean Jaurès dans `contact:street`.
- **El Tío Mojito**, `node/13198405230` : `43.6078306, 1.4512561`, `amenity=bar`, **51 Allées Jean Jaurès**, environ **84 m à vol d’oiseau** du Délirium.
- Un autre objet **Tito Mojito**, `node/7700449713`, est présent à `43.6100825, 1.4429057`. Le snapshot ne porte pas son adresse ; l’associer au 40 rue Merly demeure une indication utilisateur, pas une adresse inventée par le correctif.

Le lieu Jean Jaurès n’est donc pas absent d’OSM ni mal catégorisé. La différence de nom « El Tío » explique qu’une recherche « Tito » puisse être moins évidente ; aucune coordonnée ni fiche n’est ajoutée en dur à l’application.

**Étape démontrée de disparition : `out center 50`**, avant tout tri. Dans le snapshot de 565 bars/restaurants, le nœud Jean Jaurès arrive en 551e position ; avec le filtre historique global `pub|bar` de la migration, il arrive en **133e position**. Les deux variantes le coupent. Le correctif remonte le lieu en **2e position** backend, après le Délirium lui-même ; le filtre mobile retire le Délirium sélectionné et conserve Tito en premier voisin.

La requête réelle gratuite, son heure, le timestamp des données et son SHA-256 sont dans [request.json](request.json). Attention : le miroir primaire `.fr` déclare une base OSM au **10 août 2026** sur cette réponse. Ce constat ne certifie ni la fraîcheur de tous les miroirs, ni l’ouverture réelle des établissements. Une requête nominative préalable sur le même miroir a confirmé les trois nœuds ; aucune requête PubRush de production n’a été faite.

Corrections :

- `backend/app/api/routes/bars.py` : sélection nommée sans plafond amont ; tri par distance quand la durée est inconnue, puis limite finale à 50 ; rayon Haversine exact conservé à `80 × budget_minutes` sans promesse de temps piéton. Coordonnées node/center vérifiées, doublons de même nom à ≤10 m seulement, adresses `addr:*` ou `contact:*` avec numéro.
- Les filtres intégrés bars/restaurants couvrent aussi les biergärten, cafés/restaurants ayant une activité bar explicite, clubs et restauration rapide. Un restaurant avec bar reste accessible via le filtre restaurants. Le sélecteur canonique remplace les anciens sélecteurs trop étroits des filtres globaux `bar`/`food` ; les autres filtres personnalisés sont conservés. Aucun changement de base/migration.
- Photon reçoit les filtres de catégories **avant sa limite de résultats**, selon son [API officielle](https://github.com/komoot/photon/blob/master/docs/api-v1.md). Son repli Overpass transmet désormais le filtre demandé. Photon demeure un géocodeur incomplet, sans garantie de couverture.
- `nearbyPlaces.service.ts` / carte de création : suppression du rejet « coordonnées proches OU sous-chaîne de nom ». Deux bars voisins différents et deux adresses de même enseigne restent distincts. Tri géographique des durées inconnues et retrait des suggestions obsolètes après édition. Le centre reste le dernier lieu sélectionné ; ajout en fin/remplacement conservent les règles PLACES-002/003.

Si un autre établissement manque réellement dans OSM : rechercher son nom officiel puis son adresse dans Photon ; vérifier dans le site de l’établissement ou dans une recherche Google/Apple Maps ouverte à la demande, sans API Places facturable. Une adresse géocodée seule ne prouve pas l’existence d’un bar. Faire confirmer l’emplacement et proposer une correction OSM sourcée ; ne pas recopier des coordonnées d’un service tiers en inventant une fiche. Aucun établissement de secours fictif n’est créé ici.

## P0 — « trajet indisponible » et choix retenu

La cause exacte en configuration de production est `getRouteLabel()` : tout segment `straight_line` ajoutait « trajet indisponible », y compris lorsque le routeur est volontairement désactivé. Le service mobile renvoie alors immédiatement une distance Haversine et `durationMinutes=null`, sans HTTP. Backend : les durées restent également inconnues. Ce cas ne démontre aucune impossibilité de marcher entre les bars.

Le libellé devient simplement **« N m à vol d’oiseau »**. Les pointillés restent approximatifs ; seuls les résultats valides du graphe piéton portent « Piéton calculé ». `NoRoute`/`NoSegment` restent des absences explicites de route, distinctes d’une panne. Les gardes de production FOSSGIS et les tests PLACES-002/003 restent en place.

Évaluation bornée des options déjà identifiées dans l’audit, vérifiée sur les sources officielles le 26 octobre :

- **FOSSGIS public** : débit maximal et obligations d’attribution dans la [politique officielle](https://routing.openstreetmap.de/about.html), restrictions d’usage et absence de garantie déjà analysées dans PLACES-002. Pas de nouveau calcul ni activation en production.
- **HeiGIT/openrouteservice `foot-walking`** : usage commercial Standard confirmé par [l’équipe HeiGIT](https://ask.openrouteservice.org/t/free-plan-in-an-app-with-a-paid-tier-license-cc-by-sa-4-0-personal-data-and-attribution-questions/8079). La [FAQ officielle](https://giscience.github.io/openrouteservice/frequently-asked-questions) impose une clé côté serveur et décrit les quotas Directions. Un compte et ses quotas, les conditions complètes, l’attribution CC-BY-SA et la disponibilité correspondant à PubRush restent à valider. La page web principale était indisponible, sans que cela prouve une panne API. Aucune clé/activation validée n’a été fournie dans cette mission ; aucun appel API HeiGIT.
- **Geoapify `walk`** : les [conditions officielles](https://www.geoapify.com/terms-and-conditions/) requièrent un compte, encadrent l’usage commercial gratuit en production, imposent les crédits et réservent le SLA aux plans payants. Compte, plafond sans dépassement facturable et niveau de service non validés ici ; aucune activation ni appel API.
- Un moteur auto-hébergé demanderait préparation/actualisation du graphe et exploitation : infrastructure hors périmètre de ce lot, aucun changement monopod.

**Repli livré pour vendredi :** boutons « À pied dans Maps » sur les liaisons de création/récapitulatif et commande explicite dans le barathon actif. Ils ouvrent une [URL Google Maps universelle](https://developers.google.com/maps/documentation/urls/get-started), sans clé ni requête à l’API Directions facturable ; ce n’est pas un fournisseur intégré ni un engagement de disponibilité. Dans le barathon actif, une destination peut aussi être ouverte sans origine GPS disponible, laissant Maps demander l’origine. Les erreurs d’ouverture sont gérées. La sélection/création/réorganisation et le remplacement/ajout restent indépendants du routeur.

Après le barathon : prioriser un proxy backend HeiGIT `foot-walking` pour routes **et** matrices, avec compte approuvé, quotas communs, cache borné, limite d’accrochage, timeout/repli, attribution/licence et tests terrain. Ne transmettre que des coordonnées de lieux ; aucune extension du traitement GPS utilisateur. Une offre avec disponibilité contractuelle ou un moteur régional exploité doit être retenu si la navigation intégrée devient essentielle.

## P1 — carte et gestes

- `RouteSummarySheet.tsx` : poignée, glissement vertical vers le bas sur l’en-tête, tap carte/recherche pour replier, bouton **Déplier** et glissement haut pour rouvrir. Seul l’en-tête capture les gestes verticaux ; la liste et la carte gardent leurs propres gestes. Le contenu demeure monté, les lieux et paramètres du formulaire restent dans leur état existant.
- Safe areas iOS/Android et hauteur disponible ; suggestions/recentrage de création positionnés selon la taille du panneau.
- `RoutingAttribution.tsx` : retrait de l’encadré de légende, crédits OSM/ODbL et correction dans un pied discret. Le crédit OSRM/FOSSGIS apparaît seulement dans le mode privé activé. Le fond de carte conserve ses crédits natifs. Distances et lien de navigation restent près des étapes ; le formulaire parle de **budget**, pas d’un temps garanti.
- Écran actif : mesure des panneaux haut/bas, commandes de carte placées entre leurs limites ; disposition horizontale si l’espace vertical est réduit. Panneaux défilables avec hauteur plafonnée, lignes d’actions/métriques adaptables. Cibles flottantes **48×48**, libellés accessibles et marge pour le hitSlop. Logiques GPS, WebSockets, rôles et dépenses inchangées.

## Validation et reproduction

- **PASS : 34 tests mobiles** (`routing.test.cjs` + `places-005.test.cjs`) : régressions PLACES-002/003, panne/réseau/timeout, changements d’ordre/coordonnées, zéro HTTP sans routeur, vrais POI Toulouse archivés, voisins distincts, URL externe, gestes de l’en-tête et maintien du contenu monté. Les tests JSX utilisent des primitives natives simulées ; ils ne remplacent pas un test natif.
- **PASS : 86 tests backend ; 3 PostgreSQL réel SKIPPED**, suite complète avec SQLite isolé, dotenv désactivé et URL PostgreSQL volontairement locale indisponible. Inclut création sans fournisseur/en timeout et étapes dynamiques existantes. L’assertion de création PLACES-003 suit désormais l’ordre des candidats réellement soumis, puisque le classement de proximité a changé.
- **PASS : TypeScript mobile et web**, `npx --no-install tsc --noEmit` (web : `--incremental false`).
- **PASS : export Metro/Hermes iOS + Android**, sans publication, dans `/private/tmp/pubrush-places005-export-final`. Aucune dépendance, configuration Expo/runtime, fonction protégée ou infrastructure changée.
- **PASS : calculs de disposition** pour fenêtres 320×568, 375×667, Android 320×480 et 360×640, paysage 667×375, avec safe areas et panneaux à leur hauteur maximale. Ces tests vérifient les marges et les cibles, pas le rendu sur de vrais appareils.
- **NOT_RUN : appareils réels/simulateur, rendu visuel natif, gestes carte vs panneau, ouverture Maps native, marche terrain, PostgreSQL réel, disponibilité en charge.** Recette Expo Go nécessaire avant vendredi.

Rejouer Toulouse hors ligne, depuis la racine :

```sh
PYTHON_DOTENV_DISABLED=1 DATABASE_URL=sqlite:///:memory: PYTHONPATH=backend \
  backend/.venv/bin/python docs/places-005/verify_toulouse.py
node --test mobile/tests/routing.test.cjs mobile/tests/places-005.test.cjs
```

`--fetch` effectue **une** requête Overpass gratuite et remplace les preuves locales ; sans option, aucun réseau. Le script signale si l’ordre de la source change et exige une réévaluation de la reproduction. Les tests figent le snapshot livré, pas une vérité terrain permanente.

Recette Expo Go sur cette branche : démarrer le backend corrigé avec une **base locale de test préparée**, `ENVIRONMENT=development` et `WALKING_ROUTING_ENABLED=false`. Garder la configuration de production intacte. Depuis `mobile/`, lancer (remplacer l’adresse LAN) :

```sh
EXPO_PUBLIC_API_URL=http://ADRESSE_LAN_DU_MAC:8000 \
  EXPO_PUBLIC_WALKING_ROUTING_ENABLED=false npx expo start --go --clear
```

Utiliser le même réseau local et un compte de test. L’export a été vérifié ; cette commande de lancement et la recette téléphone ne sont pas annoncées exécutées. Avec l’API de production inchangée, seule la partie mobile du lot est essayable : le correctif de recherche nécessite le backend de cette branche.

1. Sélectionner Délirium Jean Jaurès, budget 15 min, filtre Bars ; voir **El Tío Mojito, 51 Allées Jean Jaurès**, puis l’ajouter. Vérifier le dernier établissement comme nouveau centre, sans retirer les étapes précédentes.
2. Ajouter un troisième lieu, déplacer/remplacer/supprimer une étape ; constater les nouvelles distances géométriques, aucune minute calculée ni ancien tracé. La confirmation reste possible sans routeur si l’API PubRush répond.
3. Glisser la poignée vers le bas, toucher la carte, déplier et revenir au formulaire ; vérifier nom/date/budget/liste. Déplacer la carte et faire défiler la liste séparément, ouvrir/fermer le clavier.
4. Ouvrir une liaison dans Maps puis revenir. En mode avion, le service externe peut être indisponible ; les distances locales et la sélection restent visibles, une création serveur nécessite le réseau.
5. Dans un barathon de test lancé, tester les deux boutons à droite et les commandes inférieures, petit iPhone/Android, tailles de texte augmentées et rotation. Vérifier attribution et safe areas.

Risques résiduels : dépendance communautaire et fraîcheur OSM, limite finale aux 50 plus proches, absence de garantie de marche/ouverture, arbitrage natif des gestes à recetter. La requête élargie rapporte davantage de POI ; timeout et repli existants restent applicables. Aucun cache de durée inconnue ni route FOSSGIS de production ajouté.

## Périmètre et intégration

Le [manifeste](git-paths.txt) énumère les seuls fichiers du lot. Inclure ses nouveaux fichiers non suivis lors d’une intégration autorisée ; ne pas embarquer les anciens dossiers de preuves PLACES-002/003/004 par un `git add .`. Aucun commit n’a été créé conformément à AGENTS.md. Une intégration sur `main` déclenche les publications existantes et nécessite son autorisation explicite.

Retour arrière : retirer uniquement les changements de ce manifeste après sauvegarde du diff ; aucune migration, donnée ou configuration de production à restaurer dans ce lot. Ne pas réactiver FOSSGIS pour compenser le retrait. Une éventuelle publication ou annulation de publication reste soumise à autorisation.
