import { writeFileSync } from 'node:fs';
import { renderReplayGif } from '../src/export/replayGif';
import { synthesizeChain } from '../src/social/synth';

const [, , baseIdx = '2', hops = '3', out = '.tmp/replay.gif'] = process.argv;
const chain = synthesizeChain(Number(baseIdx), Number(hops));
const t0 = Date.now();
renderReplayGif(chain).then((g) => {
  if (!g) throw new Error('no gif');
  writeFileSync(out, g.bytes);
  console.log(`${out}: ${g.width}x${g.height}, ${g.frames} frames, ${g.seconds.toFixed(1)}s, ${(g.bytes.length / 1024).toFixed(0)} KB, rendered in ${Date.now() - t0} ms`);
});
