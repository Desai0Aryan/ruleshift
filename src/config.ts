/** Backend config comes from EXPO_PUBLIC_* env vars (see .env.example). Empty => the app runs fully offline with share codes. */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const backendEnabled = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/** Monetization (Part 4). Everything is optional: with no keys the app is fully free and shows no ads. */
export const ADS_ENABLED = process.env.EXPO_PUBLIC_ADS_ENABLED === '1';
/** Empty => Google's official TEST ad units are used (safe for development; never earns money). */
export const ADMOB_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID ?? '';
export const ADMOB_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? '';
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
