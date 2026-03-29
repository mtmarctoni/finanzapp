import { NextResponse } from "next/server";
import { getTotalSpent, getCostBreakdown, getRecentCosts, isPaidFallbackAvailable } from "@/lib/ai/fallback";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const totalSpent = getTotalSpent();
    const breakdown = getCostBreakdown();
    const recentCosts = getRecentCosts(10);
    const paidAvailable = isPaidFallbackAvailable();
    
    return NextResponse.json({
      totalSpent,
      formattedTotal: `$${totalSpent.toFixed(6)}`,
      breakdown: {
        freeCalls: breakdown.free,
        paidCallsCost: breakdown.paid,
      },
      recentCosts: recentCosts.map((entry) => ({
        timestamp: entry.timestamp.toISOString(),
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        costUsd: entry.costUsd,
        formattedCost: `$${entry.costUsd.toFixed(6)}`,
        endpoint: entry.endpoint,
      })),
      paidFallbackAvailable: paidAvailable,
    });
  } catch (error) {
    console.error("[Cost API Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve cost data" },
      { status: 500 }
    );
  }
}
