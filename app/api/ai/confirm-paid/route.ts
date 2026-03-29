import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Store user confirmations (in-memory, per-session)
// In production, you might want to use Redis or a database
interface Confirmation {
  userId: string;
  timestamp: Date;
  confirmed: boolean;
  expiresAt: Date;
}

const confirmations = new Map<string, Confirmation>();

// Confirmation expires after 10 minutes
const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

// Clean up expired confirmations periodically
setInterval(() => {
  const now = new Date();
  for (const [key, value] of confirmations.entries()) {
    if (value.expiresAt < now) {
      confirmations.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const userId = session.user.id;
  const confirmation = confirmations.get(userId);
  
  if (!confirmation) {
    return NextResponse.json({
      confirmed: false,
      message: "No active confirmation found",
    });
  }
  
  if (confirmation.expiresAt < new Date()) {
    confirmations.delete(userId);
    return NextResponse.json({
      confirmed: false,
      message: "Confirmation expired",
    });
  }
  
  return NextResponse.json({
    confirmed: confirmation.confirmed,
    timestamp: confirmation.timestamp.toISOString(),
    expiresAt: confirmation.expiresAt.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { confirmed } = body;
    
    if (typeof confirmed !== "boolean") {
      return NextResponse.json(
        { error: "Missing or invalid 'confirmed' field" },
        { status: 400 }
      );
    }
    
    const userId = session.user.id;
    const now = new Date();
    
    confirmations.set(userId, {
      userId,
      timestamp: now,
      confirmed,
      expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS),
    });
    
    if (confirmed) {
      console.log(`[Paid Fallback] User ${userId} confirmed paid model usage`);
    } else {
      console.log(`[Paid Fallback] User ${userId} declined paid model usage`);
    }
    
    return NextResponse.json({
      success: true,
      confirmed,
      message: confirmed
        ? "You have confirmed paid model usage for this session"
        : "You have declined paid model usage",
      expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS).toISOString(),
    });
  } catch (error) {
    console.error("[Confirmation API Error]", error);
    return NextResponse.json(
      { error: "Failed to process confirmation" },
      { status: 500 }
    );
  }
}

// Helper function to check if user has confirmed (exported for use in other routes)
export function hasUserConfirmedPaidFallback(userId: string): boolean {
  const confirmation = confirmations.get(userId);
  
  if (!confirmation) {
    return false;
  }
  
  if (confirmation.expiresAt < new Date()) {
    confirmations.delete(userId);
    return false;
  }
  
  return confirmation.confirmed;
}
