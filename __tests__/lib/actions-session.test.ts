/** @jest-environment node */

import {
  createEntry,
  deleteEntry,
  deleteManyEntries,
  updateEntry,
} from '@/lib/actions';
import {
  deleteEntriesByIds,
  deleteEntryById,
  insertEntry,
  updateEntryById,
  type EntryInput,
} from '@/lib/entries/repo';
import { requireSessionUserId } from '@/lib/session';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/entries/repo', () => ({
  insertEntry: jest.fn(),
  isUniqueViolation: jest.fn(() => false),
  updateEntryById: jest.fn(),
  deleteEntryById: jest.fn(),
  deleteEntriesByIds: jest.fn(),
}));
jest.mock('@/lib/users/repo', () => ({
  findUserByEmail: jest.fn(),
  insertUser: jest.fn(),
}));
jest.mock('@/lib/merchants/repo', () => ({
  applyMerchantConfirmation: jest.fn(),
}));
jest.mock('@/lib/server-data', () => ({ ensureCategory: jest.fn() }));
jest.mock('@/lib/session', () => ({ requireSessionUserId: jest.fn() }));

const sessionMock = requireSessionUserId as jest.MockedFunction<
  typeof requireSessionUserId
>;

const ENTRY: EntryInput = {
  fecha: '2026-09-20T12:00:00.000Z',
  tipo: 'Supermercado',
  accion: 'Gasto',
  que: 'Mercadona',
  plataforma_pago: 'Visa',
  cantidad: 10,
};

// Server actions are public POST endpoints, so a caller can send any extra
// argument it likes. These casts stand in for a forged request that still
// passes another user's id the way the old signatures accepted it.
const FORGED = { user: { id: 'victim' } };
type Loose = (...args: unknown[]) => Promise<unknown>;

function idsForm(field: string, value: string) {
  const formData = new FormData();
  formData.set(field, value);
  return formData;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('entry server actions take the user from the session', () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue('user-1');
  });

  it('createEntry ignores a caller-supplied user id', async () => {
    await (createEntry as Loose)(ENTRY, FORGED);
    expect(insertEntry).toHaveBeenCalledWith(ENTRY, 'user-1');
  });

  it('updateEntry ignores a caller-supplied user id', async () => {
    await (updateEntry as Loose)('e-1', ENTRY, FORGED);
    expect(updateEntryById).toHaveBeenCalledWith('e-1', ENTRY, 'user-1');
  });

  it('deleteEntry ignores a caller-supplied user id', async () => {
    await (deleteEntry as Loose)(idsForm('entryId', 'e-1'), FORGED);
    expect(deleteEntryById).toHaveBeenCalledWith('e-1', 'user-1');
  });

  it('deleteManyEntries ignores a caller-supplied user id', async () => {
    await (deleteManyEntries as Loose)(idsForm('ids', 'e-1,e-2'), FORGED);
    expect(deleteEntriesByIds).toHaveBeenCalledWith(['e-1', 'e-2'], 'user-1');
  });
});

describe('entry server actions without a session', () => {
  beforeEach(() => {
    sessionMock.mockRejectedValue(new Error('Not authenticated'));
  });

  it('createEntry writes nothing', async () => {
    await expect((createEntry as Loose)(ENTRY, FORGED)).rejects.toThrow(
      'Not authenticated',
    );
    expect(insertEntry).not.toHaveBeenCalled();
  });

  it('updateEntry writes nothing', async () => {
    await expect((updateEntry as Loose)('e-1', ENTRY, FORGED)).rejects.toThrow(
      'Not authenticated',
    );
    expect(updateEntryById).not.toHaveBeenCalled();
  });

  it('deleteEntry deletes nothing', async () => {
    await expect(
      (deleteEntry as Loose)(idsForm('entryId', 'e-1'), FORGED),
    ).rejects.toThrow('Not authenticated');
    expect(deleteEntryById).not.toHaveBeenCalled();
  });

  it('deleteManyEntries deletes nothing', async () => {
    await expect(
      (deleteManyEntries as Loose)(idsForm('ids', 'e-1'), FORGED),
    ).rejects.toThrow('Not authenticated');
    expect(deleteEntriesByIds).not.toHaveBeenCalled();
  });
});
