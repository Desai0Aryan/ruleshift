import type { Chain } from './chain';
import { encodeChain } from './codec';
import { RULES } from '../rules';

/** TODO(owner): replace with your real universal-link domain once registered (see docs/OWNER_TODO.md). */
export const SHARE_HOST = 'https://ruleshift.app';
export const APP_SCHEME = 'ruleshift://';

export const shareUrl = (code: string) => `${SHARE_HOST}/c/${code}`;
export const appUrl = (code: string) => `${APP_SCHEME}c/${code}`;

/** Accepts a full URL, an app-scheme URL, or a bare code (as pasted from a message). */
export function extractCode(input: string): string | null {
  const t = input.trim();
  const m = t.match(/RS1\.[A-Za-z0-9_-]+\.[a-z0-9]+/);
  return m ? m[0] : null;
}

export function shareMessage(chain: Chain): string {
  const last = chain.links[chain.links.length - 1];
  const rule = last ? RULES[last.rule].name : 'a twist';
  const depth = chain.links.length;
  const code = encodeChain(chain);
  return `I changed the rules: ${rule}. That's ${depth} change${depth === 1 ? '' : 's'} deep. Can you still solve it? \u{1F9E9}\n${shareUrl(code)}\n\nCode: ${code}`;
}
