/**
 * Invite app flow controller.
 *
 * Sequential screen progression — the user moves forward through screens.
 * No hash-based routing (unlike the wallet). The fragment is consumed
 * on load and cleared immediately.
 */

import type { InviteState, ScreenName, ScreenFn } from './types';
import { LandingScreen } from './ui/screens/landing';
import { PinEntryScreen } from './ui/screens/pin-entry';
import { VerifyingScreen } from './ui/screens/verifying';
import { UsernameScreen } from './ui/screens/username';
import { KeyBackupScreen } from './ui/screens/key-backup';
import { ClaimingScreen } from './ui/screens/claiming';
import { SuccessScreen } from './ui/screens/success';

const SCREENS: Record<ScreenName, ScreenFn> = {
  landing: LandingScreen,
  pin: PinEntryScreen,
  verifying: VerifyingScreen,
  username: UsernameScreen,
  backup: KeyBackupScreen,
  claiming: ClaimingScreen,
  success: SuccessScreen,
};

export class InviteApp {
  private container: HTMLElement;
  state: InviteState;

  constructor(container: HTMLElement) {
    this.container = container;
    this.state = {
      encryptedBlob: null,
      pin: null,
      payload: null,
      masterPassword: null,
      username: null,
      keys: null,
      claimResult: null,
    };

    this.detectFragment();
  }

  private detectFragment(): void {
    const hash = window.location.hash.slice(1); // strip '#'
    if (hash) {
      this.state.encryptedBlob = hash;
      // Clear fragment from address bar immediately (security requirement)
      history.replaceState(null, '', window.location.pathname + window.location.search);
      this.showScreen('pin');
    } else {
      this.showScreen('landing');
    }
  }

  showScreen(name: ScreenName): void {
    this.container.innerHTML = '';
    const screen = SCREENS[name];
    if (screen) {
      screen(this.container, this.state, (next) => this.showScreen(next));
    }
  }
}
