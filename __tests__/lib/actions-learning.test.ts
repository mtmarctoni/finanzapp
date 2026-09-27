/** @jest-environment node */

import { revalidatePath } from 'next/cache';

import { createEntry } from '@/lib/actions';
import { insertEntry, type EntryInput } from '@/lib/entries/repo';
import { applyMerchantConfirmation } from '@/lib/merchants/repo';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/entries/repo', () => ({
  insertEntry: jest.fn(),
  // The real predicate, not a `jest.fn()`: this suite is what decides whether
  // a duplicate save is swallowed, so stubbing the decision would make the
  // duplicate tests assert nothing. Every other export of the module is mocked
  // away, so this has to be a faithful copy of the implementation.
  isUniqueViolation: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505',
  updateEntryById: jest.fn(),
  deleteEntryById: jest.fn(),
  deleteEntriesByIds: jest.fn(),
  exportEntries: jest.fn(),
  findEntries: jest.fn(),
}));
jest.mock('@/lib/users/repo', () => ({
  findUserByEmail: jest.fn(),
  insertUser: jest.fn(),
}));
jest.mock('@/lib/merchants/repo', () => ({
  applyMerchantConfirmation: jest.fn(),
}));

const insertMock = insertEntry as jest.MockedFunction<typeof insertEntry>;
const learningMock = applyMerchantConfirmation as jest.MockedFunction<
  typeof applyMerchantConfirmation
>;
const revalidateMock = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;

const SESSION = { user: { id: 'user-1' } };

const RECEIPT: EntryInput = {
  fecha: '2026-09-20T12:00:00.000Z',
  tipo: 'Limpieza',
  accion: 'Gasto',
  que: 'Mercadona',
  plataforma_pago: 'Visa',
  cantidad: 43.2,
  origen: 'receipt',
  content_hash: 'a'.repeat(64),
  merchant_id: 'm-1',
  confianza: 0.92,
};

beforeEach(() => {
  jest.clearAllMocks();
  insertMock.mockResolvedValue('entry-id');
  learningMock.mockResolvedValue(undefined);
});

describe('createEntry', () => {
  it('persists the entry as before', async () => {
    await createEntry(RECEIPT, SESSION);
    expect(insertMock).toHaveBeenCalledWith(RECEIPT, 'user-1');
    expect(revalidateMock).toHaveBeenCalledWith('/');
  });

  // Review Focus #5: the saved category is the authority, not the prefill.
  it('learns the category the user actually saved, not the prefill', async () => {
    await createEntry(RECEIPT, SESSION, {
      comercio: 'Mercadona',
      categoriaPrefill: 'Supermercado',
    });
    expect(learningMock).toHaveBeenCalledWith({
      userId: 'user-1',
      comercio: 'Mercadona',
      tipo: 'Limpieza',
      plataforma_pago: 'Visa',
    });
  });

  it('does not touch merchant memory for a manual entry', async () => {
    await createEntry({ ...RECEIPT, origen: 'manual' }, SESSION, {
      comercio: 'Mercadona',
      categoriaPrefill: 'Supermercado',
    });
    expect(learningMock).not.toHaveBeenCalled();
  });

  it('does not touch merchant memory without learning context', async () => {
    await createEntry(RECEIPT, SESSION);
    expect(learningMock).not.toHaveBeenCalled();
  });

  // The unique index is the last line of defence against a double save.
  it('treats a unique violation as an already-saved receipt, not a failure', async () => {
    insertMock.mockRejectedValue(
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );

    await expect(
      createEntry(RECEIPT, SESSION, {
        comercio: 'Mercadona',
        categoriaPrefill: 'Supermercado',
      }),
    ).resolves.toBeUndefined();

    expect(revalidateMock).toHaveBeenCalledWith('/');
  });

  // Counting the same confirmation twice would inflate `veces_confirmado`,
  // which is exactly the number that marks a merchant as trusted.
  it('does not learn twice when the save was a duplicate', async () => {
    insertMock.mockRejectedValue(
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );

    await createEntry(RECEIPT, SESSION, {
      comercio: 'Mercadona',
      categoriaPrefill: 'Supermercado',
    });

    expect(learningMock).not.toHaveBeenCalled();
  });

  it('keeps the entry even when the learning write fails', async () => {
    learningMock.mockRejectedValue(new Error('learning boom'));
    await expect(
      createEntry(RECEIPT, SESSION, {
        comercio: 'Mercadona',
        categoriaPrefill: 'Supermercado',
      }),
    ).resolves.toBeUndefined();
    expect(insertMock).toHaveBeenCalled();
  });
});
