import type { KV } from '../social/kv';
import { type CustomDef, emptyCustom, validateCustom } from '../game/custom';

const KEY = 'ruleshift.editor.draft.v1';

/** The editor autosaves one draft on the device. Anything malformed in storage is ignored. */
export async function loadDraft(kv: KV): Promise<CustomDef> {
  try {
    const raw = await kv.get(KEY);
    if (raw) { const o = JSON.parse(raw); if (validateCustom(o) === null) return o as CustomDef; }
  } catch { /* fall through */ }
  return emptyCustom();
}
export async function saveDraft(kv: KV, def: CustomDef): Promise<void> {
  try { await kv.set(KEY, JSON.stringify(def)); } catch { /* best effort */ }
}
