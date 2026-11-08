import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const r = await build({
  entryPoints: ['web-preview/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020',
  loader: { '.json': 'json' }, write: false, logLevel: 'error',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('web-preview/index.template.html', 'utf8').replace('/*BUNDLE*/', () => js);
mkdirSync('web-preview/dist', { recursive: true });
writeFileSync('web-preview/dist/index.html', html);
console.log(`web-preview/dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
