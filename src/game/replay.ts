import type { Chain } from '../social/chain';
import { checkChain } from '../social/chain';
import { RULES } from '../rules';
import { PlayController } from './controller';
import type { Level, RuleId, Solution } from './types';

export interface ReplayStage {
  level: Level;
  solution: Solution;
  /** rule that created this stage from the previous one (undefined for the original) */
  rule?: RuleId;
  label: string;
}

/** Builds the replay timeline for a chain: original, then each rule's puzzle, each played with its stored solution. */
export function replayStages(chain: Chain): ReplayStage[] | null {
  const c = checkChain(chain);
  if (!c.ok) return null;
  return c.levels.map((level, k) => ({
    level,
    solution: k < chain.links.length ? chain.links[k].solved : chain.proof,
    rule: k === 0 ? undefined : chain.links[k - 1].rule,
    label: k === 0 ? 'Original' : `+ ${RULES[chain.links[k - 1].rule].name}`,
  }));
}

/**
 * Plays every stage back-to-back from stored inputs (no video). Works for any renderer: it exposes the
 * active PlayController and a banner. Call advance(dt) each frame.
 */
export class ChainReplay {
  stages: ReplayStage[];
  index = 0;
  ctl: PlayController;
  /** 'intro' (show banner) -> 'play' -> 'hold' (celebrate) */
  state: 'intro' | 'play' | 'hold' | 'done' = 'intro';
  t = 0;
  finished = false;
  loop = true;
  onStage: (i: number) => void = () => {};
  constructor(stages: ReplayStage[]) {
    this.stages = stages;
    this.ctl = this.make(0);
  }
  private make(i: number): PlayController {
    const c = new PlayController(this.stages[i].level);
    c.autoRetry = false;
    c.setSolution(this.stages[i].solution);
    return c;
  }
  get stage(): ReplayStage { return this.stages[this.index]; }
  get banner(): string { return `${this.index + 1}/${this.stages.length}  ${this.stage.label}`; }
  restart(): void { this.index = 0; this.go(0); this.finished = false; }
  private go(i: number) {
    this.index = i;
    this.ctl = this.make(i);
    this.state = 'intro';
    this.t = 0;
    this.onStage(i);
  }
  advance(dt: number): void {
    this.t += dt;
    this.ctl.advance(dt);
    if (this.state === 'intro' && this.t > 1.1) { this.ctl.play(); this.state = 'play'; this.t = 0; }
    else if (this.state === 'play' && this.ctl.phase !== 'running') { this.state = 'hold'; this.t = 0; }
    else if (this.state === 'hold' && this.t > 1.4) {
      if (this.index + 1 < this.stages.length) this.go(this.index + 1);
      else { this.finished = true; if (this.loop) this.go(0); else this.state = 'done'; }
    }
  }
}
