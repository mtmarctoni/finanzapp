'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot() {
  // Environments without matchMedia (jsdom) get the desktop layout.
  if (typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(QUERY).matches;
}

/**
 * true on md+ screens, false below, null during SSR / hydration. The records
 * page renders either the mobile list or the desktop table, never both, so
 * there is one set of row controls in the DOM.
 */
export function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribe,
    getSnapshot,
    () => null,
  );
}
