/**
 * Options for filtering and paginating finance entries
 */
export type GetEntriesOptions = {
  search?: string;
  tipo?: string;
  from?: string;
  to?: string;
  page?: number;
  itemsPerPage?: number;
  sortBy?: "fecha" | "accion" | "que" | "tipo" | "plataforma_pago" | "cantidad" | "quien";
  sortOrder?: "asc" | "desc";
};

/**
 * Options for filtering and paginating crypto transactions
 */
export type GetCryptoTransactionsOptions = {
  search?: string;
  transactionType?: string;
  cryptoSymbol?: string;
  wallet?: string;
  from?: string;
  to?: string;
  page?: number;
  itemsPerPage?: number;
  sortBy?: "transaction_date" | "crypto_symbol" | "amount" | "transaction_type";
  sortOrder?: "asc" | "desc";
};

/**
 * Response structure for paginated entries
 */
export type PaginatedEntriesResponse = {
  data: Array<import("./finance").Entry>;
  totalItems: number;
  totalPages: number;
  currentPage: number;
};

/**
 * API response for summary statistics
 */
export type SummaryStatsResponse = import("./finance").SummaryStats;

/**
 * Response for duplicate entry request
 */
export type DuplicateEntryResponse = import("./finance").Entry;

/**
 * Response structure for paginated crypto transactions
 */
export type PaginatedCryptoTransactionsResponse = {
  data: Array<import("./finance").CryptoTransaction>;
  totalItems: number;
  totalPages: number;
  currentPage: number;
};

/**
 * Response structure for crypto wallets list
 */
export type CryptoWalletsResponse = {
  data: Array<import("./finance").CryptoWallet>;
};

/**
 * Response structure for crypto holdings summary
 */
export type CryptoHoldingsResponse = {
  data: Array<import("./finance").CryptoHoldingsSummary>;
};

/**
 * Standard API error response
 */
export type ApiErrorResponse = {
  error: string;
  message: string;
  statusCode: number;
};
