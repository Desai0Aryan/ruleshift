import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { Solution } from '../game/types';
import { dealHand, ICON_GLYPH, RULES } from '../rules';
import { verifyRule, type Verdict } from '../rules/verify';
import type { Chain } from '../social/chain';
import { type Challenge, passItOn } from '../social/flow';
import { getRepository } from '../social';
import { backendEnabled } from '../config';
import { shareReplayGif } from './exportGif';
import { track } from '../telemetry';
import { C } from './theme';

const getRepoIsOnlineCapable = () => backendEnabled;

interface RowState { status: 'checking' | 'ok' | 'no'; text: string; progress: number; verdict?: Verdict }

export function RulePickerSheet(props: {
  challenge: Challenge;
  solved: Solution;
  nextLabel?: string;
  onNext?: () => void;
  onHome: () => void;
  onChosen: (chain: Chain) => void;
}) {
  const { challenge, solved } = props;
  const [deal, setDeal] = useState(() => (Date.now() & 0xffff) + 1);
  const hand = dealHand(deal, 4);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const baseSeed = (Date.now() & 0xffff) + 1;
    setRows(Object.fromEntries(dealHand(deal, 4).map((id) => [id, { status: 'checking', text: 'checking…', progress: 0 } as RowState])));
    dealHand(deal, 4).forEach((id) => {
      verifyRule(challenge.level, id, {
        baseSeed,
        budget: 4500,
        onProgress: (f) => alive.current && setRows((r) => (r[id]?.status === 'checking' ? { ...r, [id]: { ...r[id], progress: f } } : r)),
      }).then((v) => {
        if (!alive.current) return;
        if (v.status !== 'ok') track('rule_unavailable', { rule: id, why: v.status });
        setRows((r) => ({ ...r, [id]: v.status === 'ok' ? { status: 'ok', text: 'ready', progress: 1, verdict: v } : { status: 'no', text: v.reason, progress: 1 } }));
      });
    });
    return () => { alive.current = false; };
  }, [challenge, deal]);

  const choose = (id: string) => {
    const v = rows[id]?.verdict;
    if (!v || v.status !== 'ok') return;
    const applied = v.level.rules[v.level.rules.length - 1];
    track('rule_picked', { rule: applied.id, depth: challenge.depth });
    props.onChosen(passItOn(challenge, solved, { id: applied.id, seed: applied.seed }, v.solution));
  };

  return (
    <View style={s.sheet}>
      <Text style={s.h2}>Solved! {'✨'} Change ONE rule</Text>
      <Text style={s.p}>{challenge.source !== 'campaign' ? 'Add your twist and pass it on.' : 'Pick a twist, then send it to a friend.'} We check every twist is still solvable.</Text>
      {hand.map((id) => {
        const r = RULES[id];
        const st = rows[id] ?? { status: 'checking', text: 'checking…', progress: 0 };
        return (
          <Pressable key={id} disabled={st.status !== 'ok'} onPress={() => choose(id)}
            style={({ pressed }) => [s.rule, { borderColor: r.color, opacity: st.status === 'no' ? 0.45 : 1, borderStyle: st.status === 'no' ? 'dashed' : 'solid', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <View style={[s.glyph, { backgroundColor: r.color }]}><Text style={s.glyphT}>{ICON_GLYPH[r.icon]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rname}>{r.name}</Text>
              <Text style={s.rblurb}>{r.blurb}</Text>
            </View>
            <Text style={[s.status, { color: r.color }]}>{st.text}</Text>
            {st.status === 'checking' && <View style={[s.prog, { backgroundColor: r.color, width: `${Math.round(st.progress * 100)}%` }]} />}
          </Pressable>
        );
      })}
      <View style={s.row}>
        <Pressable style={s.btn} onPress={() => { track('hand_reroll', { depth: challenge.depth }); setDeal((d) => d + 1); }}><Text style={s.btnT}>{'\u21BB'} New hand</Text></Pressable>
        {props.onNext && <Pressable style={s.btn} onPress={props.onNext}><Text style={s.btnT}>{props.nextLabel ?? 'Next'} {'›'}</Text></Pressable>}
        <Pressable style={s.btn} onPress={props.onHome}><Text style={s.btnT}>Home</Text></Pressable>
      </View>
    </View>
  );
}

export function SendSheet(props: { chain: Chain; message: string; remote: boolean; nodeId?: string; onReplay: () => void; onHome: () => void }) {
  const last = props.chain.links[props.chain.links.length - 1];
  const [note, setNote] = useState('');
  const [gifProgress, setGifProgress] = useState<number | null>(null);
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 2200); };
  const repo = getRepository();
  return (
    <View style={s.sheet}>
      <Text style={s.h2}>Ready to send {'\uD83D\uDE80'}</Text>
      <Text style={s.p}>{RULES[last.rule].name} added. Your friend must solve it {'\u2014'} then add their own twist.</Text>
      <Text style={s.code} numberOfLines={3} selectable>{props.message}</Text>
      {!props.remote && getRepoIsOnlineCapable() && <Text style={s.warn}>Offline right now, so this is a self-contained code. It works anywhere.</Text>}
      <View style={s.row}>
        <Pressable style={[s.btn, s.mint]} onPress={async () => {
          track('share_tapped', { depth: props.chain.links.length, remote: props.remote });
          void repo.event(null, props.nodeId, 'share');
          try { await Share.share({ message: props.message }); } catch { /* cancelled */ }
        }}>
          <Text style={[s.btnT, { color: C.bgTop }]}>Send to a friend</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={async () => { track('copy_tapped'); void repo.event(null, props.nodeId, 'copy'); await Clipboard.setStringAsync(props.message); flash('Copied \u2014 paste it in any chat'); }}>
          <Text style={s.btnT}>Copy</Text>
        </Pressable>
      </View>
      <View style={s.row}>
        <Pressable style={s.btn} onPress={props.onReplay}><Text style={s.btnT}>Watch replay</Text></Pressable>
        <Pressable style={s.btn} disabled={gifProgress !== null} onPress={async () => {
          setGifProgress(0);
          track('gif_export', { depth: props.chain.links.length });
          const r = await shareReplayGif(props.chain, setGifProgress);
          setGifProgress(null);
          if (r !== 'shared') flash(r === 'unavailable' ? 'Sharing isn\u2019t available on this device' : 'Couldn\u2019t make the GIF');
        }}>
          <Text style={s.btnT}>{gifProgress === null ? 'Share GIF' : `Making GIF ${Math.round(gifProgress * 100)}%`}</Text>
        </Pressable>
      </View>
      <View style={s.row}>
        <Pressable style={s.btn} onPress={props.onHome}><Text style={s.btnT}>Home</Text></Pressable>
      </View>
      {!!note && <Text style={s.note}>{note}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: '#141944', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: C.panelEdge, padding: 18, paddingBottom: 30 },
  h2: { color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  p: { color: C.dim, fontSize: 13, marginBottom: 14 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: '#1f2563', borderWidth: 1.5, marginBottom: 9, overflow: 'hidden' },
  glyph: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  glyphT: { color: C.bgTop, fontWeight: '900', fontSize: 15 },
  rname: { color: C.text, fontSize: 16, fontWeight: '700' },
  rblurb: { color: C.dim, fontSize: 12 },
  status: { fontSize: 11, fontWeight: '700' },
  prog: { position: 'absolute', left: 0, bottom: 0, height: 3 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, height: 48, borderRadius: 24, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  mint: { backgroundColor: C.mint, borderWidth: 0 },
  btnT: { color: C.text, fontWeight: '700', fontSize: 15 },
  code: { color: C.dim, fontFamily: 'Menlo', fontSize: 10, backgroundColor: C.bgTop, borderRadius: 10, borderWidth: 1, borderColor: C.panelEdge, padding: 8, marginBottom: 10 },
  warn: { color: C.gold, fontSize: 12, marginBottom: 8 },
  note: { color: C.mint, textAlign: 'center', marginTop: 10, fontSize: 13 },
});
