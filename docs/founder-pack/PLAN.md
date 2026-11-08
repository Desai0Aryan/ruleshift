# PLAN.md: Build plan for RULESHIFT

**Instructions for Claude Code:** Read all files in /docs first. Work one phase at a time. At the end of each phase, summarize what works, what is untested, and wait for the owner's go-ahead. Never claim something is tested if it was not run.

## Owner context
- Owner has a Computer Science degree, is building with AI assistance, and wants an App Store game funded by ads and in-app purchases.
- Target: iPhone first, Android later (expandable architecture). Owner must handle developer accounts, ad accounts, store products, privacy disclosures, and submission.

## One-line concept
Solve a 20-30 second physics puzzle, change ONE rule, send it to a friend. The puzzle mutates as it travels. Replays show the whole chain.

## Phase 0: Setup (days)
- Expo + React Native + TypeScript project, lint, test runner, CI.
- Decide physics approach (Matter.js vs a deterministic custom solver). Determinism matters: a shared puzzle must behave the same on every device.
- Create folder structure: /src/game, /src/rules, /src/social, /src/ui, /src/monetization.

## Phase 1: Core game and validation gate (weeks 1-3)
- Build a single puzzle scene: move a ball to a target, drag obstacles to make a path.
- Build the rule-modifier system as small, composable, deterministic modules: reverse gravity, duplicate objects, speed up, teleport swap. Start with 4, add later.
- Instant restart, haptics, sound, juicy feedback.
- Solvability check: a modified puzzle must still be solvable (auto-verify with a solver or require the modifier to submit a solution replay).
- **Gate:** give it to 10-20 real people. Is it fun for 20 seconds with no explanation? Do not proceed until yes.

## Phase 2: Social loop (weeks 3-5)
- Challenge links (deep links), puzzle chain data model, replay of the full evolution, shareable video/GIF export.
- Supabase backend: anonymous accounts first, puzzles, chains, results.
- **Gate (the key assumption):** do people actually send challenges to friends? Measure send rate per solve and chain depth. If send rate is very low, rethink before monetizing.

## Phase 3: Retention (weeks 5-7)
- Daily global puzzle, streaks, achievements, leaderboards, unlockable skins/trails/environments.

## Phase 4: Monetization (weeks 7-8)
- RevenueCat for IAP/subscription, AdMob for rewarded + sparing interstitials, PostHog analytics. See docs/06.
- Rewarded ads for hints/retries. Never interrupt a puzzle with an ad.

## Phase 5: Polish, safety, launch (weeks 8-10)
- Real-device testing, performance, accessibility.
- Moderation and reporting for user-created content (required for App Store approval of UGC apps), block/report, rate limits.
- Privacy policy, ATT prompt handling, App Store listing, screenshots, preview video.
- Soft launch to a small audience, measure D1/D7 retention, then iterate.

## Risks to track
- Puzzle quality and solvability of user-modified levels.
- Cold start: social loop needs initial users; seed with bot/designer chains.
- UGC moderation burden and App Store rules.
- Physics determinism across devices.
- Discovery and marketing are as important as the build.

## Definition of done per phase
Runs on a real device, tests pass, known issues listed, owner has reviewed.
