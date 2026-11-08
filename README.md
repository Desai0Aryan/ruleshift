# RULESHIFT

Solve a physics puzzle → change **one** rule → pass it to a friend. Chains are replayable.
Expo SDK 58 · React Native · TypeScript · Skia. Spec: `docs/founder-pack/`.

```
npm install
npm test                 # 50+ tests: determinism, physics, rules, solver, chains, codecs
npm run typecheck
npm run web:build        # → web-preview/dist/index.html (playable in any browser)
npx expo start           # needs a development build (Skia), see docs/OWNER_TODO.md
```

Layout: `src/game` (engine, solver, levels, controller) · `src/rules` · `src/social` (chain, share codes) ·
`src/ui` (Skia renderer, screens) · `src/app` (routes) · `src/telemetry` · `src/monetization` (stubs) · `scripts/` · `tests/`.
Docs: `docs/PART1_STATUS.md` (read first), `DETERMINISM.md`, `ROADMAP.md`, `OWNER_TODO.md`.
