import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import type { ApiResponse } from '../server/handler';
import type { Transport } from './repository';

/**
 * Real transport: anonymous Supabase auth + the `api` Edge Function. NOT exercised by the automated tests
 * (needs your Supabase project): everything behind it (handler, repository) is. See docs/BACKEND_SETUP.md.
 */
let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

async function ensureSession(c: SupabaseClient): Promise<void> {
  const { data } = await c.auth.getSession();
  if (data.session) return;
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`auth failed: ${error.message}`);
}

export const supabaseTransport: Transport = {
  async call(body: Record<string, unknown>): Promise<ApiResponse> {
    const c = getClient();
    await ensureSession(c);
    const { data, error } = await c.functions.invoke('api', { body });
    if (body.op === 'deleteMe' && data && typeof data === 'object' && 'deleted' in data) {
      // the auth user no longer exists: drop the local session so the next call signs in as a brand-new anonymous user
      try { await c.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
    }
    if (data && typeof data === 'object' && 'ok' in data) return data as ApiResponse;
    // functions.invoke surfaces non-2xx as `error` with the JSON body in error.context (a Response)
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === 'function') {
      try { const j = await ctx.json(); if (j && typeof j === 'object' && 'ok' in j) return j as ApiResponse; } catch { /* fall through */ }
    }
    throw new Error(`network: ${error?.message ?? 'no response'}`);
  },
};
