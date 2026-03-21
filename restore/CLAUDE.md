# Backup Restore App

A lightweight single-page app for recovering Hive account keys from the encrypted QR backup generated during invite onboarding. Hosted on GitHub Pages.

## Flow

Three screens:
1. **Scan** — scan or upload encrypted backup QR code (via `jsqr`)
2. **PIN entry** — enter the 6-character PIN from the original gift card
3. **Result** — displays decrypted master password and derived keys with copy buttons

## Key Points

- Fully offline after initial load — all crypto bundled inline
- Single HTML file via `vite-plugin-singlefile`
- English only (no i18n currently)
- Separate from both the wallet and invite app — focused single purpose
- Does NOT need blockchain access — purely local decryption

## Build

```bash
npm run build    # single HTML output
npm run dev      # dev server
```

## Related

- `invite/` — generates the encrypted QR backups this app restores
- Requirements.md "Backup Restore App" in Future Considerations
