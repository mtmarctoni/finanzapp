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

import {
  deleteEntriesByIds,
  deleteEntryById,
  exportEntries,
  findEntries,
  insertEntry,
  isUniqueViolation,
  updateEntryById,
  type EntryFilter,
  type EntryInput,
  type PaginatedEntries,
} from '@/lib/entries/repo';
import { applyMerchantConfirmation } from '@/lib/merchants/repo';
import { ensureCategory } from '@/lib/server-data';
import { findUserByEmail, insertUser } from '@/lib/users/repo';

/**
 * Register a newly written `tipo` in the canonical `categories` table so it
 * becomes selectable in the "categoria" dropdown.
 *
 * Deliberately best-effort: the record has already been saved, and failing the
 * whole request because the category index could not be updated would lose the
 * user's actual work. A failure only means the category will be missing from
 * the dropdown until the next successful write.
 */
async function provisionCategory(userId: string, tipo: string | undefined) {
  if (!tipo?.trim()) return;
  try {
    await ensureCategory(userId, tipo);
  } catch (error) {
    console.error('Failed to provision category:', error);
  }
}

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
  learning?: {
    /** Merchant as the user saw it on the receipt. */
    comercio: string;
    /** The value the form was pre-filled with. Never used to learn. */
    categoriaPrefill: string;
  },
) {
  try {
    await insertEntry(formData, session.user.id);
    await provisionCategory(session.user.id, formData.tipo);
  } catch (error) {
    // The unique partial index on `(user_id, content_hash)` is the last line
    // of defence against a double save: two tabs opened from the same
    // `/new?rcpt=1&content_hash=…` URL, or a retry after a dropped response.
    // The entry the user just reviewed *is* in the ledger, so this is a
    // success, not a failure — throwing would turn a saved receipt into a
    // dead end, and the form's submit handler has no error UI, so the user
    // would just see nothing happen. Learning is deliberately skipped: the
    // first save already incremented `veces_confirmado` for this merchant,
    // and doing it twice would inflate the trust signal.
    if (isUniqueViolation(error)) {
      console.warn('Duplicate receipt save ignored:', error);
      revalidatePath('/');
      return;
    }
    console.error('Database Error:', error);
    throw new Error('Failed to create entry.');
  }

  // The entry is saved; a failed learning write must not undo that.
  if (learning && formData.origen === 'receipt') {
    try {
      await applyMerchantConfirmation({
        userId: session.user.id,
        comercio: learning.comercio,
        // The category the user saved, which outranks the prefill.
        tipo: formData.tipo,
        plataforma_pago: formData.plataforma_pago,
      });
    } catch (error) {
      console.error('Merchant learning error:', error);
    }
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
    await provisionCategory(session.user.id, formData.tipo);
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
