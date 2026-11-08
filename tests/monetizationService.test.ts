import { describe, expect, it } from 'vitest';
import { createMockAds, createMockPurchases } from '../src/monetization/adapters/mock';
import { INTERSTITIAL } from '../src/monetization/policy';
import { Monetization } from '../src/monetization/service';
import { MemoryKV } from '../src/social/kv';

const mk = (o: { ads?: ReturnType<typeof createMockAds>; purchases?: ReturnType<typeof createMockPurchases>; kv?: MemoryKV; now?: { t: number }; day?: { d: number }; consent?: boolean } = {}) => {
  const now = o.now ?? { t: 1e9 }; const day = o.day ?? { d: 100 };
  const kv = o.kv ?? new MemoryKV();
  const m = new Monetization({
    kv, ads: o.ads, purchases: o.purchases, now: () => now.t, day: () => day.d,
    consent: async () => ({ resolved: o.consent ?? true, personalized: false }),
  });
  return { m, kv, now, day };
};

describe('hints', () => {
  it('spends, persists across restarts, and refuses at zero', async () => {
    const { m, kv } = mk(); await m.init();
    expect(m.getSnapshot().hints).toBe(3);
    expect(await m.spendHint()).toBe(true);
    const again = mk({ kv }).m; await again.init();
    expect(again.getSnapshot().hints).toBe(2);
    await again.spendHint(); await again.spendHint();
    expect(await again.spendHint()).toBe(false);
  });
  it('rewarded ad grants a hint; closing early grants nothing; cap enforced', async () => {
    const ads = createMockAds();
    const { m } = mk({ ads }); await m.init();
    expect(await m.watchAdForHint()).toBe('granted');
    expect(m.getSnapshot().hints).toBe(4);
    const closed = mk({ ads: createMockAds({ rewarded: 'closed' }) }); await closed.m.init();
    expect(await closed.m.watchAdForHint()).toBe('closed');
    expect(closed.m.getSnapshot().hints).toBe(3);
    for (let i = 0; i < 4; i++) await m.watchAdForHint();
    expect(await m.watchAdForHint()).toBe('cap');
  });
  it('no ads configured => unavailable, never throws', async () => {
    const { m } = mk(); await m.init();
    expect(await m.watchAdForHint()).toBe('unavailable');
    expect(m.getSnapshot().rewardedAvailable).toBe(false);
  });
  it('ads wait for the tracking answer', async () => {
    const ads = createMockAds();
    const { m } = mk({ ads, consent: false }); await m.init();
    expect(await m.watchAdForHint()).toBe('unavailable');
  });
});

describe('interstitials', () => {
  const solves = (m: Monetization, n: number) => { for (let i = 0; i < n; i++) m.noteSolved(); };
  it('only after enough play, then spaced out', async () => {
    const ads = createMockAds(); const { m, now } = mk({ ads }); await m.init();
    solves(m, INTERSTITIAL.MIN_LIFETIME_SOLVES - 1);
    expect(await m.maybeShowInterstitial()).toBe(false);
    solves(m, 1);
    expect(await m.maybeShowInterstitial()).toBe(true);
    solves(m, 5);
    expect(await m.maybeShowInterstitial()).toBe(false); // too soon in time
    now.t += 200_000;
    expect(await m.maybeShowInterstitial()).toBe(true);
    expect(ads.shown.interstitial).toBe(2);
  });
  it('sending a challenge skips the next break; a failed ad does not consume pacing', async () => {
    const ads = createMockAds({ interstitial: false }); const { m } = mk({ ads }); await m.init();
    solves(m, 12);
    expect(await m.maybeShowInterstitial()).toBe(false);
    const ads2 = createMockAds(); const b = mk({ ads: ads2 }); await b.m.init();
    solves(b.m, 12); b.m.noteSent();
    expect(await b.m.maybeShowInterstitial()).toBe(false);
  });
  it('buying remove ads stops them and survives reinstall via ownership check', async () => {
    const ads = createMockAds(); const purchases = createMockPurchases();
    const a = mk({ ads, purchases }); await a.m.init();
    expect(await a.m.buy('remove_ads')).toEqual({ ok: true });
    solves(a.m, 20);
    expect(await a.m.maybeShowInterstitial()).toBe(false);
    // reinstall: fresh storage, but the store still knows the purchase
    const b = mk({ ads, purchases }); await b.m.init();
    expect(b.m.getSnapshot().adsRemoved).toBe(true);
  });
});

describe('purchases', () => {
  it('hint pack adds hints; supporter grants hints once and removes ads', async () => {
    const purchases = createMockPurchases();
    const { m } = mk({ purchases, ads: createMockAds() }); await m.init();
    await m.buy('hints_25');
    expect(m.getSnapshot().hints).toBe(28);
    await m.buy('supporter');
    expect(m.getSnapshot().hints).toBe(88);
    expect(m.getSnapshot().adsRemoved).toBe(true);
    await m.buy('supporter');
    expect(m.getSnapshot().hints).toBe(88); // not granted twice
  });
  it('cancelled and failed purchases change nothing', async () => {
    const c = mk({ purchases: createMockPurchases({ cancel: true }) }); await c.m.init();
    expect(await c.m.buy('hints_25')).toMatchObject({ ok: false, cancelled: true });
    const f = mk({ purchases: createMockPurchases({ fail: true }) }); await f.m.init();
    expect(await f.m.buy('hints_25')).toMatchObject({ ok: false, cancelled: false });
    expect(f.m.getSnapshot().hints).toBe(3);
    expect(f.m.getSnapshot().busy).toBe(false);
  });
  it('restore returns newly restored items', async () => {
    const purchases = createMockPurchases(); purchases.ownedSet.add('remove_ads');
    const { m } = mk({ purchases }); await m.init();
    // init already picked up ownership; restore reports nothing new
    expect((await m.restore()).restored).toEqual([]);
    expect(m.getSnapshot().adsRemoved).toBe(true);
  });
  it('corrupt storage falls back to defaults', async () => {
    const kv = new MemoryKV(); kv.m.set('ruleshift.money.v1', '{"wallet":{"balance":"x"},"owned":["bogus"]}');
    const { m } = mk({ kv }); await m.init();
    expect(m.getSnapshot().hints).toBe(3);
    expect(m.getSnapshot().adsRemoved).toBe(false);
  });
});
