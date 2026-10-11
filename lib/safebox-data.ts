'use client';

import type {
  SafeboxMovementInput,
  SafeboxMovement,
  SafeboxMovementWithBalance,
  SafeboxSummary,
} from '@/types/finance';

/**
 * Client helpers for the safebox API. They mirror `lib/crypto-data.ts`:
 * fetch from the browser, return `null` on failure and let the component
 * render its error state.
 */

export class SafeboxRequestError extends Error {
  constructor(
    message: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      reason?: string;
    } | null;
    throw new SafeboxRequestError(
      body?.error ?? `API error: ${response.status}`,
      body?.reason,
    );
  }
  return response;
}

/** Expected safebox cash and movement totals. */
export async function getSafeboxSummary(): Promise<SafeboxSummary | null> {
  try {
    const response = await apiFetch('/api/safebox');
    return (await response.json()) as SafeboxSummary;
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

/** Full movement history, newest first, with running balances. */
export async function getSafeboxMovements(): Promise<
  SafeboxMovementWithBalance[] | null
> {
  try {
    const response = await apiFetch('/api/safebox/movements');
    const result = (await response.json()) as {
      data: SafeboxMovementWithBalance[];
    };
    return result.data;
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

/**
 * Record a deposit, withdrawal, opening count or adjustment. Throws
 * `SafeboxRequestError` with the server's message so the form can show why
 * a movement was rejected (e.g. not enough expected cash).
 */
export async function createSafeboxMovement(
  input: SafeboxMovementInput,
): Promise<SafeboxMovement> {
  const response = await apiFetch('/api/safebox/movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await response.json()) as SafeboxMovement;
}

/** Delete a mistaken movement. Throws `SafeboxRequestError` on rejection. */
export async function deleteSafeboxMovement(id: string): Promise<void> {
  await apiFetch(`/api/safebox/movements/${id}`, { method: 'DELETE' });
}
