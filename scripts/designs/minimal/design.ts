import type { DesignConfig } from '../types.js';

/**
 * Minimal example design — demonstrates custom colors with no background
 * image and no logo (uses text fallback). Good starting point for new designs.
 */
const minimalDesign: DesignConfig = {
  name: 'Minimal',
  colors: {
    primary: { r: 0.2, g: 0.4, b: 0.8 },           // blue accent
    bodyText: { r: 0.2, g: 0.2, b: 0.2 },
    mutedText: { r: 0.4, g: 0.4, b: 0.4 },
    pinBoxBackground: { r: 0.95, g: 0.95, b: 1.0 },  // light blue tint
    pinBoxBorder: { r: 0.2, g: 0.4, b: 0.8 },        // match accent
    pinText: { r: 0.1, g: 0.1, b: 0.1 },
  },
  text: {
    localeOverrides: {
      en: {
        inviteLine1: 'Welcome! You\'ve been gifted a Hive account.',
        inviteLine2: 'Scan the QR code to get started.',
      },
    },
  },
};

export default minimalDesign;
