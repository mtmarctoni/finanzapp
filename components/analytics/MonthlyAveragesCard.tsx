import { CalendarRange } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type MonthlyAveragesResult } from '@/lib/analytics-charts';
import { cn, formatCurrency } from '@/lib/utils';

const ACTION_ACCENTS: Record<string, string> = {
  Gasto: 'text-destructive',
  Inversión: 'text-blue-600',
  Ingreso: 'text-green-600',
};

interface MonthlyAveragesCardProps {
  result: MonthlyAveragesResult;
  scopeLabel: string;
  loading?: boolean;
}

export function MonthlyAveragesCard({
  result,
  scopeLabel,
  loading,
}: MonthlyAveragesCardProps) {
  const yearsDesc = [...result.byYear].reverse();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CalendarRange className="h-4 w-4" />
          Promedios Mensuales
        </CardTitle>
        <p className="text-xs text-muted-foreground">{scopeLabel}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : result.totalMonths === 0 ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            No hay datos disponibles
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {result.overall.map((stat) => (
                <div key={stat.action}>
                  <div className="text-xs text-muted-foreground">
                    {stat.action} · {result.totalMonths} meses
                  </div>
                  <div
                    className={cn(
                      'text-xl font-bold',
                      ACTION_ACCENTS[stat.action] ?? '',
                    )}
                  >
                    {formatCurrency(stat.average)}
                    <span className="text-xs font-normal text-muted-foreground">
                      {' '}
                      /mes
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <table
              className="w-full text-sm mt-4"
              aria-label={`Promedios mensuales por año en ${scopeLabel}`}
            >
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th scope="col" className="py-1 pr-4 font-medium">
                    Año
                  </th>
                  <th scope="col" className="py-1 pr-4 font-medium">
                    Meses
                  </th>
                  {result.overall.map((stat) => (
                    <th
                      scope="col"
                      key={stat.action}
                      className="py-1 pr-4 font-medium"
                    >
                      {stat.action}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearsDesc.map((year) => (
                  <tr key={year.year} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-medium">{year.year}</td>
                    <td className="py-1.5 pr-4 text-muted-foreground">
                      {year.months}
                    </td>
                    {year.stats.map((stat) => (
                      <td
                        key={stat.action}
                        className={cn(
                          'py-1.5 pr-4',
                          ACTION_ACCENTS[stat.action] ?? '',
                        )}
                      >
                        {formatCurrency(stat.average)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-xs text-muted-foreground mt-3">
              Promedio por mes de calendario entre el primer y el último
              movimiento; los meses sin movimientos cuentan como 0.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
