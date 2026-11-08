# What I need from you (in order of when it blocks us)

**Now (to play it on your iPhone)**
1. Install Node 20+ and run `npm install`, then `npx expo start`. Skia needs a **development build** (Expo Go will not work):
   `npx expo run:ios` (needs a Mac + Xcode) **or** `npx eas-cli@latest build --profile development --platform ios`.
2. Or just open `web-preview/dist/index.html` in a phone browser: same engine, playable today.

**Before TestFlight**
3. Apple Developer Program account ($99/yr). Tell me your Team ID; we set `ios.bundleIdentifier` (currently the placeholder `com.example.ruleshift`).
4. A free Expo account for EAS builds.

**Part 2 (backend / friend links)**
5. Supabase project (URL + anon key). 6. A domain for share links (set `SHARE_HOST` in `src/social/links.ts`, add the apple-app-site-association file).

**Part 4 (money)**
7. AdMob account + app IDs. 8. RevenueCat account + App Store Connect products. 9. PostHog project key (plugs into `setSink` in `src/telemetry`).

**Also:** trademark / name check on "RULESHIFT" before you spend on art or ads.
