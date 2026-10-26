# UX-NAV-001 — Navigation mobile

Verdict : **PARTIAL** — corrections et validations locales terminées ; recette visuelle et gestuelle sur iPhone et Android encore nécessaire avant validation pour le 30 octobre.

État de la validation locale, avant autorisation d’intégration et de publication.

Branche : `fix/ux-nav-001`, créée depuis `origin/main` après fetch (base `709694c6b718d54e7cb8313f4950f1a54c7c40e7`). Aucun commit, push, déploiement ou OTA. Les fichiers non suivis préexistants de `docs/places-*` ont été conservés.

## Avant / après

Inventaire limité aux contrôles de navigation et de fermeture des écrans mobiles. « Header » désigne désormais le header natif du Stack Expo Router, fixe au-dessus du contenu : flèche blanche de 22 dp, fond sombre et zone tactile de 48 × 48 dp, libellé d’accessibilité « Retour ». Aucun nouveau composant React n’a été créé.

| Écrans ou panneaux | Avant | Après |
| --- | --- | --- |
| Connexion | Écran racine sans retour ; succès remplaçant uniquement la route courante | Racine sans retour ; succès réinitialisant l’historique vers l’accueil |
| Inscription | Pas de flèche ; lien « Se connecter » en bas ajoutant une route | Flèche dans le header à gauche ; lien réutilisant la connexion existante ; confirmation si saisie abandonnée |
| Mot de passe oublié / réinitialisation | Texte « ← Retour » dans le contenu défilant, sans repli | Flèche fixe à gauche ; repli vers connexion / demande de code ; confirmation si saisie abandonnée |
| Accueil | Carte racine, ouverture du menu | Carte conservée ; fermeture explicite du menu ajoutée |
| Création — configuration | Retour sombre dans le formulaire défilant | Header à gauche ; avertissement avant abandon ; clavier tenant compte du header |
| Création — sélection des bars | Petit retour à droite de l’en-tête flottant | Header à gauche ; bars transmis à la configuration lors des modifications et restaurés en continuant |
| Création — récapitulatif / détails du barathon | Retour dans le ScrollView ; avertissement d’ajouts incomplet pour le geste iOS | Header à gauche ; même garde pour bouton, geste et retour système ; validation des ajouts toujours proposée en mode détails |
| Barathons prévus / historique | Retours textuels dans le contenu ; remplacement vers `/` ou `/home` | Header à gauche ; véritable historique si présent, accueil sinon ; suppression du détour par `/` |
| Attribution des rôles | Retour textuel défilant ; sélections perdues au retour | Header à gauche ; confirmation avant abandon des rôles ; attente pendant une soumission |
| Barathon lancé | Pas de retour visible ; anciens écrans de préparation encore sous la carte | Carte racine conservée ; historique de préparation retiré en gardant la clé de l’écran actif |
| Bilan après arrêt / fin | « Retour à mes barathons » tout en bas ; risque de retourner aux rôles par l’historique | Header à gauche ; historique normalisé vers prévus, historique ou accueil selon la provenance ; bouton inférieur retiré |
| Profil / informations personnelles | Retour textuel, parfois dans la zone défilante | Header à gauche ; protection des modifications non enregistrées des informations personnelles |
| Barathons enregistrés / mes dépenses / dépenses du barathon | Retours textuels de styles différents | Header à gauche ; retour au vrai parent et destination de repli si ouverture directe |
| Événements / carte partenaire | Retour dans le contenu / icône à droite sur la carte | Header à gauche ; carte et contrôles flottants respectant les insets latéraux et inférieurs |
| Menu de l’accueil | Fermeture par le fond extérieur seulement | Croix explicite en haut à droite, au-dessus du contenu défilant |
| Invitation QR / activation d’événement | Croix en haut à droite avec petites cibles | Croix conservées, cibles de 48 dp et libellé « Fermer » |
| Rappel des rôles | Bouton « Compris ! » en bas | Croix en haut à droite ; action inférieure redondante retirée |
| Gestion des participants / changement d’heure | « Fermer » / « Annuler » en bas | Croix en haut à droite ; validation seule en bas ; avertissement si participants ajoutés non validés |
| Remplacement ou ajout d’étape | Croix en haut et annulation en bas | Croix de 48 dp en haut ; validation seule en bas ; fermeture bloquée pendant la requête |
| Ajout d’un lieu / aperçu d’une suggestion | « Non / Oui » / « Ajouter / Fermer » en bas | Croix en haut à droite ; « Ajouter ce lieu » / « Ajouter » en bas |
| Nouvelle dépense / enregistrement du bilan | Annulation en bas | Croix en haut à droite ; action principale en bas ; protection d’une dépense saisie et des requêtes en cours |
| Sélecteurs de date et d’heure | Annuler / Valider en haut avec petites cibles ; enveloppe Android pouvant rester ouverte | Positions conservées, cibles ≥ 48 dp ; annulation native Android ferme l’enveloppe, sélection confirme une seule fois |
| Confirmation d’arrêt et alertes destructives | Choix natifs Annuler, ou « Non / Oui » pour l’arrêt | Alertes destructives conservées ; arrêt libellé « Annuler / Arrêter », cibles ≥ 48 dp |

## Comportement et périmètre

- Les 18 routes secondaires utilisent le même header. `index`, connexion, accueil et carte active restent des racines sans flèche artificielle.
- Le bouton utilise le vrai retour lorsqu’un historique existe. Sans historique, bouton et retour système Android ont une destination de repli explicite, sans exception « GO_BACK not handled ».
- L’aller-retour récapitulatif → carte conserve l’écran de carte monté. Carte → configuration → continuer restaure les bars, leur ordre et leur type. Les champs de configuration restent en mémoire. Une ouverture directe carte/récapitulatif conserve les paramètres du parcours fournis au retour vers sa configuration.
- Après création, la pile devient accueil → prévus : revenir en arrière ne réouvre pas le formulaire déjà soumis. Après connexion ou inscription, l’accueil devient racine. Après réinitialisation de mot de passe, la connexion devient racine.
- Le lancement retire les anciennes routes de préparation, en conservant la clé de la carte active. Aucun appel de suivi, de connexion ou de déconnexion GPS/WebSocket n’a été changé. Les dépenses ouvertes depuis cette carte reviennent normalement à la même carte.
- Le bilan conserve sa clé lors de la normalisation de l’historique. Provenance `past` → historique ; `active` → prévus ; sinon → accueil.
- Les gardes `usePreventRemove` couvrent aussi le geste iOS. Les formulaires laissés sous un écran suivant ne bloquent pas la fin réussie du parcours. La navigation de démarrage reçue du serveur reste acceptée pendant l’attribution des rôles.
- Les SafeAreaView des écrans avec header ne rajoutent pas une seconde marge supérieure. Les modales utilisent les safe areas ; les formulaires ajustent l’évitement du clavier ; la carte de sélection déduit aussi la hauteur du header pour dimensionner son panneau.
- Aucune animation globale n’a été remplacée. La désactivation préexistante du geste iOS sur `planned` et celle du retour prédictif Android dans la configuration sont conservées. Il n’existe pas de navigateur Expo Tabs : les onglets clavier/scanner des événements restent des états internes inchangés.
- Aucun changement du backend, du web, de Kubernetes, des API de lieux, des services d’itinéraire piéton, des services GPS/WebSocket ou des dépendances. Seule la navigation d’écran mobile et ses contrôles ont été modifiés.

## Validation exécutée

| Vérification | Résultat |
| --- | --- |
| `cd mobile && npx tsc --noEmit` | PASS, 0 erreur |
| `cd mobile && node --test tests/*.test.cjs` | PASS, 44 tests dont 10 ciblés UX-NAV-001 |
| ESLint sur les 30 fichiers source concernés, comparé au contenu de `HEAD` | PASS, 0 erreur ; 51 avertissements préexistants restants contre 55 avant ; 0 nouvelle alerte |
| `cd mobile && CI=1 EXPO_NO_TELEMETRY=1 npx expo export --platform ios --platform android --max-workers 2 --output-dir /private/tmp/ux-nav-001-export` | PASS, bundles Hermes iOS et Android exportés localement |
| `cd backend && PYTHONPATH=. .venv/bin/pytest` | 86 PASS, 3 SKIP (intégration PostgreSQL réel indisponible dans cet environnement) |
| `cd web && npx tsc --noEmit` | PASS, 0 erreur |
| `git diff --check` | PASS |

Les tests UX exécutent le vrai réducteur StackRouter installé, les callbacks du header, le gestionnaire Android, les callbacks de connexion/inscription et de fermeture des participants, la garde de sortie et le sélecteur de date. Les vues React Native et les effets natifs sont simulés : il ne s’agit pas d’une recette sur téléphone ou d’un test de services en production.

Preuves : [tests mobiles](mobile-tests.txt), [comparaison ESLint](lint-comparison.json), [export Expo](expo-export.txt), [résultats structurés](validation.json). Test ciblé : [ux-nav-001.test.cjs](../../mobile/tests/ux-nav-001.test.cjs).

## Recette physique restante

À exécuter sur iPhone Expo Go SDK 58 et Android avant de déclarer READY, sans lancer de déploiement ni d’OTA :

1. Connexion → inscription → retour avec saisie : Rester conserve tout, Abandonner revient à la connexion ; connexion réussie puis retour système ne réouvre pas l’authentification. Vérifier également le parcours de réinitialisation.
2. Accueil → création → saisir nom/date/heure/rythme → choisir au moins deux bars → récapitulatif → geste retour vers carte → retour vers configuration → continuer : vérifier champs, bars, ordre et types. Répéter avec bouton système Android.
3. Ajouter des participants, revenir par flèche, geste et bouton système : vérifier Rester, Abandonner et Valider en mode détails. Confirmer la création : retour de prévus vers accueil sans écran intermédiaire de création.
4. Prévu → rôles → assignations → retour : vérifier la confirmation ; lancer le barathon. Vérifier qu’aucun geste ne ramène à une ancienne préparation ; ouvrir les dépenses puis revenir à la carte sans interruption de suivi.
5. Ouvrir et fermer les modales (QR, rôles, participants, heure, ajout/remplacement, dépense, sauvegarde, événement) par la croix et le bouton système ; vérifier la fermeture pendant une requête et l’abandon d’une dépense saisie.
6. Arrêter/terminer un barathon de test, consulter le bilan et revenir : vérifier la liste cible et l’absence de retour à une session close. Faire aussi historique → bilan → retour.
7. Profil → informations personnelles / dépenses / sauvegardes → retour ; modifier les informations, vérifier Rester puis Abandonner. Vérifier la lisibilité avec clavier, texte agrandi et sur petit écran ; contrôler encoche, Dynamic Island et barre de gestes Android.
8. Réouvrir directement profil, détails, carte et récapitulatif avec des paramètres valides, puis sans historique. Faire un rechargement Expo sur ces écrans. Vérifier les replis et l’absence de boucle. Les tests automatisés couvrent les transitions correspondantes, pas la réception effective des liens par le système.

## Risques et limites

- **Présentation native non vérifiée visuellement sur téléphone** : hauteur réelle du header, cibles dans la barre iOS, espace restant sur la carte, petits écrans, clavier et texte agrandi restent à contrôler.
- **Gestes natifs et cycle de vie réel** : les tests de réducteur ne prouvent pas le comportement du swipe iOS ni l’absence de remontage natif lors d’un reset conservant une clé. Le retour dépenses → carte et le passage au bilan doivent être vérifiés avec le suivi actif.
- **Brouillons en mémoire** : retour attendu préservé, mais aucune persistance supplémentaire après fermeture forcée de l’application ou rechargement qui efface l’état et ses paramètres. Les liens incomplets ne peuvent pas reconstruire des informations absentes ; ils ramènent à une configuration utilisable. Les participants non validés au récapitulatif demandent confirmation avant abandon.
- **Lint historique** : 51 avertissements restent hors de ce périmètre. Les trois tests PostgreSQL réel ignorés ne constituent pas une validation de cette base.
- **Export local seulement** : aucun binaire natif installé, aucune validation sur les serveurs de production, aucun envoi aux utilisateurs. Les corrections restent à relire et à tester sur téléphone avant autorisation de livraison.

Références utilisées pour les primitives existantes : [Stack Expo Router](https://docs.expo.dev/router/advanced/stack/) et [usePreventRemove React Navigation](https://reactnavigation.org/docs/use-prevent-remove/).
