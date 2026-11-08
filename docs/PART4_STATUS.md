# Part 4 status: ads, purchases, analytics

## Added
- `src/monetization/policy.ts`: pure, tested rules (hint wallet, rewarded caps, interstitial pacing, product table).
- `src/monetization/service.ts`: one `Monetization` class (state persisted, every SDK call guarded).
- Adapters: real AdMob, RevenueCat; mock ads/store for dev. PostHog sink (`src/telemetry/posthog.ts`).
- iOS App Tracking Transparency prompt before any ad request (plugin config in app.json).
- UI: hint button with balance badge, "Out of hints" sheet (watch video / shop), Shop screen with restore, Settings section, interstitial only when leaving a solved puzzle.
- `docs/MONETIZATION_SETUP.md`: step-by-step with product ids.

## Verification: 136 tests pass (21 new: policy + service), tsc clean, iOS bundle exports with all SDKs, ad/tracking keys confirmed in the generated iOS config.

## NOT verified
- Real ads, real purchases, PostHog delivery (no accounts). Native app still never run on a device.
- Ad/IAP revenue assumptions and pacing numbers are untested guesses; tune after TestFlight data.
- Privacy policy page and App Store privacy answers are Part 5.
