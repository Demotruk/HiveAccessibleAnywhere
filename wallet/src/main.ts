import './ui/styles.css';
import { App } from './ui/app';
import { getClient } from './hive/client';
import { importKey, formatAsset } from './hive/keys';
import { signAndBroadcast } from './hive/signing';
import { decryptMemo } from './hive/memo';

// Boot the app
const appEl = document.getElementById('app')!;
const app = new App(appEl);

// Export for browser console testing during development
(window as any).haa = {
  app,
  getClient,
  importKey,
  formatAsset,
  signAndBroadcast,
  decryptMemo,
};
