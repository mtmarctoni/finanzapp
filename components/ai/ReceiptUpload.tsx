'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { downscaleImageFile } from '@/components/ai/imageDownscale';
import { Button } from '@/components/ui/button';

type UploadStatus = 'idle' | 'working' | 'error' | 'duplicate';

interface ReceiptPayload {
  success: boolean;
  duplicate?: boolean;
  duplicateKind?: 'exact' | 'similar';
  entry?: { id: string; que: string; cantidad: number };
  parsedData?: Record<string, unknown>;
  receipt?: {
    contentHash: string;
    confianza: number;
    needsReview?: boolean;
    comercio: string;
    categorySource?: string;
    merchantId?: string | null;
  };
  providerUsed?: string;
  modelUsed?: string;
  /** Set by the parse failures. */
  message?: string;
  /** Always set, including by the guard failures that have no `message`. */
  error?: string;
}

export function ReceiptUpload() {
  const router = useRouter();
  const { status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState('');

  if (status !== 'authenticated') return null;

  async function handleAnalyze() {
    if (!file) return;

    setUploadStatus('working');
    setMessage('');

    try {
      const downscaled = await downscaleImageFile(file);
      const formData = new FormData();
      formData.set('image', downscaled);

      const response = await fetch('/api/ai/parse-receipt', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json()) as ReceiptPayload;

      if (data.duplicate && data.entry) {
        setUploadStatus('duplicate');
        setMessage(
          `Ya tienes esta entrada: ${data.entry.que}, ${data.entry.cantidad}.`,
        );
        return;
      }

      if (!response.ok || !data.success || !data.parsedData) {
        setUploadStatus('error');
        // The guard failures (415 wrong type, 413 too large, 400 no field,
        // 429 rate limited) answer with `error` only, because they are not
        // parse failures. Falling back only to a generic string would swallow
        // the one message that tells the user what to change.
        setMessage(
          data.message ??
            data.error ??
            'No hemos podido leer el recibo. Inténtalo de nuevo.',
        );
        return;
      }

      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(data.parsedData)) {
        if (value !== undefined && value !== null && value !== '') {
          query.set(key, String(value));
        }
      }
      query.set('rcpt', '1');
      if (data.receipt) {
        query.set('content_hash', data.receipt.contentHash);
        query.set('confianza', String(data.receipt.confianza));
        query.set('comercio', data.receipt.comercio);
        if (data.receipt.needsReview) query.set('needs_review', '1');
      }

      router.push(`/new?${query.toString()}`);
    } catch {
      setUploadStatus('error');
      setMessage('No se ha podido subir la imagen. Inténtalo de nuevo.');
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor="receipt-image"
        className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-hairline-strong bg-surface-2 px-4 py-6 text-center transition-colors active:bg-surface-3"
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-3">
          <Camera className="h-6 w-6" />
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">
          {file ? file.name : 'Hacer foto o elegir imagen'}
        </span>
        <span className="text-xs text-faint">
          {file ? 'Toca para cambiarla' : 'JPG, PNG, WEBP o HEIC'}
        </span>
        <input
          id="receipt-image"
          type="file"
          aria-label="Sube una foto de un recibo"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setUploadStatus('idle');
            setMessage('');
          }}
          className="sr-only"
        />
      </label>

      <Button
        onClick={handleAnalyze}
        disabled={!file || uploadStatus === 'working'}
        size="lg"
        className="w-full"
      >
        {uploadStatus === 'working' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        Analizar recibo
      </Button>

      {message && (
        <p
          role="status"
          className={
            uploadStatus === 'error'
              ? 'text-center text-sm text-negative'
              : 'text-center text-sm text-subtle'
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
