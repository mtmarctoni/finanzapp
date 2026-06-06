// app/api/analytics/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getPool } from '@/lib/db';
import { escapeLikePattern } from '@/lib/utils';

interface TemporalRow {
  period: Date;
  action: string;
  total: number;
  count: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get('search');
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  const groupBy =
    (searchParams.get('groupBy') || 'month').toLowerCase() === 'year'
      ? 'year'
      : 'month';
  const useActivePeriods =
    (searchParams.get('useActivePeriods') || 'false').toLowerCase() === 'true';
  const minAmountParam = searchParams.get('minAmount');
  const maxAmountParam = searchParams.get('maxAmount');
  const minAmount = minAmountParam ? Number(minAmountParam) : undefined;
  const maxAmount = maxAmountParam ? Number(maxAmountParam) : undefined;
  const actionValues = searchParams.getAll('action');
  const accionLegacy = searchParams.get('accion');
  const actions =
    actionValues.length > 0 ? actionValues : accionLegacy ? [accionLegacy] : [];
  const categories = searchParams.getAll('category');
  const platforms = searchParams.getAll('platform');
  const types = searchParams.getAll('type');

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const pool = getPool();

    const queryParams: string[] = [session.user.id];
    const whereClauses: string[] = [`user_id = $1`];
    let paramIndex = 2;

    if (search) {
      const escaped = escapeLikePattern(search.toLowerCase());
      const searchTerm = `%${escaped}%`;
      whereClauses.push(`(
        LOWER(tipo) LIKE $${paramIndex} OR
        LOWER(que) LIKE $${paramIndex} OR
        LOWER(plataforma_pago) LIKE $${paramIndex} OR
        LOWER(COALESCE(detalle1, '')) LIKE $${paramIndex} OR
        LOWER(COALESCE(detalle2, '')) LIKE $${paramIndex} OR
        LOWER(quien) LIKE $${paramIndex}
      )`);
      queryParams.push(searchTerm);
      paramIndex++;
    }

    if (actions.length > 0) {
      const placeholders = actions.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(`accion IN (${placeholders})`);
      for (const a of actions) queryParams.push(a);
    }

    if (fromDate) {
      whereClauses.push(`fecha >= $${paramIndex}`);
      queryParams.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      whereClauses.push(
        `fecha <= $${paramIndex}::date + INTERVAL '1 day - 1 second'`,
      );
      queryParams.push(toDate);
      paramIndex++;
    }

    if (categories.length > 0) {
      const placeholders = categories.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(`que IN (${placeholders})`);
      for (const c of categories) queryParams.push(c);
    }

    if (platforms.length > 0) {
      const placeholders = platforms.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(`plataforma_pago IN (${placeholders})`);
      for (const p of platforms) queryParams.push(p);
    }

    if (types.length > 0) {
      const placeholders = types.map(() => `$${paramIndex++}`).join(', ');
      whereClauses.push(`tipo IN (${placeholders})`);
      for (const t of types) queryParams.push(t);
    }

    if (typeof minAmount === 'number' && !Number.isNaN(minAmount)) {
      whereClauses.push(`cantidad >= $${paramIndex}`);
      queryParams.push(String(minAmount));
      paramIndex++;
    }

    if (typeof maxAmount === 'number' && !Number.isNaN(maxAmount)) {
      whereClauses.push(`cantidad <= $${paramIndex}`);
      queryParams.push(String(maxAmount));
      paramIndex++;
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const truncUnit = groupBy === 'year' ? 'year' : 'month';

    // All queries are independent — run them in parallel
    const [
      temporalData,
      categoryData,
      actionSums,
      overall,
      platformData,
      typeData,
      topTransactions,
      categoryPlatformData,
      tipoQueData,
      categoryTemporalData,
      typeTemporalData,
      categoryStats,
    ] = await Promise.all([
      pool.query(
        `SELECT
          date_trunc('${truncUnit}', fecha) as period,
          accion as action,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY date_trunc('${truncUnit}', fecha), accion
        ORDER BY period, accion`,
        queryParams,
      ),
      pool.query(
        `SELECT
          que as category,
          accion as action,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY que, accion
        HAVING SUM(cantidad) != 0
        ORDER BY total DESC`,
        queryParams,
      ),
      pool.query(
        `SELECT
          accion as action,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY accion
        HAVING SUM(cantidad) != 0`,
        queryParams,
      ),
      pool.query(
        `SELECT
          COALESCE(SUM(cantidad), 0) as total_amount,
          COUNT(*) as entry_count
        FROM finance_entries
        ${whereClause}`,
        queryParams,
      ),
      pool.query(
        `SELECT
          plataforma_pago as platform,
          accion as action,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY plataforma_pago, accion
        HAVING SUM(cantidad) != 0
        ORDER BY total DESC`,
        queryParams,
      ),
      pool.query(
        `SELECT
          tipo as type,
          accion as action,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY tipo, accion
        HAVING SUM(cantidad) != 0
        ORDER BY total DESC`,
        queryParams,
      ),
      pool.query(
        `SELECT
          id, fecha, tipo,
          accion as action,
          que as category,
          plataforma_pago as platform,
          cantidad as amount,
          detalle1, detalle2, quien
        FROM finance_entries
        ${whereClause}
        ORDER BY ABS(cantidad) DESC
        LIMIT 10`,
        queryParams,
      ),
      pool.query(
        `SELECT
          que as category,
          plataforma_pago as platform,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY que, plataforma_pago
        HAVING SUM(cantidad) != 0
        ORDER BY total DESC`,
        queryParams,
      ),
      pool.query(
        `SELECT
          tipo as type,
          que as category,
          accion as action,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY tipo, que, accion
        HAVING SUM(cantidad) != 0
        ORDER BY total DESC`,
        queryParams,
      ),
      pool.query(
        `SELECT
          date_trunc('${truncUnit}', fecha) as period,
          que as category,
          tipo as type,
          accion as action,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY date_trunc('${truncUnit}', fecha), que, tipo, accion
        ORDER BY period, que, accion`,
        queryParams,
      ),
      pool.query(
        `SELECT
          date_trunc('${truncUnit}', fecha) as period,
          tipo as type,
          accion as action,
          SUM(cantidad) as total,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY date_trunc('${truncUnit}', fecha), tipo, accion
        ORDER BY period, tipo, accion`,
        queryParams,
      ),
      pool.query(
        `SELECT
          que as category,
          tipo as type,
          accion as action,
          AVG(ABS(cantidad)) as avg,
          MIN(ABS(cantidad)) as min,
          MAX(ABS(cantidad)) as max,
          COUNT(*) as count
        FROM finance_entries
        ${whereClause}
        GROUP BY que, tipo, accion`,
        queryParams,
      ),
    ]);

    const sums = actionSums.rows.reduce(
      (acc, row) => {
        acc[row.action as string] = row.total as number;
        return acc;
      },
      {} as Record<string, number>,
    );
    const countsByAction = actionSums.rows.reduce(
      (acc, row) => {
        acc[row.action as string] = Number(row.count || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    let periodCount = 0;
    if (useActivePeriods) {
      const periodSet = new Set<string>();
      for (const row of temporalData.rows as unknown as TemporalRow[]) {
        const dt = new Date(row.period);
        const iso =
          truncUnit === 'year'
            ? `${dt.getUTCFullYear()}-01-01`
            : `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`;
        periodSet.add(iso);
      }
      periodCount = periodSet.size;
    } else {
      if (fromDate && toDate) {
        const start = new Date(fromDate);
        const end = new Date(toDate);
        if (truncUnit === 'year') {
          const startYear = start.getUTCFullYear();
          const endYear = end.getUTCFullYear();
          periodCount = Math.max(0, endYear - startYear + 1);
        } else {
          const startYear = start.getUTCFullYear();
          const startMonth = start.getUTCMonth();
          const endYear = end.getUTCFullYear();
          const endMonth = end.getUTCMonth();
          periodCount = Math.max(
            0,
            (endYear - startYear) * 12 + (endMonth - startMonth) + 1,
          );
        }
      } else {
        const periodSet = new Set<string>();
        for (const row of temporalData.rows as unknown as TemporalRow[]) {
          const dt = new Date(row.period);
          const iso =
            truncUnit === 'year'
              ? `${dt.getUTCFullYear()}-01-01`
              : `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`;
          periodSet.add(iso);
        }
        periodCount = periodSet.size;
      }
    }

    const totalAmount = Number(overall.rows[0]?.total_amount || 0);
    const entryCount = Number(overall.rows[0]?.entry_count || 0);

    const netByPeriod = new Map<string, number>();
    for (const row of temporalData.rows as unknown as TemporalRow[]) {
      const key = new Date(row.period).toISOString();
      const amt = Number(row.total || 0);
      const act: string = row.action;
      const current = netByPeriod.get(key) || 0;
      if (act === 'Ingreso') {
        netByPeriod.set(key, current + amt);
      } else {
        netByPeriod.set(key, current - Math.abs(amt));
      }
    }
    const netTemporal = Array.from(netByPeriod.entries())
      .map(([periodIso, net]) => ({ period: periodIso, net }))
      .sort((a, b) => (a.period < b.period ? -1 : 1));

    return NextResponse.json({
      temporalData: temporalData.rows,
      categoryData: categoryData.rows,
      platformData: platformData.rows,
      typeData: typeData.rows,
      topTransactions: topTransactions.rows,
      categoryPlatformData: categoryPlatformData.rows,
      tipoQueData: tipoQueData.rows,
      categoryTemporalData: categoryTemporalData.rows,
      typeTemporalData: typeTemporalData.rows,
      categoryStats: categoryStats.rows,
      sums: {
        gastos: Math.abs(sums['Gasto'] || 0),
        ingresos: Math.abs(sums['Ingreso'] || 0),
        inversion: Math.abs(sums['Inversión'] || 0),
      },
      metrics: {
        totalAmount: Math.abs(totalAmount),
        entryCount,
        periodCount,
        avgPerPeriodAmount:
          periodCount > 0 ? Math.abs(totalAmount) / periodCount : 0,
        avgPerPeriodCount: periodCount > 0 ? entryCount / periodCount : 0,
        perAction: {
          Ingreso: {
            amount: Math.abs(sums['Ingreso'] || 0),
            count: countsByAction['Ingreso'] || 0,
          },
          Gasto: {
            amount: Math.abs(sums['Gasto'] || 0),
            count: countsByAction['Gasto'] || 0,
          },
          Inversión: {
            amount: Math.abs(sums['Inversión'] || 0),
            count: countsByAction['Inversión'] || 0,
          },
        },
        groupBy: truncUnit,
        useActivePeriods,
      },
      netTemporal,
    });
  } catch (error) {
    console.error('Database query error:', error);
    return NextResponse.json(
      { error: 'Error querying database' },
      { status: 500 },
    );
  }
}
