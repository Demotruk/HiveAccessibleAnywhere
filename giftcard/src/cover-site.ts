/**
 * Cover site — serves a normal-looking website at the service's root URL.
 *
 * When someone visits the URL in a browser, they see an ordinary
 * blog/portfolio site, not an API endpoint. This makes the service
 * harder to identify as Hive infrastructure.
 *
 * Environment variables:
 *   COVER_SITE_TITLE   - Site name (default: from theme)
 *   COVER_SITE_TAGLINE - Subtitle text (default: from theme)
 *   COVER_SITE_THEME   - Theme preset: nature, food, travel, tech (default: nature)
 */

import type { Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');

// -- Theme presets --

interface Theme {
  title: string;
  tagline: string;
  bg: string;
  headerBorder: string;
  h1Color: string;
  textColor: string;
  mutedColor: string;
  placeholderBg: string;
  footerBorder: string;
  articles: { title: string; date: string; body: string }[];
}

const THEMES: Record<string, Theme> = {
  nature: {
    title: 'Mountain Vista Photography',
    tagline: 'Landscapes \u00b7 Nature \u00b7 Light',
    bg: '#fafaf7', headerBorder: '#e0ddd5', h1Color: '#5a5a50',
    textColor: '#555', mutedColor: '#999', placeholderBg: '#e8e6df',
    footerBorder: '#e0ddd5',
    articles: [
      { title: 'Morning Light on the Ridge', date: 'February 28, 2026',
        body: 'Caught the first light breaking over the eastern ridge this morning. The fog in the valley below created a beautiful layered effect that lasted only about fifteen minutes before the sun burned through.' },
      { title: 'Winter Reflections', date: 'February 14, 2026',
        body: 'The lake was perfectly still after last week\'s freeze. These conditions are rare enough that you have to be ready to drop everything and shoot when they appear.' },
      { title: 'New Lens, First Impressions', date: 'January 30, 2026',
        body: 'Finally picked up the 70-200mm f/2.8 I\'ve been considering. Initial impressions are very positive \u2014 the autofocus is noticeably faster than my older model, and the image stabilization makes a real difference for handheld telephoto work.' },
    ],
  },
  food: {
    title: 'The Weeknight Table',
    tagline: 'Simple recipes \u00b7 Honest cooking',
    bg: '#fffdf8', headerBorder: '#e8dfd0', h1Color: '#7a5c3a',
    textColor: '#5a4a3a', mutedColor: '#a09080', placeholderBg: '#f0e8d8',
    footerBorder: '#e8dfd0',
    articles: [
      { title: 'One-Pan Lemon Chicken', date: 'March 2, 2026',
        body: 'This has become a Tuesday night staple. Bone-in thighs, halved lemons, olives, and a handful of herbs on a sheet pan. Forty minutes, minimal cleanup, and the pan juices make their own sauce.' },
      { title: 'Sourdough Progress', date: 'February 18, 2026',
        body: 'Week six with the starter and the crumb is finally opening up. The trick was a longer autolyse and being more patient with bulk fermentation. Temperature matters more than timing.' },
      { title: 'Pantry Pasta for Real Life', date: 'February 5, 2026',
        body: 'Anchovy, garlic, chili flakes, a tin of tomatoes, and whatever pasta shape is in the cupboard. Fifteen minutes, one pot. This is what I actually cook when nobody is watching.' },
    ],
  },
  travel: {
    title: 'Slow Miles Journal',
    tagline: 'Notes from the road',
    bg: '#f7f9fa', headerBorder: '#d5dde0', h1Color: '#3a5a6a',
    textColor: '#4a5a60', mutedColor: '#8a9aa0', placeholderBg: '#dfe8ed',
    footerBorder: '#d5dde0',
    articles: [
      { title: 'Three Days in Porto', date: 'February 25, 2026',
        body: 'Walked the Ribeira district along the Douro. The tiled facades are extraordinary, every building different. Had a pastel de nata still warm from the oven at a bakery with no signage, just a counter and a queue.' },
      { title: 'Overnight Train Notes', date: 'February 10, 2026',
        body: 'There is something about the rhythm of a sleeper train that resets your sense of time. Fell asleep somewhere in the countryside, woke up at the border. The dining car coffee was terrible and I loved every minute of it.' },
      { title: 'Packing Light, Again', date: 'January 22, 2026',
        body: 'Down to a 28L bag for two weeks. The secret is doing laundry, not packing more clothes. One pair of shoes that works for walking and dinner. Two books, swap when done.' },
    ],
  },
  tech: {
    title: 'Build Notes',
    tagline: 'Software \u00b7 Systems \u00b7 Side projects',
    bg: '#f5f5f7', headerBorder: '#e0e0e5', h1Color: '#404050',
    textColor: '#505058', mutedColor: '#9090a0', placeholderBg: '#e5e5ea',
    footerBorder: '#e0e0e5',
    articles: [
      { title: 'Migrating to SQLite', date: 'March 1, 2026',
        body: 'Moved the side project off Postgres. For a single-server app doing under 100 writes per second, the operational simplicity is worth it. No connection pooling, no separate process, backups are just file copies.' },
      { title: 'Debugging a Memory Leak', date: 'February 15, 2026',
        body: 'Spent two hours convinced it was the cache layer. Turned out to be event listeners not being cleaned up on component unmount. Heap snapshots are underrated \u2014 should have started there.' },
      { title: 'Thoughts on Simplicity', date: 'February 1, 2026',
        body: 'Every abstraction you add is a bet that the future will need it. Most of those bets lose. Started removing layers from the API and the code got both shorter and easier to reason about.' },
    ],
  },
};

/** Build the HTML for a given theme */
function buildCoverHtml(theme: Theme, title: string, tagline: string): string {
  const articleHtml = theme.articles.map((a, i) => {
    const placeholder = i < 2 ? `<div class="placeholder">[ image ]</div>` : '';
    return `<article>
<h2>${a.title}</h2>
<div class="date">${a.date}</div>
${placeholder}
<p>${a.body}</p>
</article>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;color:${theme.textColor};background:${theme.bg};line-height:1.7}
header{text-align:center;padding:3rem 1rem 2rem;border-bottom:1px solid ${theme.headerBorder}}
header h1{font-size:1.8rem;font-weight:400;letter-spacing:.1em;color:${theme.h1Color}}
header p{color:${theme.mutedColor};font-size:.9rem;margin-top:.3rem}
main{max-width:720px;margin:0 auto;padding:2rem 1rem}
article{margin-bottom:3rem}
article h2{font-size:1.3rem;font-weight:400;margin-bottom:.5rem;color:${theme.h1Color}}
article .date{font-size:.8rem;color:${theme.mutedColor};margin-bottom:1rem}
article p{margin-bottom:1rem}
.placeholder{background:${theme.placeholderBg};height:220px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:.9rem;margin-bottom:1rem;border-radius:4px}
footer{text-align:center;padding:2rem;font-size:.8rem;color:${theme.mutedColor};border-top:1px solid ${theme.footerBorder}}
</style>
</head>
<body>
<header>
<h1>${title}</h1>
<p>${tagline}</p>
</header>
<main>
${articleHtml}
</main>
<footer>&copy; 2026 ${title}</footer>
</body>
</html>`;
}

/** Get the themed cover HTML based on environment variables */
function getCoverHtml(): string {
  const themeName = (process.env.COVER_SITE_THEME || 'nature').toLowerCase();
  const theme = THEMES[themeName] ?? THEMES.nature;
  const title = process.env.COVER_SITE_TITLE || theme.title;
  const tagline = process.env.COVER_SITE_TAGLINE || theme.tagline;
  return buildCoverHtml(theme, title, tagline);
}

/**
 * Serve the cover site index page.
 */
export function serveCoverPage(_req: Request, res: Response): void {
  const indexPath = join(PUBLIC_DIR, 'index.html');
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8');
    res.type('html').send(html);
  } else {
    res.type('html').send(getCoverHtml());
  }
}

/** Export theme names for health check / logging */
export function getThemeName(): string {
  const name = (process.env.COVER_SITE_THEME || 'nature').toLowerCase();
  return THEMES[name] ? name : 'nature';
}
