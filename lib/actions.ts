'use server';

/**
 * Server-action surface for the finance domain.
 *
 * This file used to contain ~415 lines of mixed user CRUD, entry
 * mutations, and pagination logic. The implementation has been moved
 * into focused repository modules (`lib/users/repo.ts`,
 * `lib/entries/repo.ts`). This file now provides only the
 * `"use server"` boundary that client components and API routes rely
 * on — its job is to be the small, audited surface that performs the
 * RPC handshake.
 *
 * Public API stays identical, so existing imports (`@/lib/actions`)
 * keep working:
 *   - createUser, getUserByEmail
 *   - createEntry, updateEntry, deleteEntry, deleteManyEntries
 *   - getEntries, getExportEntries
 */

import { revalidatePath } from 'next/cache';
import { findUserByEmail, insertUser } from '@/lib/users/repo';
import {
  deleteEntriesByIds,
  deleteEntryById,
  exportEntries,
  findEntries,
  insertEntry,
  updateEntryById,
  type EntryFilter,
  type EntryInput,
  type PaginatedEntries,
} from '@/lib/entries/repo';

export async function createUser(formData: { name: string; email: string }) {
  try {
    await insertUser(formData);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create user.');
  }
  revalidatePath('/');
}

export async function getUserByEmail(email: string) {
  try {
    return await findUserByEmail(email);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to get user.');
  }
}

export async function createEntry(
  formData: EntryInput,
  session: { user: { id: string } },
) {
  try {
    await insertEntry(formData, session.user.id);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create entry.');
  }
  revalidatePath('/');
}

export async function updateEntry(
  entryId: string,
  formData: EntryInput,
  session: { user: { id: string } },
) {
  try {
    await updateEntryById(entryId, formData, session.user.id);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to update entry.');
  }
  revalidatePath('/');
}

export async function deleteEntry(
  formData: FormData,
  session: { user: { id: string } },
) {
  const entryId = String(formData.get('entryId') ?? '');
  if (!entryId) return;
  await deleteEntryById(entryId, session.user.id);
  revalidatePath('/');
}

export async function deleteManyEntries(
  formData: FormData,
  session: { user: { id: string } },
) {
  const raw = String(formData.get('ids') ?? '');
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return;
  await deleteEntriesByIds(ids, session.user.id);
  revalidatePath('/');
}

export async function getEntries(
  filters: EntryFilter,
  session: { user: { id: string } },
): Promise<PaginatedEntries> {
  return findEntries(filters, session.user.id);
}

export async function getExportEntries(
  filter: { search?: string; tipo?: string; from?: string; to?: string },
  userId: string,
) {
  return exportEntries(filter, userId);
}
