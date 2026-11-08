# Roadmap & extension points

Built in Part 1: engine, 4 rules, solver + anti-collapse verification, 12 levels, chain model + share codes, Skia app, web preview.

| Part | Scope |
|---|---|
| 2 | Supabase: accounts (anonymous first), chains stored server-side, friend links/deep links, server re-verification, strip proofs from codes, push on "your turn" |
| 3 | Rules 5-10 (gravity-zones, bigger/smaller, bounce, wind, time-slow, mirror), more levels, daily puzzle, level editor |
| 4 | AdMob (rewarded hints, break interstitials), RevenueCat (remove ads, rule packs), PostHog, A/B config |
| 5 | Juice/polish pass: art direction, music, onboarding, accessibility, localisation, App Store assets |

## How to extend (designed for it)
- **New rule:** add an id to `RuleId` (`src/game/types.ts`), one entry in `RULES` (`src/rules/index.ts`), append to `RULE_ORDER`
  (never reorder: the index is in share codes). `npm run rules:matrix` shows how it behaves on every level. The tests pick it up.
- **New level:** add a `LevelDef` in `src/game/levelDefs.ts`, run `npm run levels:solve` (pins a verified solution), `npm run levels:metrics` (luck %).
- **New piece type / mechanic:** extend `PieceSpec` + `placementSegment`; bump `ENGINE_VERSION`.
- **New screen:** drop a file in `src/app/`.
