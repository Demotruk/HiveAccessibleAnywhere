import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { state, subscribe } from '../state.js';
import { Header } from './header.js';
import { Login } from './login.js';
import { BatchList } from './batch-list.js';
import { BatchForm } from './batch-form.js';
import { BatchDetail } from './batch-detail.js';
import { Apply } from './apply.js';
import { Setup } from './setup.js';
import { Admin } from './admin.js';

interface Route {
  view: string;
  param?: string;
}

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '') || 'login';
  if (path === 'login') return { view: 'login' };
  if (path === 'apply') return { view: 'apply' };
  if (path === 'setup') return { view: 'setup' };
  if (path === 'admin') return { view: 'admin' };
  if (path === 'batches') return { view: 'batch-list' };
  if (path === 'batches/generate') return { view: 'batch-form' };
  if (path.startsWith('batches/')) return { view: 'batch-detail', param: path.slice(8) };
  return { view: 'batch-list' };
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute(window.location.hash));
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    function onHashChange() {
      setRoute(parseRoute(window.location.hash));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Re-render when global state changes (login/logout)
  useEffect(() => subscribe(() => forceUpdate(n => n + 1)), []);

  // Auth guard
  const loggedIn = !!state.jwt;

  // Login page — show if not logged in
  if (!loggedIn && route.view !== 'login') {
    window.location.hash = '#login';
    return null;
  }
  if (loggedIn && route.view === 'login') {
    // Redirect based on role
    if (state.role === 'admin') {
      window.location.hash = '#admin';
    } else if (state.role === 'issuer') {
      window.location.hash = '#batches';
    } else if (state.issuerStatus?.status === 'approved') {
      window.location.hash = '#setup';
    } else {
      window.location.hash = '#apply';
    }
    return null;
  }

  if (route.view === 'login') {
    return html`<${Login} />`;
  }

  // Apply page — accessible to any logged-in user
  if (route.view === 'apply') {
    return html`
      <div class="ct">
        <${Header} route=${route.view} />
      </div>
      <${Apply} />
    `;
  }

  // Setup page — accessible to approved issuers and admins
  if (route.view === 'setup') {
    return html`
      <div class="ct">
        <${Header} route=${route.view} />
      </div>
      <${Setup} />
    `;
  }

  // Admin page — accessible to admins only
  if (route.view === 'admin') {
    if (state.role !== 'admin') {
      window.location.hash = '#batches';
      return null;
    }
    return html`
      <div class="ct">
        <${Header} route=${route.view} />
      </div>
      <${Admin} />
    `;
  }

  // Batch pages — accessible to active issuers and admins
  if (state.role !== 'issuer' && state.role !== 'admin') {
    if (state.issuerStatus?.status === 'approved') {
      window.location.hash = '#setup';
    } else {
      window.location.hash = '#apply';
    }
    return null;
  }

  return html`
    <div class="ct">
      <${Header} route=${route.view} />
    </div>
    ${route.view === 'batch-list' && html`<${BatchList} />`}
    ${route.view === 'batch-form' && html`<${BatchForm} />`}
    ${route.view === 'batch-detail' && route.param && html`<${BatchDetail} batchId=${route.param} key=${route.param} />`}
  `;
}
