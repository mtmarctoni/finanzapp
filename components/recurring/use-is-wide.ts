'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 1024px)';

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot() {
  if (typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(QUERY).matches;
}

/**
 * true on lg+ screens, where the recurring detail sits beside the list; below
 * that it opens as a bottom sheet. false during SSR.
 */
export function useIsWide(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
