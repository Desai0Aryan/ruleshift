import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMoney } from '../monetization';
import { clearTelemetry, exportJson, type GateSummary, summary } from '../telemetry';
import { resetProgress, setHaptics, setSound, useAppState } from './store';
import { C } from './theme';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const st = useAppState();
  const wallet = useMoney();
  const [sum, setSum] = useState<GateSummary | null>(null);
  const [note, setNote] = useState('');
  const refresh = () => { void summary().then(setSum); };
  useEffect(refresh, []);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 }}>
      <View style={s.head}>
        <Pressable style={s.ibtn} onPress={() => router.back()}><Text style={s.ibtnT}>{'‹'}</Text></Pressable>
        <Text style={s.h1}>Settings</Text>
      </View>

      <View style={s.card}>
        <View style={s.row}><Text style={s.label}>Sound</Text><Switch value={st.sound} onValueChange={setSound} /></View>
        <View style={s.row}><Text style={s.label}>Haptics</Text><Switch value={st.haptics} onValueChange={setHaptics} /></View>
      </View>

      <Text style={s.sec}>Hints &amp; shop</Text>
      <View style={s.card}>
        <Text style={s.stat}>Hints left: <Text style={s.val}>{wallet.hints}</Text>  <Text style={s.dim}>(+1 free every day)</Text></Text>
        {wallet.storeAvailable && <Pressable style={s.btn} onPress={() => router.push('/store')}><Text style={s.btnT}>Shop &amp; restore purchases</Text></Pressable>}
        {__DEV__ && <Text style={s.dim}>Debug: {wallet.adapters}</Text>}
      </View>

      <Text style={s.sec}>Playtest numbers (this device)</Text>
      <View style={s.card}>
        <Text style={s.stat}>Levels solved: <Text style={s.val}>{sum?.counts.level_solved ?? 0}</Text></Text>
        <Text style={s.stat}>Twist picked per solve: <Text style={s.val}>{pct(sum?.twistRate ?? null)}</Text></Text>
        <Text style={s.stat}>Sent per solve: <Text style={s.val}>{pct(sum?.sendRate ?? null)}</Text>  <Text style={s.dim}>(goal: 20%+)</Text></Text>
        <Text style={s.stat}>Attempts per level: <Text style={s.val}>{sum?.attemptsPerLevel?.toFixed(1) ?? '—'}</Text></Text>
        <Text style={s.stat}>Challenges opened: <Text style={s.val}>{sum?.counts.challenge_opened ?? 0}</Text></Text>
        <View style={s.btnRow}>
          <Pressable style={s.btn} onPress={async () => { await Clipboard.setStringAsync(await exportJson()); setNote('Copied raw events'); }}><Text style={s.btnT}>Copy raw data</Text></Pressable>
          <Pressable style={s.btn} onPress={refresh}><Text style={s.btnT}>Refresh</Text></Pressable>
        </View>
        {!!note && <Text style={[s.dim, { marginTop: 8 }]}>{note}</Text>}
      </View>

      <Text style={s.sec}>Danger zone</Text>
      <View style={s.card}>
        <Pressable style={[s.btn, { borderColor: C.danger }]} onPress={async () => { resetProgress(); await clearTelemetry(); refresh(); setNote('Progress and stats reset'); }}>
          <Text style={[s.btnT, { color: C.danger }]}>Reset progress &amp; stats</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgTop },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  ibtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  ibtnT: { color: C.text, fontSize: 18 },
  h1: { color: C.text, fontSize: 24, fontWeight: '800' },
  sec: { color: C.dim, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: C.panel, borderRadius: 18, borderWidth: 1, borderColor: C.panelEdge, padding: 14, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: C.text, fontSize: 16 },
  stat: { color: C.dim, fontSize: 14 },
  val: { color: C.text, fontWeight: '700' },
  dim: { color: C.dim, fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  btnT: { color: C.text, fontWeight: '700' },
});
