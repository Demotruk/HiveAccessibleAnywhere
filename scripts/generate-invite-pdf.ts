/**
 * Generate printable A6 postcard PDFs for gift card invite tokens.
 *
 * Each card produces a 2-page A6 landscape PDF:
 *   Page 1 (front): Hive logo, large QR code (hero element), invitation text
 *   Page 2 (back):  "To:"/"From:" lines, PIN display, instruction text
 *
 * Supports localized text (en, zh) and robust invite variant extras
 * (PIN confidentiality notice, Signal support contact).
 *
 * Uses pdf-lib to build PDFs from scratch — no template file required.
 * The Hive logo is embedded from a PNG asset for crisp, correct rendering.
 *
 * CJK locales (zh) require a font file — pass fontBytes (e.g. Noto Sans SC)
 * for Chinese character rendering. Without it, Chinese text will show as tofu.
 *
 * Usage (standalone test):
 *   npx tsx generate-invite-pdf.ts
 *   npx tsx generate-invite-pdf.ts --locale zh --variant robust
 *
 * Programmatic:
 *   import { generateInvitePdf } from './generate-invite-pdf.js';
 *   const pdfBytes = await generateInvitePdf({ qrPngBytes, pin, issuer, logoPngBytes });
 */

import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';

const RESTORE_URL = 'https://demotruk.github.io/HiveAccessibleAnywhere/restore/';

// A6 landscape in points (148mm × 105mm)
const A6_WIDTH = 419.53;
const A6_HEIGHT = 297.64;

// Hive brand red
const HIVE_RED = rgb(0.898, 0.133, 0.157); // #E5222A approx

// ---------------------------------------------------------------------------
// Locale text maps
// ---------------------------------------------------------------------------

interface CardStrings {
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

const LOCALE_STRINGS: Record<string, CardStrings> = {
  en: STRINGS_EN,
  zh: STRINGS_ZH,
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
  /** Hive logo as PNG bytes (loaded once, passed per card for efficiency) */
  logoPngBytes?: Uint8Array;
  /** Locale code — determines card text language (default: 'en') */
  locale?: string;
  /** Card variant — 'robust' adds PIN notice and Signal contact (default: 'standard') */
  variant?: 'standard' | 'robust';
  /** Signal contact number or signal.me link (robust variant only) */
  signalContact?: string;
  /** Custom font bytes for CJK support (e.g. Noto Sans SC .ttf) */
  fontBytes?: Uint8Array;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple word-wrap helper: splits text into lines that fit within maxWidth.
 */
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

/**
 * Draw centered text helper — returns the Y position after drawing.
 */
function drawCentered(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
): number {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: A6_WIDTH / 2 - w / 2,
    y,
    size,
    font,
    color,
  });
  return y;
}

// ---------------------------------------------------------------------------
// Main PDF generator
// ---------------------------------------------------------------------------

/**
 * Generate a printable A6 postcard PDF for a single invite card.
 *
 * Page 1 layout (front):
 *   ┌─────────────────────────────────┐
 *   │  [Hive Logo]                    │
 *   │                                 │
 *   │        ┌──────────────┐         │
 *   │        │              │         │
 *   │        │   QR CODE    │         │
 *   │        │   (large)    │         │
 *   │        │              │         │
 *   │        └──────────────┘         │
 *   │                                 │
 *   │  Your invitation to Hive.       │
 *   │  Scan the QR code to begin.     │
 *   │  Issued by: @issuer             │
 *   │                  Expires: date  │
 *   └─────────────────────────────────┘
 *
 * Page 2 layout (back — robust variant shown):
 *   ┌─────────────────────────────────┐
 *   │  To:   ________________________ │
 *   │  From: ________________________ │
 *   │                                 │
 *   │       Your Invite PIN           │
 *   │      ┌──────────────┐           │
 *   │      │   ABC123     │           │
 *   │      └──────────────┘           │
 *   │  Enter this PIN when prompted   │
 *   │  after scanning the QR code.    │
 *   │  (PIN confidentiality notice)   │
 *   │                                 │
 *   │  ┌─────┐ Restore backup  Signal │
 *   │  │ QR  │ Scan to recover +1-XXX │
 *   │  └─────┘ keys from backup       │
 *   └─────────────────────────────────┘
 */
export async function generateInvitePdf(options: InviteCardOptions): Promise<Uint8Array> {
  const {
    qrPngBytes, pin, issuer, expires, logoPngBytes,
    locale = 'en',
    variant = 'standard',
    signalContact,
    fontBytes,
  } = options;

  const strings = LOCALE_STRINGS[locale] ?? STRINGS_EN;
  const isRobust = variant === 'robust';

  const doc = await PDFDocument.create();

  // Register fontkit for custom font embedding (required by pdf-lib)
  if (fontBytes) {
    doc.registerFontkit(fontkit);
  }

  // Embed fonts — use custom font for CJK, Helvetica as fallback / for Latin text
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let cjkFont: PDFFont | undefined;
  if (fontBytes) {
    cjkFont = await doc.embedFont(fontBytes);
  }

  // Choose fonts: CJK font for localized text, Helvetica for PIN/numbers
  const textFont = cjkFont ?? helvetica;
  const boldFont = cjkFont ?? helveticaBold;
  // PIN is always alphanumeric — Helvetica Bold is best for readability
  const pinFont = helveticaBold;

  const qrImage = await doc.embedPng(qrPngBytes);
  const centerX = A6_WIDTH / 2;

  // ---- Page 1: Front ----
  const front = doc.addPage([A6_WIDTH, A6_HEIGHT]);

  // -- Hive logo (top-left) --
  let logoBottomY = A6_HEIGHT - 20; // fallback if no logo
  if (logoPngBytes) {
    const logoImage = await doc.embedPng(logoPngBytes);
    const logoDisplayHeight = 35;
    const logoAspect = logoImage.width / logoImage.height;
    const logoDisplayWidth = logoDisplayHeight * logoAspect;
    const logoX = 22;
    const logoY = A6_HEIGHT - 12 - logoDisplayHeight;
    front.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoDisplayWidth,
      height: logoDisplayHeight,
    });
    logoBottomY = logoY;
  } else {
    // Fallback: draw "HIVE" text in brand red
    front.drawText('HIVE', {
      x: 25,
      y: A6_HEIGHT - 40,
      size: 22,
      font: helveticaBold,
      color: HIVE_RED,
    });
    logoBottomY = A6_HEIGHT - 45;
  }

  // -- QR code (large, centered, hero element) --
  const qrSize = 170;
  const qrX = centerX - qrSize / 2;
  const qrTopY = logoBottomY - 5;
  const qrY = qrTopY - qrSize;
  front.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // -- Invitation text (below QR) --
  const textStartY = qrY - 10;
  const textFontSize = 10;
  const smallFontSize = 9;

  drawCentered(front, strings.inviteLine1, textStartY, textFont, textFontSize, rgb(0.15, 0.15, 0.15));
  drawCentered(front, strings.inviteLine2, textStartY - 14, textFont, textFontSize, rgb(0.15, 0.15, 0.15));

  // Issuer + expiry on one line at the bottom
  const issuerText = strings.issuedBy(issuer);
  const expiryText = expires ? `  \u00b7  ${strings.expires(expires)}` : '';
  const bottomLine = issuerText + expiryText;
  drawCentered(front, bottomLine, textStartY - 32, boldFont, smallFontSize, rgb(0.35, 0.35, 0.35));

  // -- "See PIN on back" hint (top-right corner) --
  // More prominent for CJK locales where the hint competes with denser text
  const flipHint = strings.flipHint;
  const flipHintSize = locale === 'zh' ? 11 : 8.5;
  const flipHintColor = locale === 'zh' ? HIVE_RED : rgb(0.15, 0.15, 0.15);
  const flipHintWidth = boldFont.widthOfTextAtSize(flipHint, flipHintSize);
  front.drawText(flipHint, {
    x: A6_WIDTH - flipHintWidth - 18,
    y: A6_HEIGHT - 20,
    size: flipHintSize,
    font: boldFont,
    color: flipHintColor,
  });

  // ---- Page 2: Back ----
  const back = doc.addPage([A6_WIDTH, A6_HEIGHT]);

  // -- "To:" and "From:" lines at top (skipped for zh — confusing noise per feedback) --
  let backContentTopY: number;

  if (locale !== 'zh') {
    const labelColor = rgb(0.2, 0.2, 0.2);
    const lineColor = rgb(0.4, 0.4, 0.4);
    const labelSize = 12;

    const toLabel = strings.to;
    const fromLabel = strings.from;
    const toLabelWidth = textFont.widthOfTextAtSize(toLabel, labelSize);
    const fromLabelWidth = textFont.widthOfTextAtSize(fromLabel, labelSize);
    const labelIndent = Math.max(toLabelWidth, fromLabelWidth) + 50;
    const lineEndX = 280;

    const toY = A6_HEIGHT - 40;
    back.drawText(toLabel, {
      x: 40,
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
      x: 40,
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
  const pinHeadingFontSize = 20;
  const pinFontSize = 30;
  const pinWidth = pinFont.widthOfTextAtSize(pin, pinFontSize);
  const boxPadX = 28;
  const boxPadY = 14;
  const boxW = pinWidth + boxPadX * 2;
  const boxH = pinFontSize + boxPadY * 2;

  // For zh (no To/From), vertically center the PIN box in the usable area.
  // Heading goes above the box, instruction below — the box is the visual anchor.
  if (locale === 'zh') {
    const usableTop = A6_HEIGHT - 20;
    const usableBottom = 90; // above restore QR
    const usableCenterY = usableBottom + (usableTop - usableBottom) / 2;
    // Center the box, then place heading above it
    const boxBottomY = usableCenterY - boxH / 2;
    backContentTopY = boxBottomY + boxH + 18; // heading sits 18pt above box top
  }

  const pinHeadingY = backContentTopY;
  drawCentered(back, pinHeading, pinHeadingY, boldFont, pinHeadingFontSize, rgb(0.1, 0.1, 0.1));

  // -- PIN box --
  const boxX = centerX - boxW / 2;
  const boxY = pinHeadingY - 18 - boxH;

  back.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 1.5,
    color: rgb(0.97, 0.97, 0.97),
  });

  back.drawText(pin, {
    x: centerX - pinWidth / 2,
    y: boxY + boxPadY,
    size: pinFontSize,
    font: pinFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  // -- PIN instruction text --
  const instructionY = boxY - 18;
  const instrMaxWidth = A6_WIDTH - 80;
  const instrLines = wrapText(strings.pinInstruction, textFont, 10, instrMaxWidth);
  for (let i = 0; i < instrLines.length; i++) {
    drawCentered(back, instrLines[i], instructionY - i * 14, textFont, 10, rgb(0.35, 0.35, 0.35));
  }

  // -- Robust-only: PIN confidentiality notice --
  let noticeBottomY = instructionY - instrLines.length * 14;
  if (isRobust) {
    noticeBottomY -= 4;
    drawCentered(back, strings.pinNotice, noticeBottomY, textFont, 8, rgb(0.5, 0.5, 0.5));
    noticeBottomY -= 12;
  }

  // -- Restore backup QR code (bottom-left) --
  const restoreQrPng = await QRCode.toBuffer(RESTORE_URL, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
  const restoreQrImage = await doc.embedPng(new Uint8Array(restoreQrPng));

  const restoreQrSize = 60;
  const restoreQrX = 40;
  const restoreQrY = 18;

  back.drawImage(restoreQrImage, {
    x: restoreQrX,
    y: restoreQrY,
    width: restoreQrSize,
    height: restoreQrSize,
  });

  // Label text next to the restore QR
  const restoreLabelX = restoreQrX + restoreQrSize + 10;
  const restoreLabelY = restoreQrY + restoreQrSize - 12;
  const restoreLabelSize = 9;

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
  if (isRobust && signalContact) {
    const signalX = A6_WIDTH - 160;
    const signalY = restoreQrY + restoreQrSize - 12;

    back.drawText(strings.signalPrompt, {
      x: signalX,
      y: signalY,
      size: 8,
      font: textFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    back.drawText(signalContact, {
      x: signalX,
      y: signalY - 12,
      size: 9,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15),
    });
  }

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

  console.log(`Generating test card: locale=${locale}, variant=${variant}`);

  // Load Hive logo
  const logoPath = resolve(import.meta.dirname, '..', 'hive-branding', 'logo', 'png', 'logo_transparent@2.png');
  let logoPngBytes: Uint8Array | undefined;
  if (existsSync(logoPath)) {
    logoPngBytes = new Uint8Array(readFileSync(logoPath));
    console.log(`Loaded Hive logo: ${logoPath}`);
  } else {
    console.warn('Hive logo not found — will use text fallback');
  }

  // Load CJK font if needed
  let fontBytes: Uint8Array | undefined;
  if (locale === 'zh') {
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
      logoPngBytes,
      locale,
      variant,
      signalContact: variant === 'robust' ? '+1-XXX-XXX-XXXX' : undefined,
      fontBytes,
    });

    const outPath = resolve(batchDir, `${card.tokenPrefix}-invite-${locale}-${variant}.pdf`);
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
      logoPngBytes,
      locale,
      variant,
      signalContact: variant === 'robust' ? '+1-XXX-XXX-XXXX' : undefined,
      fontBytes,
    });

    const outPath = resolve(import.meta.dirname, `test-invite-${locale}-${variant}.pdf`);
    writeFileSync(outPath, pdfBytes);
    console.log(`Written: ${outPath} (${pdfBytes.length} bytes)`);
  }
}
