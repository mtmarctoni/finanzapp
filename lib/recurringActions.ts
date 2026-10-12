'use server';

import { headers } from 'next/headers';

import {
  checkPreviewAction,
  authorizePreviewWork,
  PreviewMutationError,
} from '@/lib/demo/mutations';
import { isPreviewDemo } from '@/lib/demo/policy';
import * as repo from '@/lib/recurring/repo';
import type { RecurringRecord } from '@/lib/recurring/repo';
import { requireSessionUserId } from '@/lib/session';

export type { RecurringRecord } from '@/lib/recurring/repo';

export async function getRecurringRecords(_userId: string) {
  return repo.getRecurringRecords(await requireSessionUserId());
}

export async function createRecurringRecord(data: Omit<RecurringRecord, 'id'>) {
  const userId = await requireSessionUserId();
  const rejection = await checkPreviewAction();
  if (rejection) return rejection;
  return repo.createRecurringRecord({ ...data, user_id: userId });
}

export async function updateRecurringRecord(
  id: string,
  data: Partial<Omit<RecurringRecord, 'id' | 'user_id'>>,
  _userId: string,
) {
  const userId = await requireSessionUserId();
  const rejection = await checkPreviewAction();
  if (rejection) return rejection;
  // Only schema fields are allowed, even when invoked directly as an RPC.
  const allowed = [
    'name',
    'accion',
    'tipo',
    'detalle1',
    'detalle2',
    'quien',
    'amount',
    'frequency',
    'active',
    'dia',
    'plataforma_pago',
  ];
  const safe = Object.fromEntries(
    Object.entries(data).filter(([key]) => allowed.includes(key)),
  );
  return repo.updateRecurringRecord(id, safe, userId);
}

export async function deleteRecurringRecord(id: string, _userId: string) {
  const userId = await requireSessionUserId();
  const rejection = await checkPreviewAction();
  if (rejection) return rejection;
  return repo.deleteRecurringRecord(id, userId);
}

export async function generateFinanceEntries(
  _userId: string,
  date: string,
  year: number,
  month: number,
) {
  const userId = await requireSessionUserId();
  const source = isPreviewDemo() ? await headers() : null;
  try {
    return await repo.generateFinanceEntries(
      userId,
      date,
      year,
      month,
      source ? async (units) => authorizePreviewWork(source, units) : undefined,
    );
  } catch (error) {
    if (error instanceof PreviewMutationError) return error.result;
    throw error;
  }
}
