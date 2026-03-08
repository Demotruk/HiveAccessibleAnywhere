/**
 * Generate printable A6 postcard PDFs for gift card invite tokens.
 *
 * Each card produces a 2-page A6 landscape PDF:
 *   Page 1 (front): Hive logo, large QR code (hero element), invitation text
 *   Page 2 (back):  "From:" line, PIN display, instruction text
 *
 * Uses pdf-lib to build PDFs from scratch — no template file required.
 * The Hive logo is embedded from a PNG asset for crisp, correct rendering.
 *
 * Usage (standalone test):
 *   npx tsx generate-invite-pdf.ts
 *
 * Programmatic:
 *   import { generateInvitePdf } from './generate-invite-pdf.js';
 *   const pdfBytes = await generateInvitePdf({ qrPngBytes, pin, issuer, logoPngBytes });
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// A6 landscape in points (148mm × 105mm)
const A6_WIDTH = 419.53;
const A6_HEIGHT = 297.64;

// Hive brand red
const HIVE_RED = rgb(0.898, 0.133, 0.157); // #E5222A approx

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
}

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
 * Page 2 layout (back):
 *   ┌─────────────────────────────────┐
 *   │  From: ________________________ │
 *   │                                 │
 *   │                                 │
 *   │       Your Invite PIN           │
 *   │                                 │
 *   │      ┌──────────────┐           │
 *   │      │   ABC123     │           │
 *   │      └──────────────┘           │
 *   │                                 │
 *   │  Enter this PIN when prompted   │
 *   │  after scanning the QR code.    │
 *   │                                 │
 *   └─────────────────────────────────┘
 */
export async function generateInvitePdf(options: InviteCardOptions): Promise<Uint8Array> {
  const { qrPngBytes, pin, issuer, expires, logoPngBytes } = options;

  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
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
  // The QR code is the most important element — make it large for reliable scanning
  const qrSize = 170;
  const qrX = centerX - qrSize / 2;
  // Position QR below logo with a small gap
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

  const line1 = 'Your invitation to the Hive Community.';
  const line2 = 'Scan the QR code to receive your free account.';

  const line1Width = helvetica.widthOfTextAtSize(line1, textFontSize);
  const line2Width = helvetica.widthOfTextAtSize(line2, textFontSize);

  front.drawText(line1, {
    x: centerX - line1Width / 2,
    y: textStartY,
    size: textFontSize,
    font: helvetica,
    color: rgb(0.15, 0.15, 0.15),
  });

  front.drawText(line2, {
    x: centerX - line2Width / 2,
    y: textStartY - 14,
    size: textFontSize,
    font: helvetica,
    color: rgb(0.15, 0.15, 0.15),
  });

  // Issuer + expiry on one line at the bottom
  const issuerText = `Issued by: @${issuer}`;
  const expiryText = expires ? `  ·  Expires: ${expires}` : '';
  const bottomLine = issuerText + expiryText;
  const bottomLineWidth = helveticaBold.widthOfTextAtSize(bottomLine, smallFontSize);

  front.drawText(bottomLine, {
    x: centerX - bottomLineWidth / 2,
    y: textStartY - 32,
    size: smallFontSize,
    font: helveticaBold,
    color: rgb(0.35, 0.35, 0.35),
  });

  // ---- Page 2: Back ----
  const back = doc.addPage([A6_WIDTH, A6_HEIGHT]);

  // -- "From:" line at top (for handwritten personal note) --
  const fromY = A6_HEIGHT - 50;
  back.drawText('From:', {
    x: 40,
    y: fromY,
    size: 12,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });
  // Underline for handwriting
  back.drawLine({
    start: { x: 82, y: fromY - 2 },
    end: { x: 280, y: fromY - 2 },
    thickness: 0.5,
    color: rgb(0.4, 0.4, 0.4),
  });

  // -- "Your Invite PIN" heading (vertically centered area) --
  const pinSectionCenterY = A6_HEIGHT / 2 + 10;
  const pinHeading = 'Your Invite PIN';
  const pinHeadingFontSize = 20;
  const pinHeadingWidth = helveticaBold.widthOfTextAtSize(pinHeading, pinHeadingFontSize);

  // Heading positioned above center
  const pinHeadingY = pinSectionCenterY + 30;
  back.drawText(pinHeading, {
    x: centerX - pinHeadingWidth / 2,
    y: pinHeadingY,
    size: pinHeadingFontSize,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // -- PIN box (below heading with clear separation) --
  const pinFontSize = 30;
  const pinWidth = helveticaBold.widthOfTextAtSize(pin, pinFontSize);
  const boxPadX = 28;
  const boxPadY = 14;
  const boxW = pinWidth + boxPadX * 2;
  const boxH = pinFontSize + boxPadY * 2;
  const boxX = centerX - boxW / 2;
  // Leave 20pt gap between heading baseline and box top
  const boxY = pinHeadingY - 20 - boxH;

  // Box with light background and border
  back.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 1.5,
    color: rgb(0.97, 0.97, 0.97),
  });

  // PIN text centered in box
  back.drawText(pin, {
    x: centerX - pinWidth / 2,
    y: boxY + boxPadY,
    size: pinFontSize,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // -- Instruction text (below PIN box) --
  const instructionY = boxY - 25;
  const instruction = 'Enter this PIN when prompted after scanning the QR code on the front.';
  const instrMaxWidth = A6_WIDTH - 80;

  const instrLines = wrapText(instruction, helvetica, 10, instrMaxWidth);
  for (let i = 0; i < instrLines.length; i++) {
    const lineWidth = helvetica.widthOfTextAtSize(instrLines[i], 10);
    back.drawText(instrLines[i], {
      x: centerX - lineWidth / 2,
      y: instructionY - i * 14,
      size: 10,
      font: helvetica,
      color: rgb(0.35, 0.35, 0.35),
    });
  }

  return doc.save();
}

// -- Standalone test --
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('generate-invite-pdf.ts')) {
  const { readFileSync, writeFileSync, existsSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  // Load Hive logo
  const logoPath = resolve(import.meta.dirname, '..', 'hive-branding', 'logo', 'png', 'logo_transparent@2.png');
  let logoPngBytes: Uint8Array | undefined;
  if (existsSync(logoPath)) {
    logoPngBytes = new Uint8Array(readFileSync(logoPath));
    console.log(`Loaded Hive logo: ${logoPath}`);
  } else {
    console.warn('Hive logo not found — will use text fallback');
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

    console.log('Generating test invite PDF...');
    const pdfBytes = await generateInvitePdf({
      qrPngBytes: new Uint8Array(qrPngBytes),
      pin: card.pin,
      issuer: manifest.provider,
      expires: card.expires.split('T')[0],
      logoPngBytes,
    });

    const outPath = resolve(batchDir, `${card.tokenPrefix}-invite.pdf`);
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
    });

    const outPath = resolve(import.meta.dirname, 'test-invite.pdf');
    writeFileSync(outPath, pdfBytes);
    console.log(`Written: ${outPath} (${pdfBytes.length} bytes)`);
  }
}
