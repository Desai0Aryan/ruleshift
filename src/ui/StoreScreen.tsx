import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, useMoney } from '../monetization';
import { SKU_ORDER, SKUS, type Sku } from '../monetization/policy';
import { track } from '../telemetry';
import { C } from './theme';

export function StoreScreen() {
  const insets = useSafeAreaInsets();
  const m = useMoney();
  const [note, setNote] = useState('');
  useEffect(() => { track('store_opened'); money().refresh(); }, []);

  const owned = (sku: Sku) => SKUS[sku].kind === 'non_consumable' && SKUS[sku].removesAds && m.adsRemoved;
  const buy = async (sku: Sku) => {
    track('purchase_started', { sku });
    const r = await money().buy(sku);
    if (r.ok) { track('purchase_done', { sku }); setNote('Thank you! ❤️'); }
    else if (!r.cancelled) { track('purchase_failed', { sku }); setNote(r.error ?? 'Purchase failed. You were not charged.'); }
  };
  const restore = async () => {
    track('restore_tapped');
    const r = await money().restore();
    setNote(r.error ? r.error : r.restored.length ? 'Purchases restored.' : 'Nothing to restore.');
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 }}>
      <View style={s.head}>
        <Pressable style={s.ibtn} onPress={() => router.back()} accessibilityLabel="Back"><Text style={s.ibtnT}>{'‹'}</Text></Pressable>
        <Text style={s.h1}>Shop</Text>
        <Text style={s.bal}>{'💡'} {m.hints}</Text>
      </View>
      <Text style={s.free}>Solving, twisting and sending puzzles is always free.</Text>

      {m.products.length === 0 && <Text style={s.dim}>The store isn{'’'}t available right now.</Text>}
      {SKU_ORDER.filter((k) => m.products.some((p) => p.sku === k)).map((sku) => {
        const def = SKUS[sku];
        const price = m.products.find((p) => p.sku === sku)!.price;
        const have = owned(sku) && def.kind === 'non_consumable';
        return (
          <View key={sku} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{def.title}</Text>
              <Text style={s.blurb}>{def.blurb}</Text>
            </View>
            <Pressable style={[s.buy, (have || m.busy) && { opacity: 0.45 }]} disabled={have || m.busy} onPress={() => buy(sku)} accessibilityLabel={`Buy ${def.title} for ${price}`}>
              <Text style={s.buyT}>{have ? 'Owned' : price}</Text>
            </Pressable>
          </View>
        );
      })}

      {!!note && <Text style={s.note}>{note}</Text>}
      {m.storeAvailable && <Pressable style={s.restore} onPress={restore} disabled={m.busy}><Text style={s.restoreT}>Restore purchases</Text></Pressable>}
      <Text style={s.fine}>Payment is charged to your Apple ID. {m.adapters.includes('mock') ? '(Test store: nothing is charged.)' : ''}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgTop },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ibtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  ibtnT: { color: C.text, fontSize: 18 },
  h1: { color: C.text, fontSize: 24, fontWeight: '800', flex: 1 },
  bal: { color: C.text, fontWeight: '800', fontSize: 16 },
  free: { color: C.mint, fontSize: 13, marginBottom: 16 },
  dim: { color: C.dim, fontSize: 14, marginVertical: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderRadius: 18, borderWidth: 1, borderColor: C.panelEdge, padding: 14, marginBottom: 10 },
  title: { color: C.text, fontSize: 17, fontWeight: '800' },
  blurb: { color: C.dim, fontSize: 12, marginTop: 3 },
  buy: { minWidth: 76, height: 40, borderRadius: 20, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  buyT: { color: '#0f1226', fontWeight: '800' },
  note: { color: C.text, textAlign: 'center', marginTop: 8 },
  restore: { height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  restoreT: { color: C.text, fontWeight: '700' },
  fine: { color: C.dim, fontSize: 11, textAlign: 'center', marginTop: 14 },
});
