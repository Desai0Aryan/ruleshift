# Part 6 – Creator mode

Draw your own puzzle (walls, bouncy bumpers, ball, goal, 1-4 planks), solve it yourself, twist one rule, send it. Friends play it like any chain.

**Paywall:** Creator Pass (`ruleshift_creator`, ~$2.99). Free: sandbox, test-play, playing/extending friends' creations. Paid: sending your own creation. Supporter pack includes it.

**Safety by design:** no text, names or images in creations, so there is no moderation surface. The server re-validates the layout and re-simulates the creator's solution; forged or tampered codes are rejected.

**Files:** src/game/custom.ts, src/editor/{controller,draft}.ts, src/ui/EditorScreen.tsx, src/app/editor.tsx, chain/codec/flow/server changes, migration 0003, tests/custom.test.ts, tests/editor.test.ts.

**Verified:** 159 tests, tsc clean, iOS bundle exports.
**Not verified:** the editor UI and touch-drawing feel on a real iPhone; the browser-preview editor was exercised by script (draw wall, test, auto-solve, win), not by hand; custom nodes against a live Supabase; the paywall with real purchases; paywall is client-enforced only.
