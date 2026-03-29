"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, DollarSign } from "lucide-react";

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
      const response = await fetch("/api/ai/confirm-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });

      if (response.ok) {
        onConfirm();
      } else {
        console.error("Failed to save confirmation");
        onDecline();
      }
    } catch (error) {
      console.error("Error confirming paid fallback:", error);
      onDecline();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/ai/confirm-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: false }),
      });
    } catch (error) {
      console.error("Error declining paid fallback:", error);
    } finally {
      setIsLoading(false);
      onDecline();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Free AI Providers Unavailable
          </DialogTitle>
          <DialogDescription className="pt-2">
            All our free AI providers are currently experiencing issues. We can
            use a paid alternative to process your request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Model</span>
              <span className="text-sm">{modelName}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Estimated Cost
              </span>
              <span className="text-sm font-semibold text-green-600">
                {estimatedCost}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            This confirmation is valid for 10 minutes. You can view your total
            spending in the settings panel.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Confirming..." : "Use Paid Model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
