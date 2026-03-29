import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Store user confirmations (in-memory, per-session)
// In production, use Redis or a database for serverless environments
interface Confirmation {
  userId: string;
  timestamp: Date;
  confirmed: boolean;
  expiresAt: Date;
  // Track access time for LRU eviction
  lastAccessedAt: Date;
}

const confirmations = new Map<string, Confirmation>();

// Configuration
const CONFIRMATION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_STORE_SIZE = 1000; // Maximum number of entries before LRU eviction
const CLEANUP_INTERVAL_MS = 60 * 1000; // Clean up every minute

/**
 * Evict oldest entries using LRU strategy when store exceeds max size
 */
function evictOldestIfNeeded(): void {
  if (confirmations.size < MAX_STORE_SIZE) {
    return;
  }
  
  // Find and remove the least recently used entry
  let oldestKey: string | null = null;
  let oldestTime = Date.now();
  
  for (const [key, value] of confirmations.entries()) {
    if (value.lastAccessedAt.getTime() < oldestTime) {
      oldestTime = value.lastAccessedAt.getTime();
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    confirmations.delete(oldestKey);
    console.log(`[Confirmation Store] LRU eviction: removed ${oldestKey}, size: ${confirmations.size}`);
  }
}

/**
 * Clean up expired confirmations
 */
function cleanupExpired(): void {
  const now = new Date();
  let cleaned = 0;
  
  for (const [key, value] of confirmations.entries()) {
    if (value.expiresAt < now) {
      confirmations.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Confirmation Store] Cleaned up ${cleaned} expired entries, size: ${confirmations.size}`);
  }
}

// Clean up expired confirmations periodically
setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  
  const userId = session.user.id;
  const confirmation = confirmations.get(userId);
  
  if (!confirmation) {
    return NextResponse.json({
      confirmed: false,
      message: "No hay confirmación activa",
    });
  }
  
  if (confirmation.expiresAt < new Date()) {
    confirmations.delete(userId);
    return NextResponse.json({
      confirmed: false,
      message: "La confirmación ha expirado",
    });
  }
  
  // Update last accessed time for LRU tracking
  confirmation.lastAccessedAt = new Date();
  
  return NextResponse.json({
    confirmed: confirmation.confirmed,
    timestamp: confirmation.timestamp.toISOString(),
    expiresAt: confirmation.expiresAt.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { confirmed } = body;
    
    if (typeof confirmed !== "boolean") {
      return NextResponse.json(
        { error: "Falta el campo 'confirmed' o es inválido" },
        { status: 400 }
      );
    }
    
    const userId = session.user.id;
    const now = new Date();
    
    // Evict oldest entries if we're at capacity
    evictOldestIfNeeded();
    
    confirmations.set(userId, {
      userId,
      timestamp: now,
      confirmed,
      expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS),
      lastAccessedAt: now,
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
        ? "Has confirmado el uso del modelo de pago para esta sesión"
        : "Has rechazado el uso del modelo de pago",
      expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS).toISOString(),
    });
  } catch (error) {
    console.error("[Confirmation API Error]", error);
    return NextResponse.json(
      { error: "Error al procesar la confirmación" },
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
  
  // Update last accessed time for LRU tracking
  confirmation.lastAccessedAt = new Date();
  
  return confirmation.confirmed;
}
