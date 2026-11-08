/** Pure palette (no react-native imports) so the web preview and the Skia app share it. */
export const C = {
  bgTop: '#0b0e24',
  bgBottom: '#171a45',
  panel: '#151a3d',
  panelEdge: '#2a3170',
  text: '#eef0ff',
  dim: '#9aa3e6',
  accent: '#6c7bff',
  pink: '#ff7ad9',
  mint: '#7affc4',
  gold: '#ffd54a',
  ball: '#3da5ff',
  ballGlow: '#7cc4ff',
  wall: '#7f89d6',
  wallEdge: '#a9b2ff',
  plank: '#d7dcff',
  plankBad: '#ff5b7a',
  bumper: '#ff7ad9',
  target: '#ffd54a',
  portalA: '#8fb4ff',
  portalB: '#ff9bd6',
  danger: '#ff5b7a',
} as const;

export const FONT = { display: 'System', mono: 'Menlo' } as const;
