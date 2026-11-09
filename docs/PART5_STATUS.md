# Part 5 status: polish, onboarding, launch kit

## Added
- First-run coach on level 1 (drag -> tilt -> GO), one-time "this is the game" explainer on the first rule picker.
- Reduce Motion (follows the phone's setting on first launch; switch in Settings): no shake, ~80% fewer particles.
- Accessibility labels on GO/Retry, tray pieces, hint (with count), switches; live-region toasts and tips.
- Real app icon, Android adaptive icons, monochrome icon, splash art, favicon (`scripts/make-icons.py`, original art).
- Privacy policy, terms and support pages (`site/`), matching what the app really collects (templates: fill placeholders, legal review).
- **Delete my online data** (Settings): `deleteMe` server op + migration 0002 (puzzles others built on yours survive, detached). Banned users can still delete.
- iOS privacy manifest + tracking declaration in app.json; `eas.json` (development / preview / production).
- Listing copy, App Privacy answers, review notes, 5 draft screenshots (`docs/appstore/`), `docs/LAUNCH_CHECKLIST.md`.

## Verification
See final message: tests, tsc, iOS bundle, browser regression.

## NOT verified / honest limits
- Never run on a real iPhone. Tutorial placement, VoiceOver behaviour, ATT prompt timing, real icon rendering on a Home Screen are all unchecked on device.
- Screenshots are drafts from the browser preview, not native captures.
- Legal pages are templates, not legal advice. Server deletion (`auth.admin.deleteUser` + migration 0002) never ran against a real Supabase project.
- No localisation (English only), no Android store assets, no iPad layout tuning.
