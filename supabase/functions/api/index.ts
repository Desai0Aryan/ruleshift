// Supabase Edge Function (Deno). Thin glue only: auth + table access. All game rules live in engine.bundle.js,
// which is built from src/server/handler.ts with `npm run server:build` (same code the unit tests run).
// Deploy:  supabase functions deploy api   (JWT verification stays ON; anonymous sign-in users have valid JWTs)
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore built artifact
import { handleRequest } from './engine.bundle.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (i, l, o, 0, 1)
const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('');
};

const toRow = (r: any) => ({
  id: r.id, parentId: r.parent_id, depth: r.depth, base: r.base, rule: r.rule, seed: Number(r.seed),
  solved: r.solved, proof: r.proof, playerId: r.player_id, createdAt: new Date(r.created_at).getTime(), engine: r.engine,
});

function makeStore(db: any) {
  return {
    newId,
    async getNode(id: string) {
      const { data } = await db.from('nodes').select('*').eq('id', id).maybeSingle();
      return data ? toRow(data) : null;
    },
    async insertNode(n: any) {
      const { error } = await db.from('nodes').insert({
        id: n.id, parent_id: n.parentId, depth: n.depth, base: n.base, rule: n.rule, seed: n.seed,
        solved: n.solved, proof: n.proof, player_id: n.playerId, engine: n.engine,
        created_at: new Date(n.createdAt).toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    async countNodesSince(playerId: string, since: number) {
      const { count } = await db.from('nodes').select('id', { count: 'exact', head: true })
        .eq('player_id', playerId).gte('created_at', new Date(since).toISOString());
      return count ?? 0;
    },
    async addEvent(e: any) {
      await db.from('events').insert({ node_id: e.nodeId, user_id: e.userId, kind: e.kind, created_at: new Date(e.at).toISOString() });
    },
    async listNodesBy(playerId: string, limit: number) {
      const { data } = await db.from('nodes').select('*').eq('player_id', playerId).order('created_at', { ascending: false }).limit(limit);
      return (data ?? []).map(toRow);
    },
    async isBanned(playerId: string) {
      const { data } = await db.from('banned_users').select('user_id').eq('user_id', playerId).maybeSingle();
      return !!data;
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, code: 'bad_request', error: 'POST only' }, 405);
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data, error } = await db.auth.getUser(jwt);
    if (error || !data.user) return json({ ok: false, code: 'forbidden', error: 'Not signed in' }, 401);
    const body = await req.json().catch(() => null);
    const res = await handleRequest(makeStore(db), data.user.id, body);
    return json(res, res.ok ? 200 : res.code === 'rate_limited' ? 429 : 400);
  } catch (e) {
    console.error(e);
    return json({ ok: false, code: 'bad_request', error: 'Server error' }, 500);
  }
});
