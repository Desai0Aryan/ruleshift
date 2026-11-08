import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_LEVELS } from '../game/levels';
import { decodeChain } from '../social/codec';
import { challengeFromChain } from '../social/flow';
import { extractCode } from '../social/links';
import { track } from '../telemetry';
import { useAppState } from './store';
import { C } from './theme';

export function openCode(text: string): string | null {
  const code = extractCode(text);
  if (!code) return 'That doesn’t look like a RULESHIFT challenge.';
  const d = decodeChain(code);
  if (!d.ok) { track('challenge_invalid'); return d.error; }
  const c = challengeFromChain(d.chain);
  if (!c.ok) { track('challenge_invalid'); return c.error; }
  track('challenge_opened', { depth: d.chain.links.length });
  router.push({ pathname: '/play', params: { code } });
  return null;
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { solved } = useAppState();
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const next = BASE_LEVELS.find((l) => !solved.includes(l.id)) ?? BASE_LEVELS[0];

  return (
    <LinearGradient colors={['#232a7a', C.bgTop, C.bgTop]} locations={[0, 0.55, 1]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.push('/settings')} style={[s.gear, { top: insets.top + 8 }]} accessibilityLabel="Settings"><Text style={s.gearT}>{'⚙'}</Text></Pressable>
        <Text style={s.logo}><Text style={{ color: C.accent }}>RULE</Text><Text style={{ color: C.pink }}>SHIFT</Text></Text>
        <Text style={s.tag}>You solve it {'·'} You change it {'·'} You pass it on</Text>

        <Pressable style={s.cta} onPress={() => router.push({ pathname: '/play', params: { level: next.id } })}>
          <Text style={s.ctaT}>{solved.length === 0 ? 'Play' : 'Continue'}</Text>
        </Pressable>

        <View style={s.grid}>
          {BASE_LEVELS.map((l, i) => {
            const done = solved.includes(l.id);
            return (
              <Pressable key={l.id} style={[s.lv, done && { borderColor: C.mint }]} onPress={() => router.push({ pathname: '/play', params: { level: l.id } })}>
                <Text style={[s.lvT, done && { color: C.mint }]}>{i + 1}</Text>
                {done && <Text style={s.tick}>{'✓'}</Text>}
              </Pressable>
            );
          })}
        </View>

        <View style={s.paste}>
          <TextInput value={text} onChangeText={setText} placeholder="Paste a friend's challenge…" placeholderTextColor={C.dim}
            autoCapitalize="none" autoCorrect={false} style={s.input} />
          <Pressable style={s.pbtn} onPress={async () => {
            const clip = text.trim() ? text : await Clipboard.getStringAsync();
            setText(clip);
            setMsg(openCode(clip) ?? '');
          }}><Text style={s.pbtnT}>{text.trim() ? 'Go' : 'Paste'}</Text></Pressable>
        </View>
        {!!msg && <Text style={s.msg}>{msg}</Text>}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 20 },
  gear: { position: 'absolute', right: 0, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  gearT: { color: C.dim, fontSize: 24 },
  logo: { fontSize: 46, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  tag: { color: C.dim, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 24, textAlign: 'center' },
  cta: { width: '100%', maxWidth: 340, height: 58, borderRadius: 29, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: C.accent, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  ctaT: { color: '#fff', fontWeight: '800', fontSize: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', maxWidth: 340, marginBottom: 22 },
  lv: { width: '22.5%', aspectRatio: 1, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  lvT: { color: C.text, fontWeight: '800', fontSize: 18 },
  tick: { position: 'absolute', right: 7, top: 3, color: C.mint, fontSize: 11 },
  paste: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 340 },
  input: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.panelEdge, backgroundColor: C.panel, color: C.text, paddingHorizontal: 12, fontSize: 14 },
  pbtn: { height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  pbtnT: { color: C.pink, fontWeight: '700' },
  msg: { color: C.danger, marginTop: 10, fontSize: 13, textAlign: 'center' },
});
