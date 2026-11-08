/**
 * Pure monetization rules (no SDKs, fully unit-tested). Design-doc commitments baked in:
 *  - never interrupt a puzzle with an ad
 *  - the multiplayer loop (solve, twist, send) is always free
 *  - ads that block nothing: rewarded = opt-in for a hint; interstitial = only at natural breaks
 */
export const HINT = {
  START_BALANCE: 3,
  /** one free hint per local day, until the free pool reaches this */
  FREE_CAP: 3,
  REWARD_PER_AD: 1,
  MAX_REWARDED_PER_DAY: 5,
};

export interface HintWallet { balance: number; lastFreeDay: number | null; rewardedDay: number | null; rewardedToday: number }
export const newWallet = (): HintWallet => ({ balance: HINT.START_BALANCE, lastFreeDay: null, rewardedDay: null, rewardedToday: 0 });

/** Tops the free pool up by one hint per new day (never above FREE_CAP, never removes purchased hints). */
export function grantDailyFree(w: HintWallet, day: number): HintWallet {
  if (w.lastFreeDay === day) return w;
  if (w.lastFreeDay !== null && day < w.lastFreeDay) return w;
  return { ...w, lastFreeDay: day, balance: w.balance < HINT.FREE_CAP ? w.balance + 1 : w.balance };
}
export function spendHint(w: HintWallet): HintWallet | null {
  return w.balance > 0 ? { ...w, balance: w.balance - 1 } : null;
}
export function addHints(w: HintWallet, n: number): HintWallet {
  return { ...w, balance: Math.max(0, Math.min(9999, w.balance + Math.floor(n))) };
}
export function rewardedLeft(w: HintWallet, day: number): number {
  return w.rewardedDay === day ? Math.max(0, HINT.MAX_REWARDED_PER_DAY - w.rewardedToday) : HINT.MAX_REWARDED_PER_DAY;
}
export function creditRewarded(w: HintWallet, day: number): HintWallet {
  const today = w.rewardedDay === day ? w.rewardedToday : 0;
  return { ...addHints(w, HINT.REWARD_PER_AD), rewardedDay: day, rewardedToday: today + 1 };
}

// ---- interstitials ----
export const INTERSTITIAL = {
  /** no interstitials until the player has experienced the game properly */
  MIN_LIFETIME_SOLVES: 8,
  MIN_SOLVES_BETWEEN: 3,
  MIN_SECONDS_BETWEEN: 180,
  MAX_PER_DAY: 6,
};
export interface AdPacing {
  lifetimeSolves: number;
  solvesSinceAd: number;
  lastAdAt: number | null;
  adsDay: number | null;
  adsToday: number;
  /** player sent a challenge since the last ad: spreading the game is rewarded with a free break */
  sentSinceAd: boolean;
}
export const newPacing = (): AdPacing => ({ lifetimeSolves: 0, solvesSinceAd: 0, lastAdAt: null, adsDay: null, adsToday: 0, sentSinceAd: false });

export const onSolve = (p: AdPacing): AdPacing => ({ ...p, lifetimeSolves: p.lifetimeSolves + 1, solvesSinceAd: p.solvesSinceAd + 1 });
export const onSent = (p: AdPacing): AdPacing => ({ ...p, sentSinceAd: true });

export function interstitialAllowed(p: AdPacing, ctx: { now: number; day: number; adsRemoved: boolean; adsReady: boolean; consentResolved: boolean }): boolean {
  if (ctx.adsRemoved || !ctx.adsReady || !ctx.consentResolved) return false;
  if (p.lifetimeSolves < INTERSTITIAL.MIN_LIFETIME_SOLVES) return false;
  if (p.solvesSinceAd < INTERSTITIAL.MIN_SOLVES_BETWEEN) return false;
  if (p.sentSinceAd) return false;
  if (p.lastAdAt !== null && ctx.now - p.lastAdAt < INTERSTITIAL.MIN_SECONDS_BETWEEN * 1000) return false;
  const today = p.adsDay === ctx.day ? p.adsToday : 0;
  return today < INTERSTITIAL.MAX_PER_DAY;
}
export function onInterstitialShown(p: AdPacing, now: number, day: number): AdPacing {
  return { ...p, solvesSinceAd: 0, sentSinceAd: false, lastAdAt: now, adsDay: day, adsToday: (p.adsDay === day ? p.adsToday : 0) + 1 };
}

// ---- products ----
export type Sku = 'remove_ads' | 'hints_25' | 'supporter';
export const SKUS: Record<Sku, { storeId: string; kind: 'non_consumable' | 'consumable'; hints: number; removesAds: boolean; title: string; blurb: string }> = {
  remove_ads: { storeId: 'ruleshift_remove_ads', kind: 'non_consumable', hints: 0, removesAds: true, title: 'Remove ads', blurb: 'No more breaks between puzzles. Rewarded hints stay optional.' },
  hints_25: { storeId: 'ruleshift_hints_25', kind: 'consumable', hints: 25, removesAds: false, title: '25 hints', blurb: 'Never get stuck.' },
  supporter: { storeId: 'ruleshift_supporter', kind: 'non_consumable', hints: 60, removesAds: true, title: 'Supporter pack', blurb: 'No ads + 60 hints. Thank you!' },
};
export const SKU_ORDER: Sku[] = ['remove_ads', 'hints_25', 'supporter'];
export const skuFromStoreId = (id: string): Sku | null => SKU_ORDER.find((k) => SKUS[k].storeId === id) ?? null;
