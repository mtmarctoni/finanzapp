import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import React from "react";

interface SummaryCardsProps {
  sums: { gastos: number; ingresos: number; inversion: number };
  metrics?: {
    totalAmount: number;
    entryCount: number;
    periodCount: number;
    avgPerPeriodAmount: number;
    avgPerPeriodCount: number;
    perAction: {
      Ingreso: { amount: number; count: number };
      Gasto: { amount: number; count: number };
      Inversión: { amount: number; count: number };
    };
    groupBy: "month" | "year";
    useActivePeriods: boolean;
  };
  monthsInRange: number;
  yearsInRange: number;
}

export function SummaryCards({ sums, metrics, monthsInRange, yearsInRange }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {sums.gastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-destructive/10 text-destructive">
              <Calendar className="h-3 w-3" />
              <span>Mes</span>
              <span>{(monthsInRange > 0 ? sums.gastos / monthsInRange : 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-destructive/10 text-destructive">
              <Calendar className="h-3 w-3" />
              <span>Año</span>
              <span>{(yearsInRange > 0 ? sums.gastos / yearsInRange : 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {sums.ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-green-100 text-green-600">
              <Calendar className="h-3 w-3" />
              <span>Mes</span>
              <span>{(monthsInRange > 0 ? sums.ingresos / monthsInRange : 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-green-100 text-green-600">
              <Calendar className="h-3 w-3" />
              <span>Año</span>
              <span>{(yearsInRange > 0 ? sums.ingresos / yearsInRange : 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Inversión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {sums.inversion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-blue-100 text-blue-600">
              <Calendar className="h-3 w-3" />
              <span>Mes</span>
              <span>{(monthsInRange > 0 ? sums.inversion / monthsInRange : 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-blue-100 text-blue-600">
              <Calendar className="h-3 w-3" />
              <span>Año</span>
              <span>{(yearsInRange > 0 ? sums.inversion / yearsInRange : 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total (€) y movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">
            {metrics?.totalAmount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
          <div className="text-sm text-muted-foreground">
            {metrics?.entryCount ?? 0} movimientos
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-muted text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Mes</span>
              <span>{(monthsInRange > 0 ? (metrics?.totalAmount ?? 0) / monthsInRange : 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-muted text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Año</span>
              <span>{(yearsInRange > 0 ? (metrics?.totalAmount ?? 0) / yearsInRange : 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
