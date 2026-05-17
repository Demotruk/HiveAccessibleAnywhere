/**
 * Step progress indicator — shows current position in the onboarding flow.
 *
 * Displays numbered dots connected by lines. The current step is highlighted,
 * completed steps show a checkmark. Renders above screen content.
 *
 * The 5 user-facing steps map to screen names:
 *   1. PIN        → 'pin'
 *   2. Verifying  → 'verifying'
 *   3. Username   → 'username'
 *   4. Backup     → 'backup'
 *   5. Account    → 'claiming' | 'success'
 */

import type { ScreenName } from '../types';

/** Ordered steps in the onboarding flow. */
const STEPS = ['pin', 'verifying', 'username', 'backup', 'claiming'] as const;

/** Screen-to-step mapping. Profile/intro/success all map to the claiming step. */
function stepIndex(screen: ScreenName): number {
  if (screen === 'success' || screen === 'profile' || screen === 'intro') {
    return STEPS.indexOf('claiming');
  }
  return STEPS.indexOf(screen as (typeof STEPS)[number]);
}

/**
 * Render the progress bar into the given container.
 * Returns the element so `showScreen` can prepend it.
 */
export function renderProgressBar(screen: ScreenName): HTMLElement | null {
  const idx = stepIndex(screen);
  if (idx < 0) return null; // landing — no progress bar

  const bar = document.createElement('div');
  bar.className = 'step-bar';
  bar.setAttribute('aria-label', `Step ${idx + 1} of ${STEPS.length}`);

  for (let i = 0; i < STEPS.length; i++) {
    const isDone = i < idx || screen === 'success';
    const isActive = i === idx && screen !== 'success';

    // Dot
    const dot = document.createElement('div');
    dot.className = 'step-dot' + (isDone ? ' done' : isActive ? ' active' : '');
    dot.textContent = isDone ? '\u2713' : String(i + 1);
    dot.setAttribute('aria-current', isActive ? 'step' : 'false');

    // Wrap dot + line in a flex container
    const step = document.createElement('div');
    step.className = 'step';
    step.appendChild(dot);

    // Connecting line (not after last dot)
    if (i < STEPS.length - 1) {
      const line = document.createElement('div');
      line.className = 'step-line' + (isDone ? ' done' : '');
      step.appendChild(line);
    }

    bar.appendChild(step);
  }

  return bar;
}
