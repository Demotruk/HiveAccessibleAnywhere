/**
 * Invite app entry point.
 */

import './ui/styles.css';
import { InviteApp } from './app';
import { t } from './ui/locale';

// Set lang and dir on <html>
document.documentElement.lang = t.html_lang;
document.documentElement.dir = t.html_dir;
document.title = t.app_title;

const appEl = document.getElementById('app');
if (appEl) {
  const app = new InviteApp(appEl);
  // Expose for dev/testing
  (window as any).__inviteApp = app;
}
