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
- **Age Rating**: 17+ (Alcohol References)
- **Review Notes**: 
  - Test account credentials provided below.
  - Location permissions are requested only while in use (Foreground) to track walking routes between venues and show nearby friends on the map during an active barathon. No background tracking is performed.
  - Partner events feature: Ticket codes are redemption vouchers distributed for physical, in-person nightlife events in partner venues (exempt from IAP under Guideline 3.1.3(e)).
- **Privacy (Nutrition Labels)**:
  - Location: Coarse & Precise Location (Data Used to Track You: NO, Linked to You: YES)
  - Identifiers: User ID
  - Contact Info: Email Address

## app.json NSLocation Configurations
```json
"ios": {
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false,
    "NSLocationWhenInUseUsageDescription": "PubRush a besoin de votre position pour vous localiser sur la carte et vous guider d'un bar à un autre."
  }
}
```
