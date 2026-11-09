import type { KV } from '../social/kv';
import {
  addHints, creditRewarded, grantDailyFree, interstitialAllowed, type AdPacing, type HintWallet, newPacing, newWallet,
  onInterstitialShown, onSent, onSolve, rewardedLeft, SKUS, type Sku, spendHint,
} from './policy';
import type { AdsAdapter, ProductInfo, PurchasesAdapter } from './types';

export interface MonetizationSnapshot {
  ready: boolean;
  hints: number;
  adsRemoved: boolean;
  /** Creator Pass owned (directly or through the Supporter pack) */
  creatorUnlocked: boolean;
  /** a real store is configured in this build (otherwise nothing is gated) */
  storeConfigured: boolean;
  /** a rewarded ad can be offered for a hint right now */
  rewardedAvailable: boolean;
  rewardedLeft: number;
  storeAvailable: boolean;
  products: ProductInfo[];
  busy: boolean;
  /** which adapters are live, for the Settings debug line */
  adapters: string;
}
export type WatchResult = 'granted' | 'cap' | 'unavailable' | 'closed';
export type BuyResult = { ok: true } | { ok: false; cancelled: boolean; error?: string };

interface Persisted { v: 1; wallet: HintWallet; pacing: AdPacing; owned: Sku[] }
const KEY = 'ruleshift.money.v1';

export interface Deps {
  kv: KV;
  ads?: AdsAdapter;
  purchases?: PurchasesAdapter;
  now: () => number;
  day: () => number;
  /** iOS App Tracking Transparency (or equivalent). resolved=false means the user hasn't decided yet. */
  consent?: () => Promise<{ resolved: boolean; personalized: boolean }>;
}

/**
 * All monetization state + rules in one place. Gameplay only calls: spendHint / watchAdForHint /
 * noteSolved / noteSent / maybeShowInterstitial / buy / restore. Every external call is guarded so
 * a store or ad failure can never break a puzzle.
 */
export class Monetization {
  private wallet: HintWallet = newWallet();
  private pacing: AdPacing = newPacing();
  private owned = new Set<Sku>();
  private products: ProductInfo[] = [];
  private ready = false;
  private busy = false;
  private consentResolved = false;
  private adsLive = false;
  private listeners = new Set<() => void>();
  private snap: MonetizationSnapshot;

  constructor(private d: Deps) { this.snap = this.build(); }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getSnapshot = () => this.snap;

  private build(): MonetizationSnapshot {
    const { d } = this;
    return {
      ready: this.ready,
      hints: this.wallet.balance,
      adsRemoved: this.adsRemoved(),
      creatorUnlocked: this.creatorUnlocked(),
      storeConfigured: !!d.purchases,
      rewardedAvailable: this.adsLive && !!d.ads?.rewardedReady() && rewardedLeft(this.wallet, d.day()) > 0,
      rewardedLeft: rewardedLeft(this.wallet, d.day()),
      storeAvailable: this.products.length > 0,
      products: this.products,
      busy: this.busy,
      adapters: `${d.ads?.name ?? 'no-ads'} / ${d.purchases?.name ?? 'no-store'}`,
    };
  }
  private adsRemoved() { return [...this.owned].some((s) => SKUS[s].removesAds); }
  private creatorUnlocked() { return [...this.owned].some((s) => SKUS[s].unlocksCreator); }
  private publish() { this.snap = this.build(); this.listeners.forEach((l) => l()); }
  private async save() {
    const p: Persisted = { v: 1, wallet: this.wallet, pacing: this.pacing, owned: [...this.owned] };
    try { await this.d.kv.set(KEY, JSON.stringify(p)); } catch { /* best effort */ }
  }

  async init(): Promise<void> {
    try {
      const raw = await this.d.kv.get(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Persisted>;
        if (p.wallet && Number.isFinite(p.wallet.balance)) this.wallet = { ...newWallet(), ...p.wallet };
        if (p.pacing) this.pacing = { ...newPacing(), ...p.pacing };
        for (const s of p.owned ?? []) if (s in SKUS && SKUS[s].kind === 'non_consumable') this.owned.add(s);
      }
    } catch { /* corrupt storage => defaults */ }
    this.wallet = grantDailyFree(this.wallet, this.d.day());
    this.ready = true;
    this.publish();

    // The store is initialised first: re-grants remove-ads after a reinstall, and shows prices.
    if (this.d.purchases) {
      try {
        await this.d.purchases.init();
        for (const s of await this.d.purchases.owned()) this.owned.add(s);
        this.products = await this.d.purchases.products();
      } catch { /* offline */ }
      this.publish();
    }
    // Ads only after the player has answered the tracking prompt (App Store rule + better fill).
    if (this.d.ads && !this.adsRemoved()) {
      try {
        const c = (await this.d.consent?.()) ?? { resolved: true, personalized: false };
        this.consentResolved = c.resolved;
        if (c.resolved) { await this.d.ads.init({ personalized: c.personalized }); this.adsLive = true; }
      } catch { /* no ads this session */ }
    }
    await this.save();
    this.publish();
  }

  /** Ad readiness changes without us knowing; the UI calls this when it opens a screen that offers ads. */
  refresh() { this.publish(); }

  async spendHint(): Promise<boolean> {
    const next = spendHint(this.wallet);
    if (!next) return false;
    this.wallet = next;
    this.publish();
    await this.save();
    return true;
  }

  async watchAdForHint(): Promise<WatchResult> {
    const { d } = this;
    if (rewardedLeft(this.wallet, d.day()) <= 0) return 'cap';
    if (!this.adsLive || !d.ads) return 'unavailable';
    if (this.busy) return 'closed';
    this.busy = true; this.publish();
    try {
      const r = await d.ads.showRewarded();
      if (r === 'earned') {
        this.wallet = creditRewarded(this.wallet, d.day());
        await this.save();
        return 'granted';
      }
      return r;
    } catch { return 'unavailable'; } finally { this.busy = false; this.publish(); }
  }

  noteSolved() { this.pacing = onSolve(this.pacing); void this.save(); }
  noteSent() { this.pacing = onSent(this.pacing); void this.save(); }

  /** Call ONLY at natural breaks (leaving a solved puzzle). Returns true if an ad was shown. */
  async maybeShowInterstitial(): Promise<boolean> {
    const { d } = this;
    if (!d.ads || !this.adsLive) return false;
    const ok = interstitialAllowed(this.pacing, {
      now: d.now(), day: d.day(), adsRemoved: this.adsRemoved(), adsReady: d.ads.interstitialReady(), consentResolved: this.consentResolved,
    });
    if (!ok || this.busy) return false;
    this.busy = true;
    try {
      const shown = await d.ads.showInterstitial();
      if (shown) { this.pacing = onInterstitialShown(this.pacing, d.now(), d.day()); await this.save(); }
      return shown;
    } catch { return false; } finally { this.busy = false; this.publish(); }
  }

  async buy(sku: Sku): Promise<BuyResult> {
    if (!this.d.purchases) return { ok: false, cancelled: false, error: 'Store unavailable' };
    if (this.busy) return { ok: false, cancelled: true };
    this.busy = true; this.publish();
    try {
      const r = await this.d.purchases.purchase(sku);
      if (!r.ok) return r;
      this.grant(sku);
      await this.save();
      return { ok: true };
    } catch (e) {
      return { ok: false, cancelled: false, error: e instanceof Error ? e.message : 'Purchase failed' };
    } finally { this.busy = false; this.publish(); }
  }

  private grant(sku: Sku) {
    const def = SKUS[sku];
    if (def.kind === 'non_consumable') {
      // supporter's hints are granted once, on first ownership only
      if (!this.owned.has(sku)) this.wallet = addHints(this.wallet, def.hints);
      this.owned.add(sku);
    } else this.wallet = addHints(this.wallet, def.hints);
  }

  async restore(): Promise<{ restored: Sku[]; error?: string }> {
    if (!this.d.purchases) return { restored: [], error: 'Store unavailable' };
    this.busy = true; this.publish();
    try {
      const got = await this.d.purchases.restore();
      const fresh = got.filter((s) => !this.owned.has(s));
      for (const s of got) this.owned.add(s);
      await this.save();
      return { restored: fresh };
    } catch (e) { return { restored: [], error: e instanceof Error ? e.message : 'Restore failed' }; }
    finally { this.busy = false; this.publish(); }
  }
}
