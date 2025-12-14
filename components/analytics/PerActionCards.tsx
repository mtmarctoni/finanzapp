import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";

interface PerActionCardsProps {
  metrics?: {
    perAction: {
      Ingreso: { amount: number; count: number };
      Gasto: { amount: number; count: number };
      Inversión: { amount: number; count: number };
    };
    avgPerPeriodAmount: number;
    avgPerPeriodCount: number;
    periodCount: number;
    groupBy: "month" | "year";
  };
}

export function PerActionCards({ metrics }: PerActionCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Promedio por {metrics?.groupBy === 'year' ? 'año' : 'mes'} (importe)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(metrics?.avgPerPeriodAmount ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
          <div className="text-sm text-muted-foreground">
            {metrics?.periodCount ?? 0} periodos
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Promedio por {metrics?.groupBy === 'year' ? 'año' : 'mes'} (movimientos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics?.avgPerPeriodCount ?? 0}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Detalle por acción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="font-semibold text-green-600">Ingreso</div>
              <div>{(metrics?.perAction.Ingreso.amount ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
              <div className="text-muted-foreground">{metrics?.perAction.Ingreso.count ?? 0} mov.</div>
            </div>
            <div>
              <div className="font-semibold text-destructive">Gasto</div>
              <div>{(metrics?.perAction.Gasto.amount ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
              <div className="text-muted-foreground">{metrics?.perAction.Gasto.count ?? 0} mov.</div>
            </div>
            <div>
              <div className="font-semibold text-blue-600">Inversión</div>
              <div>{(metrics?.perAction.Inversión.amount ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
              <div className="text-muted-foreground">{metrics?.perAction.Inversión.count ?? 0} mov.</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
