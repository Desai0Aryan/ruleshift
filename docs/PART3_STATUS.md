# Part 3 status: more rules, more levels, daily puzzle

## Added
- **6 new rules** (10 total): Rubber walls, Crosswind, Mirror, Big or tiny, Low gravity, Add a bumper. All only transform level data, so the engine (ENGINE_VERSION 1) and all existing share codes are unchanged. `RULE_ORDER` is append-only.
- **Rule picker deals a hand of 4** from the 10 (`dealHand`), with a "New hand" button (native app). Keeps the screen uncluttered and the solver load the same.
- **12 new levels** (24 total, L13-L24). All proven solvable, none solved by an empty board (`npm run levels:solve`, `levels:metrics`). L01-L12 digests unchanged.
- **Daily puzzle** (`src/daily`): same puzzle for everyone on the same local date, built on-device by the deterministic solver, cached, no server needed. Difficulty ramps Mon/Tue easy -> Sat/Sun hard. Solving it lets you add a twist and send it (the "submit a variation" idea).
- **Streaks**: consecutive days, one freeze earned per 7-day streak (max 2, covers one missed day), best-result tracking, Wordle-style share text.
- Wind streaks and orange rubber walls drawn in the scene.

## Tests: 115 passing (40 new), tsc clean, iOS bundle exports, browser regression + daily check pass.

## Not done / not verified
- **Level editor** deferred (not needed for the gates; better after playtest feedback).
- Daily leaderboard needs the server; results are stored locally only.
- Daily build time on a real phone unknown (about 0.3 s on desktop). Native app still never run on a device.
- Rule balance/fun is untested by humans: some rules are easy to satisfy on most levels (see `npm run rules:matrix`).
