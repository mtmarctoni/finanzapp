import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VelocityItem } from "@/lib/analytics-charts";
import { TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface SpendingVelocityProps {
  velocities: VelocityItem[];
  loading: boolean;
}

export function SpendingVelocity({ velocities, loading }: SpendingVelocityProps) {
  const growing = velocities.filter((v) => v.direction === "up").slice(0, 3);
  const shrinking = velocities.filter((v) => v.direction === "down").slice(0, 3);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Velocidad de Gasto
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Categorías que más han cambiado respecto al periodo anterior
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Growing */}
            <div>
              <h4 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Creciendo (alerta)
              </h4>
              <div className="space-y-3">
                {growing.length > 0 ? (
                  growing.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="font-medium text-sm truncate">
                          {item.category}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.previous.toLocaleString("es-ES", {
                            style: "currency",
                            currency: "EUR",
                          })}{" "}
                          →{" "}
                          {item.current.toLocaleString("es-ES", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-red-600 font-bold text-sm shrink-0">
                        <ArrowUpRight className="h-4 w-4" />
                        +{item.changePercent.toFixed(0)}%
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Ninguna categoría creciendo significativamente
                  </div>
                )}
              </div>
            </div>

            {/* Shrinking */}
            <div>
              <h4 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4" />
                Reduciendo (bien)
              </h4>
              <div className="space-y-3">
                {shrinking.length > 0 ? (
                  shrinking.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="font-medium text-sm truncate">
                          {item.category}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.previous.toLocaleString("es-ES", {
                            style: "currency",
                            currency: "EUR",
                          })}{" "}
                          →{" "}
                          {item.current.toLocaleString("es-ES", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-green-600 font-bold text-sm shrink-0">
                        <ArrowDownRight className="h-4 w-4" />
                        {item.changePercent.toFixed(0)}%
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Ninguna categoría reduciendo significativamente
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
