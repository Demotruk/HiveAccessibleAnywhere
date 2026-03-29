/**
 * Load a design config by name.
 *
 * Resolves the design folder under scripts/designs/<name>/, dynamically imports
 * the config, and reads any referenced asset files (logo, background, font).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DesignConfig, ResolvedDesign } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load and resolve a design by name.
 *
 * @param name - Design folder name (e.g. 'hive', 'minimal')
 * @returns ResolvedDesign with config and loaded asset bytes
 */
export async function loadDesign(name: string): Promise<ResolvedDesign> {
  const designDir = resolve(__dirname, name);
  const designFile = resolve(designDir, 'design.ts');

  if (!existsSync(designFile)) {
    throw new Error(`Design not found: ${designFile}`);
  }

  // Dynamic import — works with tsx
  const mod = await import(/* @vite-ignore */ `file:///${designFile.replace(/\\/g, '/')}`);
  const config: DesignConfig = mod.default;

  if (!config || !config.name || !config.colors) {
    throw new Error(`Invalid design config in ${designFile}: must export a DesignConfig with name and colors`);
  }

  const result: ResolvedDesign = { config, designDir };

  // Load logo
  if (config.logo?.src) {
    const logoPath = resolve(designDir, config.logo.src);
    if (existsSync(logoPath)) {
      result.logoPngBytes = new Uint8Array(readFileSync(logoPath));
    } else {
      console.warn(`Design "${name}": logo not found at ${logoPath} — will use text fallback`);
    }
  }

  // Load background
  if (config.background?.src) {
    const bgPath = resolve(designDir, config.background.src);
    if (existsSync(bgPath)) {
      result.backgroundBytes = new Uint8Array(readFileSync(bgPath));
    } else {
      console.warn(`Design "${name}": background not found at ${bgPath} — skipping`);
    }
  }

  // Load custom font
  if (config.fonts?.bodyFont) {
    const fontPath = resolve(designDir, config.fonts.bodyFont);
    if (existsSync(fontPath)) {
      result.fontBytes = new Uint8Array(readFileSync(fontPath));
    } else {
      console.warn(`Design "${name}": font not found at ${fontPath} — using default fonts`);
    }
  }

  return result;
}
