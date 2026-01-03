import { getCryptoHoldings } from "@/lib/cryptoActions";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const holdings = await getCryptoHoldings({ user: { id: session.user.id } });
    
    return NextResponse.json({
      data: holdings,
    });
  } catch (error) {
    console.error("Error fetching crypto holdings:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto holdings" },
      { status: 500 }
    );
  }
}
