import { describe, expect, it } from 'vitest';
import {
  addHints, creditRewarded, grantDailyFree, HINT, INTERSTITIAL, interstitialAllowed, newPacing, newWallet, onInterstitialShown,
  onSent, onSolve, rewardedLeft, skuFromStoreId, SKU_ORDER, SKUS, spendHint,
} from '../src/monetization/policy';

describe('hint wallet', () => {
  it('starts with a few hints and tops up one per day to the free cap only', () => {
    let w = newWallet();
    expect(w.balance).toBe(3);
    w = grantDailyFree(w, 10);
    expect(w.balance).toBe(3); // already at the cap
    w = spendHint(w)!; w = spendHint(w)!;
    expect(w.balance).toBe(1);
    expect(grantDailyFree(w, 10).balance).toBe(1); // same day: nothing
    expect(grantDailyFree(w, 11).balance).toBe(2);
    expect(grantDailyFree(w, 5)).toBe(w); // clock going backwards
  });
  it('purchased hints are never reduced by the daily top-up', () => {
    let w = addHints(newWallet(), 25);
    w = grantDailyFree(w, 1);
    expect(w.balance).toBe(28);
  });
  it('cannot spend below zero', () => {
    let w = newWallet();
    for (let i = 0; i < 3; i++) w = spendHint(w)!;
    expect(spendHint(w)).toBeNull();
  });
  it('rewarded ads are capped per day and reset next day', () => {
    let w = newWallet();
    for (let i = 0; i < HINT.MAX_REWARDED_PER_DAY; i++) w = creditRewarded(w, 7);
    expect(rewardedLeft(w, 7)).toBe(0);
    expect(rewardedLeft(w, 8)).toBe(HINT.MAX_REWARDED_PER_DAY);
    expect(w.balance).toBe(3 + HINT.MAX_REWARDED_PER_DAY);
  });
});

describe('interstitial pacing', () => {
  const ctx = (o = {}) => ({ now: 1_000_000_000, day: 1, adsRemoved: false, adsReady: true, consentResolved: true, ...o });
  const solved = (n: number) => { let p = newPacing(); for (let i = 0; i < n; i++) p = onSolve(p); return p; };
  it('never in the first solves', () => {
    expect(interstitialAllowed(solved(INTERSTITIAL.MIN_LIFETIME_SOLVES - 1), ctx())).toBe(false);
    expect(interstitialAllowed(solved(INTERSTITIAL.MIN_LIFETIME_SOLVES), ctx())).toBe(true);
  });
  it('never when ads removed, not ready, or consent unresolved', () => {
    const p = solved(20);
    expect(interstitialAllowed(p, ctx({ adsRemoved: true }))).toBe(false);
    expect(interstitialAllowed(p, ctx({ adsReady: false }))).toBe(false);
    expect(interstitialAllowed(p, ctx({ consentResolved: false }))).toBe(false);
  });
  it('spaces ads by solves and by time', () => {
    let p = solved(20);
    p = onInterstitialShown(p, 1_000_000_000, 1);
    expect(interstitialAllowed(solved(0) && p, ctx({ now: 1_000_000_000 + 10 * 60_000 }))).toBe(false); // no solves since
    for (let i = 0; i < 3; i++) p = onSolve(p);
    expect(interstitialAllowed(p, ctx({ now: 1_000_000_000 + 60_000 }))).toBe(false); // too soon
    expect(interstitialAllowed(p, ctx({ now: 1_000_000_000 + 181_000 }))).toBe(true);
  });
  it('sending a challenge earns an ad-free break', () => {
    const p = onSent(solved(20));
    expect(interstitialAllowed(p, ctx())).toBe(false);
    const after = onInterstitialShown(p, 0, 1);
    expect(after.sentSinceAd).toBe(false);
  });
  it('daily cap holds and resets next day', () => {
    let p = solved(50);
    for (let i = 0; i < INTERSTITIAL.MAX_PER_DAY; i++) { p = onInterstitialShown(p, i * 1e7, 1); p = { ...p, solvesSinceAd: 9 }; }
    expect(interstitialAllowed(p, ctx({ now: 1e9, day: 1 }))).toBe(false);
    expect(interstitialAllowed(p, ctx({ now: 1e9, day: 2 }))).toBe(true);
  });
});

describe('products', () => {
  it('store ids are unique and round-trip', () => {
    const ids = SKU_ORDER.map((k) => SKUS[k].storeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of SKU_ORDER) expect(skuFromStoreId(SKUS[k].storeId)).toBe(k);
    expect(skuFromStoreId('nope')).toBeNull();
  });
});
