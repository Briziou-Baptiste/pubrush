# App Store Metadata

## Metadata (English)
**Title**: PubRush - Epic Barathons
**Subtitle**: Track, share and conquer bars
**Keywords**: barathon, pub crawl, drinking game, night out, friends, map, tracking

**Description**:
Create, track, and share your epic barathons with friends! PubRush is the ultimate app for your nights out. Track your progress on the map, manage expenses, and see where your friends are in real-time. Drink responsibly and conquer the night!

## Metadata (French)
**Titre**: PubRush - Barathons Épiques
**Sous-titre**: Créez et suivez vos tournées
**Mots-clés**: barathon, tournée des bars, soirée, amis, carte, suivi, bars

**Description**:
Créez, suivez et partagez vos barathons épiques avec vos amis ! PubRush est l'application ultime pour vos soirées. Suivez votre progression sur la carte, gérez vos dépenses et voyez où sont vos amis en temps réel. Consommez avec modération !

## App Store Connect Configurations
- **Age Rating**: 17+ (Alcohol)
- **Review Notes**: This app requires location permissions to track users during a barathon event. Background location is used to keep friends in sync. Test account provided in the submission.
- **Privacy (Nutrition Labels)**:
  - Location (Coarse & Precise)
  - Identifiers (User ID)
  - Contact Info (Email)

## app.json NSLocation Configurations
Ensure `app.json` contains:
```json
"ios": {
  "infoPlist": {
    "NSLocationWhenInUseUsageDescription": "PubRush needs your location to track your barathon progress and show you on the map.",
    "NSLocationAlwaysAndWhenInUseUsageDescription": "PubRush requires background location to keep your friends updated on your position during a barathon."
  }
}
```
