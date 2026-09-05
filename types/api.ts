import type { Entry } from './finance';

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
  sortBy?:
    | 'fecha'
    | 'accion'
    | 'que'
    | 'tipo'
    | 'plataforma_pago'
    | 'cantidad'
    | 'quien';
  sortOrder?: 'asc' | 'desc';
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
  sortBy?: 'transaction_date' | 'crypto_symbol' | 'amount' | 'transaction_type';
  sortOrder?: 'asc' | 'desc';
};

/**
 * Response structure for paginated entries
 */
export type PaginatedEntriesResponse = {
  data: Entry[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
};
