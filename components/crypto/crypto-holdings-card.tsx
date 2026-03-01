"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { CryptoHoldingsSummary } from "@/types/finance"

interface CryptoHoldingsCardProps {
  holdings: CryptoHoldingsSummary[]
  loading?: boolean
}

export function CryptoHoldingsCard({ holdings, loading }: CryptoHoldingsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No hay holdings registrados
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {holdings.map((holding) => (
            <div key={holding.symbol} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div>
                <div className="font-medium">{holding.symbol}</div>
                <div className="text-sm text-muted-foreground">
                  {holding.totalAmount.toLocaleString('es-ES', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 8 
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono">
                  €{holding.totalInvested.toLocaleString('es-ES', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </div>
                <div className="text-sm text-muted-foreground">
                  Avg: €{holding.averagePrice.toLocaleString('es-ES', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
