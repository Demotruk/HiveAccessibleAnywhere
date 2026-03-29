# Gift Card Design Templates

Each design is a folder containing a `design.ts` config file and optional assets.

## Quick Start

1. Copy `minimal/` as a starting point:
   ```bash
   cp -r scripts/designs/minimal scripts/designs/my-design
   ```

2. Edit `my-design/design.ts` to customize colors, text, layout, etc.

3. Optionally add assets to the folder:
   - `logo.png` — custom logo (referenced via `logo.src` in config)
   - `background.jpg` — background image (referenced via `background.src`)
   - `custom-font.ttf` — custom body font (referenced via `fonts.bodyFont`)

4. Generate cards with your design:
   ```bash
   npx tsx giftcard-generate.ts --count 10 --design my-design [other options]
   ```

## Folder Structure

```
scripts/designs/
  types.ts              — TypeScript interfaces (DesignConfig, etc.)
  loader.ts             — Design loader (used by generation scripts)
  hive/                 — Default Hive Community design
    design.ts
  minimal/              — Example: custom colors, no background
    design.ts
  my-design/            — Your custom design
    design.ts
    logo.png            — Optional custom logo
    background.jpg      — Optional background image
    my-font.ttf         — Optional custom font
```

## DesignConfig Reference

The `design.ts` file must export a `DesignConfig` object as its default export.

### Required Fields

- **`name`** — Human-readable design name
- **`colors`** — Color scheme (all fields required):
  - `primary` — Accent color for headings and highlights
  - `bodyText` — Main text color
  - `mutedText` — Secondary/muted text color
  - `pinBoxBackground` — PIN display box fill color
  - `pinBoxBorder` — PIN display box border color
  - `pinText` — PIN digit text color

Colors use `{ r, g, b }` format with values from 0 to 1 (not 0-255).

### Optional Fields

- **`dimensions`** — Card size as `[width, height]` in points. Default: A6 landscape `[419.53, 297.64]`. Common sizes:
  - A6 landscape: `[419.53, 297.64]`
  - A5 landscape: `[595.28, 419.53]`
  - Business card: `[252, 144]`

- **`logo`** — Logo on the front page:
  - `src` — Path to PNG image, relative to the design folder
  - `height` — Display height in points (width auto-calculated)
  - `position` — `'top-left'`, `'top-center'`, or `'top-right'`
  - `margin` — `{ x, y }` margin from page edges in points

- **`background`** — Background image:
  - `src` — Path to PNG/JPG, relative to design folder
  - `mode` — `'fill'` (cover + crop), `'fit'` (letterbox), `'stretch'`
  - `pages` — `'front'`, `'back'`, or `'both'`

- **`fonts`** — Typography:
  - `bodyFont` — Path to TTF/OTF, relative to design folder
  - `sizes` — Font size overrides: `{ heading, body, small, pinDisplay, flipHint }`

- **`text`** — Text overrides:
  - `localeOverrides` — Per-locale text overrides (partial `CardStrings`)

- **`layout`** — Layout tuning:
  - `qrSize` — QR code size in points (default: 170)
  - `logoQrGap` — Gap between logo and QR (default: 5)
  - `pageMarginX` — Horizontal page margin (default: 40)
  - `restoreQrSize` — Restore QR size (default: 60)
  - `pinBoxPadding` — `{ x, y }` padding inside PIN box (default: `{ x: 28, y: 14 }`)
  - `showToFrom` — Show To/From lines on back (default: true, always hidden for zh)

## Tips

- Test your design standalone: `npx tsx generate-invite-pdf.ts --design my-design`
- The PIN is always rendered in Helvetica Bold regardless of custom fonts
- Background images should be opaque and ideally match the card aspect ratio
- For CJK locales, provide a font that supports the characters (e.g. Noto Sans SC)
- Asset paths are relative to the design folder — use `../../path` to reference shared assets
