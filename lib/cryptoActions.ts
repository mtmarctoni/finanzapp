/**
 * Server-side facade for the crypto domain.
 *
 * The previous version of this file was 592 lines that mixed
 * transaction CRUD, wallet CRUD, holdings aggregation, mapping
 * helpers, and connection management. The implementation now lives in
 * focused modules:
 *   - lib/crypto/transactions.ts
 *   - lib/crypto/wallets.ts
 *   - lib/crypto/holdings.ts
 *   - lib/crypto/mappers.ts
 *
 * Only API routes and server components import this file. It is
 * deliberately not a "use server" module: every function takes the user
 * from a `session` argument, and a server action is a public endpoint
 * whose arguments the caller controls. Callers pass the session they
 * resolved with `getServerSession`; client components go through the
 * `/api/crypto/*` routes via `lib/crypto-data.ts`.
 */

import { revalidatePath } from 'next/cache';

import { aggregateHoldings, listUserSymbols } from '@/lib/crypto/holdings';
import {
  type CryptoTransactionFilter,
  type PaginatedCryptoTransactions,
  deleteTransactionById,
  duplicateTransactionById,
  findTransactionById,
  insertTransaction,
  listTransactions,
  updateTransactionById,
} from '@/lib/crypto/transactions';
import {
  insertWallet,
  listUsedWallets,
  listWallets,
} from '@/lib/crypto/wallets';
import type {
  CryptoHoldingsSummary,
  CryptoTransaction,
  CryptoTransactionFormData,
  CryptoWallet,
} from '@/types/finance';

// Types are used internally but not re-exported from this 'use server'
// boundary to avoid Turbopack strict-mode issues in Next.js 16.2+.
// Consumers should import types directly from '@/lib/crypto/transactions'.

const CRYPTO_REVALIDATE_PATH = '/investment/crypto';

// ============================================
// CRYPTO TRANSACTIONS
// ============================================

export async function getCryptoTransactions(
  filters: CryptoTransactionFilter,
  session: { user: { id: string } },
): Promise<PaginatedCryptoTransactions> {
  return listTransactions(filters, session.user.id);
}

export async function getCryptoTransactionById(
  id: string,
  session: { user: { id: string } },
): Promise<CryptoTransaction | null> {
  return findTransactionById(id, session.user.id);
}

export async function createCryptoTransaction(
  formData: CryptoTransactionFormData,
  session: { user: { id: string } },
): Promise<CryptoTransaction> {
  const result = await insertTransaction(formData, session.user.id);
  revalidatePath(CRYPTO_REVALIDATE_PATH);
  return result;
}

export async function updateCryptoTransaction(
  id: string,
  formData: Partial<CryptoTransactionFormData>,
  session: { user: { id: string } },
): Promise<CryptoTransaction | null> {
  const result = await updateTransactionById(id, formData, session.user.id);
  revalidatePath(CRYPTO_REVALIDATE_PATH);
  return result;
}

export async function deleteCryptoTransaction(
  id: string,
  session: { user: { id: string } },
): Promise<boolean> {
  const ok = await deleteTransactionById(id, session.user.id);
  revalidatePath(CRYPTO_REVALIDATE_PATH);
  return ok;
}

export async function duplicateCryptoTransaction(
  id: string,
  session: { user: { id: string } },
): Promise<CryptoTransaction | null> {
  const result = await duplicateTransactionById(id, session.user.id);
  revalidatePath(CRYPTO_REVALIDATE_PATH);
  return result;
}

// ============================================
// CRYPTO WALLETS
// ============================================

export async function getCryptoWallets(session: {
  user: { id: string };
}): Promise<CryptoWallet[]> {
  return listWallets(session.user.id);
}

export async function createCryptoWallet(
  data: { name: string; walletType: string; address?: string; notes?: string },
  session: { user: { id: string } },
): Promise<CryptoWallet> {
  const result = await insertWallet(data, session.user.id);
  revalidatePath(CRYPTO_REVALIDATE_PATH);
  return result;
}

// ============================================
// CRYPTO HOLDINGS / OPTIONS
// ============================================

export async function getCryptoHoldings(session: {
  user: { id: string };
}): Promise<CryptoHoldingsSummary[]> {
  return aggregateHoldings(session.user.id);
}

export async function getCryptoSymbols(session: {
  user: { id: string };
}): Promise<string[]> {
  return listUserSymbols(session.user.id);
}

export async function getUsedWallets(session: {
  user: { id: string };
}): Promise<string[]> {
  return listUsedWallets(session.user.id);
}
