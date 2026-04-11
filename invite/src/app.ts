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
import { ProfileSetupScreen } from './ui/screens/profile-setup';
import { IntroPostScreen } from './ui/screens/intro-post';
import { SuccessScreen } from './ui/screens/success';
import { SuccessRobustScreen } from './ui/screens/success-robust';
import { renderProgressBar } from './ui/progress-bar';

// Build-time variant selection — Vite dead-code-eliminates the unused branch
const SCREENS: Record<ScreenName, ScreenFn> = {
  landing: LandingScreen,
  pin: PinEntryScreen,
  verifying: VerifyingScreen,
  username: UsernameScreen,
  backup: KeyBackupScreen,
  claiming: ClaimingScreen,
  profile: ProfileSetupScreen,
  intro: IntroPostScreen,
  success: __VARIANT__ === 'robust' ? SuccessRobustScreen : SuccessScreen,
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
      bootstrapSaved: false,
    };

    this.detectFragment();
  }

  private detectFragment(): void {
    // Dev-only shortcuts for testing individual screens
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const devScreen = params.has('dev-profile') ? 'profile' as const
        : params.has('dev-intro') ? 'intro' as const
        : params.has('dev-success') ? 'success' as const
        : null;

      if (devScreen) {
        this.state.payload = {
          token: 'test', provider: 'demotruktest27', serviceUrl: '', endpoints: [],
          batchId: 'test', expires: '', signature: '', promiseType: 'account-creation',
          variant: 'standard', referrer: 'demotruktest27', extendedOnboarding: true,
        };
        this.state.username = 'testuser123';
        this.state.keys = {
          owner:   { wif: '5JTestOwnerKeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', pub: 'STM...' },
          active:  { wif: '5JTestActiveKeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', pub: 'STM...' },
          posting: { wif: '5JTestPostingKeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', pub: 'STM...' },
          memo:    { wif: '5JTestMemoKeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', pub: 'STM...' },
        };
        this.state.claimResult = { account: 'testuser123', tx_id: 'abc123def456abc123def456abc123def456abc1' };
        if (devScreen === 'intro') {
          this.state.imageUrl = 'https://images.hive.blog/u/demotruktest27/avatar';
        }
        this.showScreen(devScreen);
        return;
      }
    }

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

    // Progress indicator (shown for all screens except landing)
    const bar = renderProgressBar(name);
    if (bar) this.container.appendChild(bar);

    // Screen content goes into a wrapper so it doesn't clobber the progress bar
    const screenEl = document.createElement('div');
    this.container.appendChild(screenEl);

    const screen = SCREENS[name];
    if (screen) {
      screen(screenEl, this.state, (next) => this.showScreen(next));
    }
  }
}
