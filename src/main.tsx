import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { configManager } from './lib/config';

const root = ReactDOM.createRoot(document.getElementById('root')!);

async function clearLegacyBrowserState() {
  const cleanupFlag = 'sendcraft-browser-cleanup-v1';

  try {
    if (window.localStorage.getItem(cleanupFlag) === 'done') {
      return;
    }
  } catch {
    // Best effort only.
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Best effort only.
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Best effort only.
  }

  try {
    window.localStorage.setItem(cleanupFlag, 'done');
  } catch {
    // Best effort only.
  }
}

void (async () => {
  await clearLegacyBrowserState();

  void configManager.loadConfig();

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();
