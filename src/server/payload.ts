import { ENGINE_VERSION } from '../game/constants';
import type { Chain } from '../social/chain';

/** What a client sends to publish the LAST link of `chain` as a new node under `parentId`. */
export function createNodeBody(chain: Chain, parentId: string | null) {
  const last = chain.links[chain.links.length - 1];
  return {
    op: 'createNode' as const,
    engine: ENGINE_VERSION,
    parentId,
    base: chain.base,
    rule: last.rule,
    seed: last.seed,
    solved: last.solved,
    proof: chain.proof,
  };
}
