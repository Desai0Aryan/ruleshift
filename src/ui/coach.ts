/** First-run coaching for the very first level. Pure so it can be unit-tested. */
export type CoachStep = { id: 'drag' | 'aim' | 'watch'; text: string };

export function coachStep(o: { show: boolean; placed: number; phase: string }): CoachStep | null {
  if (!o.show) return null;
  if (o.phase === 'edit') {
    return o.placed === 0
      ? { id: 'drag', text: 'Drag the plank from the tray into the puzzle.' }
      : { id: 'aim', text: 'Move it, drag the round handle to tilt it, then press GO. Get the blue ball into the gold ring!' };
  }
  if (o.phase === 'running') return { id: 'watch', text: 'Watch it roll…' };
  return null;
}
export const TWIST_INTRO = 'This is the game: change ONE rule, then send it. Your friend solves your twisted puzzle, then twists it again.';
