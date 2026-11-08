/** Backend config comes from EXPO_PUBLIC_* env vars (see .env.example). Empty => the app runs fully offline with share codes. */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const backendEnabled = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
