/**
 * Landing screen — shown when no URL fragment is present.
 * Explains what the app is and how to use it.
 */

import type { ScreenFn } from '../../types';
import { t } from '../locale';

export const LandingScreen: ScreenFn = (container) => {
  container.innerHTML = `<div class="ct center">
    <h1>${t.landing_title}</h1>
    <p class="mt mb">${t.landing_desc}</p>
    <div class="card">
      <p class="sm">${t.landing_no_card}</p>
    </div>
  </div>`;
};
