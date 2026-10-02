# PubRush Mobile App (Expo)

This is the mobile application for PubRush, built using React Native and Expo, with Expo Router for navigation.

## Features
- **Expo Router**: File-based routing.
- **Real-time Map**: Live location tracking and geofencing.
- **WebSockets**: Real-time sync with friends.
- **EAS**: Builds and Over-the-Air updates using Expo Application Services.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in the backend API URL and any other necessary keys.
```bash
cp .env.example .env
```

### 3. Start Development Server
```bash
npx expo start
```
You can use the Expo Go app on your physical device, or run it on an iOS Simulator/Android Emulator.

## TypeScript Validation
Run the TypeScript compiler to check for type errors without emitting output:
```bash
npx tsc --noEmit
```

## EAS Builds & Updates
To create a production build for iOS or Android:
```bash
eas build --profile production
```
For OTA updates:
```bash
eas update --branch main --message "Update message"
```
