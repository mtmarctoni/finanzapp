import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PiggyBank } from "lucide-react";

interface SavingsRateCardProps {
  income: number;
  expenses: number;
}

export function SavingsRateCard({ income, expenses }: SavingsRateCardProps) {
  const savings = income - expenses;
  const rate = income > 0 ? (savings / income) * 100 : 0;
  const isPositive = savings >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <PiggyBank className="h-4 w-4" />
          Tasa de Ahorro
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${isPositive ? "text-green-600" : "text-destructive"}`}>
          {rate.toFixed(1)}%
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {isPositive ? "Ahorrando" : "Gastando más de lo que entra"}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Gastos</span>
            <span>{Math.min(100, Math.max(0, 100 - rate)).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${isPositive ? "bg-green-500" : "bg-destructive"}`}
              style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-2">
            <span className="text-muted-foreground">Ingresos</span>
            <span className="font-medium">
              {income.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
            </span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Gastos</span>
            <span className="font-medium">
              {expenses.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
            </span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Neto</span>
            <span className={`font-medium ${isPositive ? "text-green-600" : "text-destructive"}`}>
              {savings.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
