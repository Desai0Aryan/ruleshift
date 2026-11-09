import type { Sku } from '../policy';
import type { AdsAdapter, ProductInfo, PurchaseResult, PurchasesAdapter, RewardedResult } from '../types';

/** Dev/test stand-ins that behave like the real SDKs (async, can be cancelled) without any account. */
export function createMockAds(opts: { rewarded?: RewardedResult; delayMs?: number; interstitial?: boolean } = {}): AdsAdapter & { shown: { rewarded: number; interstitial: number } } {
  const shown = { rewarded: 0, interstitial: 0 };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return {
    name: 'mock-ads', shown,
    async init() {},
    rewardedReady: () => (opts.rewarded ?? 'earned') !== 'unavailable',
    interstitialReady: () => opts.interstitial ?? true,
    async showRewarded() { await wait(opts.delayMs ?? 0); const r = opts.rewarded ?? 'earned'; if (r === 'earned') shown.rewarded++; return r; },
    async showInterstitial() { await wait(opts.delayMs ?? 0); if (opts.interstitial === false) return false; shown.interstitial++; return true; },
  };
}

export function createMockPurchases(opts: { fail?: boolean; cancel?: boolean } = {}): PurchasesAdapter & { ownedSet: Set<Sku> } {
  const ownedSet = new Set<Sku>();
  const price: Record<Sku, string> = { creator: '$2.99', remove_ads: '$2.99', hints_25: '$0.99', supporter: '$4.99' };
  return {
    name: 'mock-purchases', ownedSet,
    async init() {},
    async products(): Promise<ProductInfo[]> { return (Object.keys(price) as Sku[]).map((sku) => ({ sku, price: price[sku] })); },
    async purchase(sku): Promise<PurchaseResult> {
      if (opts.cancel) return { ok: false, cancelled: true };
      if (opts.fail) return { ok: false, cancelled: false, error: 'boom' };
      if (sku !== 'hints_25') ownedSet.add(sku);
      return { ok: true, sku };
    },
    async restore() { return [...ownedSet]; },
    async owned() { return [...ownedSet]; },
  };
}
