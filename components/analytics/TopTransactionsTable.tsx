import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TopTransactionDatum } from "@/lib/analytics-charts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TopTransactionsTableProps {
  transactions: TopTransactionDatum[];
  loading: boolean;
}

export function TopTransactionsTable({ transactions, loading }: TopTransactionsTableProps) {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Mayores Movimientos</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="hidden sm:table-cell">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const isIncome = tx.action === "Ingreso";
                  const isInvestment = tx.action === "Inversión";
                  const amount = Math.abs(Number(tx.amount));
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(tx.fecha).toLocaleDateString("es-ES")}
                      </TableCell>
                      <TableCell className="font-medium">{tx.category}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isIncome
                              ? "bg-green-100 text-green-700"
                              : isInvestment
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {isIncome ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {tx.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.platform}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          isIncome
                            ? "text-green-600"
                            : isInvestment
                            ? "text-blue-600"
                            : "text-destructive"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                        {tx.detalle1 || tx.detalle2 || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No hay transacciones disponibles
          </div>
        )}
      </CardContent>
    </Card>
  );
}
