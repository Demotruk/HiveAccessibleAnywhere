/**
 * Generate printable postcard PDFs for gift card invite tokens.
 *
 * Extracted from scripts/generate-invite-pdf.ts for use by the giftcard service.
 * The CLI script retains its own copy — both are kept in sync manually.
 *
 * Each card produces a 2-page landscape PDF:
 *   Page 1 (front): Logo, large QR code (hero element), invitation text
 *   Page 2 (back):  "To:"/"From:" lines, PIN display, instruction text
 */

import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import type { CardStrings, ResolvedDesign, RgbColor } from './design-types.js';

const DEFAULT_RESTORE_URL = 'https://hiveinvite.com/restore/';

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 419.53;
const DEFAULT_HEIGHT = 297.64;

const DEFAULT_PRIMARY: RgbColor = { r: 0.898, g: 0.133, b: 0.157 };
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
  qrPngBytes: Uint8Array;
  pin: string;
  issuer: string;
  expires?: string;
  locale?: string;
  variant?: 'standard' | 'robust';
  signalContact?: string;
  design?: ResolvedDesign;
  /** Base URL for the restore app (defaults to https://hiveinvite.com/restore/) */
  restoreUrl?: string;
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
// Render context
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
  primaryColor: RgbColor;
  bodyTextColor: RgbColor;
  mutedTextColor: RgbColor;
  pinBoxBgColor: RgbColor;
  pinBoxBorderColor: RgbColor;
  pinTextColor: RgbColor;
  logoHeight: number;
  logoPosition: 'top-left' | 'top-center' | 'top-right';
  logoMarginX: number;
  logoMarginY: number;
  qrSize: number;
  logoQrGap: number;
  pageMarginX: number;
  restoreQrSize: number;
  pinBoxPadX: number;
  pinBoxPadY: number;
  showToFrom: boolean;
  headingSize: number;
  bodySize: number;
  smallSize: number;
  pinDisplaySize: number;
  flipHintSize: number;
}

// ---------------------------------------------------------------------------
// Front page
// ---------------------------------------------------------------------------

async function renderFrontPage(
  ctx: RenderContext,
  front: PDFPage,
  qrImage: PDFImage,
  logoImage: PDFImage | undefined,
  options: { issuer: string; expires?: string },
): Promise<void> {
  const { pageWidth, pageHeight, boldFont, textFont, strings, locale } = ctx;
  const centerX = pageWidth / 2;

  let logoBottomY = pageHeight - 20;
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
      x: logoX, y: logoY,
      width: logoDisplayWidth, height: logoDisplayHeight,
    });
    logoBottomY = logoY;
  } else {
    front.drawText('HIVE', {
      x: 25, y: pageHeight - 40,
      size: 22, font: ctx.helveticaBold, color: c(ctx.primaryColor),
    });
    logoBottomY = pageHeight - 45;
  }

  const qrX = centerX - ctx.qrSize / 2;
  const qrTopY = logoBottomY - ctx.logoQrGap;
  const qrY = qrTopY - ctx.qrSize;
  front.drawImage(qrImage, {
    x: qrX, y: qrY, width: ctx.qrSize, height: ctx.qrSize,
  });

  const textStartY = qrY - 10;
  drawCentered(front, strings.inviteLine1, textStartY, textFont, ctx.bodySize, c(ctx.bodyTextColor), pageWidth);
  drawCentered(front, strings.inviteLine2, textStartY - 14, textFont, ctx.bodySize, c(ctx.bodyTextColor), pageWidth);

  const issuerText = strings.issuedBy(options.issuer);
  const expiryText = options.expires ? `  \u00b7  ${strings.expires(options.expires)}` : '';
  drawCentered(front, issuerText + expiryText, textStartY - 32, boldFont, ctx.smallSize, c(ctx.mutedTextColor), pageWidth);

  const flipHint = strings.flipHint;
  const hintSize = locale === 'zh' ? 11 : ctx.flipHintSize;
  const hintColor = locale === 'zh' ? c(ctx.primaryColor) : c(ctx.bodyTextColor);
  const flipHintWidth = boldFont.widthOfTextAtSize(flipHint, hintSize);
  front.drawText(flipHint, {
    x: pageWidth - flipHintWidth - 18, y: pageHeight - 20,
    size: hintSize, font: boldFont, color: hintColor,
  });
}

// ---------------------------------------------------------------------------
// Back page
// ---------------------------------------------------------------------------

async function renderBackPage(
  ctx: RenderContext,
  back: PDFPage,
  options: { pin: string; variant: string; signalContact?: string; restoreUrl?: string },
): Promise<void> {
  const { pageWidth, pageHeight, textFont, boldFont, strings, locale } = ctx;
  const centerX = pageWidth / 2;
  const isRobust = options.variant === 'robust';

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
      x: ctx.pageMarginX, y: toY, size: labelSize, font: textFont, color: labelColor,
    });
    back.drawLine({
      start: { x: labelIndent, y: toY - 2 }, end: { x: lineEndX, y: toY - 2 },
      thickness: 0.5, color: lineColor,
    });

    const fromY = toY - 28;
    back.drawText(fromLabel, {
      x: ctx.pageMarginX, y: fromY, size: labelSize, font: textFont, color: labelColor,
    });
    back.drawLine({
      start: { x: labelIndent, y: fromY - 2 }, end: { x: lineEndX, y: fromY - 2 },
      thickness: 0.5, color: lineColor,
    });

    backContentTopY = fromY - 35;
  } else {
    backContentTopY = 0;
  }

  const pinHeading = strings.pinHeading;
  const pinFont = ctx.helveticaBold;
  const pinFontSize = ctx.pinDisplaySize;
  const pinWidth = pinFont.widthOfTextAtSize(options.pin, pinFontSize);
  const boxPadX = ctx.pinBoxPadX;
  const boxPadY = ctx.pinBoxPadY;
  const boxW = pinWidth + boxPadX * 2;
  const boxH = pinFontSize + boxPadY * 2;

  if (locale === 'zh' || !ctx.showToFrom) {
    if (backContentTopY === 0) {
      const usableTop = pageHeight - 20;
      const usableBottom = 90;
      const usableCenterY = usableBottom + (usableTop - usableBottom) / 2;
      const boxBottomY = usableCenterY - boxH / 2;
      backContentTopY = boxBottomY + boxH + 18;
    }
  }

  const pinHeadingY = backContentTopY;
  drawCentered(back, pinHeading, pinHeadingY, boldFont, ctx.headingSize, c(ctx.pinTextColor), pageWidth);

  const boxX = centerX - boxW / 2;
  const boxY = pinHeadingY - 18 - boxH;

  back.drawRectangle({
    x: boxX, y: boxY, width: boxW, height: boxH,
    borderColor: c(ctx.pinBoxBorderColor), borderWidth: 1.5, color: c(ctx.pinBoxBgColor),
  });

  back.drawText(options.pin, {
    x: centerX - pinWidth / 2, y: boxY + boxPadY,
    size: pinFontSize, font: pinFont, color: c(ctx.pinTextColor),
  });

  const instructionY = boxY - 18;
  const instrMaxWidth = pageWidth - 80;
  const instrLines = wrapText(strings.pinInstruction, textFont, ctx.bodySize, instrMaxWidth);
  for (let i = 0; i < instrLines.length; i++) {
    drawCentered(back, instrLines[i], instructionY - i * 14, textFont, ctx.bodySize, c(ctx.mutedTextColor), pageWidth);
  }

  let noticeBottomY = instructionY - instrLines.length * 14;
  if (isRobust) {
    noticeBottomY -= 4;
    drawCentered(back, strings.pinNotice, noticeBottomY, textFont, 8, rgb(0.5, 0.5, 0.5), pageWidth);
    noticeBottomY -= 12;
  }

  const restoreQrPng = await QRCode.toBuffer(options.restoreUrl || DEFAULT_RESTORE_URL, {
    errorCorrectionLevel: 'M', margin: 1, width: 256,
  });
  const restoreQrImage = await ctx.doc.embedPng(new Uint8Array(restoreQrPng));

  const restoreQrX = ctx.pageMarginX;
  const restoreQrY = 18;

  back.drawImage(restoreQrImage, {
    x: restoreQrX, y: restoreQrY,
    width: ctx.restoreQrSize, height: ctx.restoreQrSize,
  });

  const restoreLabelX = restoreQrX + ctx.restoreQrSize + 10;
  const restoreLabelY = restoreQrY + ctx.restoreQrSize - 12;

  back.drawText(strings.restoreHeading, {
    x: restoreLabelX, y: restoreLabelY,
    size: ctx.smallSize, font: boldFont, color: rgb(0.2, 0.2, 0.2),
  });

  const restoreBodyLines = wrapText(strings.restoreBody, textFont, 8, 140);
  for (let i = 0; i < restoreBodyLines.length; i++) {
    back.drawText(restoreBodyLines[i], {
      x: restoreLabelX, y: restoreLabelY - 13 - i * 10,
      size: 8, font: textFont, color: rgb(0.4, 0.4, 0.4),
    });
  }

  if (isRobust && options.signalContact) {
    const signalX = pageWidth - 160;
    const signalY = restoreQrY + ctx.restoreQrSize - 12;
    back.drawText(strings.signalPrompt, {
      x: signalX, y: signalY, size: 8, font: textFont, color: rgb(0.2, 0.2, 0.2),
    });
    back.drawText(options.signalContact, {
      x: signalX, y: signalY - 12,
      size: ctx.smallSize, font: ctx.helveticaBold, color: c(ctx.bodyTextColor),
    });
  }
}

// ---------------------------------------------------------------------------
// Main PDF generator
// ---------------------------------------------------------------------------

export async function generateInvitePdf(options: InviteCardOptions): Promise<Uint8Array> {
  const {
    qrPngBytes, pin, issuer, expires,
    locale = 'en', variant = 'standard', signalContact, design,
  } = options;

  const logoPngBytes = design?.logoPngBytes;
  const fontBytes = design?.fontBytes;
  const backgroundBytes = design?.backgroundBytes;
  const cfg = design?.config;

  let strings = LOCALE_STRINGS[locale] ?? STRINGS_EN;
  if (cfg?.text?.localeOverrides?.[locale]) {
    strings = { ...strings, ...cfg.text.localeOverrides[locale] };
  }

  const pageWidth = cfg?.dimensions?.[0] ?? DEFAULT_WIDTH;
  const pageHeight = cfg?.dimensions?.[1] ?? DEFAULT_HEIGHT;

  const headingSize = cfg?.fonts?.sizes?.heading ?? 20;
  const bodySize = cfg?.fonts?.sizes?.body ?? 10;
  const smallSize = cfg?.fonts?.sizes?.small ?? 9;
  const pinDisplaySize = cfg?.fonts?.sizes?.pinDisplay ?? 30;
  const flipHintSize = cfg?.fonts?.sizes?.flipHint ?? 8.5;

  const qrSize = cfg?.layout?.qrSize ?? 170;
  const logoQrGap = cfg?.layout?.logoQrGap ?? 5;
  const pageMarginX = cfg?.layout?.pageMarginX ?? 40;
  const restoreQrSize = cfg?.layout?.restoreQrSize ?? 60;
  const pinBoxPadX = cfg?.layout?.pinBoxPadding?.x ?? 28;
  const pinBoxPadY = cfg?.layout?.pinBoxPadding?.y ?? 14;
  const showToFrom = cfg?.layout?.showToFrom ?? true;

  const primaryColor = cfg?.colors.primary ?? DEFAULT_PRIMARY;
  const bodyTextColor = cfg?.colors.bodyText ?? DEFAULT_BODY_TEXT;
  const mutedTextColor = cfg?.colors.mutedText ?? DEFAULT_MUTED_TEXT;
  const pinBoxBgColor = cfg?.colors.pinBoxBackground ?? DEFAULT_PIN_BOX_BG;
  const pinBoxBorderColor = cfg?.colors.pinBoxBorder ?? DEFAULT_PIN_BOX_BORDER;
  const pinTextColor = cfg?.colors.pinText ?? DEFAULT_PIN_TEXT;

  const doc = await PDFDocument.create();
  if (fontBytes) doc.registerFontkit(fontkit);

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let cjkFont: PDFFont | undefined;
  if (fontBytes) cjkFont = await doc.embedFont(fontBytes);

  const textFont = cjkFont ?? helvetica;
  const boldFont = cjkFont ?? helveticaBold;

  const qrImage = await doc.embedPng(qrPngBytes);
  let logoImage: PDFImage | undefined;
  if (logoPngBytes) logoImage = await doc.embedPng(logoPngBytes);

  const ctx: RenderContext = {
    doc, pageWidth, pageHeight, textFont, boldFont, helveticaBold,
    strings, locale,
    primaryColor, bodyTextColor, mutedTextColor,
    pinBoxBgColor, pinBoxBorderColor, pinTextColor,
    logoHeight: cfg?.logo?.height ?? 35,
    logoPosition: cfg?.logo?.position ?? 'top-left',
    logoMarginX: cfg?.logo?.margin?.x ?? 22,
    logoMarginY: cfg?.logo?.margin?.y ?? 12,
    qrSize, logoQrGap, pageMarginX, restoreQrSize,
    pinBoxPadX, pinBoxPadY, showToFrom,
    headingSize, bodySize, smallSize, pinDisplaySize, flipHintSize,
  };

  const front = doc.addPage([pageWidth, pageHeight]);
  const bgConfig = cfg?.background;
  if (backgroundBytes && bgConfig) {
    if (bgConfig.pages === 'front' || bgConfig.pages === 'both') {
      await drawBackground(doc, front, backgroundBytes, bgConfig.mode, pageWidth, pageHeight);
    }
  }
  if (!backgroundBytes && cfg?.colors.pageBackground) {
    front.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: c(cfg.colors.pageBackground) });
  }
  await renderFrontPage(ctx, front, qrImage, logoImage, { issuer, expires });

  const back = doc.addPage([pageWidth, pageHeight]);
  if (backgroundBytes && bgConfig) {
    if (bgConfig.pages === 'back' || bgConfig.pages === 'both') {
      await drawBackground(doc, back, backgroundBytes, bgConfig.mode, pageWidth, pageHeight);
    }
  }
  if (!backgroundBytes && cfg?.colors.pageBackground) {
    back.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: c(cfg.colors.pageBackground) });
  }
  await renderBackPage(ctx, back, { pin, variant, signalContact, restoreUrl: options.restoreUrl });

  return doc.save();
}
