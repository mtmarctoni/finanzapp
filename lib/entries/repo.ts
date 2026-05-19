import { v4 as uuidv4 } from 'uuid';
import { withClient, withPool } from '@/lib/db';
import { escapeLikePattern } from '@/lib/utils';

/**
 * Database access for the `finance_entries` table.
 *
 * This module is intentionally *not* marked with the `"use server"`
 * directive. It is plain async TypeScript that runs only on the server
 * (it imports `@vercel/postgres`). The server-action surface that
 * client components call into lives in `lib/actions.ts`, which simply
 * forwards to the functions exported here.
 *
 * Why split? `lib/actions.ts` had grown into a 415-line file mixing
 * user CRUD, entry CRUD, query building, and pagination together,
 * making it the single largest lib module in the codebase. The
 * "use server" directive also prevents extracting helpers (every
 * export must be async). Pulling the SQL into a normal module makes
 * it possible to reuse, test, and reason about each operation.
 */

export interface EntryFilter {
  search?: string;
  accion?: string;
  tipo?: string;
  from?: string;
  to?: string;
  page: number;
  itemsPerPage: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface Entry {
  id: string;
  fecha: string;
  tipo: string;
  accion: string;
  que: string;
  plataforma_pago: string;
  cantidad: number;
  detalle1?: string;
  detalle2?: string;
  quien?: string;
}

export interface PaginatedEntries {
  entries: Entry[];
  total: number;
  totalPages: number;
}

export interface EntryInput {
  fecha: string;
  tipo: string;
  accion: string;
  que: string;
  plataforma_pago: string;
  cantidad: number;
  detalle1?: string;
  detalle2?: string;
  quien?: string;
}

const ALLOWED_SORT_FIELDS = new Set([
  'fecha',
  'accion',
  'que',
  'tipo',
  'plataforma_pago',
  'cantidad',
  'quien',
]);

function resolveSort(
  sortBy: string | undefined,
  sortOrder: string | undefined,
): { sortField: string; sortDirection: 'ASC' | 'DESC' } {
  const sortField =
    sortBy && ALLOWED_SORT_FIELDS.has(String(sortBy))
      ? String(sortBy)
      : 'fecha';
  const sortDirection =
    String(sortOrder ?? '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { sortField, sortDirection };
}

interface FilterCompilation {
  whereStatement: string;
  params: (string | number)[];
}

/**
 * Compile a user-controlled filter into a parameterized WHERE clause.
 * The user_id predicate is appended unconditionally so callers cannot
 * forget the per-user scope.
 */
function compileFilter(
  filter: Omit<EntryFilter, 'page' | 'itemsPerPage' | 'sortBy' | 'sortOrder'>,
  userId: string,
): FilterCompilation {
  const whereClauses: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (filter.search) {
    whereClauses.push(
      `(
        accion ILIKE $${paramIndex} OR
        que ILIKE $${paramIndex} OR
        tipo ILIKE $${paramIndex} OR
        plataforma_pago ILIKE $${paramIndex} OR
        detalle1 ILIKE $${paramIndex} OR
        detalle2 ILIKE $${paramIndex} OR
        quien ILIKE $${paramIndex}
      )`,
    );
    params.push(`%${escapeLikePattern(filter.search)}%`);
    paramIndex++;
  }

  if (filter.accion && filter.accion !== 'todos') {
    whereClauses.push(`accion = $${paramIndex}`);
    params.push(filter.accion);
    paramIndex++;
  }

  if (filter.tipo && filter.tipo !== 'todos') {
    whereClauses.push(`tipo = $${paramIndex}`);
    params.push(filter.tipo);
    paramIndex++;
  }

  if (filter.from) {
    whereClauses.push(
      `fecha >= ($${paramIndex} || 'T00:00:00.000')::timestamptz`,
    );
    params.push(filter.from);
    paramIndex++;
  }

  if (filter.to) {
    whereClauses.push(
      `fecha <= ($${paramIndex} || 'T23:59:59.999')::timestamptz`,
    );
    params.push(filter.to);
    paramIndex++;
  }

  whereClauses.push(`user_id = $${paramIndex}`);
  params.push(userId);

  return {
    whereStatement:
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params,
  };
}

export async function findEntries(
  filters: EntryFilter,
  userId: string,
): Promise<PaginatedEntries> {
  const {
    search,
    accion,
    tipo,
    from,
    to,
    page,
    itemsPerPage,
    sortBy,
    sortOrder,
  } = filters;
  const { whereStatement, params } = compileFilter(
    { search, accion, tipo, from, to },
    userId,
  );
  const { sortField, sortDirection } = resolveSort(sortBy, sortOrder);
  const offset = (page - 1) * itemsPerPage;

  return withPool(async (pool) => {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM finance_entries ${whereStatement}`,
      params,
    );
    const total: number = countResult.rows[0]?.count ?? 0;

    const entriesResult = await pool.query(
      `SELECT id, fecha, tipo, accion, que, plataforma_pago, cantidad,
              detalle1, detalle2, quien, user_id
         FROM finance_entries
         ${whereStatement}
         ORDER BY ${sortField} ${sortDirection}
         LIMIT $${params.length + 1}
         OFFSET $${params.length + 2}`,
      [...params, itemsPerPage, offset],
    );

    return {
      entries: entriesResult.rows as Entry[],
      total,
      totalPages: Math.ceil((total || 0) / itemsPerPage),
    };
  });
}

export async function exportEntries(
  filter: { search?: string; tipo?: string; from?: string; to?: string },
  userId: string,
): Promise<Entry[]> {
  const { whereStatement, params } = compileFilter(
    {
      search: filter.search ?? '',
      tipo: filter.tipo ?? '',
      from: filter.from ?? '',
      to: filter.to ?? '',
    },
    userId,
  );

  return withClient(async (client) => {
    const result = await client.query(
      `SELECT * FROM finance_entries
         ${whereStatement}
         ORDER BY fecha DESC`,
      params,
    );
    return result.rows as Entry[];
  });
}

export async function insertEntry(
  data: EntryInput,
  userId: string,
): Promise<string> {
  const entryId = uuidv4();
  await withClient(async (client) => {
    await client.sql`
      INSERT INTO finance_entries (
        id, fecha, tipo, accion, que, plataforma_pago, cantidad,
        detalle1, detalle2, quien, user_id
      ) VALUES (
        ${entryId},
        ${data.fecha}::timestamptz,
        ${data.tipo},
        ${data.accion},
        ${data.que},
        ${data.plataforma_pago},
        ${data.cantidad},
        ${data.detalle1 || null},
        ${data.detalle2 || null},
        ${data.quien || 'Yo'},
        ${userId}
      )
    `;
  });
  return entryId;
}

export async function updateEntryById(
  entryId: string,
  data: EntryInput,
  userId: string,
): Promise<void> {
  await withClient(async (client) => {
    await client.sql`
      UPDATE finance_entries
         SET fecha           = ${data.fecha}::timestamptz,
             tipo            = ${data.tipo},
             accion          = ${data.accion},
             que             = ${data.que},
             plataforma_pago = ${data.plataforma_pago},
             cantidad        = ${data.cantidad},
             detalle1        = ${data.detalle1 || null},
             detalle2        = ${data.detalle2 || null},
             quien           = ${data.quien || 'Yo'},
             updated_at      = NOW()
       WHERE id = ${entryId}
         AND user_id = ${userId}
    `;
  });
}

export async function deleteEntryById(
  entryId: string,
  userId: string,
): Promise<void> {
  await withClient(async (client) => {
    await client.sql`
      DELETE FROM finance_entries
       WHERE id = ${entryId}
         AND user_id = ${userId}
    `;
  });
}

export async function deleteEntriesByIds(
  ids: string[],
  userId: string,
): Promise<void> {
  if (ids.length === 0) return;
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM finance_entries
        WHERE user_id = $1
          AND id = ANY($2::uuid[])`,
      [userId, ids],
    );
  });
}
