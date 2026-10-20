import {readFile, writeFile} from 'node:fs/promises';
import {renderToString} from 'react-dom/server';
import Hero from '../src/Hero';

// Render the same component for every visitor. The client attaches only its CTA.
// Responsive preloads already exist in index.html; remove React's unscoped hints.
const hero = renderToString(<Hero />).replace(/<link\b[^>]*rel="preload"[^>]*\/>/g, '');
const path = new URL('../dist/index.html', import.meta.url);
const html = await readFile(path, 'utf8');
if (!html.includes('<!-- PRERENDER_HERO -->')) throw new Error('Hero placeholder missing');
await writeFile(path, html.replace('<!-- PRERENDER_HERO -->', hero));
