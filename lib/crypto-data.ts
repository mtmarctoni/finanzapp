"use client";

import type { CryptoTransaction, CryptoHoldingsSummary, CryptoWallet } from "@/types/finance";
import type { GetCryptoTransactionsOptions } from "@/types/api";
import { ITEMS_PER_PAGE } from "@/config";

/**
 * Fetches crypto transactions from the API with optional filtering and pagination
 */
export async function getCryptoTransactions(options: GetCryptoTransactionsOptions = {}) {
  const {
    search = "",
    transactionType = "",
    cryptoSymbol = "",
    wallet = "",
    from = "",
    to = "",
    page = 1,
    itemsPerPage,
    sortBy,
    sortOrder,
  } = options;

  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (transactionType && transactionType !== "all") params.set("transactionType", transactionType);
    if (cryptoSymbol) params.set("cryptoSymbol", cryptoSymbol);
    if (wallet) params.set("wallet", wallet);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", page.toString());
    params.set("itemsPerPage", (itemsPerPage ?? ITEMS_PER_PAGE).toString());
    if (sortBy) params.set("sortBy", String(sortBy));
    if (sortOrder) params.set("sortOrder", String(sortOrder));

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/crypto/transactions?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return {
      data: [],
      totalItems: 0,
      totalPages: 0,
      currentPage: page,
    };
  }
}

/**
 * Fetches a single crypto transaction by ID
 */
export async function getCryptoTransactionById(id: string): Promise<CryptoTransaction | null> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/crypto/transactions/${id}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}

/**
 * Creates a new crypto transaction
 */
export async function createCryptoTransaction(data: Partial<CryptoTransaction>): Promise<CryptoTransaction | null> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/crypto/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}

/**
 * Updates a crypto transaction
 */
export async function updateCryptoTransaction(id: string, data: Partial<CryptoTransaction>): Promise<CryptoTransaction | null> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/crypto/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}

/**
 * Deletes a crypto transaction
 */
export async function deleteCryptoTransaction(id: string): Promise<boolean> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/crypto/transactions/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("API Error:", error);
    return false;
  }
}

/**
 * Fetches crypto holdings summary
 */
export async function getCryptoHoldings(): Promise<CryptoHoldingsSummary[]> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/crypto/holdings`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error("API Error:", error);
    return [];
  }
}

/**
 * Fetches crypto options (symbols, wallets, transaction types)
 */
export async function getCryptoOptions(): Promise<{
  cryptoSymbols: string[];
  wallets: string[];
  transactionTypes: { value: string; label: string }[];
}> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/crypto/options`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return {
      cryptoSymbols: [],
      wallets: [],
      transactionTypes: [],
    };
  }
}

/**
 * Fetches crypto wallets (saved and used)
 */
export async function getCryptoWallets(): Promise<{
  savedWallets: CryptoWallet[];
  usedWallets: string[];
}> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/crypto/wallets`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return {
      savedWallets: [],
      usedWallets: [],
    };
  }
}
