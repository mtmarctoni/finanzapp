/**
 * Core finance entry type representing a financial transaction
 */
export type Entry = {
  id: string;
  fecha: string;
  tipo: string;
  accion: string;
  que: string;
  plataforma_pago: string;
  cantidad: number;
  detalle1: string | null;
  detalle2: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Summary statistics for the dashboard
 */
export type SummaryStats = {
  totalIncome: number;
  incomeCount: number;
  totalExpense: number;
  expenseCount: number;
  totalInvestment: number;
  investmentCount: number;
  netBalance: number;
  monthlyData: MonthlyData[];
};

/**
 * Monthly aggregated data for charts
 */
export type MonthlyData = {
  month: string;
  income: number;
  expense: number;
  investment: number;
};

/**
 * Transaction types
 */
export type TransactionType = "Ingreso" | "Gasto" | "Inversión" | "todos";

/**
 * Recurring record type
 */
export type RecurringRecord = {
  /**
   * Unique identifier for the recurring record
   */
  id: string;
  /**
   * Name of the recurring record
   */
  name: string;
  /**
   * Type of transaction (Ingreso, Gasto, Inversión)
   */
  accion: "Ingreso" | "Gasto" | "Inversión";
  /**
   * Type of transaction (e.g. 'Ingreso', 'Gasto', 'Inversión')
   */
  tipo: string;
  /**
   * First detail of the recurring record
   */
  detalle1: string;
  /**
   * Second detail of the recurring record
   */
  detalle2: string;
  /**
   * Amount of the recurring record
   */
  amount: number;
  /**
   * Frequency of the recurring record (monthly, weekly, biweekly, or yearly)
   */
  frequency: "monthly" | "weekly" | "biweekly" | "yearly";
  /**
   * Whether the recurring record is active or not
   */
  active: boolean;
  /**
   * Day of the month for the recurring record
   */
  dia: number;
  /**
   * Payment platform of the recurring record
   */
  plataforma_pago: string;
  /**
   * Date of the last generated transaction (null if never generated)
   */
  lastGenerated: string | null;
  /**
   * Date the recurring record was created
   */
  createdAt: string;
  /**
   * Date the recurring record was last updated
   */
  updatedAt: string;
};

/**
 * Crypto transaction types
 */
export type CryptoTransactionType =
  | "deposit" // Buying crypto (linked to finance_entries with tipo="Cripto D")
  | "withdrawal" // Selling crypto (linked to finance_entries with tipo="Cripto W")
  | "wallet_transfer" // Moving crypto between wallets
  | "exchange" // Trading one crypto for another
  | "staking" // Staking rewards
  | "airdrop" // Received airdrop
  | "fee" // Network/transaction fees
  | "genesis"; // Initial acquisition (not linked to finance_entries)

/**
 * Crypto wallet types
 */
export type CryptoWalletType = "exchange" | "hardware" | "software" | "paper";

/**
 * Crypto transaction record
 */
export type CryptoTransaction = {
  id: string;
  recordId: string | null; // Link to finance_entries (for deposits/withdrawals)
  transactionType: CryptoTransactionType;
  cryptoSymbol: string; // e.g., BTC, ETH, USDT
  amount: number;
  priceAtTransaction: number | null; // Fiat price at time of transaction
  toCryptoSymbol: string | null; // For exchanges
  toAmount: number | null; // Amount received in exchange
  fromWallet: string | null;
  toWallet: string | null;
  fee: number;
  feeCrypto: string | null;
  notes: string | null;
  transactionDate: string;
  externalTxId: string | null; // Blockchain tx ID or exchange order ID
  userId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Crypto wallet record
 */
export type CryptoWallet = {
  id: string;
  userId: string;
  name: string;
  walletType: CryptoWalletType;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Form data for creating/updating crypto transactions
 */
export type CryptoTransactionFormData = {
  recordId?: string | null;
  transactionType: CryptoTransactionType;
  cryptoSymbol: string;
  amount: number;
  priceAtTransaction?: number | null;
  toCryptoSymbol?: string | null;
  toAmount?: number | null;
  fromWallet?: string | null;
  toWallet?: string | null;
  fee?: number;
  feeCrypto?: string | null;
  notes?: string | null;
  transactionDate: string;
  externalTxId?: string | null;
};

/**
 * Summary of crypto holdings
 */
export type CryptoHoldingsSummary = {
  symbol: string;
  totalAmount: number;
  totalInvested: number;
  averagePrice: number;
  currentValue?: number; // Will be populated when we add price API
  profitLoss?: number;
  profitLossPercent?: number;
};
