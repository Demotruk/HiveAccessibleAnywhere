/**
 * Main app controller with hash-based routing.
 * No framework — vanilla TypeScript DOM manipulation.
 */

import { LoginScreen } from './components/login';
import { BalanceScreen } from './components/balance';
import { TransferScreen } from './components/transfer';
import { SavingsScreen } from './components/savings';
import { SettingsScreen } from './components/settings';

export interface AppState {
  /** Logged-in account name */
  account: string | null;
  /** Private active key WIF (stored in session only) */
  activeKeyWif: string | null;
  /** Private memo key WIF (optional, for endpoint discovery) */
  memoKeyWif: string | null;
  /** Whether keys are persisted to localStorage */
  persistKeys: boolean;
}

type Screen = (container: HTMLElement, state: AppState, app: App) => void | Promise<void>;

const SCREENS: Record<string, Screen> = {
  login: LoginScreen,
  balance: BalanceScreen,
  transfer: TransferScreen,
  savings: SavingsScreen,
  settings: SettingsScreen,
};

const NAV_ITEMS = [
  { hash: 'balance', label: 'Balance' },
  { hash: 'transfer', label: 'Transfer' },
  { hash: 'savings', label: 'Savings' },
  { hash: 'settings', label: 'Settings' },
];

export class App {
  private container: HTMLElement;
  private navEl: HTMLElement;
  private contentEl: HTMLElement;
  state: AppState;

  constructor(container: HTMLElement) {
    this.container = container;
    this.state = this.loadState();

    // Build shell
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'ct';
    header.innerHTML = '<h1>HAA Wallet</h1>';

    this.navEl = document.createElement('nav');
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'ct';

    header.appendChild(this.navEl);
    this.container.appendChild(header);
    this.container.appendChild(this.contentEl);

    this.renderNav();

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.route());
    this.route();
  }

  private loadState(): AppState {
    const persisted = localStorage.getItem('haa_keys');
    if (persisted) {
      try {
        const data = JSON.parse(persisted);
        return {
          account: data.account || null,
          activeKeyWif: data.activeKeyWif || null,
          memoKeyWif: data.memoKeyWif || null,
          persistKeys: true,
        };
      } catch {
        // Corrupted data, ignore
      }
    }

    const sessionAccount = sessionStorage.getItem('haa_account');
    const sessionActiveKey = sessionStorage.getItem('haa_activeKey');
    const sessionMemoKey = sessionStorage.getItem('haa_memoKey');

    return {
      account: sessionAccount,
      activeKeyWif: sessionActiveKey,
      memoKeyWif: sessionMemoKey,
      persistKeys: false,
    };
  }

  /** Save state to session (or local if persist enabled) */
  saveState(): void {
    if (this.state.persistKeys) {
      localStorage.setItem('haa_keys', JSON.stringify({
        account: this.state.account,
        activeKeyWif: this.state.activeKeyWif,
        memoKeyWif: this.state.memoKeyWif,
      }));
    } else {
      localStorage.removeItem('haa_keys');
      if (this.state.account) sessionStorage.setItem('haa_account', this.state.account);
      if (this.state.activeKeyWif) sessionStorage.setItem('haa_activeKey', this.state.activeKeyWif);
      if (this.state.memoKeyWif) sessionStorage.setItem('haa_memoKey', this.state.memoKeyWif);
    }
  }

  /** Clear all stored keys and log out */
  logout(): void {
    this.state.account = null;
    this.state.activeKeyWif = null;
    this.state.memoKeyWif = null;
    localStorage.removeItem('haa_keys');
    sessionStorage.clear();
    this.navigate('login');
  }

  /** Navigate to a screen */
  navigate(screen: string): void {
    window.location.hash = `#${screen}`;
  }

  private renderNav(): void {
    this.navEl.innerHTML = '';

    if (!this.state.account) {
      this.navEl.classList.add('hidden');
      return;
    }

    this.navEl.classList.remove('hidden');
    const currentHash = (window.location.hash || '#balance').slice(1);

    for (const item of NAV_ITEMS) {
      const a = document.createElement('a');
      a.href = `#${item.hash}`;
      a.textContent = item.label;
      if (item.hash === currentHash) a.className = 'active';
      this.navEl.appendChild(a);
    }
  }

  private route(): void {
    const hash = (window.location.hash || '').slice(1) || 'login';

    // Require login for all screens except login
    if (hash !== 'login' && !this.state.account) {
      this.navigate('login');
      return;
    }

    // If logged in and trying to access login, go to balance
    if (hash === 'login' && this.state.account) {
      this.navigate('balance');
      return;
    }

    const screen = SCREENS[hash];
    if (!screen) {
      this.navigate('balance');
      return;
    }

    this.renderNav();
    this.contentEl.innerHTML = '';
    screen(this.contentEl, this.state, this);
  }
}
