import { Redirect, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getRepository } from '../social';
import { decodeCustom } from '../social/codec';
import { type Challenge, challengeFromBase, challengeFromCustom } from '../social/flow';
import { track } from '../telemetry';
import { PlayScreen } from '../ui/PlayScreen';
import { C } from '../ui/theme';

/** `level` = authored level id. `code` = an offline share code, a short link, or a bare node id. */
export default function Play() {
  const { level, code, custom } = useLocalSearchParams<{ level?: string; code?: string; custom?: string }>();
  const base = useMemo(() => (code || custom ? null : challengeFromBase(level ?? 'L01')), [level, code, custom]);
  const testing = useMemo(() => {
    if (!custom) return null;
    const d = decodeCustom(custom);
    return d.ok ? challengeFromCustom(d.def) : d;
  }, [custom]);
  const [remote, setRemote] = useState<{ challenge?: Challenge; error?: string } | null>(null);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    setRemote(null);
    void getRepository().fetch(code).then((r) => {
      if (!alive) return;
      if (r.ok) { track('challenge_opened', { depth: r.challenge.depth - 1, remote: !!r.challenge.nodeId }); setRemote({ challenge: r.challenge }); }
      else { track('challenge_invalid'); setRemote({ error: r.error }); }
    });
    return () => { alive = false; };
  }, [code]);

  if (testing) {
    if (!testing.ok) {
      return (
        <View style={s.c}>
          <Text style={s.t}>{testing.error}</Text>
          <Pressable style={s.b} onPress={() => router.back()}><Text style={s.bt}>Back to editor</Text></Pressable>
        </View>
      );
    }
    return <PlayScreen key={custom} challenge={testing.challenge} />;
  }
  if (base) return <PlayScreen key={level ?? 'L01'} challenge={base} />;
  if (!code) return <Redirect href="/" />;
  if (!remote) return <View style={s.c}><ActivityIndicator color={C.accent} size="large" /><Text style={s.t}>Opening challenge{'\u2026'}</Text></View>;
  if (remote.error || !remote.challenge) {
    return (
      <View style={s.c}>
        <Text style={s.t}>{remote.error ?? 'This challenge can\u2019t be opened.'}</Text>
        <Pressable style={s.b} onPress={() => router.replace('/')}><Text style={s.bt}>Home</Text></Pressable>
      </View>
    );
  }
  return <PlayScreen key={code} challenge={remote.challenge} />;
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: C.bgTop, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 },
  t: { color: C.text, fontSize: 16, textAlign: 'center' },
  b: { height: 46, paddingHorizontal: 26, borderRadius: 23, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  bt: { color: '#fff', fontWeight: '700' },
});
