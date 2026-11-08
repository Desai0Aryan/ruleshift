# Part 2 status (read this first)

## Built
| Area | What |
|---|---|
| Replay GIF export | Pure-TypeScript software renderer + GIF encoder (`src/export`). Renders a whole chain from stored inputs (each stage labelled with its twist + "Can you solve it?" end card). Deterministic, constant memory. One-tap "Share GIF" in the send sheet, replay screen. Sample: `docs/demo-replay.gif` |
| Backend logic | `src/server/handler.ts`: createNode / getNode / getHint / recordEvent / myNodes. Re-simulates the whole path + solution + proof on every publish; rate limit, ban list, depth cap, strict input validation. Puzzles form a **tree**, so two friends can continue the same puzzle |
| Hidden answers | Server never sends the proof except via `getHint` (hook for rewarded ads); offline codes still carry it (documented trade-off) |
| Supabase | `supabase/migrations/0001_ruleshift.sql` (tables, RLS deny-all, gate-metric views), Edge Function glue, `server:build` bundler |
| Client | `HybridRepository`: short link when online, silent fallback to self-contained code when offline/limited; on-device "My chains" history; anonymous auth |
| Links | `ruleshift://c/<id>` + universal-link config + landing page + web fallback in `site/` |
| Cold start | 10 designer seed chains shown as "Featured chains" (`npm run seeds:gen`) |
| UI | async challenge opening, "checking and sending" state, rejected-twist recovery, My chains (replay / re-send), Featured chains |

## Verified
- 75 automated tests, all passing (adds: GIF round-trip against an independent decoder, server tamper/fuzz/rate-limit tests,
  full client↔server loop in process: A publishes → B opens short link → solves → extends → C opens depth 2, offline fallback, seeds).
- SQL migration parses with the real PostgreSQL parser (pglast).
- GIF decoded by Pillow (independent) and frames reviewed visually; browser regression 11/11; `expo export --platform ios` bundles.

## NOT verified (be aware)
- **Nothing here has run against a real Supabase project** (no account/credentials). The Edge Function glue (`supabase/functions/api/index.ts`,
  table queries) and `supabaseTransport.ts` are small and typechecked/parsed, but untested at runtime; the logic behind them is tested.
  Expect to debug a few things on first deploy. The SQL was syntax-checked, not executed.
- Native app still not run on a device (see PART1_STATUS.md). GIF export uses expo-file-system/expo-sharing: typechecked only.
  GIF render time on a phone is unknown (Node: ~1 s for a 17 s chain); there is a progress indicator.
- The web fallback page can open `ruleshift://` and link to the App Store but cannot yet *play* an online (short-link) challenge in the browser.

## Decisions
- Offline codes can't be attached to the server tree (no ancestry): a deep chain received as a code is re-shared as a code.
- Rules `duplicate`/`teleport` seeded; all twists verified solvable before being offered (unchanged).
