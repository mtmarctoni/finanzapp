'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

interface PaidFallbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  estimatedCost: string;
  modelName: string;
}

export function PaidFallbackDialog({
  isOpen,
  onClose,
  onConfirm,
  onDecline,
  estimatedCost,
  modelName,
}: PaidFallbackDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      // Save confirmation to server
      const response = await fetch('/api/ai/confirm-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });

      if (response.ok) {
        onConfirm();
      } else {
        console.error('Failed to save confirmation');
        onDecline();
      }
    } catch (error) {
      console.error('Error confirming paid fallback:', error);
      onDecline();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/ai/confirm-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: false }),
      });
    } catch (error) {
      console.error('Error declining paid fallback:', error);
    } finally {
      setIsLoading(false);
      onDecline();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-5">
          <div className="flex items-start gap-3 pr-10">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-subtle">
              <Sparkles className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">
                Los modelos gratuitos no responden
              </DialogTitle>
              <DialogDescription className="mt-1 text-[13px] leading-relaxed text-subtle">
                Todos nuestros proveedores de IA gratuitos están fallando ahora
                mismo. Podemos usar un modelo de pago para procesar tu petición.
              </DialogDescription>
            </div>
          </div>

          <div className="rounded-[16px] bg-surface-2 px-4">
            <div className="flex min-h-12 items-center justify-between gap-4">
              <span className="text-[15px] text-subtle">Modelo</span>
              <span className="truncate text-[15px] font-medium">
                {modelName}
              </span>
            </div>
            <div className="flex min-h-12 items-center justify-between gap-4 border-t border-hairline">
              <span className="text-[15px] text-subtle">Coste estimado</span>
              <span className="num text-[15px] font-semibold">
                {estimatedCost}
              </span>
            </div>
          </div>

          <p className="px-1 text-[12px] leading-relaxed text-faint">
            La confirmación dura 10 minutos. Puedes ver el gasto total en los
            ajustes.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={handleDecline}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {isLoading ? 'Confirmando...' : 'Usar modelo de pago'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
