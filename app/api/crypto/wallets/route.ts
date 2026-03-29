import {
  getCryptoWallets,
  createCryptoWallet,
  getUsedWallets,
} from "@/lib/cryptoActions";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get both saved wallets and used wallets from transactions
    const [savedWallets, usedWallets] = await Promise.all([
      getCryptoWallets({ user: { id: session.user.id } }),
      getUsedWallets({ user: { id: session.user.id } }),
    ]);

    return NextResponse.json({
      savedWallets,
      usedWallets,
    });
  } catch (error) {
    console.error("Error fetching wallets:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallets" },
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

    const wallet = await createCryptoWallet(body, {
      user: { id: session.user.id },
    });

    return NextResponse.json(wallet, { status: 201 });
  } catch (error) {
    console.error("Error creating wallet:", error);
    return NextResponse.json(
      { error: "Failed to create wallet" },
      { status: 500 }
    );
  }
}
