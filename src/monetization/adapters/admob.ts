import { Platform } from 'react-native';
import mobileAds, { AdEventType, InterstitialAd, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { ADMOB_INTERSTITIAL_ID, ADMOB_REWARDED_ID } from '../../config';
import type { AdsAdapter, RewardedResult } from '../types';

/** Real AdMob. Every SDK call is wrapped: an ad problem must never crash or block the game. */
export function createAdmobAdapter(): AdsAdapter {
  const rewardedId = ADMOB_REWARDED_ID || TestIds.REWARDED;
  const interstitialId = ADMOB_INTERSTITIAL_ID || TestIds.INTERSTITIAL;
  let personalized = false;
  let rewarded: RewardedAd | null = null;
  let rewardedLoaded = false;
  let interstitial: InterstitialAd | null = null;
  let interstitialLoaded = false;
  let retry = 0;

  const loadRewarded = () => {
    try {
      rewardedLoaded = false;
      rewarded = RewardedAd.createForAdRequest(rewardedId, { requestNonPersonalizedAdsOnly: !personalized });
      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => { rewardedLoaded = true; retry = 0; });
      rewarded.addAdEventListener(AdEventType.ERROR, () => { rewardedLoaded = false; setTimeout(loadRewarded, Math.min(60000, 2000 * 2 ** retry++)); });
      rewarded.load();
    } catch { rewarded = null; }
  };
  const loadInterstitial = () => {
    try {
      interstitialLoaded = false;
      interstitial = InterstitialAd.createForAdRequest(interstitialId, { requestNonPersonalizedAdsOnly: !personalized });
      interstitial.addAdEventListener(AdEventType.LOADED, () => { interstitialLoaded = true; });
      interstitial.addAdEventListener(AdEventType.ERROR, () => { interstitialLoaded = false; setTimeout(loadInterstitial, 30000); });
      interstitial.load();
    } catch { interstitial = null; }
  };

  return {
    name: 'admob',
    async init(opts) {
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
      personalized = opts.personalized;
      try { await mobileAds().initialize(); } catch { return; }
      loadRewarded();
      loadInterstitial();
    },
    rewardedReady: () => rewardedLoaded,
    interstitialReady: () => interstitialLoaded,
    showRewarded() {
      const ad = rewarded;
      if (!ad || !rewardedLoaded) return Promise.resolve<RewardedResult>('unavailable');
      return new Promise<RewardedResult>((resolve) => {
        let earned = false;
        const offs: (() => void)[] = [];
        const done = (r: RewardedResult) => { offs.forEach((o) => o()); loadRewarded(); resolve(r); };
        try {
          offs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
          offs.push(ad.addAdEventListener(AdEventType.CLOSED, () => done(earned ? 'earned' : 'closed')));
          offs.push(ad.addAdEventListener(AdEventType.ERROR, () => done(earned ? 'earned' : 'unavailable')));
          ad.show().catch(() => done('unavailable'));
        } catch { done('unavailable'); }
      });
    },
    showInterstitial() {
      const ad = interstitial;
      if (!ad || !interstitialLoaded) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const offs: (() => void)[] = [];
        const done = (shown: boolean) => { offs.forEach((o) => o()); loadInterstitial(); resolve(shown); };
        try {
          offs.push(ad.addAdEventListener(AdEventType.CLOSED, () => done(true)));
          offs.push(ad.addAdEventListener(AdEventType.ERROR, () => done(false)));
          ad.show().catch(() => done(false));
        } catch { done(false); }
      });
    },
  };
}
