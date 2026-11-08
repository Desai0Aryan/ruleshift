import { PlayController, type GameEvent } from '../src/game/controller';
import { BASE_LEVELS } from '../src/game/levels';
import { ChainReplay, replayStages } from '../src/game/replay';
import type { Solution } from '../src/game/types';
import { RULE_ORDER, RULES } from '../src/rules';
import { verifyRule, type Verdict } from '../src/rules/verify';
import { encodeChain, decodeChain } from '../src/social/codec';
import { challengeFromBase, challengeFromChain, passItOn, type Challenge } from '../src/social/flow';
import { extractCode, shareMessage } from '../src/social/links';
import type { Chain } from '../src/social/chain';
import { drawScene, fitView, toWorld, type View } from './draw';
import { sfx } from './sound';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('cv');
const ctx = cv.getContext('2d')!;

type Mode = 'home' | 'play' | 'replay';
let mode: Mode = 'home';
let challenge: Challenge | null = null;
let ctl: PlayController | null = null;
let replay: ChainReplay | null = null;
let selected: number | null = null;
let view: View = fitView(300, 500, 90, 160);
let lastChain: Chain | null = null;
let modalOpen = false;
let wonShown = false;

// ---------- progress (best-effort) ----------
const solvedSet = new Set<string>();
try { JSON.parse(localStorage.getItem('rs.solved') || '[]').forEach((x: string) => solvedSet.add(x)); } catch { /* private mode */ }
const saveSolved = () => { try { localStorage.setItem('rs.solved', JSON.stringify([...solvedSet])); } catch { /* ignore */ } };

// ---------- layout ----------
function resize() {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lvl = (mode === 'replay' ? replay?.ctl.level : ctl?.level) ?? BASE_LEVELS[0];
  view = fitView(r.width, r.height, lvl.w, lvl.h, 8);
  view = { ...view, oy: Math.max(view.oy, 58) < view.oy ? view.oy : view.oy }; // keep the top bar clear
  const topPad = 52;
  const sc = Math.min((r.width - 16) / lvl.w, (r.height - topPad - 8) / lvl.h);
  view = { w: r.width, h: r.height, scale: sc, ox: (r.width - lvl.w * sc) / 2, oy: topPad + (r.height - topPad - lvl.h * sc) / 2 };
}
window.addEventListener('resize', resize);

// ---------- screens ----------
function showHome(msg = '') {
  mode = 'home'; ctl = null; replay = null; challenge = null;
  $('home').classList.remove('hidden');
  $('tray').classList.add('hidden');
  $('bar').classList.add('hidden');
  $('banner').classList.add('hidden');
  closeModal();
  $('homeMsg').textContent = msg;
  const grid = $('grid');
  grid.innerHTML = '';
  BASE_LEVELS.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'lv' + (solvedSet.has(l.id) ? ' done' : '');
    b.textContent = String(i + 1);
    b.onclick = () => startChallenge(challengeFromBase(l.id)!);
    grid.appendChild(b);
  });
  $('playBtn').textContent = solvedSet.size === 0 ? 'Play' : 'Continue';
}

function startChallenge(ch: Challenge) {
  challenge = ch;
  ctl = new PlayController(ch.level);
  ctl.onEvent = onEvent;
  mode = 'play'; selected = null; wonShown = false;
  $('home').classList.add('hidden');
  $('tray').classList.remove('hidden');
  $('bar').classList.remove('hidden');
  $('hintBtn').classList.remove('hidden');
  $('banner').classList.add('hidden');
  closeModal();
  const idx = BASE_LEVELS.findIndex((l) => l.id === ch.level.base);
  $('ttl').innerHTML = `${ch.level.name}<small>${ch.source === 'friend' ? `Friend's puzzle \u00b7 ${ch.chain!.links.length} change${ch.chain!.links.length === 1 ? '' : 's'}` : `Level ${idx + 1}`}</small>`;
  const chips = $('chips');
  chips.innerHTML = '';
  for (const r of ch.level.rules) {
    const d = document.createElement('div');
    d.className = 'chip'; d.style.color = RULES[r.id].color; d.textContent = RULES[r.id].name;
    chips.appendChild(d);
  }
  buildTray();
  syncGo();
  resize();
}

function buildTray() {
  const wrap = $('pieces');
  wrap.innerHTML = '';
  ctl!.level.inventory.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'piece';
    el.dataset.i = String(i);
    el.style.width = `${p.len * 3.4}px`;
    el.onpointerdown = (e) => {
      if (!ctl || ctl.phase !== 'edit') return;
      e.preventDefault();
      const [wx, wy] = toWorld(view, e.clientX - cv.getBoundingClientRect().left, e.clientY - cv.getBoundingClientRect().top);
      if (!ctl.placed[i]) ctl.place(i, wx, wy);
      selected = i;
      startDrag(e, { i, mode: 'move', dx: 0, dy: 0 });
    };
    wrap.appendChild(el);
  });
}

function syncTray() {
  if (!ctl) return;
  document.querySelectorAll<HTMLElement>('.piece').forEach((el) => el.classList.toggle('used', !!ctl!.placed[Number(el.dataset.i)]));
}

function syncGo() {
  const go = $<HTMLButtonElement>('goBtn');
  if (!ctl) return;
  if (ctl.phase === 'edit') { go.textContent = 'GO'; go.className = 'go'; go.disabled = !(ctl.solution.length > 0 && ctl.canPlay); }
  else if (ctl.phase === 'running') { go.textContent = 'Retry'; go.className = 'go retry'; go.disabled = false; }
  else { go.textContent = 'Retry'; go.className = 'go retry'; go.disabled = false; }
}

// ---------- input ----------
interface Drag { i: number; mode: 'move' | 'rotate'; dx: number; dy: number }
let drag: Drag | null = null;

function startDrag(e: PointerEvent, d: Drag) {
  drag = d;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
  window.addEventListener('pointercancel', onUp, { once: true });
  onMove(e);
}
function onMove(e: PointerEvent) {
  if (!drag || !ctl) return;
  const r = cv.getBoundingClientRect();
  const [wx, wy] = toWorld(view, e.clientX - r.left, e.clientY - r.top);
  if (drag.mode === 'move') ctl.move(drag.i, wx - drag.dx, wy - drag.dy);
  else ctl.rotateToward(drag.i, wx, wy);
  syncTray();
}
function onUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onMove);
  if (drag && ctl) {
    // dropped on the tray => pick the piece back up
    const trayR = $('tray').getBoundingClientRect();
    if (e.clientY > trayR.top + 4) { ctl.remove(drag.i); if (selected === drag.i) selected = null; }
  }
  drag = null;
  syncTray(); syncGo();
}
cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || !ctl || ctl.phase !== 'edit') return;
  const r = cv.getBoundingClientRect();
  const [wx, wy] = toWorld(view, e.clientX - r.left, e.clientY - r.top);
  const hit = ctl.hitTest(wx, wy, 5);
  if (!hit) { selected = null; return; }
  selected = hit.i;
  const p = ctl.placed[hit.i]!;
  if (hit.part === 'end') startDrag(e, { i: hit.i, mode: 'rotate', dx: 0, dy: 0 });
  else startDrag(e, { i: hit.i, mode: 'move', dx: wx - p.x / 4, dy: wy - p.y / 4 });
});

$('goBtn').onclick = () => {
  if (!ctl) return;
  if (ctl.phase === 'edit') { ctl.ghost = null; ctl.play(); selected = null; }
  else ctl.reset();
  syncGo();
};
$('back').onclick = () => (mode === 'replay' ? (challenge ? backToPlay() : showHome()) : showHome());
$('hintBtn').onclick = () => {
  if (!ctl || !challenge || ctl.phase !== 'edit') return;
  // hint = reveal one piece of a known-good solution that is not yet placed (rewarded-ad hook later)
  const next = challenge.hint.find((p) => !ctl!.placed[p.i]) ?? challenge.hint[0];
  if (next) { ctl.ghost = next; toast('Hint: try a piece here'); }
};
$('playBtn').onclick = () => {
  const next = BASE_LEVELS.find((l) => !solvedSet.has(l.id)) ?? BASE_LEVELS[0];
  startChallenge(challengeFromBase(next.id)!);
};
$('codeGo').onclick = () => openCode(($('codeIn') as HTMLInputElement).value);

function openCode(text: string) {
  const code = extractCode(text);
  if (!code) return showHome('That doesn\u2019t look like a RULESHIFT challenge.');
  const d = decodeChain(code);
  if (!d.ok) return showHome(d.error);
  const c = challengeFromChain(d.chain);
  if (!c.ok) return showHome(c.error);
  startChallenge(c.challenge);
}

// ---------- events / juice ----------
function onEvent(e: GameEvent, d?: { speed?: number }) {
  switch (e) {
    case 'place': sfx.tick(); buzz(8); break;
    case 'pickup': sfx.tick(0.7); break;
    case 'rotate': sfx.tick(1.3, 0.05); break;
    case 'start': sfx.whoosh(); break;
    case 'bounce': sfx.pop(Math.min(1, (d?.speed ?? 30) / 140)); break;
    case 'bumper': sfx.boing(); buzz(14); break;
    case 'portal': sfx.portal(); break;
    case 'goal': sfx.ding(); break;
    case 'win': sfx.win(); buzz([20, 40, 30]); break;
    case 'lose': sfx.lose(); buzz(25); break;
    case 'invalid': sfx.lose(); break;
  }
}
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

function toast(msg: string) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.getElementById('stage')!.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ---------- modals ----------
function openModal(html: string) { $('sheet').innerHTML = html; $('modal').classList.remove('hidden'); modalOpen = true; }
function closeModal() { $('modal').classList.add('hidden'); modalOpen = false; }

const ICON: Record<string, string> = { gravity: '\u21C5', twin: '\u25CF\u25CF', speed: '\u00BB', portal: '\u25CE' };

function showRulePicker() {
  if (!ctl || !challenge) return;
  const solved: Solution = ctl.solution.map((p) => ({ ...p }));
  const ch = challenge;
  if (ch.source === 'campaign') { solvedSet.add(ch.level.base); saveSolved(); }
  const nextIdx = BASE_LEVELS.findIndex((l) => l.id === ch.level.base) + 1;
  openModal(`
    <h2>Solved! \u2728 Change ONE rule</h2>
    <p>${ch.source === 'friend' ? 'Add your twist and pass it on.' : 'Pick a twist, then send it to a friend.'} We check every twist is still solvable.</p>
    <div id="rules"></div>
    <div class="row">${ch.source === 'campaign' && nextIdx < BASE_LEVELS.length ? '<button class="btn" id="nextLv">Next level \u203A</button>' : ''}<button class="btn" id="homeBtn">Home</button></div>`);
  const holder = $('rules');
  const verdicts: Partial<Record<string, Verdict>> = {};
  RULE_ORDER.forEach((id) => {
    const r = RULES[id];
    const b = document.createElement('button');
    b.className = 'rule'; b.disabled = true; b.style.setProperty('--c', r.color);
    b.innerHTML = `<i>${ICON[r.icon]}</i><div><b>${r.name}</b><span>${r.blurb}</span></div><em>checking\u2026</em><div class="bar2"></div>`;
    holder.appendChild(b);
    verifyRule(ch.level, id, { baseSeed: (Date.now() & 0xffff) + 1, budget: 4500, onProgress: (f) => b.style.setProperty('--p', `${Math.round(f * 100)}%`) }).then((v) => {
      verdicts[id] = v;
      const em = b.querySelector('em')!;
      b.querySelector('.bar2')!.remove();
      if (v.status === 'ok') { em.textContent = 'ready'; b.disabled = false; b.onclick = () => choose(id, v, solved); }
      else em.textContent = v.reason;
    });
  });
  const nx = document.getElementById('nextLv');
  if (nx) nx.onclick = () => startChallenge(challengeFromBase(BASE_LEVELS[nextIdx].id)!);
  $('homeBtn').onclick = () => showHome();
}

function choose(id: string, v: Verdict, solved: Solution) {
  if (v.status !== 'ok' || !challenge) return;
  const rule = v.level.rules[v.level.rules.length - 1];
  lastChain = passItOn(challenge, solved, { id: rule.id, seed: rule.seed }, v.solution);
  const code = encodeChain(lastChain);
  const msg = shareMessage(lastChain);
  openModal(`
    <h2>Ready to send \uD83D\uDE80</h2>
    <p>${RULES[rule.id].name} added. Your friend must solve it \u2014 then add their own twist.</p>
    <div class="code" id="codeBox">${code}</div>
    <div class="row"><button class="btn m" id="share">Send to a friend</button><button class="btn" id="copy">Copy</button></div>
    <div class="row"><button class="btn" id="watch">Watch replay</button><button class="btn" id="homeBtn">Home</button></div>`);
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('Copied \u2014 paste it in any chat'); } catch { toast('Long-press the code to copy'); } };
  $('share').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ text: msg }); } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(msg); toast('Copied \u2014 paste it in any chat'); } catch { toast('Long-press the code to copy'); } }
  };
  $('watch').onclick = () => startReplay(lastChain!);
  $('homeBtn').onclick = () => showHome();
}

function startReplay(chain: Chain) {
  const st = replayStages(chain);
  if (!st) return toast('Could not build replay');
  replay = new ChainReplay(st);
  replay.ctl.onEvent = () => {};
  replay.onStage = () => { if (replay) { replay.ctl.onEvent = onEvent; resize(); } };
  mode = 'replay'; selected = null;
  closeModal();
  $('tray').classList.add('hidden');
  $('banner').classList.remove('hidden');
  $('hintBtn').classList.add('hidden');
  $('ttl').innerHTML = 'Chain replay<small>' + chain.links.length + ' change' + (chain.links.length === 1 ? '' : 's') + '</small>';
  $('chips').innerHTML = '';
  resize();
}
function backToPlay() { if (challenge) startChallenge(challenge); }

// ---------- main loop ----------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (mode === 'play' && ctl) {
    const before = ctl.phase;
    ctl.advance(dt);
    if (before !== ctl.phase) { syncGo(); syncTray(); }
    if (ctl.phase === 'won' && ctl.phaseTime > 1.0 && !wonShown) { wonShown = true; showRulePicker(); }
    drawScene(ctx, view, ctl, t, selected, true);
  } else if (mode === 'replay' && replay) {
    replay.advance(dt);
    drawScene(ctx, view, replay.ctl, t, null, false);
    $('banner').textContent = replay.banner;
    $('banner').style.color = replay.stage.rule ? RULES[replay.stage.rule].color : '#eef0ff';
  } else {
    ctx.fillStyle = '#0b0e24'; ctx.fillRect(0, 0, view.w, view.h);
  }
  void modalOpen;
  requestAnimationFrame(frame);
}

// test hooks (used by the automated visual check)
(window as unknown as { __rs: unknown }).__rs = {
  start: (id: string) => startChallenge(challengeFromBase(id)!),
  sync: () => { syncTray(); syncGo(); }, view: () => view, ctl: () => ctl, replay: () => replay, mode: () => mode, lastChain: () => lastChain,
  openCode, solveAuto: () => { if (ctl && challenge) { ctl.setSolution(challenge.hint); syncTray(); syncGo(); } },
};

resize();
const hash = location.hash.match(/c=([^&]+)/);
if (hash) openCode(decodeURIComponent(hash[1])); else showHome();
requestAnimationFrame(frame);
