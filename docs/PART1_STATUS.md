# Part 1 status (read this first)

## What was verified, and how
| Thing | Evidence |
|---|---|
| Engine determinism, physics, validation, solver, 4 rules, chains, share codes (incl. 3000-case decoder fuzz) | 50 automated tests, all passing (`npm test`) |
| All 12 levels solvable, none trivially solvable | `npm run levels:solve` pins a solution per level; tests re-verify |
| Whole game loop (place → GO → win → pick verified twist → send code → friend opens code → adds twist → replay; bad code; auto-retry; drag/rotate/remove) | Driven in a headless phone-size browser with real pointer events (`web-preview`), 11/11 checks pass, screenshots reviewed |
| Native app compiles | `npx tsc --noEmit` clean; `expo export --platform ios` produced a Hermes bundle |

## What was NOT verified
- **The native Skia app has not been run on a device or simulator** (no Xcode/iPhone here). It shares all game logic with the verified web preview,
  but the Skia renderer, touch handling (PanResponder), haptics, audio, share sheet and clipboard are untested at runtime. Expect small fixes on first launch.
- Expo docs were unreachable from my sandbox; Expo APIs were checked against the installed SDK 58 type definitions and the bundler, not the docs.
- Fun/difficulty is **not tuned**: levels were checked by solver + "luck %" (`npm run levels:metrics`), not by humans. That is the Phase-1 gate in your plan: have 10-20 people play.

## Design decisions worth knowing
- **Reverse gravity also mirrors start/goal top↔bottom.** Flipping gravity alone made 12/12 levels impossible (the solver proved it). Even so it is refused on 4 levels; the picker shows "Would make it impossible" instead of offering a broken puzzle.
- **Anti-collapse guarantee:** a twist is only offered if the solver finds a solution and the empty board doesn't already win. Seeded rules (duplicate, teleport) retry up to 6 seeds.
- **Share codes include a proof solution** so receivers can verify solvability instantly with no backend. Trade-off: a determined player could read the answer out of the code. Part 2 moves proofs server-side.
- Rule order in `RULE_ORDER` is baked into share codes: append only.
- Bundle id is the placeholder `com.example.ruleshift`; share domain is the placeholder `ruleshift.app`.
- Playtest stats (twist rate, send rate, attempts/level) are recorded on-device: Settings → "Playtest numbers". Goal from your plan: send rate ≥ 20%.

## Known limitations / next candidates
- Frame drawing is one Skia picture per frame, driven by React state at 60 fps; fine for these scenes, upgrade path is Reanimated/worklets if needed.
- No onboarding/tutorial, no music, placeholder (but real) synthesized SFX and a generated icon.
- Android is untested (iOS first, as in the plan).
