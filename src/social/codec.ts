import { ENGINE_VERSION } from '../game/constants';
import { fnv1a } from '../game/rng';
import type { Placement, RuleId, Solution } from '../game/types';
import { RULE_ORDER } from '../rules';
import { type Chain, MAX_CHAIN_DEPTH } from './chain';

/**
 * Share code: "RS1.<base64url(json)>.<checksum>". Pure strings, no Buffer/atob needed, so it works
 * identically in Hermes, Node and browsers. Decoding treats input as hostile (shape + range checks);
 * semantic verification (solutions really win) happens in checkChain().
 */
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const REV: Record<string, number> = {};
for (let i = 0; i < ALPHA.length; i++) REV[ALPHA[i]] = i;

function b64Encode(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i += 3) {
    const a = s.charCodeAt(i);
    const b = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
    const c = i + 2 < s.length ? s.charCodeAt(i + 2) : 0;
    const n = (a << 16) | (b << 8) | c;
    out += ALPHA[(n >> 18) & 63] + ALPHA[(n >> 12) & 63];
    if (i + 1 < s.length) out += ALPHA[(n >> 6) & 63];
    if (i + 2 < s.length) out += ALPHA[n & 63];
  }
  return out;
}

function b64Decode(s: string): string | null {
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    if (chunk.length === 1) return null;
    const v = [...chunk].map((ch) => REV[ch]);
    if (v.some((x) => x === undefined)) return null;
    const n = (v[0] << 18) | (v[1] << 12) | ((v[2] ?? 0) << 6) | (v[3] ?? 0);
    out += String.fromCharCode((n >> 16) & 255);
    if (chunk.length > 2) out += String.fromCharCode((n >> 8) & 255);
    if (chunk.length > 3) out += String.fromCharCode(n & 255);
  }
  return out;
}

const packSol = (s: Solution) => s.map((p) => [p.i, p.x, p.y, p.a]);

export function encodeChain(chain: Chain): string {
  const body = JSON.stringify({
    e: chain.engine,
    b: chain.base,
    l: chain.links.map((k) => [RULE_ORDER.indexOf(k.rule), k.seed, packSol(k.solved)]),
    p: packSol(chain.proof),
  });
  return `RS${chain.v}.${b64Encode(body)}.${fnv1a(body).toString(36)}`;
}

export type DecodeResult = { ok: true; chain: Chain } | { ok: false; error: string };

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) < 2 ** 31 * 2;

function unpackSol(v: unknown): Solution | null {
  if (!Array.isArray(v) || v.length > 8) return null;
  const out: Placement[] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== 4 || !row.every(isInt)) return null;
    out.push({ i: row[0], x: row[1], y: row[2], a: row[3] });
  }
  return out;
}

export function decodeChain(code: string): DecodeResult {
  const bad = (error: string): DecodeResult => ({ ok: false, error });
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'RS1') return bad('That doesn’t look like a RULESHIFT challenge.');
  if (parts[1].length > 20000) return bad('Challenge is too large.');
  const body = b64Decode(parts[1]);
  if (body === null) return bad('Challenge code is damaged.');
  if (fnv1a(body).toString(36) !== parts[2]) return bad('Challenge code is damaged (checksum mismatch).');
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return bad('Challenge code is damaged.'); }
  if (!raw || typeof raw !== 'object') return bad('Challenge code is damaged.');
  const o = raw as Record<string, unknown>;
  if (!isInt(o.e) || o.e !== ENGINE_VERSION) return bad('This challenge was made with a different game version.');
  if (typeof o.b !== 'string' || o.b.length > 16) return bad('Challenge code is damaged.');
  if (!Array.isArray(o.l) || o.l.length > MAX_CHAIN_DEPTH) return bad('Challenge code is damaged.');
  const links: Chain['links'] = [];
  for (const l of o.l) {
    if (!Array.isArray(l) || l.length !== 3 || !isInt(l[0]) || !isInt(l[1])) return bad('Challenge code is damaged.');
    const rule: RuleId | undefined = RULE_ORDER[l[0]];
    const solved = unpackSol(l[2]);
    if (!rule || !solved) return bad('Challenge code is damaged.');
    links.push({ rule, seed: l[1] >>> 0, solved });
  }
  const proof = unpackSol(o.p);
  if (!proof) return bad('Challenge code is damaged.');
  return { ok: true, chain: { v: 1, engine: o.e, base: o.b, links, proof } };
}
