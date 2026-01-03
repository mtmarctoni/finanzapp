"use client";

import { useState, useEffect, useCallback } from "react";
import type { CryptoTransaction, CryptoHoldingsSummary } from "@/types/finance";
import type { GetCryptoTransactionsOptions } from "@/types/api";
import {
  getCryptoTransactions,
  getCryptoHoldings,
  getCryptoOptions,
  deleteCryptoTransaction,
} from "@/lib/crypto-data";

interface UseCryptoDataOptions extends GetCryptoTransactionsOptions {
  autoFetch?: boolean;
}

interface UseCryptoDataReturn {
  // Transactions
  transactions: CryptoTransaction[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
  
  // Holdings
  holdings: CryptoHoldingsSummary[];
  holdingsLoading: boolean;
  
  // Options
  cryptoSymbols: string[];
  wallets: string[];
  transactionTypes: { value: string; label: string }[];
  optionsLoading: boolean;
  
  // Actions
  refetch: () => Promise<void>;
  deleteTransaction: (id: string) => Promise<boolean>;
  refetchHoldings: () => Promise<void>;
}

export function useCryptoData(options: UseCryptoDataOptions = {}): UseCryptoDataReturn {
  const { autoFetch = true, ...filterOptions } = options;

  // Transactions state
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Holdings state
  const [holdings, setHoldings] = useState<CryptoHoldingsSummary[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  // Options state
  const [cryptoSymbols, setCryptoSymbols] = useState<string[]>([]);
  const [wallets, setWallets] = useState<string[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<{ value: string; label: string }[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getCryptoTransactions(filterOptions);
      setTransactions(result.data || []);
      setTotalItems(result.total || result.totalItems || 0);
      setTotalPages(result.totalPages || 0);
      setCurrentPage(result.currentPage || 1);
    } catch (err) {
      setError("Failed to fetch transactions");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [
    filterOptions.search,
    filterOptions.transactionType,
    filterOptions.cryptoSymbol,
    filterOptions.wallet,
    filterOptions.from,
    filterOptions.to,
    filterOptions.page,
    filterOptions.itemsPerPage,
    filterOptions.sortBy,
    filterOptions.sortOrder,
  ]);

  // Fetch holdings
  const fetchHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    try {
      const result = await getCryptoHoldings();
      setHoldings(result);
    } catch (err) {
      console.error("Failed to fetch holdings:", err);
    } finally {
      setHoldingsLoading(false);
    }
  }, []);

  // Fetch options
  const fetchOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const result = await getCryptoOptions();
      setCryptoSymbols(result.cryptoSymbols || []);
      setWallets(result.wallets || []);
      setTransactionTypes(result.transactionTypes || []);
    } catch (err) {
      console.error("Failed to fetch options:", err);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  // Delete transaction
  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteCryptoTransaction(id);
    if (success) {
      // Refetch transactions and holdings after deletion
      await Promise.all([fetchTransactions(), fetchHoldings()]);
    }
    return success;
  }, [fetchTransactions, fetchHoldings]);

  // Auto-fetch on mount and when filters change
  useEffect(() => {
    if (autoFetch) {
      fetchTransactions();
    }
  }, [autoFetch, fetchTransactions]);

  // Fetch options on mount
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return {
    transactions,
    totalItems,
    totalPages,
    currentPage,
    isLoading,
    error,
    holdings,
    holdingsLoading,
    cryptoSymbols,
    wallets,
    transactionTypes,
    optionsLoading,
    refetch: fetchTransactions,
    deleteTransaction: handleDelete,
    refetchHoldings: fetchHoldings,
  };
}
