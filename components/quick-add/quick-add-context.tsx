'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { QuickAddSheet } from './quick-add-sheet';

type QuickAddContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

/**
 * Owns the one quick-add sheet in the app, so the tab bar button, the sidebar
 * button and any page CTA all open the same instance.
 */
export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const pathname = usePathname();

  // The AI and receipt shortcuts hand off to the /new review page.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close on navigation
  useEffect(() => setIsOpen(false), [pathname]);

  return (
    <QuickAddContext.Provider value={{ open, close, isOpen }}>
      {children}
      <QuickAddSheet open={isOpen} onClose={close} />
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error('useQuickAdd must be used inside QuickAddProvider');
  return ctx;
}
