import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dailyNumber, dailyShareText, dayIndex, weekday } from '../daily/daily';
import { liveStreak } from '../daily/progress';
import { loadDailyProgress, useDailyProgress } from '../daily/store';
import { BASE_LEVELS } from '../game/levels';
import { getRepository } from '../social';
import { SEED_CHAINS } from '../social/seeds';
import { track } from '../telemetry';
import { useAppState } from './store';
import { C } from './theme';

/** Accepts a code, a short link, or a whole pasted message; validates before navigating. */
export async function openCode(text: string): Promise<string | null> {
  const r = await getRepository().fetch(text);
  if (!r.ok) { track('challenge_invalid'); return r.error; }
  router.push({ pathname: '/play', params: { code: text } });
  return null;
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { solved } = useAppState();
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const daily = useDailyProgress();
  useEffect(() => { void loadDailyProgress(); }, []);
  const today = dayIndex();
  const live = liveStreak(daily.p, today);
  const todayResult = daily.p.results[String(today)];
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

        <Pressable style={[s.daily, live.doneToday && { borderColor: C.mint }]} onPress={() => router.push('/daily')} accessibilityLabel="Daily puzzle">
          <View style={{ flex: 1 }}>
            <Text style={s.dailyH}>Daily #{dailyNumber(today)} <Text style={s.dailyTier}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(today)]}</Text></Text>
            <Text style={s.dailyD}>
              {live.doneToday ? 'Solved \u2713 Come back tomorrow' : live.atRisk ? (live.usesFreeze ? `Streak ${live.streak} \u00b7 a freeze will cover yesterday` : `Keep your ${live.streak}-day streak alive`) : 'Same puzzle for everyone today'}
            </Text>
          </View>
          {live.streak > 0 && <Text style={s.fire}>{'\uD83D\uDD25'} {live.streak}</Text>}
          {live.doneToday && todayResult
            ? <Pressable style={s.shareBtn} onPress={() => { track('daily_shared'); void Share.share({ message: dailyShareText(today, todayResult, live.streak) }); }}><Text style={s.shareT}>Share</Text></Pressable>
            : <Text style={s.seedGo}>{'\u203A'}</Text>}
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
            setMsg((await openCode(clip)) ?? '');
          }}><Text style={s.pbtnT}>{text.trim() ? 'Go' : 'Paste'}</Text></Pressable>
        </View>
        {!!msg && <Text style={s.msg}>{msg}</Text>}

        <Text style={s.sec}>Featured chains</Text>
        {SEED_CHAINS.map((c, i) => (
          <Pressable key={i} style={s.seed} onPress={() => { track('seed_opened', { depth: c.depth }); router.push({ pathname: '/play', params: { code: c.code } }); }}>
            <View style={{ flex: 1 }}><Text style={s.seedT}>{c.title}</Text><Text style={s.seedD}>{c.depth} {c.depth === 1 ? 'twist' : 'twists'} deep</Text></View>
            <Text style={s.seedGo}>{'\u203A'}</Text>
          </Pressable>
        ))}
        <Pressable style={s.mine} onPress={() => router.push('/chains')}><Text style={s.mineT}>My chains</Text></Pressable>
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
  daily: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 340, backgroundColor: C.panel, borderRadius: 18, borderWidth: 1.5, borderColor: C.pink, padding: 14, marginBottom: 18, gap: 8 },
  dailyH: { color: C.text, fontWeight: '800', fontSize: 16 },
  dailyTier: { color: C.dim, fontWeight: '600', fontSize: 12 },
  dailyD: { color: C.dim, fontSize: 12, marginTop: 3 },
  fire: { color: '#ffb347', fontWeight: '800', fontSize: 16 },
  shareBtn: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  shareT: { color: '#0f1226', fontWeight: '800', fontSize: 13 },
  paste: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 340 },
  input: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.panelEdge, backgroundColor: C.panel, color: C.text, paddingHorizontal: 12, fontSize: 14 },
  pbtn: { height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  pbtnT: { color: C.pink, fontWeight: '700' },
  sec: { color: C.dim, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', alignSelf: 'flex-start', marginTop: 26, marginBottom: 8, width: '100%', maxWidth: 340 },
  seed: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 340, backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: C.panelEdge, padding: 12, marginBottom: 8 },
  seedT: { color: C.text, fontWeight: '700', fontSize: 13 },
  seedD: { color: C.dim, fontSize: 11, marginTop: 2 },
  seedGo: { color: C.pink, fontSize: 24, paddingHorizontal: 6 },
  mine: { marginTop: 14, height: 44, width: '100%', maxWidth: 340, borderRadius: 22, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  mineT: { color: C.text, fontWeight: '700' },
  msg: { color: C.danger, marginTop: 10, fontSize: 13, textAlign: 'center' },
});
