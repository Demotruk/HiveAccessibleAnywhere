/**
 * Generate printable postcard PDFs for gift card invite tokens.
 *
 * Each card produces a 2-page landscape PDF:
 *   Page 1 (front): Logo, large QR code (hero element), invitation text
 *   Page 2 (back):  "To:"/"From:" lines, PIN display, instruction text
 *
 * Supports pluggable design templates via DesignConfig. When no design is
 * provided, uses hardcoded defaults matching the original Hive design.
 *
 * Usage (standalone test):
 *   npx tsx generate-invite-pdf.ts
 *   npx tsx generate-invite-pdf.ts --locale zh --variant robust
 *   npx tsx generate-invite-pdf.ts --design minimal
 *
 * Programmatic:
 *   import { generateInvitePdf } from './generate-invite-pdf.js';
 *   const pdfBytes = await generateInvitePdf({ qrPngBytes, pin, issuer, design });
 */

import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import type { CardStrings, ResolvedDesign, RgbColor } from './designs/types.js';

const RESTORE_URL = 'https://demotruk.github.io/HiveAccessibleAnywhere/restore/';

// ---------------------------------------------------------------------------
// Default values (match original Hive design for backward compatibility)
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 419.53;  // A6 landscape
const DEFAULT_HEIGHT = 297.64;

const DEFAULT_PRIMARY: RgbColor = { r: 0.898, g: 0.133, b: 0.157 };  // #E5222A
const DEFAULT_BODY_TEXT: RgbColor = { r: 0.15, g: 0.15, b: 0.15 };
const DEFAULT_MUTED_TEXT: RgbColor = { r: 0.35, g: 0.35, b: 0.35 };
const DEFAULT_PIN_BOX_BG: RgbColor = { r: 0.97, g: 0.97, b: 0.97 };
const DEFAULT_PIN_BOX_BORDER: RgbColor = { r: 0.3, g: 0.3, b: 0.3 };
const DEFAULT_PIN_TEXT: RgbColor = { r: 0.1, g: 0.1, b: 0.1 };

// ---------------------------------------------------------------------------
// Locale text maps
// ---------------------------------------------------------------------------

const STRINGS_EN: CardStrings = {
  inviteLine1: 'Your invitation to the Hive Community.',
  inviteLine2: 'Scan the QR code to receive your free account.',
  issuedBy: (issuer) => `Issued by: @${issuer}`,
  expires: (date) => `Expires: ${date}`,
  flipHint: '>> See PIN on back',
  to: 'To:',
  from: 'From:',
  pinHeading: 'Your Invite PIN',
  pinInstruction: 'Enter this PIN when prompted after scanning the QR code on the front.',
  restoreHeading: 'Restore your backup',
  restoreBody: 'Scan to recover your keys from backup.',
  pinNotice: 'This card is personal \u2014 don\u2019t share the PIN',
  signalPrompt: 'Need help? Contact us on Signal:',
};

const STRINGS_ZH: CardStrings = {
  inviteLine1: '\u60a8\u7684 Hive \u793e\u533a\u9080\u8bf7\u51fd',
  inviteLine2: '\u626b\u63cf\u4e8c\u7ef4\u7801\uff0c\u514d\u8d39\u83b7\u53d6\u60a8\u7684\u8d26\u6237',
  issuedBy: (issuer) => `\u53d1\u884c\u8005\uff1a@${issuer}`,
  expires: (date) => `\u6709\u6548\u671f\u81f3\uff1a${date}`,
  flipHint: '>> \u80cc\u9762\u67e5\u770bPIN\u7801',
  to: '\u6536\u4ef6\u4eba\uff1a',
  from: '\u8d60\u9001\u4eba\uff1a',
  pinHeading: '\u60a8\u7684\u9080\u8bf7 PIN \u7801',
  pinInstruction: '\u626b\u63cf\u6b63\u9762\u4e8c\u7ef4\u7801\u540e\uff0c\u6309\u63d0\u793a\u8f93\u5165\u6b64 PIN \u7801',
  restoreHeading: '\u6062\u590d\u60a8\u7684\u5907\u4efd',
  restoreBody: '\u626b\u63cf\u6b64\u7801\u53ef\u6062\u590d\u60a8\u7684\u5bc6\u94a5\u5907\u4efd',
  pinNotice: '\u6b64\u5361\u4ec5\u9650\u672c\u4eba\u4f7f\u7528\uff0c\u8bf7\u52ff\u5206\u4eab PIN \u7801',
  signalPrompt: '\u9700\u8981\u5e2e\u52a9\uff1f\u901a\u8fc7 Signal \u8054\u7cfb\u6211\u4eec\uff1a',
};

const STRINGS_ES: CardStrings = {
  inviteLine1: 'Tu invitación a la comunidad Hive.',
  inviteLine2: 'Escanea el código QR para recibir tu cuenta gratuita.',
  issuedBy: (issuer) => `Emitida por: @${issuer}`,
  expires: (date) => `Expira: ${date}`,
  flipHint: '>> Ver PIN en el reverso',
  to: 'Para:',
  from: 'De:',
  pinHeading: 'Tu PIN de Invitación',
  pinInstruction: 'Ingresa este PIN cuando se te solicite después de escanear el código QR del frente.',
  restoreHeading: 'Restaura tu respaldo',
  restoreBody: 'Escanea para recuperar tus claves desde el respaldo.',
  pinNotice: 'Esta tarjeta es personal \u2014 no compartas el PIN',
  signalPrompt: '¿Necesitas ayuda? Contáctanos en Signal:',
};

const LOCALE_STRINGS: Record<string, CardStrings> = {
  en: STRINGS_EN,
  zh: STRINGS_ZH,
  es: STRINGS_ES,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InviteCardOptions {
  /** QR code as PNG bytes */
  qrPngBytes: Uint8Array;
  /** 6-char alphanumeric PIN */
  pin: string;
  /** Hive account name of the issuer (without @) */
  issuer: string;
  /** Optional expiry date string for the card */
  expires?: string;
  /** Locale code — determines card text language (default: 'en') */
  locale?: string;
  /** Card variant — 'robust' adds PIN notice and Signal contact (default: 'standard') */
  variant?: 'standard' | 'robust';
  /** Signal contact number or signal.me link (robust variant only) */
  signalContact?: string;
  /** Resolved design template. When omitted, uses built-in Hive defaults. */
  design?: ResolvedDesign;
  /**
   * @deprecated Pass design.logoPngBytes via ResolvedDesign instead.
   * Kept for backward compatibility with callers that don't use designs yet.
   */
  logoPngBytes?: Uint8Array;
  /**
   * @deprecated Pass design.fontBytes via ResolvedDesign instead.
   * Kept for backward compatibility with callers that don't use designs yet.
   */
  fontBytes?: Uint8Array;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function c(color: RgbColor) {
  return rgb(color.r, color.g, color.b);
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize(text: string, size: number): number },
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine: string[] = [];

  for (const word of words) {
    const testLine = [...currentLine, word].join(' ');
    if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine.length > 0) {
      lines.push(currentLine.join(' '));
      currentLine = [word];
    } else {
      currentLine.push(word);
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }
  return lines;
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  pageWidth: number,
): number {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: pageWidth / 2 - w / 2,
    y,
    size,
    font,
    color,
  });
  return y;
}

// ---------------------------------------------------------------------------
// Background rendering
// ---------------------------------------------------------------------------

async function drawBackground(
  doc: PDFDocument,
  page: PDFPage,
  backgroundBytes: Uint8Array,
  mode: 'fill' | 'fit' | 'stretch',
  pageWidth: number,
  pageHeight: number,
): Promise<void> {
  // Detect format: JPG starts with FF D8, PNG starts with 89 50 4E 47
  const isJpg = backgroundBytes[0] === 0xFF && backgroundBytes[1] === 0xD8;
  const bgImage = isJpg
    ? await doc.embedJpg(backgroundBytes)
    : await doc.embedPng(backgroundBytes);

  let drawWidth: number;
  let drawHeight: number;
  let drawX = 0;
  let drawY = 0;

  if (mode === 'stretch') {
    drawWidth = pageWidth;
    drawHeight = pageHeight;
  } else if (mode === 'fit') {
    const scale = Math.min(pageWidth / bgImage.width, pageHeight / bgImage.height);
    drawWidth = bgImage.width * scale;
    drawHeight = bgImage.height * scale;
    drawX = (pageWidth - drawWidth) / 2;
    drawY = (pageHeight - drawHeight) / 2;
  } else {
    // fill: cover the page, crop overflow
    const scale = Math.max(pageWidth / bgImage.width, pageHeight / bgImage.height);
    drawWidth = bgImage.width * scale;
    drawHeight = bgImage.height * scale;
    drawX = (pageWidth - drawWidth) / 2;
    drawY = (pageHeight - drawHeight) / 2;
  }

  page.drawImage(bgImage, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight,
  });
}

// ---------------------------------------------------------------------------
// Front page renderer
// ---------------------------------------------------------------------------

interface RenderContext {
  doc: PDFDocument;
  pageWidth: number;
  pageHeight: number;
  textFont: PDFFont;
  boldFont: PDFFont;
  helveticaBold: PDFFont;
  strings: CardStrings;
  locale: string;
  // Design colors
  primaryColor: RgbColor;
  bodyTextColor: RgbColor;
  mutedTextColor: RgbColor;
  pinBoxBgColor: RgbColor;
  pinBoxBorderColor: RgbColor;
  pinTextColor: RgbColor;
  // Logo config
  logoHeight: number;
  logoPosition: 'top-left' | 'top-center' | 'top-right';
  logoMarginX: number;
  logoMarginY: number;
  // Design layout
  qrSize: number;
  logoQrGap: number;
  pageMarginX: number;
  restoreQrSize: number;
  pinBoxPadX: number;
  pinBoxPadY: number;
  showToFrom: boolean;
  // Font sizes
  headingSize: number;
  bodySize: number;
  smallSize: number;
  pinDisplaySize: number;
  flipHintSize: number;
}

async function renderFrontPage(
  ctx: RenderContext,
  front: PDFPage,
  qrImage: PDFImage,
  logoImage: PDFImage | undefined,
  options: { issuer: string; expires?: string },
): Promise<void> {
  const { pageWidth, pageHeight, boldFont, textFont, strings, locale } = ctx;
  const centerX = pageWidth / 2;

  // -- Logo --
  let logoBottomY = pageHeight - 20; // fallback if no logo
  if (logoImage) {
    const logoDisplayHeight = ctx.logoHeight;
    const logoAspect = logoImage.width / logoImage.height;
    const logoDisplayWidth = logoDisplayHeight * logoAspect;

    let logoX: number;
    if (ctx.logoPosition === 'top-center') {
      logoX = centerX - logoDisplayWidth / 2;
    } else if (ctx.logoPosition === 'top-right') {
      logoX = pageWidth - ctx.logoMarginX - logoDisplayWidth;
    } else {
      logoX = ctx.logoMarginX;
    }
    const logoY = pageHeight - ctx.logoMarginY - logoDisplayHeight;
    front.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoDisplayWidth,
      height: logoDisplayHeight,
    });
    logoBottomY = logoY;
  } else {
    // Fallback: draw "HIVE" text in primary color
    front.drawText('HIVE', {
      x: 25,
      y: pageHeight - 40,
      size: 22,
      font: ctx.helveticaBold,
      color: c(ctx.primaryColor),
    });
    logoBottomY = pageHeight - 45;
  }

  // -- QR code (large, centered, hero element) --
  const qrX = centerX - ctx.qrSize / 2;
  const qrTopY = logoBottomY - ctx.logoQrGap;
  const qrY = qrTopY - ctx.qrSize;
  front.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: ctx.qrSize,
    height: ctx.qrSize,
  });

  // -- Invitation text (below QR) --
  const textStartY = qrY - 10;

  drawCentered(front, strings.inviteLine1, textStartY, textFont, ctx.bodySize, c(ctx.bodyTextColor), pageWidth);
  drawCentered(front, strings.inviteLine2, textStartY - 14, textFont, ctx.bodySize, c(ctx.bodyTextColor), pageWidth);

  // Issuer + expiry on one line at the bottom
  const issuerText = strings.issuedBy(options.issuer);
  const expiryText = options.expires ? `  \u00b7  ${strings.expires(options.expires)}` : '';
  const bottomLine = issuerText + expiryText;
  drawCentered(front, bottomLine, textStartY - 32, boldFont, ctx.smallSize, c(ctx.mutedTextColor), pageWidth);

  // -- "See PIN on back" hint (top-right corner) --
  const flipHint = strings.flipHint;
  // CJK locales: larger, in primary color. Others: smaller, in body text color.
  const hintSize = locale === 'zh' ? 11 : ctx.flipHintSize;
  const hintColor = locale === 'zh' ? c(ctx.primaryColor) : c(ctx.bodyTextColor);
  const flipHintWidth = boldFont.widthOfTextAtSize(flipHint, hintSize);
  front.drawText(flipHint, {
    x: pageWidth - flipHintWidth - 18,
    y: pageHeight - 20,
    size: hintSize,
    font: boldFont,
    color: hintColor,
  });
}

// ---------------------------------------------------------------------------
// Back page renderer
// ---------------------------------------------------------------------------

async function renderBackPage(
  ctx: RenderContext,
  back: PDFPage,
  options: { pin: string; variant: string; signalContact?: string },
): Promise<void> {
  const { pageWidth, pageHeight, textFont, boldFont, strings, locale } = ctx;
  const centerX = pageWidth / 2;
  const isRobust = options.variant === 'robust';

  // -- "To:" and "From:" lines at top (skipped for zh — confusing noise per feedback) --
  let backContentTopY: number;

  if (locale !== 'zh' && ctx.showToFrom) {
    const labelColor = rgb(0.2, 0.2, 0.2);
    const lineColor = rgb(0.4, 0.4, 0.4);
    const labelSize = 12;

    const toLabel = strings.to;
    const fromLabel = strings.from;
    const toLabelWidth = textFont.widthOfTextAtSize(toLabel, labelSize);
    const fromLabelWidth = textFont.widthOfTextAtSize(fromLabel, labelSize);
    const labelIndent = Math.max(toLabelWidth, fromLabelWidth) + 50;
    const lineEndX = 280;

    const toY = pageHeight - 40;
    back.drawText(toLabel, {
      x: ctx.pageMarginX,
      y: toY,
      size: labelSize,
      font: textFont,
      color: labelColor,
    });
    back.drawLine({
      start: { x: labelIndent, y: toY - 2 },
      end: { x: lineEndX, y: toY - 2 },
      thickness: 0.5,
      color: lineColor,
    });

    const fromY = toY - 28;
    back.drawText(fromLabel, {
      x: ctx.pageMarginX,
      y: fromY,
      size: labelSize,
      font: textFont,
      color: labelColor,
    });
    back.drawLine({
      start: { x: labelIndent, y: fromY - 2 },
      end: { x: lineEndX, y: fromY - 2 },
      thickness: 0.5,
      color: lineColor,
    });

    backContentTopY = fromY - 35;
  } else {
    // No To/From — will vertically center the PIN block instead
    backContentTopY = 0; // placeholder, computed below
  }

  // -- "Your Invite PIN" heading + box layout --
  const pinHeading = strings.pinHeading;
  const pinFont = ctx.helveticaBold; // PIN always Helvetica Bold
  const pinFontSize = ctx.pinDisplaySize;
  const pinWidth = pinFont.widthOfTextAtSize(options.pin, pinFontSize);
  const boxPadX = ctx.pinBoxPadX;
  const boxPadY = ctx.pinBoxPadY;
  const boxW = pinWidth + boxPadX * 2;
  const boxH = pinFontSize + boxPadY * 2;

  // For zh (no To/From), vertically center the PIN box in the usable area
  if (locale === 'zh' || !ctx.showToFrom) {
    if (backContentTopY === 0) {
      const usableTop = pageHeight - 20;
      const usableBottom = 90; // above restore QR
      const usableCenterY = usableBottom + (usableTop - usableBottom) / 2;
      const boxBottomY = usableCenterY - boxH / 2;
      backContentTopY = boxBottomY + boxH + 18;
    }
  }

  const pinHeadingY = backContentTopY;
  drawCentered(back, pinHeading, pinHeadingY, boldFont, ctx.headingSize, c(ctx.pinTextColor), pageWidth);

  // -- PIN box --
  const boxX = centerX - boxW / 2;
  const boxY = pinHeadingY - 18 - boxH;

  back.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: c(ctx.pinBoxBorderColor),
    borderWidth: 1.5,
    color: c(ctx.pinBoxBgColor),
  });

  back.drawText(options.pin, {
    x: centerX - pinWidth / 2,
    y: boxY + boxPadY,
    size: pinFontSize,
    font: pinFont,
    color: c(ctx.pinTextColor),
  });

  // -- PIN instruction text --
  const instructionY = boxY - 18;
  const instrMaxWidth = pageWidth - 80;
  const instrLines = wrapText(strings.pinInstruction, textFont, ctx.bodySize, instrMaxWidth);
  for (let i = 0; i < instrLines.length; i++) {
    drawCentered(back, instrLines[i], instructionY - i * 14, textFont, ctx.bodySize, c(ctx.mutedTextColor), pageWidth);
  }

  // -- Robust-only: PIN confidentiality notice --
  let noticeBottomY = instructionY - instrLines.length * 14;
  if (isRobust) {
    noticeBottomY -= 4;
    drawCentered(back, strings.pinNotice, noticeBottomY, textFont, 8, rgb(0.5, 0.5, 0.5), pageWidth);
    noticeBottomY -= 12;
  }

  // -- Restore backup QR code (bottom-left) --
  const restoreQrPng = await QRCode.toBuffer(RESTORE_URL, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
  const restoreQrImage = await ctx.doc.embedPng(new Uint8Array(restoreQrPng));

  const restoreQrX = ctx.pageMarginX;
  const restoreQrY = 18;

  back.drawImage(restoreQrImage, {
    x: restoreQrX,
    y: restoreQrY,
    width: ctx.restoreQrSize,
    height: ctx.restoreQrSize,
  });

  // Label text next to the restore QR
  const restoreLabelX = restoreQrX + ctx.restoreQrSize + 10;
  const restoreLabelY = restoreQrY + ctx.restoreQrSize - 12;
  const restoreLabelSize = ctx.smallSize;

  back.drawText(strings.restoreHeading, {
    x: restoreLabelX,
    y: restoreLabelY,
    size: restoreLabelSize,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Wrap restore body text
  const restoreBodyMaxWidth = 140;
  const restoreBodyLines = wrapText(strings.restoreBody, textFont, 8, restoreBodyMaxWidth);
  for (let i = 0; i < restoreBodyLines.length; i++) {
    back.drawText(restoreBodyLines[i], {
      x: restoreLabelX,
      y: restoreLabelY - 13 - i * 10,
      size: 8,
      font: textFont,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // -- Robust-only: Signal support contact (bottom-right) --
  if (isRobust && options.signalContact) {
    const signalX = pageWidth - 160;
    const signalY = restoreQrY + ctx.restoreQrSize - 12;

    back.drawText(strings.signalPrompt, {
      x: signalX,
      y: signalY,
      size: 8,
      font: textFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    back.drawText(options.signalContact, {
      x: signalX,
      y: signalY - 12,
      size: ctx.smallSize,
      font: ctx.helveticaBold,
      color: c(ctx.bodyTextColor),
    });
  }
}

// ---------------------------------------------------------------------------
// Main PDF generator
// ---------------------------------------------------------------------------

export async function generateInvitePdf(options: InviteCardOptions): Promise<Uint8Array> {
  const {
    qrPngBytes, pin, issuer, expires,
    locale = 'en',
    variant = 'standard',
    signalContact,
    design,
  } = options;

  // Resolve asset bytes: design takes precedence over legacy direct params
  const logoPngBytes = design?.logoPngBytes ?? options.logoPngBytes;
  const fontBytes = design?.fontBytes ?? options.fontBytes;
  const backgroundBytes = design?.backgroundBytes;
  const cfg = design?.config;

  // Resolve card strings with optional design text overrides
  let strings = LOCALE_STRINGS[locale] ?? STRINGS_EN;
  if (cfg?.text?.localeOverrides?.[locale]) {
    strings = { ...strings, ...cfg.text.localeOverrides[locale] };
  }

  // Page dimensions
  const pageWidth = cfg?.dimensions?.[0] ?? DEFAULT_WIDTH;
  const pageHeight = cfg?.dimensions?.[1] ?? DEFAULT_HEIGHT;

  // Font sizes
  const headingSize = cfg?.fonts?.sizes?.heading ?? 20;
  const bodySize = cfg?.fonts?.sizes?.body ?? 10;
  const smallSize = cfg?.fonts?.sizes?.small ?? 9;
  const pinDisplaySize = cfg?.fonts?.sizes?.pinDisplay ?? 30;
  const flipHintSize = cfg?.fonts?.sizes?.flipHint ?? 8.5;

  // Layout
  const qrSize = cfg?.layout?.qrSize ?? 170;
  const logoQrGap = cfg?.layout?.logoQrGap ?? 5;
  const pageMarginX = cfg?.layout?.pageMarginX ?? 40;
  const restoreQrSize = cfg?.layout?.restoreQrSize ?? 60;
  const pinBoxPadX = cfg?.layout?.pinBoxPadding?.x ?? 28;
  const pinBoxPadY = cfg?.layout?.pinBoxPadding?.y ?? 14;
  const showToFrom = cfg?.layout?.showToFrom ?? true;

  // Colors
  const primaryColor = cfg?.colors.primary ?? DEFAULT_PRIMARY;
  const bodyTextColor = cfg?.colors.bodyText ?? DEFAULT_BODY_TEXT;
  const mutedTextColor = cfg?.colors.mutedText ?? DEFAULT_MUTED_TEXT;
  const pinBoxBgColor = cfg?.colors.pinBoxBackground ?? DEFAULT_PIN_BOX_BG;
  const pinBoxBorderColor = cfg?.colors.pinBoxBorder ?? DEFAULT_PIN_BOX_BORDER;
  const pinTextColor = cfg?.colors.pinText ?? DEFAULT_PIN_TEXT;

  const doc = await PDFDocument.create();

  // Register fontkit for custom font embedding (required by pdf-lib)
  if (fontBytes) {
    doc.registerFontkit(fontkit);
  }

  // Embed fonts — use custom font for CJK, Helvetica as fallback
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let cjkFont: PDFFont | undefined;
  if (fontBytes) {
    cjkFont = await doc.embedFont(fontBytes);
  }

  const textFont = cjkFont ?? helvetica;
  const boldFont = cjkFont ?? helveticaBold;

  const qrImage = await doc.embedPng(qrPngBytes);

  // Embed logo if available
  let logoImage: PDFImage | undefined;
  if (logoPngBytes) {
    logoImage = await doc.embedPng(logoPngBytes);
  }

  // Logo config
  const logoHeight = cfg?.logo?.height ?? 35;
  const logoPosition = cfg?.logo?.position ?? 'top-left';
  const logoMarginX = cfg?.logo?.margin?.x ?? 22;
  const logoMarginY = cfg?.logo?.margin?.y ?? 12;

  // Build render context
  const ctx: RenderContext = {
    doc, pageWidth, pageHeight,
    textFont, boldFont, helveticaBold,
    strings, locale,
    primaryColor, bodyTextColor, mutedTextColor,
    pinBoxBgColor, pinBoxBorderColor, pinTextColor,
    logoHeight, logoPosition, logoMarginX, logoMarginY,
    qrSize, logoQrGap, pageMarginX, restoreQrSize,
    pinBoxPadX, pinBoxPadY, showToFrom,
    headingSize, bodySize, smallSize, pinDisplaySize, flipHintSize,
  };

  // ---- Page 1: Front ----
  const front = doc.addPage([pageWidth, pageHeight]);

  // Draw background if configured
  const bgConfig = cfg?.background;
  if (backgroundBytes && bgConfig) {
    if (bgConfig.pages === 'front' || bgConfig.pages === 'both') {
      await drawBackground(doc, front, backgroundBytes, bgConfig.mode, pageWidth, pageHeight);
    }
  }

  // Draw solid page background if configured (and no background image on this page)
  if (!backgroundBytes && cfg?.colors.pageBackground) {
    front.drawRectangle({
      x: 0, y: 0, width: pageWidth, height: pageHeight,
      color: c(cfg.colors.pageBackground),
    });
  }

  await renderFrontPage(ctx, front, qrImage, logoImage, { issuer, expires });

  // ---- Page 2: Back ----
  const back = doc.addPage([pageWidth, pageHeight]);

  if (backgroundBytes && bgConfig) {
    if (bgConfig.pages === 'back' || bgConfig.pages === 'both') {
      await drawBackground(doc, back, backgroundBytes, bgConfig.mode, pageWidth, pageHeight);
    }
  }

  if (!backgroundBytes && cfg?.colors.pageBackground) {
    back.drawRectangle({
      x: 0, y: 0, width: pageWidth, height: pageHeight,
      color: c(cfg.colors.pageBackground),
    });
  }

  await renderBackPage(ctx, back, { pin, variant, signalContact });

  return doc.save();
}

// -- Standalone test --
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('generate-invite-pdf.ts')) {
  const { readFileSync, writeFileSync, existsSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  // Parse CLI flags
  const args = process.argv.slice(2);
  const localeIdx = args.indexOf('--locale');
  const locale = localeIdx >= 0 ? args[localeIdx + 1] : 'en';
  const variantIdx = args.indexOf('--variant');
  const variant = (variantIdx >= 0 ? args[variantIdx + 1] : 'standard') as 'standard' | 'robust';
  const designIdx = args.indexOf('--design');
  const designName = designIdx >= 0 ? args[designIdx + 1] : undefined;

  console.log(`Generating test card: locale=${locale}, variant=${variant}${designName ? `, design=${designName}` : ''}`);

  // Load design if specified, otherwise use legacy asset loading
  let design: ResolvedDesign | undefined;
  let logoPngBytes: Uint8Array | undefined;
  let fontBytes: Uint8Array | undefined;

  if (designName) {
    const { loadDesign } = await import('./designs/loader.js');
    design = await loadDesign(designName);
    console.log(`Loaded design: ${design.config.name}`);
  } else {
    // Legacy: load Hive logo directly
    const logoPath = resolve(import.meta.dirname, '..', 'hive-branding', 'logo', 'png', 'logo_transparent@2.png');
    if (existsSync(logoPath)) {
      logoPngBytes = new Uint8Array(readFileSync(logoPath));
      console.log(`Loaded Hive logo: ${logoPath}`);
    } else {
      console.warn('Hive logo not found — will use text fallback');
    }
  }

  // Load CJK font if needed (and not provided by design)
  if (locale === 'zh' && !design?.fontBytes) {
    const fontPath = resolve(import.meta.dirname, 'fonts', 'NotoSansSC.ttf');
    if (existsSync(fontPath)) {
      fontBytes = new Uint8Array(readFileSync(fontPath));
      console.log(`Loaded CJK font: ${fontPath} (${(fontBytes.length / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      console.warn(`CJK font not found at ${fontPath} — Chinese text will not render correctly`);
    }
  }

  // Check for a test QR code from a previous batch
  const testQr = resolve(import.meta.dirname, 'giftcard-output');
  const batches = existsSync(testQr) ? (await import('node:fs')).readdirSync(testQr) : [];

  if (batches.length > 0) {
    const batchDir = resolve(testQr, batches[0]);
    const manifest = JSON.parse(readFileSync(resolve(batchDir, 'manifest.json'), 'utf-8'));
    const card = manifest.cards[0];
    const qrPngPath = resolve(batchDir, card.qrPng);
    const qrPngBytes = readFileSync(qrPngPath);

    console.log('Generating invite PDF from batch data...');
    const pdfBytes = await generateInvitePdf({
      qrPngBytes: new Uint8Array(qrPngBytes),
      pin: card.pin,
      issuer: manifest.provider,
      expires: card.expires.split('T')[0],
      locale,
      variant,
      signalContact: variant === 'robust' ? '+1-XXX-XXX-XXXX' : undefined,
      design,
      logoPngBytes,
      fontBytes,
    });

    const suffix = designName ? `-${designName}` : '';
    const outPath = resolve(batchDir, `${card.tokenPrefix}-invite-${locale}-${variant}${suffix}.pdf`);
    writeFileSync(outPath, pdfBytes);
    console.log(`Written: ${outPath} (${pdfBytes.length} bytes)`);
  } else {
    // Generate with dummy data
    const QRCode = (await import('qrcode')).default;
    const qrPng = await QRCode.toBuffer('https://example.com/invite#test', {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 512,
    });

    console.log('Generating test invite PDF with dummy data...');
    const pdfBytes = await generateInvitePdf({
      qrPngBytes: new Uint8Array(qrPng),
      pin: 'ABC123',
      issuer: 'demotruk',
      expires: '2027-03-08',
      locale,
      variant,
      signalContact: variant === 'robust' ? '+1-XXX-XXX-XXXX' : undefined,
      design,
      logoPngBytes,
      fontBytes,
    });

    const suffix = designName ? `-${designName}` : '';
    const outPath = resolve(import.meta.dirname, `test-invite-${locale}-${variant}${suffix}.pdf`);
    writeFileSync(outPath, pdfBytes);
    console.log(`Written: ${outPath} (${pdfBytes.length} bytes)`);
  }
}
