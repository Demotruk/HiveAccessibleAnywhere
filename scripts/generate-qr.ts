/**
 * Generate QR codes for the hosted Propolis Wallet bootstrap pages.
 *
 * Produces SVG (vector, for print) and PNG (raster, for digital sharing)
 * in docs/qr/ for each supported locale.
 *
 * Usage:
 *   npx tsx generate-qr.ts
 *
 * Override the base URL:
 *   PROPOLIS_BASE_URL=https://example.com npx tsx generate-qr.ts
 */

import QRCode from 'qrcode';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL =
  process.env.PROPOLIS_BASE_URL ||
  'https://demotruk.github.io/HiveAccessibleAnywhere';

const LOCALES = ['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi'];
const OUTPUT_DIR = resolve(import.meta.dirname, '..', 'docs', 'qr');

const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const, // 30% recovery — robust for print
  margin: 2,
  width: 512,
  color: { dark: '#000000', light: '#ffffff' },
};

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const locale of LOCALES) {
    const url = `${BASE_URL}/propolis-bootstrap-${locale}.html`;

    // SVG — scalable vector for print
    const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' });
    const svgPath = resolve(OUTPUT_DIR, `propolis-${locale}.svg`);
    writeFileSync(svgPath, svg);

    // PNG — raster for digital sharing (WhatsApp, WeChat, Telegram, etc.)
    const png = await QRCode.toBuffer(url, { ...QR_OPTIONS, type: 'png' });
    const pngPath = resolve(OUTPUT_DIR, `propolis-${locale}.png`);
    writeFileSync(pngPath, png);

    console.log(`${locale}: ${url}`);
    console.log(`  SVG → docs/qr/propolis-${locale}.svg`);
    console.log(`  PNG → docs/qr/propolis-${locale}.png (${(png.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
