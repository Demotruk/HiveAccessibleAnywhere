/**
 * Design loader for the giftcard service.
 *
 * For v1, only the default Hive Community design is supported.
 * The design config is inlined and the logo is loaded from a bundled asset.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DesignConfig, ResolvedDesign } from './design-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const hiveDesign: DesignConfig = {
  name: 'Hive Community',
  dimensions: [419.53, 297.64], // A6 landscape
  colors: {
    primary: { r: 0.898, g: 0.133, b: 0.157 },      // #E5222A Hive red
    bodyText: { r: 0.15, g: 0.15, b: 0.15 },
    mutedText: { r: 0.35, g: 0.35, b: 0.35 },
    pinBoxBackground: { r: 0.97, g: 0.97, b: 0.97 },
    pinBoxBorder: { r: 0.3, g: 0.3, b: 0.3 },
    pinText: { r: 0.1, g: 0.1, b: 0.1 },
  },
  logo: {
    src: 'hive-logo.png',
    height: 35,
    position: 'top-left',
    margin: { x: 22, y: 12 },
  },
  layout: {
    qrSize: 170,
    logoQrGap: 5,
    pageMarginX: 40,
    restoreQrSize: 60,
    pinBoxPadding: { x: 28, y: 14 },
  },
};

let cachedDesign: ResolvedDesign | null = null;

/**
 * Load a design by name. Only "hive" is supported for v1.
 */
export function loadDesign(name: string): ResolvedDesign {
  if (name !== 'hive') {
    throw new Error(`Unknown design "${name}". Only "hive" is supported.`);
  }

  if (cachedDesign) return cachedDesign;

  const assetsDir = resolve(__dirname, '../../assets');
  const logoPath = resolve(assetsDir, 'hive-logo.png');
  const logoPngBytes = new Uint8Array(readFileSync(logoPath));

  cachedDesign = {
    config: hiveDesign,
    designDir: assetsDir,
    logoPngBytes,
  };

  return cachedDesign;
}
