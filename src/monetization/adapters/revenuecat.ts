import Purchases, { PURCHASES_ERROR_CODE, type PurchasesStoreProduct } from 'react-native-purchases';
import { REVENUECAT_IOS_KEY } from '../../config';
import { SKU_ORDER, SKUS, skuFromStoreId, type Sku } from '../policy';
import type { ProductInfo, PurchaseResult, PurchasesAdapter } from '../types';

/** RevenueCat over StoreKit. Products are plain App Store products (no subscriptions), fetched by id. */
export function createRevenueCatAdapter(): PurchasesAdapter {
  let configured = false;
  const cache = new Map<Sku, PurchasesStoreProduct>();

  const load = async () => {
    const list = await Purchases.getProducts(SKU_ORDER.map((k) => SKUS[k].storeId));
    for (const p of list) { const sku = skuFromStoreId(p.identifier); if (sku) cache.set(sku, p); }
  };
  const ownedFrom = (ids: string[]): Sku[] =>
    ids.map(skuFromStoreId).filter((s): s is Sku => !!s && SKUS[s].kind === 'non_consumable');

  return {
    name: 'revenuecat',
    async init() {
      if (!REVENUECAT_IOS_KEY) return;
      Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
      configured = true;
      try { await load(); } catch { /* offline: retried on demand */ }
    },
    async products(): Promise<ProductInfo[]> {
      if (!configured) return [];
      if (cache.size === 0) { try { await load(); } catch { return []; } }
      return SKU_ORDER.filter((k) => cache.has(k)).map((k) => ({ sku: k, price: cache.get(k)!.priceString }));
    },
    async purchase(sku): Promise<PurchaseResult> {
      if (!configured) return { ok: false, cancelled: false, error: 'Store unavailable' };
      try {
        if (!cache.has(sku)) await load();
        const product = cache.get(sku);
        if (!product) return { ok: false, cancelled: false, error: 'Product not available yet' };
        await Purchases.purchaseStoreProduct(product);
        return { ok: true, sku };
      } catch (e) {
        const err = e as { code?: unknown; userCancelled?: boolean; message?: string };
        const cancelled = err.userCancelled === true || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
        return { ok: false, cancelled, error: cancelled ? undefined : err.message ?? 'Purchase failed' };
      }
    },
    async restore() {
      if (!configured) return [];
      return ownedFrom((await Purchases.restorePurchases()).allPurchasedProductIdentifiers);
    },
    async owned() {
      if (!configured) return [];
      try { return ownedFrom((await Purchases.getCustomerInfo()).allPurchasedProductIdentifiers); } catch { return []; }
    },
  };
}
