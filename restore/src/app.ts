/**
 * Restore app flow controller.
 *
 * Simple three-screen flow: scan → pin → result.
 */

import type { RestoreState, ScreenName, ScreenFn } from './types';
import { ScanScreen } from './ui/screens/scan';
import { PinEntryScreen } from './ui/screens/pin-entry';
import { ResultScreen } from './ui/screens/result';

const SCREENS: Record<ScreenName, ScreenFn> = {
  scan: ScanScreen,
  pin: PinEntryScreen,
  result: ResultScreen,
};

export class RestoreApp {
  private container: HTMLElement;
  state: RestoreState;

  constructor(container: HTMLElement) {
    this.container = container;
    this.state = {
      encryptedData: null,
      backupData: null,
      keys: null,
    };
    this.showScreen('scan');
  }

  showScreen(name: ScreenName): void {
    this.container.innerHTML = '';
    const screen = SCREENS[name];
    if (screen) {
      screen(this.container, this.state, (next) => this.showScreen(next));
    }
  }
}
