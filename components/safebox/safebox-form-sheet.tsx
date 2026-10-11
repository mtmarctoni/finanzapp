'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SafeboxCountForm } from '@/components/safebox/safebox-count-form';
import {
  type SafeboxMovementFormMode,
  SafeboxMovementForm,
} from '@/components/safebox/safebox-movement-form';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * The safebox page's widgets fetch on the client, so they talk through
 * window events instead of shared state — the same pattern as the crypto
 * module: one event opens the form sheet, the other tells the overview and
 * the history to reload after a save.
 */

export type SafeboxFormMode = SafeboxMovementFormMode | 'count';

const OPEN_FORM_EVENT = 'finanzapp:safebox-open-form';
const SAFEBOX_CHANGED_EVENT = 'finanzapp:safebox-changed';

export function openSafeboxForm(mode: SafeboxFormMode) {
  window.dispatchEvent(
    new CustomEvent<SafeboxFormMode>(OPEN_FORM_EVENT, { detail: mode }),
  );
}

function notifySafeboxChanged() {
  window.dispatchEvent(new Event(SAFEBOX_CHANGED_EVENT));
}

/** Re-runs `reload` whenever a safebox movement is saved or removed. */
export function useSafeboxChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener(SAFEBOX_CHANGED_EVENT, reload);
    return () => window.removeEventListener(SAFEBOX_CHANGED_EVENT, reload);
  }, [reload]);
}

const MODE_TITLES: Record<SafeboxFormMode, string> = {
  opening: 'Saldo inicial',
  deposit: 'Ingresar efectivo',
  withdrawal: 'Retirar efectivo',
  count: 'Contar efectivo',
};

/** The page's one form sheet, for movements and the physical count. */
export function SafeboxFormSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SafeboxFormMode>('deposit');
  // Remount the form per opening so it always starts clean.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const handler = (event: Event) => {
      setMode((event as CustomEvent<SafeboxFormMode>).detail);
      setFormKey((key) => key + 1);
      setOpen(true);
    };
    window.addEventListener(OPEN_FORM_EVENT, handler);
    return () => window.removeEventListener(OPEN_FORM_EVENT, handler);
  }, []);

  const handleDone = (saved: boolean) => {
    setOpen(false);
    if (saved) {
      notifySafeboxChanged();
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogTitle className="sr-only">{MODE_TITLES[mode]}</DialogTitle>
        {mode === 'count' ? (
          <SafeboxCountForm key={formKey} onDone={handleDone} />
        ) : (
          <SafeboxMovementForm key={formKey} mode={mode} onDone={handleDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}
