import { getCryptoTransactions, createCryptoTransaction, getCryptoSymbols, getUsedWallets } from "@/lib/cryptoActions";
import { ITEMS_PER_PAGE } from "@/config";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const transactionType = searchParams.get("transactionType") || "";
  const cryptoSymbol = searchParams.get("cryptoSymbol") || "";
  const wallet = searchParams.get("wallet") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const itemsPerPage = parseInt(
    searchParams.get("itemsPerPage") || ITEMS_PER_PAGE.toString()
  );
  const sortBy = searchParams.get("sortBy") || "transaction_date";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const filters = {
      search,
      transactionType,
      cryptoSymbol,
      wallet,
      from,
      to,
      page,
      itemsPerPage,
      sortBy,
      sortOrder,
    };

    const result = await getCryptoTransactions(filters, { user: { id: session.user.id } });
    
    return NextResponse.json({
      data: result.transactions,
      total: result.total,
      totalPages: result.totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching crypto transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    const { transaction_type, to_wallet } = body;

    if (transaction_type === "genesis" && !to_wallet) {
      return NextResponse.json({ error: "'to_wallet' is required for genesis transactions." }, { status: 400 });
    }

    const transaction = await createCryptoTransaction(body, { user: { id: session.user.id } });
    
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error creating crypto transaction:", error);
    return NextResponse.json(
      { error: "Failed to create crypto transaction" },
      { status: 500 }
    );
  }
}
