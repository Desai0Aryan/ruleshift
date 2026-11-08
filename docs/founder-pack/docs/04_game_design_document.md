# RULESHIFT: Game Design Document

Tagline: YOU SOLVE IT. YOU CHANGE IT. YOU PASS IT ON.

## Core loop
1. Receive a tiny physics puzzle (20-30 seconds to solve).
2. Solve it (example: get the blue ball into the target by dragging obstacles to build a path).
3. Choose ONE rule modifier to apply.
4. Send the modified puzzle to another player.
5. They solve it, add another modifier, and pass it on.
6. After several hops the puzzle is very different. The game generates a replay of the whole evolution.

## Rule modifiers (launch set, add more later)
- Reverse gravity: everything falls upward.
- Duplicate objects: one object becomes two.
- Speed mode: everything moves faster.
- Teleportation: objects swap positions.

Design requirements: each modifier is small, composable, deterministic, and must leave the puzzle solvable (verify with a solver or require the modifier to submit a solution replay).

## Social features
- Challenge links: personalized puzzle link; notification when a friend beats or fails it.
- Chains: track depth, who changed what, and success/fail rates.
- Replay: auto-generated evolution video/GIF for sharing.
- Daily global puzzle: same puzzle for everyone, fewest moves wins, then submit a variation.
- Leaderboards: fastest solves, hardest creations, most successful chains.
- Creator mode (later): build original puzzles, test, and share.

## Progression and collection
Skins, trails, environments, special modifiers, achievements, streaks.

## Screens
Home (logo, Play, Daily), Puzzle, Rule picker, Send/Share, Chain replay, Daily, Leaderboards, Collection/Shop, Profile, Settings (sound, music, haptics, privacy).

## Content types it should generate
1. Challenge videos ("can you solve my friend's puzzle?")
2. Funny evolution videos ("after five people changed it")
3. Competitive clips ("solved a level 12 others failed")

## Design principles
- Understandable in seconds, instant retry, juicy feedback.
- Basic multiplayer challenge experience stays free to maximize participation.
- Never interrupt a puzzle with an ad.

## Open design questions
- How to prevent chains collapsing into unsolvable or trivial puzzles.
- Cold start: seed chains with designer-made starters.
- Moderation for any user-generated content.
