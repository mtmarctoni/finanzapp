"use server";

import { createClient, createPool } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

interface EntryFilter {
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

interface Entry {
  id: string;
  fecha: string;
  tipo: string;
  accion: string;
  que: string;
  plataforma_pago: string;
  cantidad: number;
  detalle1?: string;
  detalle2?: string;
}

interface PaginatedEntries {
  entries: Entry[];
  total: number;
  totalPages: number;
}

export async function createUser(formData: { name: string; email: string }) {
  const id = uuidv4();
  try {
    const client = createClient();
    await client.connect();

    try {
      await client.sql`
        INSERT INTO users (id, name, email)
        VALUES (${id}, ${formData.name}, ${formData.email})
      `;
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to create user.");
  }

  revalidatePath("/");
}

export async function getUserByEmail(email: string) {
  try {
    const client = createClient();
    await client.connect();

    try {
      const result = await client.sql`
        SELECT id, name, email
        FROM users
        WHERE email = ${email}
      `;
      return result.rows[0];
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to get user.");
  }
}

export async function createEntry(
  formData: {
    fecha: string;
    tipo: string;
    accion: string;
    que: string;
    plataforma_pago: string;
    cantidad: number;
    detalle1?: string;
    detalle2?: string;
  },
  session: { user: { id: string } }
) {
  const entryId = uuidv4();
  const {
    fecha,
    tipo,
    accion,
    que,
    plataforma_pago,
    cantidad,
    detalle1,
    detalle2,
  } = formData;

  try {
    const client = createClient();
    await client.connect();

    try {
      await client.sql`
        INSERT INTO finance_entries (id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2, user_id)
        VALUES (${entryId}, ${fecha}::timestamptz, ${tipo}, ${accion}, ${que}, ${plataforma_pago}, ${cantidad}, ${
        detalle1 || null
      }, ${detalle2 || null}, ${session.user.id})
      `;
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to create entry.");
  }

  revalidatePath("/");
}

export async function updateEntry(
  entryId: string,
  formData: {
    fecha: string;
    tipo: string;
    accion: string;
    que: string;
    plataforma_pago: string;
    cantidad: number;
    detalle1?: string;
    detalle2?: string;
  },
  session: { user: { id: string } }
) {
  const {
    fecha,
    tipo,
    accion,
    que,
    plataforma_pago,
    cantidad,
    detalle1,
    detalle2,
  } = formData;

  try {
    const client = createClient();
    await client.connect();

    try {
      await client.sql`
        UPDATE finance_entries
        SET fecha = ${fecha}::timestamptz,
            tipo = ${tipo},
            accion = ${accion},
            que = ${que},
            plataforma_pago = ${plataforma_pago},
            cantidad = ${cantidad},
            detalle1 = ${detalle1 || null},
            detalle2 = ${detalle2 || null},
            updated_at = NOW()
        WHERE id = ${entryId}
          AND user_id = ${session.user.id}
      `;
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to update entry.");
  }

  revalidatePath("/");
}

export async function deleteEntry(
  formData: FormData,
  session: { user: { id: string } }
) {
  const client = createClient();
  await client.connect();

  try {
    await client.sql`
      DELETE FROM finance_entries
      WHERE id = ${String(formData.get("entryId"))}
      AND user_id = ${session.user.id}
    `;
    revalidatePath("/");
  } finally {
    await client.end();
  }
}

export async function getEntries(
  filters: EntryFilter,
  session: { user: { id: string } }
): Promise<PaginatedEntries> {
  console.log("Getting entries with filters:", filters);
  const userId = String(session.user.id);
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
  const offset = (page - 1) * itemsPerPage;

  const pool = createPool();

  try {
    console.log("Getting entries with filters:", filters);
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(
        `(
          accion ILIKE $${paramIndex} OR
          que ILIKE $${paramIndex} OR
          tipo ILIKE $${paramIndex} OR
          plataforma_pago ILIKE $${paramIndex} OR
          detalle1 ILIKE $${paramIndex} OR
          detalle2 ILIKE $${paramIndex}
        )`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (accion && accion !== "todos") {
      whereClauses.push(`accion = $${paramIndex}`);
      params.push(accion);
      paramIndex++;
    }

    if (tipo && tipo !== "todos") {
      whereClauses.push(`tipo = $${paramIndex}`);
      params.push(tipo);
      paramIndex++;
    }

    if (from) {
      whereClauses.push(
        `fecha >= ($${paramIndex} || 'T00:00:00.000')::timestamptz`
      );
      params.push(from);
      paramIndex++;
    }

    if (to) {
      whereClauses.push(
        `fecha <= ($${paramIndex} || 'T23:59:59.999')::timestamptz`
      );
      params.push(to);
      paramIndex++;
    }

    whereClauses.push(`user_id = $${paramIndex}`);
    params.push(userId);
    paramIndex++;

    const whereStatment =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    console.log("Final WHERE clause:", whereStatment, params);

    const countQuery = `SELECT COUNT(*)::int AS count FROM finance_entries ${whereStatment}`;
    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0]?.count ?? 0;

    // Build the entries query with parameters
    const allowedSortFields = new Set([
      "fecha",
      "accion",
      "que",
      "tipo",
      "plataforma_pago",
      "cantidad",
    ]);
    const sortField =
      sortBy && allowedSortFields.has(String(sortBy))
        ? String(sortBy)
        : "fecha";
    const sortDirection =
      String(sortOrder)?.toLowerCase() === "asc" ? "ASC" : "DESC";

    const entriesQuery = `SELECT id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2, user_id
      FROM finance_entries
      ${whereStatment}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    const entriesResult = await pool.query(entriesQuery, [
      ...params,
      itemsPerPage,
      offset,
    ]);
    // console.log('entriesResult', entriesResult)
    const entries = entriesResult.rows as Entry[];
    const totalPages = Math.ceil((total || 0) / itemsPerPage);
    // console.log('entries', entries)
    return {
      entries,
      total,
      totalPages,
    };
  } finally {
    await pool.end();
  }
}

export async function deleteManyEntries(
  formData: FormData,
  session: { user: { id: string } }
) {
  const raw = String(formData.get("ids") || "");
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of ids) {
    const fd = new FormData();
    fd.set("entryId", id);
    await deleteEntry(fd, session);
  }
  revalidatePath("/");
}

// Get entries for export (with filters)
export async function getExportEntries(
  { search = "", tipo = "", from = "", to = "" },
  userId: string
) {
  const whereClause = [];
  const params = [];
  let paramIndex = 1;

  if (search) {
    whereClause.push(`(
      accion ILIKE $${paramIndex} OR 
      que ILIKE $${paramIndex} OR 
      plataforma_pago ILIKE $${paramIndex} OR
      detalle1 ILIKE $${paramIndex} OR
      detalle2 ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (tipo) {
    whereClause.push(`tipo = $${paramIndex}`);
    params.push(tipo);
    paramIndex++;
  }

  if (from) {
    whereClause.push(
      `fecha >= ($${paramIndex} || 'T00:00:00.000')::timestamptz`
    );
    params.push(from);
    paramIndex++;
  }

  if (to) {
    whereClause.push(
      `fecha <= ($${paramIndex} || 'T23:59:59.999')::timestamptz`
    );
    params.push(to);
    paramIndex++;
  }

  // Always filter by user
  whereClause.push(`user_id = $${paramIndex}`);
  params.push(userId);

  const whereStatement =
    whereClause.length > 0 ? `WHERE ${whereClause.join(" AND ")}` : "";

  const client = createClient();
  await client.connect();
  try {
    const query = `
      SELECT * FROM finance_entries 
      ${whereStatement}
      ORDER BY fecha DESC
    `;
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    await client.end();
  }
}
