/**
 * Monetization seams (Part 4 fills these in with AdMob + RevenueCat). Gameplay code only ever talks to
 * these interfaces, so ads/IAP can be added, A/B tested or removed without touching the game.
 * Rule of the design doc: NEVER block progression with an ad; ads are opt-in (hints) or between chains.
 */
export interface Entitlements { adsRemoved: boolean; premiumRules: boolean; hintsBalance: number }

export interface MonetizationService {
  entitlements(): Entitlements;
  /** rewarded video -> resolves true if the user earned the reward */
  showRewarded(placement: 'hint' | 'extra_rule'): Promise<boolean>;
  /** interstitial shown at natural breaks only; no-op if ads removed */
  maybeShowInterstitial(): Promise<void>;
  purchase(sku: 'remove_ads' | 'rule_pack_1'): Promise<boolean>;
  restore(): Promise<void>;
}

/** Part 1 default: everything free, nothing shown. */
export const noopMonetization: MonetizationService = {
  entitlements: () => ({ adsRemoved: true, premiumRules: true, hintsBalance: Infinity }),
  showRewarded: async () => true,
  maybeShowInterstitial: async () => {},
  purchase: async () => false,
  restore: async () => {},
};

let service: MonetizationService = noopMonetization;
export const setMonetization = (s: MonetizationService) => { service = s; };
export const monetization = () => service;
