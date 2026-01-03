import { getCryptoSymbols, getUsedWallets } from "@/lib/cryptoActions";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Common crypto symbols for autocomplete
const COMMON_CRYPTO_SYMBOLS = [
  "BTC",
  "ETH",
  "USDT",
  "USDC",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "SOL",
  "DOT",
  "MATIC",
  "SHIB",
  "LTC",
  "TRX",
  "AVAX",
  "LINK",
  "ATOM",
  "UNI",
  "XMR",
  "ETC",
  "XLM",
  "BCH",
  "ALGO",
  "VET",
  "MANA",
  "SAND",
  "AXS",
  "FTM",
  "NEAR",
  "FLOW",
];

// Common transaction types
const TRANSACTION_TYPES = [
  { value: "deposit", label: "Depósito (Compra)" },
  { value: "withdrawal", label: "Retiro (Venta)" },
  { value: "wallet_transfer", label: "Transferencia entre wallets" },
  { value: "exchange", label: "Intercambio entre criptos" },
  { value: "staking", label: "Recompensa de staking" },
  { value: "airdrop", label: "Airdrop" },
  { value: "fee", label: "Comisión" },
  { value: "genesis", label: "Génesis (Origen)" },
];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get user's used symbols and wallets
    const [userSymbols, userWallets] = await Promise.all([
      getCryptoSymbols({ user: { id: session.user.id } }),
      getUsedWallets({ user: { id: session.user.id } }),
    ]);

    // Combine common symbols with user's symbols (user's first, then common ones not already in list)
    const allSymbols = [
      ...userSymbols,
      ...COMMON_CRYPTO_SYMBOLS.filter((s) => !userSymbols.includes(s)),
    ];

    return NextResponse.json({
      cryptoSymbols: allSymbols,
      wallets: userWallets,
      transactionTypes: TRANSACTION_TYPES,
    });
  } catch (error) {
    console.error("Error fetching crypto options:", error);
    return NextResponse.json(
      { error: "Failed to fetch options" },
      { status: 500 }
    );
  }
}
