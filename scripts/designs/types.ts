/**
 * Gift card design template types.
 *
 * A design = a folder under scripts/designs/<name>/ containing:
 *   - design.ts   — exports a DesignConfig (default export)
 *   - optional asset files (logo, background image, custom font)
 *
 * Asset paths in the config are relative to the design folder.
 */

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/** RGB color with components in 0-1 range (maps directly to pdf-lib's rgb()). */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

// ---------------------------------------------------------------------------
// Card text strings (moved from generate-invite-pdf.ts)
// ---------------------------------------------------------------------------

export interface CardStrings {
  inviteLine1: string;
  inviteLine2: string;
  issuedBy: (issuer: string) => string;
  expires: (date: string) => string;
  flipHint: string;
  to: string;
  from: string;
  pinHeading: string;
  pinInstruction: string;
  restoreHeading: string;
  restoreBody: string;
  /** Robust-only: PIN confidentiality notice */
  pinNotice: string;
  /** Robust-only: Signal support prompt */
  signalPrompt: string;
}

// ---------------------------------------------------------------------------
// Design config
// ---------------------------------------------------------------------------

export interface ColorScheme {
  /** Primary brand color (accents, headings, flip hint for CJK) */
  primary: RgbColor;
  /** Body text color */
  bodyText: RgbColor;
  /** Muted/secondary text color (issuer line, instruction text) */
  mutedText: RgbColor;
  /** PIN box fill color */
  pinBoxBackground: RgbColor;
  /** PIN box border color */
  pinBoxBorder: RgbColor;
  /** PIN digit text color */
  pinText: RgbColor;
  /** Solid page background (used when no background image). Default: white */
  pageBackground?: RgbColor;
}

export interface LogoConfig {
  /** Path to logo image (PNG), relative to the design folder */
  src: string;
  /** Display height in points (width auto-calculated from aspect ratio) */
  height: number;
  /** Where to place the logo on the front page */
  position: 'top-left' | 'top-center' | 'top-right';
  /** Margin from page edges in points */
  margin?: { x?: number; y?: number };
}

export interface BackgroundConfig {
  /** Path to background image (PNG/JPG), relative to the design folder */
  src: string;
  /** How the image fills the page: fill (cover+crop), fit (letterbox), stretch */
  mode: 'fill' | 'fit' | 'stretch';
  /** Which pages get the background */
  pages: 'front' | 'back' | 'both';
}

export interface FontConfig {
  /** Custom TTF/OTF for body/heading text, relative to design folder */
  bodyFont?: string;
  /** Font size overrides in points */
  sizes?: {
    heading?: number;      // default: 20
    body?: number;         // default: 10
    small?: number;        // default: 9
    pinDisplay?: number;   // default: 30
    flipHint?: number;     // default: 8.5
  };
}

export interface LayoutConfig {
  /** QR code size on front page in points. Default: 170 */
  qrSize?: number;
  /** Gap between logo bottom and QR top in points. Default: 5 */
  logoQrGap?: number;
  /** Horizontal page margin for text in points. Default: 40 */
  pageMarginX?: number;
  /** Restore QR code size in points. Default: 60 */
  restoreQrSize?: number;
  /** PIN box padding in points. Default: { x: 28, y: 14 } */
  pinBoxPadding?: { x?: number; y?: number };
  /** Show To/From lines on back page. Default: true (always hidden for zh) */
  showToFrom?: boolean;
}

export interface DesignConfig {
  /** Human-readable design name */
  name: string;
  /** Card dimensions in points [width, height]. Default: A6 landscape [419.53, 297.64] */
  dimensions?: [number, number];
  /** Color scheme */
  colors: ColorScheme;
  /** Logo on front page. Omit for text fallback ("HIVE" in primary color). */
  logo?: LogoConfig;
  /** Background image. Omit for solid pageBackground color (or white). */
  background?: BackgroundConfig;
  /** Font configuration */
  fonts?: FontConfig;
  /** Text content overrides per locale */
  text?: {
    localeOverrides?: Record<string, Partial<CardStrings>>;
  };
  /** Layout tuning */
  layout?: LayoutConfig;
}

// ---------------------------------------------------------------------------
// Resolved design (config + loaded asset bytes)
// ---------------------------------------------------------------------------

export interface ResolvedDesign {
  config: DesignConfig;
  /** Absolute path to the design folder (for diagnostics) */
  designDir: string;
  /** Logo image bytes (PNG), if logo.src was specified and found */
  logoPngBytes?: Uint8Array;
  /** Background image bytes (PNG/JPG), if background.src was specified and found */
  backgroundBytes?: Uint8Array;
  /** Custom font bytes (TTF/OTF), if fonts.bodyFont was specified and found */
  fontBytes?: Uint8Array;
}
