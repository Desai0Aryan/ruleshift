import type { Sku } from './policy';

export type RewardedResult = 'earned' | 'closed' | 'unavailable';
export interface AdsAdapter {
  readonly name: string;
  init(opts: { personalized: boolean }): Promise<void>;
  /** is an interstitial loaded right now */
  interstitialReady(): boolean;
  rewardedReady(): boolean;
  showRewarded(): Promise<RewardedResult>;
  showInterstitial(): Promise<boolean>;
}

export interface ProductInfo { sku: Sku; price: string }
export type PurchaseResult = { ok: true; sku: Sku } | { ok: false; cancelled: boolean; error?: string };
export interface PurchasesAdapter {
  readonly name: string;
  init(): Promise<void>;
  products(): Promise<ProductInfo[]>;
  purchase(sku: Sku): Promise<PurchaseResult>;
  /** SKUs of non-consumables the store account owns */
  restore(): Promise<Sku[]>;
  /** non-consumables currently owned (used at startup to re-grant after reinstall) */
  owned(): Promise<Sku[]>;
}
