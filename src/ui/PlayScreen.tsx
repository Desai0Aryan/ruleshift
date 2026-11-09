import { Canvas, Picture, type SkPicture } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayController } from '../game/controller';
import { BASE_LEVELS } from '../game/levels';
import { POS_Q } from '../game/constants';
import type { Solution } from '../game/types';
import { RULES } from '../rules';
import type { Chain } from '../social/chain';
import { encodeChain } from '../social/codec';
import { getRepository } from '../social';
import { type Challenge, challengeFromBase } from '../social/flow';
import { track } from '../telemetry';
import { gameFeedback } from './feedback';
import { renderScene } from './skiaScene';
import { HintSheet, RulePickerSheet, SendSheet } from './Sheets';
import { recordDailySolve } from '../daily/store';
import { money, useMoney } from '../monetization';
import { coachStep } from './coach';
import { finishTutorial, getState, markSolved, useAppState } from './store';
import { C } from './theme';
import { fitView, toWorld, type View as WView } from './view';

type Drag = { i: number; mode: 'move' | 'rotate'; dx: number; dy: number };
type Sheet = null | { kind: 'rules'; solved: Solution } | { kind: 'hints' } | { kind: 'publishing' } | { kind: 'failed'; message: string } | { kind: 'send'; chain: Chain; message: string; remote: boolean; nodeId?: string };

export function PlayScreen({ challenge }: { challenge: Challenge }) {
  const insets = useSafeAreaInsets();
  const ctl = useMemo(() => {
    const c = new PlayController(challenge.level);
    c.onEvent = gameFeedback;
    c.reduceMotion = getState().reduceMotion;
    return c;
  }, [challenge]);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const wallet = useMoney();
  const app = useAppState();
  const [toast, setToast] = useState('');
  const selected = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const stage = useRef<React.ComponentRef<typeof View>>(null);
  const tray = useRef<React.ComponentRef<typeof View>>(null);
  const stageBox = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const trayTop = useRef(Infinity);
  const viewRef = useRef<WView>(fitView(300, 500, 90, 160));
  const sheetShown = useRef(false);
  const attemptsLogged = useRef(0);

  const nextIdx = BASE_LEVELS.findIndex((l) => l.id === challenge.level.base) + 1;

  useEffect(() => { track('level_start', { level: challenge.level.base, source: challenge.source, depth: challenge.depth }); }, [challenge]);

  // ---- measuring ----
  const measure = useCallback(() => {
    stage.current?.measureInWindow((x, y, w, h) => {
      stageBox.current = { x, y, w, h };
      viewRef.current = fitView(w, h, challenge.level.w, challenge.level.h, 8, 56);
    });
    tray.current?.measureInWindow((_x, y) => { trayTop.current = y; });
  }, [challenge]);

  // ---- game loop ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPhase = ctl.phase;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctl.advance(dt);
      if (ctl.phase !== lastPhase) {
        lastPhase = ctl.phase;
        bump();
      }
      if (ctl.attempts !== attemptsLogged.current) { attemptsLogged.current = ctl.attempts; track('attempt', { level: challenge.level.base }); }
      if (ctl.phase === 'won' && ctl.phaseTime > 1.0 && !sheetShown.current) {
        sheetShown.current = true;
        if (challenge.source === 'campaign') markSolved(challenge.level.base);
        if (challenge.source === 'daily' && 'day' in challenge) {
          const day = (challenge as { day: number }).day;
          const prog = recordDailySolve(day, { attempts: ctl.attempts, pieces: ctl.solution.length });
          track('daily_solved', { attempts: ctl.attempts, streak: prog.streak });
          setToast(prog.streak >= 2 ? `\uD83D\uDD25 ${prog.streak}-day streak!` : 'Daily solved!');
          setTimeout(() => setToast(''), 2200);
        }
        finishTutorial();
        money().noteSolved();
        track('level_solved', { level: challenge.level.base, attempts: ctl.attempts, depth: challenge.depth });
        void getRepository().event(challenge, challenge.nodeId, 'solve');
        setSheet({ kind: 'rules', solved: ctl.solution.map((p) => ({ ...p })) });
      }
      const v = viewRef.current;
      if (stageBox.current.w > 0) setPicture(renderScene(ctl, v, now / 1000, selected.current, true));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ctl, challenge]);

  // ---- dragging (works from the tray and from pieces on the board) ----
  const worldAt = (e: GestureResponderEvent): [number, number] =>
    toWorld(viewRef.current, e.nativeEvent.pageX - stageBox.current.x, e.nativeEvent.pageY - stageBox.current.y);

  const onMove = (e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d) return;
    const [wx, wy] = worldAt(e);
    if (d.mode === 'move') ctl.move(d.i, wx - d.dx, wy - d.dy);
    else ctl.rotateToward(d.i, wx, wy);
  };
  const onEnd = (e: GestureResponderEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && e.nativeEvent.pageY > trayTop.current + 4) {
      ctl.remove(d.i);
      if (selected.current === d.i) selected.current = null;
    }
    bump();
  };

  const stagePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => ctl.phase === 'edit',
    onPanResponderGrant: (e) => {
      measure();
      const [wx, wy] = worldAt(e);
      const hit = ctl.hitTest(wx, wy, 5);
      if (!hit) { selected.current = null; return; }
      selected.current = hit.i;
      const p = ctl.placed[hit.i]!;
      drag.current = hit.part === 'end'
        ? { i: hit.i, mode: 'rotate', dx: 0, dy: 0 }
        : { i: hit.i, mode: 'move', dx: wx - p.x / POS_Q, dy: wy - p.y / POS_Q };
    },
    onPanResponderMove: onMove,
    onPanResponderRelease: onEnd,
    onPanResponderTerminate: onEnd,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ctl]);

  const trayPans = useMemo(() => challenge.level.inventory.map((_, i) => PanResponder.create({
    onStartShouldSetPanResponder: () => ctl.phase === 'edit',
    onPanResponderGrant: (e) => {
      measure();
      const [wx, wy] = worldAt(e);
      if (!ctl.placed[i]) ctl.place(i, wx, wy);
      selected.current = i;
      const p = ctl.placed[i]!;
      drag.current = { i, mode: 'move', dx: wx - p.x / POS_Q, dy: wy - p.y / POS_Q };
      onMove(e);
    },
    onPanResponderMove: onMove,
    onPanResponderRelease: onEnd,
    onPanResponderTerminate: onEnd,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [ctl, challenge]);

  // ---- actions ----
  const go = () => {
    if (ctl.phase === 'edit') { ctl.ghost = null; selected.current = null; ctl.play(); }
    else ctl.reset();
    bump();
  };
  const hint = async () => {
    if (ctl.phase !== 'edit') return;
    if (money().getSnapshot().hints <= 0) { track('rewarded_offered'); money().refresh(); setSheet({ kind: 'hints' }); return; }
    const answer = await getRepository().hint(challenge);
    const next = answer.find((p) => !ctl.placed[p.i]) ?? answer[0];
    if (!next) { setToast('No hint available right now'); setTimeout(() => setToast(''), 1800); return; }
    await money().spendHint(); // only charged when a hint was actually delivered
    ctl.ghost = next;
    track('hint_used', { level: challenge.level.base });
    setToast('Hint: try a piece here');
    setTimeout(() => setToast(''), 1800);
  };
  /** Leaving a SOLVED puzzle is the only place an interstitial may appear (never mid-puzzle). */
  const leave = async (fn: () => void) => {
    if (sheet) { try { if (await money().maybeShowInterstitial()) track('interstitial_shown'); } catch { /* never block */ } }
    fn();
  };
  const home = () => void leave(() => router.replace('/'));
  const goNext = () => void leave(() => router.replace({ pathname: '/play', params: { level: BASE_LEVELS[nextIdx].id } }));

  const idx = BASE_LEVELS.findIndex((l) => l.id === challenge.level.base);
  const sub = challenge.source === 'daily'
    ? `Daily puzzle \u00b7 ${challenge.chain!.links.length} twist${challenge.chain!.links.length === 1 ? '' : 's'}`
    : challenge.source === 'friend'
    ? `Friend's puzzle · ${challenge.chain!.links.length} change${challenge.chain!.links.length === 1 ? '' : 's'}`
    : `Level ${idx + 1}`;
  const phase = ctl.phase;

  return (
    <View style={s.root} onLayout={measure}>
      <View ref={stage} style={s.stage} onLayout={measure} {...stagePan.panHandlers} collapsable={false}>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {picture && <Picture picture={picture} />}
        </Canvas>
      </View>

      <View style={[s.bar, { top: insets.top + 6 }]} pointerEvents="box-none">
        <Pressable style={s.ibtn} onPress={home} accessibilityLabel="Back"><Text style={s.ibtnT}>{'‹'}</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{challenge.level.name}</Text>
          <Text style={s.sub}>{sub}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {challenge.level.rules.map((r, k) => (
            <View key={k} style={[s.chip, { borderColor: RULES[r.id].color }]}><Text style={[s.chipT, { color: RULES[r.id].color }]}>{RULES[r.id].name}</Text></View>
          ))}
        </View>
        <Pressable style={s.ibtn} onPress={hint} accessibilityLabel={`Hint, ${wallet.hints} left`}>
          <Text style={s.ibtnT}>{'💡'}</Text>
          <View style={s.badge}><Text style={s.badgeT}>{wallet.hints > 99 ? '99+' : wallet.hints}</Text></View>
        </Pressable>
      </View>

      <View ref={tray} onLayout={measure} collapsable={false} style={[s.tray, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.pieces}>
          {challenge.level.inventory.map((p, i) => (
            <View key={i} accessible accessibilityLabel={`Plank ${i + 1} of ${challenge.level.inventory.length}${ctl.placed[i] ? ', placed' : ', drag it into the puzzle'}`} {...trayPans[i].panHandlers} style={[s.piece, { width: p.len * 3.4, opacity: ctl.placed[i] ? 0.2 : 1 }]} />
          ))}
        </View>
        <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={phase === 'edit' ? 'Go, start the ball' : 'Retry'} disabled={phase === 'edit' && !(ctl.solution.length > 0 && ctl.canPlay)}
          style={[s.go, phase !== 'edit' && s.retry, phase === 'edit' && !(ctl.solution.length > 0 && ctl.canPlay) && { opacity: 0.4 }]}>
          <Text style={s.goT}>{phase === 'edit' ? 'GO' : 'Retry'}</Text>
        </Pressable>
      </View>

      {(() => {
        const step = coachStep({ show: app.loaded && !app.tutorialDone && challenge.source === 'campaign' && challenge.level.base === BASE_LEVELS[0].id, placed: ctl.placed.filter(Boolean).length, phase: ctl.phase });
        return step ? (
          <Pressable style={s.coach} onPress={finishTutorial} accessibilityLabel={`Tip: ${step.text}. Tap to dismiss.`} accessibilityLiveRegion="polite">
            <Text style={s.coachT}>{step.text}</Text>
            <Text style={s.coachSkip}>tap to hide tips</Text>
          </Pressable>
        ) : null;
      })()}

      {!!toast && <View style={s.toast} pointerEvents="none" accessibilityLiveRegion="polite"><Text style={s.toastT}>{toast}</Text></View>}

      {sheet && (
        <View style={s.modal}>
          {sheet.kind === 'rules' ? (
            <RulePickerSheet
              challenge={challenge}
              solved={sheet.solved}
              nextLabel="Next level"
              onNext={challenge.source === 'campaign' && nextIdx < BASE_LEVELS.length ? goNext : undefined}
              onHome={home}
              onChosen={async (chain) => {
                setSheet({ kind: 'publishing' });
                try {
                  const r = await getRepository().publish(chain, challenge.nodeId ?? null);
                  setSheet({ kind: 'send', chain, message: r.message, remote: r.remote, nodeId: r.remote ? r.id : undefined });
                } catch (e) {
                  track('publish_failed');
                  setSheet({ kind: 'failed', message: e instanceof Error ? e.message : 'Couldn\u2019t send that.' });
                }
              }}
            />
          ) : sheet.kind === 'hints' ? (
            <HintSheet onClose={() => setSheet(null)} />
          ) : sheet.kind === 'publishing' ? (
            <View style={s.status}><Text style={s.statusT}>Checking and sending{'\u2026'}</Text></View>
          ) : sheet.kind === 'failed' ? (
            <View style={s.status}>
              <Text style={s.statusT}>{sheet.message}</Text>
              <Pressable style={s.statusBtn} onPress={() => setSheet({ kind: 'rules', solved: ctl.solution.map((p) => ({ ...p })) })}><Text style={s.statusBtnT}>Pick another twist</Text></Pressable>
            </View>
          ) : (
            <SendSheet
              chain={sheet.chain}
              message={sheet.message}
              remote={sheet.remote}
              nodeId={sheet.nodeId}
              onHome={home}
              onReplay={() => router.push({ pathname: '/replay', params: { code: encodeChain(sheet.chain) } })}
            />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgTop },
  stage: { flex: 1 },
  bar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ibtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  ibtnT: { color: C.text, fontSize: 18 },
  coach: { position: 'absolute', left: 18, right: 18, bottom: 150, backgroundColor: '#1f2563', borderColor: C.mint, borderWidth: 1.5, borderRadius: 16, padding: 12, zIndex: 5 },
  coachT: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  coachSkip: { color: C.dim, fontSize: 11, textAlign: 'center', marginTop: 4 },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeT: { color: '#0f1226', fontSize: 11, fontWeight: '800' },
  title: { color: C.text, fontWeight: '700', fontSize: 15 },
  sub: { color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  chipT: { fontSize: 11, fontWeight: '700' },
  tray: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, backgroundColor: C.bgTop },
  pieces: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 46 },
  piece: { height: 34, borderRadius: 17, backgroundColor: '#cfd4ff', shadowColor: C.accent, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  go: { minWidth: 104, height: 48, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  retry: { backgroundColor: C.pink, shadowColor: C.pink },
  goT: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  status: { backgroundColor: '#141944', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: C.panelEdge, padding: 24, paddingBottom: 40, alignItems: 'center', gap: 14 },
  statusT: { color: C.text, fontSize: 16, textAlign: 'center' },
  statusBtn: { height: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  statusBtnT: { color: '#fff', fontWeight: '700' },
  toast: { position: 'absolute', alignSelf: 'center', bottom: 110, backgroundColor: '#000c', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.panelEdge },
  toastT: { color: C.text, fontSize: 13 },
  modal: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', backgroundColor: '#050716aa' },
});
