// Re-export types from the centralized types folder
// This file is kept for backward compatibility
export * from '../types/finance';
export * from '../types/api';

export interface GetEntriesOptions {
  search?: string;
  accion?: string;
  from?: string;
  to?: string;
  page?: number;
  itemsPerPage?: number;
}
