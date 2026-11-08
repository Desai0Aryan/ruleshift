import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RULES } from '../rules';
import { getRepository } from '../social';
import { shareMessage, shareUrl } from '../social/links';
import { type MyChain } from '../social/repository';
import { C } from './theme';

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Everything you've sent: re-share, or replay the whole chain from its stored inputs. */
export function ChainsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<MyChain[] | null>(null);
  const [note, setNote] = useState('');
  const repo = getRepository();
  useEffect(() => { void repo.mine().then(setItems); }, [repo]);

  const messageFor = (c: MyChain) => {
    const chain = repo.chainFor(c);
    if (!chain) return '';
    return c.remote ? shareMessage(chain, shareUrl(c.id)) : shareMessage(chain);
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 }}>
      <View style={s.head}>
        <Pressable style={s.ibtn} onPress={() => router.back()}><Text style={s.ibtnT}>{'\u2039'}</Text></Pressable>
        <Text style={s.h1}>My chains</Text>
      </View>
      {items === null && <Text style={s.dim}>Loading{'\u2026'}</Text>}
      {items?.length === 0 && <Text style={s.dim}>Nothing sent yet. Solve a puzzle, change one rule, and it shows up here.</Text>}
      {items?.map((c) => (
        <View key={c.id} style={s.card}>
          <View style={{ flex: 1 }}>
            <Text style={s.t}>{RULES[c.rule].name} {'\u00b7'} {c.depth} {c.depth === 1 ? 'twist' : 'twists'} deep</Text>
            <Text style={s.dim}>{ago(c.createdAt)} {'\u00b7'} {c.remote ? 'online link' : 'offline code'}</Text>
          </View>
          <Pressable style={s.mini} onPress={() => { const ch = repo.chainFor(c); if (ch) router.push({ pathname: '/replay', params: { code: c.code } }); }}><Text style={s.miniT}>Replay</Text></Pressable>
          <Pressable style={[s.mini, { borderColor: C.mint }]} onPress={async () => {
            const m = messageFor(c);
            try { await Share.share({ message: m }); } catch { await Clipboard.setStringAsync(m); setNote('Copied'); }
          }}><Text style={[s.miniT, { color: C.mint }]}>Send</Text></Pressable>
        </View>
      ))}
      {!!note && <Text style={[s.dim, { textAlign: 'center', marginTop: 10 }]}>{note}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgTop },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  ibtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  ibtnT: { color: C.text, fontSize: 18 },
  h1: { color: C.text, fontSize: 24, fontWeight: '800' },
  dim: { color: C.dim, fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: C.panelEdge, padding: 12, marginBottom: 10 },
  t: { color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  mini: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  miniT: { color: C.text, fontWeight: '700', fontSize: 12 },
});
