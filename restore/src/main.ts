/**
 * Restore app entry point.
 */

import './ui/styles.css';
import { RestoreApp } from './app';

document.title = 'Propolis Backup Restore';

const appEl = document.getElementById('app');
if (appEl) {
  new RestoreApp(appEl);
}
