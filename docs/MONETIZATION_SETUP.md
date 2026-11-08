# Monetization & analytics setup (Part 4)

Everything is optional and off by default. With no keys, a release build is simply free: no ads, no store.
In a **development build** with no keys you get clearly-fake mock ads/store so you can test the whole flow.

## How the money works (design-doc rules)
- **Never an ad during a puzzle.** Interstitials appear only when you leave a *solved* puzzle (Next level / Home).
- **No ads for the first 8 solves**, then at most one per 3 solves, 3 minutes apart, 6 per day.
- **Sending a challenge earns an ad-free break** (rewards spreading the game).
- **Rewarded video = opt-in hint** (+1 hint, max 5 videos/day). 3 free hints to start, +1 free per day (up to 3).
- **Solve / twist / send is always free.**
- Ads wait until the player answers the iOS tracking prompt. Remove-ads owners never initialise ads.
- Tunable numbers: `src/monetization/policy.ts` (all unit-tested).

## Products (create in App Store Connect, then in RevenueCat)
| Store product id | Type | Gives |
|---|---|---|
| `ruleshift_remove_ads` | Non-consumable | No interstitials |
| `ruleshift_hints_25` | Consumable | +25 hints |
| `ruleshift_supporter` | Non-consumable | No ads + 60 hints (once) |
Prices shown come from the store, never hard-coded. Change ids in `SKUS` (policy.ts) if you name them differently.

## Steps (you)
1. **AdMob**: create the app, one *Rewarded* and one *Interstitial* unit. Put the iOS **app id** in `app.json` -> plugin `react-native-google-mobile-ads` -> `iosAppId` (currently Google's TEST id). Put the unit ids in `.env` (`EXPO_PUBLIC_ADMOB_REWARDED_ID`, `..._INTERSTITIAL_ID`) and set `EXPO_PUBLIC_ADS_ENABLED=1`.
2. **RevenueCat**: new project, add the iOS app, add the 3 products, paste the **public iOS SDK key** into `EXPO_PUBLIC_REVENUECAT_IOS_KEY`. (No entitlements/offerings required; the app buys products by id.)
3. **PostHog**: create a project, put the project key in `EXPO_PUBLIC_POSTHOG_KEY` (host defaults to US cloud).
4. **App Store Connect**: App Privacy answers must disclose advertising data/identifiers (AdMob) and analytics (PostHog). The tracking prompt text is in `app.json`.
5. Real ads/purchases need a **development or TestFlight build** (`npx eas-cli build`); they cannot run in Expo Go or the browser preview. Test purchases with a Sandbox Apple ID.
6. **Never click your own live ads.** Use test unit ids (the default) until release.

## Events sent to PostHog
All names in `src/telemetry/index.ts`. New in Part 4: `rewarded_offered`, `rewarded_watched`, `interstitial_shown`, `store_opened`, `purchase_started`, `purchase_done`, `purchase_failed`, `restore_tapped`. No personal data is attached.

## Honest limits
- Ownership of non-consumables is re-read from the store at startup, but the **app trusts the device** for hint balances (no server receipts). Fine for a casual game; add RevenueCat webhooks + Supabase if hint fraud ever matters.
- The real SDK adapters (`adapters/admob.ts`, `adapters/revenuecat.ts`) compile and bundle but have **never run against live ads/StoreKit** (no accounts yet). Expect a small first-run debug pass.
