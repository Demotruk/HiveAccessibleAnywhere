/**
 * Cover site — serves a normal-looking website at the proxy's root URL.
 *
 * When someone visits the proxy URL in a browser, they see an ordinary
 * blog/photography site, not an API endpoint. This makes the proxy
 * harder to identify as Hive infrastructure.
 */

import type { Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');

/** Fallback HTML if no custom cover site files exist in /public */
const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mountain Vista Photography</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;color:#333;background:#fafaf7;line-height:1.7}
header{text-align:center;padding:3rem 1rem 2rem;border-bottom:1px solid #e0ddd5}
header h1{font-size:1.8rem;font-weight:400;letter-spacing:.1em;color:#5a5a50}
header p{color:#888;font-size:.9rem;margin-top:.3rem}
main{max-width:720px;margin:0 auto;padding:2rem 1rem}
article{margin-bottom:3rem}
article h2{font-size:1.3rem;font-weight:400;margin-bottom:.5rem;color:#444}
article .date{font-size:.8rem;color:#999;margin-bottom:1rem}
article p{margin-bottom:1rem;color:#555}
.placeholder{background:#e8e6df;height:220px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:.9rem;margin-bottom:1rem;border-radius:4px}
footer{text-align:center;padding:2rem;font-size:.8rem;color:#aaa;border-top:1px solid #e0ddd5}
</style>
</head>
<body>
<header>
<h1>Mountain Vista Photography</h1>
<p>Landscapes &middot; Nature &middot; Light</p>
</header>
<main>
<article>
<h2>Morning Light on the Ridge</h2>
<div class="date">February 28, 2026</div>
<div class="placeholder">[ photograph ]</div>
<p>Caught the first light breaking over the eastern ridge this morning. The fog in the valley below created a beautiful layered effect that lasted only about fifteen minutes before the sun burned through.</p>
</article>
<article>
<h2>Winter Reflections</h2>
<div class="date">February 14, 2026</div>
<div class="placeholder">[ photograph ]</div>
<p>The lake was perfectly still after last week's freeze. These conditions are rare enough that you have to be ready to drop everything and shoot when they appear.</p>
</article>
<article>
<h2>New Lens, First Impressions</h2>
<div class="date">January 30, 2026</div>
<p>Finally picked up the 70-200mm f/2.8 I've been considering. Initial impressions are very positive — the autofocus is noticeably faster than my older model, and the image stabilization makes a real difference for handheld telephoto work. Looking forward to taking it out on the next clear morning.</p>
</article>
</main>
<footer>&copy; 2026 Mountain Vista Photography</footer>
</body>
</html>`;

/**
 * Serve the cover site index page.
 */
export function serveCoverPage(_req: Request, res: Response): void {
  const indexPath = join(PUBLIC_DIR, 'index.html');
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8');
    res.type('html').send(html);
  } else {
    res.type('html').send(FALLBACK_HTML);
  }
}
