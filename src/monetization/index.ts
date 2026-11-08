import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTrackingPermissionsAsync, PermissionStatus, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { ADS_ENABLED, REVENUECAT_IOS_KEY } from '../config';
import { dayIndex } from '../daily/daily';
import { createAdmobAdapter } from './adapters/admob';
import { createMockAds, createMockPurchases } from './adapters/mock';
import { createRevenueCatAdapter } from './adapters/revenuecat';
import { Monetization } from './service';
import type { AdsAdapter, PurchasesAdapter } from './types';

/**
 * Rule of the design doc: NEVER block progression with an ad. Ads are opt-in (rewarded hints) or at
 * natural breaks only (see policy.ts). Gameplay code talks only to `money()`.
 *
 * Which adapters run:
 *  - release + keys set  -> real AdMob / RevenueCat
 *  - dev build, no keys  -> clearly-fake mock adapters so the whole flow can be exercised
 *  - release, no keys    -> no ads, no store (the game is simply free)
 */
function pickAds(): AdsAdapter | undefined {
  if (Platform.OS === 'web') return undefined;
  if (ADS_ENABLED) return createAdmobAdapter();
  return __DEV__ ? createMockAds({ delayMs: 600 }) : undefined;
}
function pickPurchases(): PurchasesAdapter | undefined {
  if (Platform.OS === 'web') return undefined;
  if (REVENUECAT_IOS_KEY) return createRevenueCatAdapter();
  return __DEV__ ? createMockPurchases() : undefined;
}

/** iOS App Tracking Transparency. Asked once, at first launch, before any ad is requested. */
async function askConsent() {
  if (Platform.OS !== 'ios') return { resolved: true, personalized: false };
  try {
    let st = (await getTrackingPermissionsAsync()).status;
    if (st === PermissionStatus.UNDETERMINED) st = (await requestTrackingPermissionsAsync()).status;
    return { resolved: st !== PermissionStatus.UNDETERMINED, personalized: st === PermissionStatus.GRANTED };
  } catch { return { resolved: false, personalized: false }; }
}

let instance: Monetization | null = null;
export function money(): Monetization {
  if (!instance) {
    instance = new Monetization({
      kv: { get: (k) => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) },
      ads: pickAds(), purchases: pickPurchases(), now: () => Date.now(), day: () => dayIndex(), consent: askConsent,
    });
  }
  return instance;
}
export const initMonetization = () => money().init();

export function useMoney() {
  const m = money();
  return useSyncExternalStore(m.subscribe, m.getSnapshot);
}
