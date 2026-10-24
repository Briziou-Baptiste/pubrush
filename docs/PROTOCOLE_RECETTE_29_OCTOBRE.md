# PubRush - Protocole de Recette sur Appareils Réels
**Date de la recette : Jeudi 29 octobre 2026**  
**Objectif : Validation terrain finale avant le barathon du vendredi 30 octobre 2026**  
**Équipements requis : Au moins 2 smartphones réels (1 iOS + 1 Android recommandés) avec connexion 4G/5G**

---

## 1. Cadre et Règles de la Recette

- **Gel des fonctionnalités** : Aucune modification de code ni nouvelle fonctionnalité n'est admise pendant la recette.
- **Environnement** : Backend de production (`api.pubrush.com`), base de données PostgreSQL de production, builds Version Candidate installés sur les téléphones.
- **Notation des résultats** : Renseigner pour chaque test l'un des statuts stricts :
  - `PASS` : Fonctionnement conforme au comportement attendu.
  - `PARTIAL` : Fonctionne avec une gêne ergonomique mineure ne bloquant pas le déroulement.
  - `BLOCKED` : Impossible d'exécuter le test en raison d'un blocage amont.
  - `FAIL` : Échec critique bloquant ou violation de données/sécurité.
  - `NOT_RUN` : Test non encore exécuté.

---

## 2. Checklist de Démarrage sur Téléphones Réels (via Expo Go)

L'environnement de test et d'exploitation retenu pour le barathon est **Expo Go** (SDK 57, compatible à 100% sans nécessiter de build binaire spécifique) :

### Préparation des Smartphones (Testeur A et Testeur B)
1. Télécharger l'application officielle **Expo Go** :
   - Sur iPhone : disponible gratuitement sur l'[App Store](https://apps.apple.com/app/expo-go/id982107779).
   - Sur Android : disponible gratuitement sur le [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).
2. Vérifier que les smartphones disposent d'un accès réseau actif (4G/5G ou WiFi).

### Lancement du Serveur de Développement PubRush
Sur la machine hôte :
```bash
cd mobile
npx expo start --tunnel
```
*(L'option `--tunnel` garantit l'accès à distance même si les smartphones sont sur des réseaux cellulaires 4G/5G différents).*

### Connexion des Téléphones
- **Sur Android** : Ouvrir Expo Go > Cliquer sur **« Scan QR code »** > Scanner le QR code affiché dans le terminal.
- **Sur iPhone** : Ouvrir l'application **Appareil Photo** standard > Viser le QR code > Toucher la bannière jaune **« Ouvrir dans Expo Go »**.
- **Autorisation GPS** : À l'ouverture de l'application PubRush, accepter la demande de localisation : **« Lorsque l'application est active »**.

---

## 3. Test Préliminaire Multiclient (Validation de Synchronisation à Froid - 15 min)

À exécuter dès l'installation terminée sur les 2 téléphones, AVANT d'engager la recette terrain complète :

| Étape | Action Testeur A (Créateur) | Action Testeur B (Participant) | Point de Contrôle Critique | Statut |
|---|---|---|---|---|
| **P-1** | Connexion au compte A | Connexion au compte B | Connexions réussies, écran d'accueil actif sur les deux appareils. | `[ ] PASS` `[ ] FAIL` |
| **P-2** | Crée un barathon « Pré-Recette » (2 bars) | Reste sur l'accueil | Le code d'invitation à 12 caractères et le QR code sont affichés sur le téléphone A. | `[ ] PASS` `[ ] FAIL` |
| **P-3** | Reste sur l'écran d'attribution des rôles | Rejoint via QR code ou saisie du code | **Testeur B apparaît instantanément (< 2 s)** sur l'écran de Testeur A via WebSocket sans rechargement manuel. | `[ ] PASS` `[ ] FAIL` |
| **P-4** | Appuie sur « Démarrer le barathon » | Attend sans toucher l'écran | **L'écran de Testeur B bascule automatiquement** sur la carte active du barathon en cours. | `[ ] PASS` `[ ] FAIL` |
| **P-5** | Se déplace de 30 mètres dans la rue | Reste sur place | La position de Testeur A se met à jour sur la carte de Testeur B en **moins de 3 secondes**. | `[ ] PASS` `[ ] FAIL` |
| **P-6** | Appuie sur « Terminer le barathon » | Observe l'écran | Les deux téléphones basculent simultanément sur le résumé et le tracking GPS s'arrête immédiatement. | `[ ] PASS` `[ ] FAIL` |

*Si les 6 points de contrôle sont `PASS`, la chaîne temps réel backend-mobile est validée et la recette complète ci-dessous peut débuter.*

---

## 4. Parcours Critiques de Recette

| ID | Parcours / Test | Procédure | Résultat Attendu | Statut | Notes / Testeur |
|---|---|---|---|---|---|
| **TC-01** | **Lancement via Expo Go** | Lancer l'application PubRush sur iPhone et Android via Expo Go (scan du QR code). | L'application se charge instantanément sans crash, écran d'accueil affiché, police et icônes chargées, demande de permission GPS au premier plan. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-02** | **Authentification** | Créer 2 comptes réels (Testeur A et Testeur B) avec email/mot de passe. Tester la déconnexion et reconnexion. | Comptes créés avec succès, tokens JWT stockés de manière sécurisée (`SecureStore`), reconnexion immédiate sans ressaisir les identifiants. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-03** | **Création du Barathon & Étapes** | Testeur A crée un barathon avec 3 bars, temps de trajet 10 min, temps par bar 30 min. | Barathon créé au statut `planned`, code d'invitation à 12 caractères généré, liste des étapes ordonnée. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-04** | **Invitation & Rejoindre par QR / Code** | Testeur B rejoint le barathon en saisissant le code ou scannant le QR code sur l'écran de Testeur A. | Testeur B apparaît immédiatement dans la liste des participants de Testeur A sans rechargement manuel. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-05** | **Attribution des Rôles** | Testeur A assigne un rôle à chaque participant (ex: Capitaine pour A, Sam pour B) et valide. | Rôles enregistrés en base, confirmation affichée sur les deux téléphones. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-06** | **Démarrage Temps Réel** | Testeur A appuie sur « Démarrer le barathon ». | Le barathon passe à `started`. L'écran de Testeur B bascule automatiquement en mode actif sans action manuelle. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-07** | **Diffusion GPS & Carte Live** | Les testeurs marchent dans la rue à plus de 50 m l'un de l'autre avec l'application ouverte. | La position de chaque ami apparaît en temps réel sur la carte de l'autre (icône/pin avec pseudo). Rafraîchissement fluide. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-08** | **Absence de Suivi en Arrière-Plan** | Verrouiller l'écran ou passer l'app en arrière-plan pendant 2 minutes. Réactiver. | Aucune consommation excessive de batterie, reprise immédiate du fix GPS au premier plan. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-09** | **Détection d'Arrivée à l'Étape** | S'approcher à moins de 50 m du premier bar. | L'application détecte l'entrée dans le rayon de 50 m, déclenche le chronomètre de temps au bar et bascule en phase `in_stop`. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-10** | **Avancée d'Étape Manuelle** | Testeur A valide le passage à l'étape suivante. | L'étape 1 est marquée `is_completed`, l'étape 2 devient active pour les deux participants simultanément via WebSocket. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-11** | **Remplacement d'Étape en Vol** | Testeur A remplace le bar 3 par un bar alternatif (recherche ou sélection suggérée). | Alerte reçue par Testeur B (« [Créateur] a remplacé le bar X par le bar Y »), itinéraire mis à jour sur la carte. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-12** | **Dépense Partagée** | Testeur A enregistre une dépense de 30 € payée pour l'ensemble du groupe. | La dépense est enregistrée, l'écran des soldes calcule l'équilibre (Testeur B doit 15 € à Testeur A). | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-13** | **Coupure Réseau & Reconnexion** | Testeur B active le mode avion pendant 30 secondes (simulation de bar en sous-sol), puis le désactive. | Déconnexion silencieuse gérée, reconnexion WebSocket automatique dès le retour du réseau, snapshot des positions réappliqué sans crash. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-14** | **Arrêt & Clôture du Barathon** | Testeur A clique sur « Terminer le barathon ». | Notification de fin reçue par tous, navigation automatique vers l'écran récapitulatif, tracking GPS arrêté immédiatement, WebSockets fermées. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-15** | **Vérification Purge GPS** | Après la fin du barathon, vérifier l'absence de positions en RAM et dans les bases. | Les snapshots sont vides, aucune position conservée, aucune écriture GPS en base de données. | `[ ] PASS`<br>`[ ] FAIL` | |
| **TC-16** | **Suppression de Compte (Mobile & Web)** | Supprimer le compte de Testeur B via les paramètres de l'application mobile ou via `pubrush.com/delete-account`. | Compte supprimé immédiatement, sessions et WebSockets closes sans délai, tentative de réutilisation du jeton rejetée avec code 401/1008, données personnelles effacées. | `[ ] PASS`<br>`[ ] FAIL` | |

---

## 5. Critères d'Arbitrage GO / NO-GO (Jeudi 29 Octobre - 20h00)

### Critères Déterminant un « GO »
1. **100% des tests TC-01 à TC-10, TC-13, TC-14 et TC-15 sont validés avec le statut `PASS`**.
2. **Aucun crash bloquant ni écran blanc** n'est observé sur les téléphones de test.
3. **Diffusion temps réel** : Moins de 3 secondes de latence constatée entre deux appareils lors du changement d'étape ou du déplacement GPS.
4. **Confidentialité** : Purge effective des positions GPS dès l'arrêt du barathon.

### Critères Déterminant un « NO-GO »
1. Un seul des tests TC-01 à TC-10 ou TC-14 échoue (`FAIL`).
2. Les WebSockets se désynchronisent sans reprise automatique lors d'une coupure 4G/WiFi.
3. Les coordonnées GPS continuent d'être émises ou reçues après la clôture du barathon.
4. Régression de sécurité ou indisponibilité API non résolue sous 30 minutes.
