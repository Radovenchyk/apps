import esbuild from 'esbuild';
import { fixTalismanEsm } from './talisman.mjs';
import { createProxyServer } from './server.dev.mjs';

fixTalismanEsm();

const plugins = [];

const options = {
  entryPoints: ['src/app.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  preserveSymlinks: true,
  treeShaking: true,
  sourcemap: true,
  outdir: 'out/',
  logLevel: 'info',
};

const ctx = await esbuild.context({ ...options, plugins });
await ctx.rebuild();
await ctx.watch();
const localServer = await ctx.serve({ servedir: './', host: '127.0.0.1' });
createProxyServer(localServer);
