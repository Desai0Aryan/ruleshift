# Determinism contract

A shared puzzle is only data: `(base level, [rule, seed]…, solutions)`. Every phone (and later the server) rebuilds
the exact same physics from it, so the simulation MUST be bit-identical everywhere.

Rules for `src/game/{sim,placement,solver,rng}.ts`:
- Fixed timestep (1/60 s × level.timeScale) with 4 fixed substeps. Never use wall-clock time in the sim.
- Only `+ - * /`, `Math.sqrt`, `min/max/abs/floor` (exactly specified by IEEE‑754/ECMAScript). No `sin/cos/atan2/pow/exp/hypot/random`.
  Angles come from a hard-coded literal table (`angles.ts`). Piece positions are integers in ¼ units.
- Fixed iteration order (arrays only, never object-key order).
- `tests/engine.test.ts` enforces this: it scans the engine source for banned APIs and snapshot-tests a bit-exact digest of
  every authored level's winning run ("GOLDEN"). If you change physics on purpose: bump `ENGINE_VERSION`, run
  `npm run levels:solve`, update the snapshot (`npx vitest run -u`). Old share codes then refuse to load instead of desyncing.
- UI/juice (particles, trails, shake, `atan2` for the rotate handle) lives outside the sim and may use anything.
