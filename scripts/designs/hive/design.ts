import type { DesignConfig } from '../types.js';

const hiveDesign: DesignConfig = {
  name: 'Hive Community',
  // A6 landscape: 148mm x 105mm
  dimensions: [419.53, 297.64],
  colors: {
    primary: { r: 0.898, g: 0.133, b: 0.157 },      // #E5222A Hive red
    bodyText: { r: 0.15, g: 0.15, b: 0.15 },
    mutedText: { r: 0.35, g: 0.35, b: 0.35 },
    pinBoxBackground: { r: 0.97, g: 0.97, b: 0.97 },
    pinBoxBorder: { r: 0.3, g: 0.3, b: 0.3 },
    pinText: { r: 0.1, g: 0.1, b: 0.1 },
  },
  logo: {
    src: '../../../hive-branding/logo/png/logo_transparent@2.png',
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

export default hiveDesign;
