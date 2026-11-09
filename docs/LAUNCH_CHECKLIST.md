# Launch checklist (the parts only you can do, in order)

## Accounts (see OWNER_TODO.md for details)
- [ ] Apple Developer Program ($99/yr) and an App Store Connect app record (bundle id, e.g. com.yourname.ruleshift)
- [ ] Expo account + `npx eas-cli login`, then `npx eas-cli init` (writes the project id into app.json)
- [ ] Supabase project: run migrations 0001 + 0002, deploy the `api` function (docs/BACKEND_SETUP.md), enable **Anonymous sign-ins**
- [ ] Domain hosting `site/` (Netlify/Cloudflare Pages/Vercel); set `SHARE_HOST` in src/social/links.ts; AASA file with your Team ID + bundle id; `associatedDomains` in app.json
- [ ] AdMob, RevenueCat, PostHog accounts and keys (docs/MONETIZATION_SETUP.md)

## Replace placeholders
- [ ] `app.json`: name, `ios.bundleIdentifier`, `associatedDomains`, AdMob **app id**
- [ ] `site/privacy`, `site/terms`, `site/support`: fill [DATE], [YOUR NAME], [YOUR SUPPORT EMAIL]; legal review
- [ ] `site/.well-known/apple-app-site-association`: TEAMID.bundleid
- [ ] `.env`: all keys (copy `.env.example`); `eas.json` `ascAppId`

## Test on a real iPhone (never done yet!)
- [ ] `npx eas-cli build --profile development --platform ios`, install, run through: tutorial, 3+ levels, rule picker, send/receive a challenge between two phones, daily, replay GIF share, settings
- [ ] Sandbox purchase + restore; rewarded + interstitial with TEST ad units; ATT prompt appears once
- [ ] Reduce Motion on + VoiceOver spot-check the home screen, play screen and sheets
- [ ] Airplane mode: game still plays, sending falls back to a code

## The real gate (from your plan)
- [ ] TestFlight to 10-20 people. Watch: % who send a twist after solving (target 20%+), solve rate, drop-off level, daily return. Tune `policy.ts`, levels and rules from that data BEFORE spending on growth.

## Submit
- [ ] Real screenshots (6.9" and 6.5"), listing text (docs/appstore/LISTING.md), privacy labels, age rating, review notes
- [ ] `npx eas-cli build --profile production --platform ios` then `npx eas-cli submit --platform ios`
