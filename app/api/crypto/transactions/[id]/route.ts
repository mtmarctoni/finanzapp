import { 
  getCryptoTransactionById, 
  updateCryptoTransaction, 
  deleteCryptoTransaction 
} from "@/lib/cryptoActions";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const transaction = await getCryptoTransactionById(id, { user: { id: session.user.id } });
    
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error fetching crypto transaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto transaction" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    
    const transaction = await updateCryptoTransaction(id, body, { user: { id: session.user.id } });
    
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error updating crypto transaction:", error);
    return NextResponse.json(
      { error: "Failed to update crypto transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteCryptoTransaction(id, { user: { id: session.user.id } });
    
    if (!deleted) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting crypto transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete crypto transaction" },
      { status: 500 }
    );
  }
}
