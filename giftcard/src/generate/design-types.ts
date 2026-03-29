/**
 * Gift card design template types.
 *
 * Copied from scripts/designs/types.ts for use by the giftcard service.
 * The CLI script retains its own copy — both are kept in sync manually.
 */

/** RGB color with components in 0-1 range (maps directly to pdf-lib's rgb()). */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

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
  pinNotice: string;
  signalPrompt: string;
}

export interface ColorScheme {
  primary: RgbColor;
  bodyText: RgbColor;
  mutedText: RgbColor;
  pinBoxBackground: RgbColor;
  pinBoxBorder: RgbColor;
  pinText: RgbColor;
  pageBackground?: RgbColor;
}

export interface LogoConfig {
  src: string;
  height: number;
  position: 'top-left' | 'top-center' | 'top-right';
  margin?: { x?: number; y?: number };
}

export interface BackgroundConfig {
  src: string;
  mode: 'fill' | 'fit' | 'stretch';
  pages: 'front' | 'back' | 'both';
}

export interface FontConfig {
  bodyFont?: string;
  sizes?: {
    heading?: number;
    body?: number;
    small?: number;
    pinDisplay?: number;
    flipHint?: number;
  };
}

export interface LayoutConfig {
  qrSize?: number;
  logoQrGap?: number;
  pageMarginX?: number;
  restoreQrSize?: number;
  pinBoxPadding?: { x?: number; y?: number };
  showToFrom?: boolean;
}

export interface DesignConfig {
  name: string;
  dimensions?: [number, number];
  colors: ColorScheme;
  logo?: LogoConfig;
  background?: BackgroundConfig;
  fonts?: FontConfig;
  text?: {
    localeOverrides?: Record<string, Partial<CardStrings>>;
  };
  layout?: LayoutConfig;
}

export interface ResolvedDesign {
  config: DesignConfig;
  designDir: string;
  logoPngBytes?: Uint8Array;
  backgroundBytes?: Uint8Array;
  fontBytes?: Uint8Array;
}
