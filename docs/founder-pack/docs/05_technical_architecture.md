# Technical architecture (proposed)

| Layer | Choice | Purpose |
|---|---|---|
| App | React Native + Expo | iOS first, Android later |
| Language | TypeScript | Game and app logic |
| Rendering | React Native Skia | 2D graphics |
| Physics | Matter.js (or custom deterministic solver) | Puzzle simulation |
| Backend | Supabase | Accounts, puzzles, chains, results |
| Purchases | RevenueCat (over StoreKit) | IAP and subscriptions |
| Ads | AdMob | Rewarded and interstitial |
| Analytics | PostHog | Funnels, retention, send rate |
| AI coding | Claude Code | Implementation, tests, level generation |

## Key technical risks
- **Determinism:** a shared puzzle must produce identical results on every device. Matter.js uses floating point and may drift; consider fixed timestep and a deterministic engine, and validate solutions server-side by replaying inputs.
- **Solvability:** verify modified puzzles with a solver or a submitted solution replay.
- **Replay/video export:** render the chain from stored inputs rather than recording the screen.
- **Deep links:** universal links for challenge URLs, with a web fallback and App Store redirect.

## Suggested structure
/src/game, /src/rules, /src/social, /src/ui, /src/monetization

## Data model sketch
- puzzle(id, base_level, created_by)
- chain(id, root_puzzle)
- link(chain_id, depth, player_id, modifier, solution_replay, solved_at)
- result(player_id, puzzle_id, moves, time)

## Owner-side setup (cannot be done by AI)
Apple Developer account, AdMob account, App Store Connect products, privacy disclosures and ATT, submission.
