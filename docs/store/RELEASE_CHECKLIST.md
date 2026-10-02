# Release Checklist

## 1. Preparation
- [ ] Ensure all tests pass (`pytest` for backend, `tsc` for mobile).
- [ ] Increment app version and build number in `mobile/app.json`.
- [ ] Verify environment variables for production are set correctly.

## 2. EAS Build (Expo)
- [ ] Run `eas build --platform ios --profile production`.
- [ ] Run `eas build --platform android --profile production`.
- [ ] Wait for builds to complete successfully on Expo dashboard.

## 3. App Store Connect (iOS)
- [ ] Submit build via Transporter or EAS auto-submit.
- [ ] Update App Store metadata (What's New, Screenshots if needed).
- [ ] Select the new build for submission.
- [ ] Submit for review.

## 4. Google Play Console (Android)
- [ ] Download AAB from Expo or use EAS auto-submit.
- [ ] Upload AAB to Production or Testing track.
- [ ] Update Release Notes and Metadata.
- [ ] Roll out release.

## 5. Post-Release
- [ ] Monitor crashlytics/sentry for any immediate issues.
- [ ] Announce release to users!
