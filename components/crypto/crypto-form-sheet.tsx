'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CryptoTransactionForm } from '@/components/crypto/crypto-transaction-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { CryptoTransaction } from '@/types/finance';

/**
 * The crypto page's widgets fetch on the client, so they talk through window
 * events instead of shared state: one opens the form sheet, the other tells
 * the overview and the table to reload after a save.
 */
const OPEN_FORM_EVENT = 'finanzapp:crypto-open-form';
const CRYPTO_CHANGED_EVENT = 'finanzapp:crypto-changed';

export function openCryptoForm(transaction?: CryptoTransaction) {
  window.dispatchEvent(
    new CustomEvent<CryptoTransaction | undefined>(OPEN_FORM_EVENT, {
      detail: transaction,
    }),
  );
}

function notifyCryptoChanged() {
  window.dispatchEvent(new Event(CRYPTO_CHANGED_EVENT));
}

/** Re-runs `reload` whenever a crypto transaction is saved or removed. */
export function useCryptoChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener(CRYPTO_CHANGED_EVENT, reload);
    return () => window.removeEventListener(CRYPTO_CHANGED_EVENT, reload);
  }, [reload]);
}

/** The page's one form sheet, for both new and edited transactions. */
export function CryptoFormSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [transaction, setTransaction] = useState<CryptoTransaction>();
  // Remount the form per opening so defaultValues follow the transaction.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const handler = (event: Event) => {
      setTransaction((event as CustomEvent<CryptoTransaction>).detail);
      setFormKey((key) => key + 1);
      setOpen(true);
    };
    window.addEventListener(OPEN_FORM_EVENT, handler);
    return () => window.removeEventListener(OPEN_FORM_EVENT, handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="sm:max-w-xl"
      >
        <DialogTitle className="sr-only">
          {transaction ? 'Editar transacción' : 'Nueva transacción'}
        </DialogTitle>
        <CryptoTransactionForm
          key={formKey}
          transaction={transaction}
          variant="sheet"
          onDone={(saved) => {
            setOpen(false);
            if (saved) {
              notifyCryptoChanged();
              router.refresh();
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function NewCryptoButton() {
  return (
    <Button size="sm" className="h-10 px-4" onClick={() => openCryptoForm()}>
      <Plus />
      Nueva
    </Button>
  );
}
