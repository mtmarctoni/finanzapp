/**
 * Options for filtering and paginating finance entries
 */
export type GetEntriesOptions = {
  search?: string
  tipo?: string
  from?: string
  to?: string
  page?: number
  itemsPerPage?: number
}

/**
 * Response structure for paginated entries
 */
export type PaginatedEntriesResponse = {
  data: Array<import('./finance').Entry>
  totalItems: number
  totalPages: number
  currentPage: number
}

/**
 * API response for summary statistics
 */
export type SummaryStatsResponse = import('./finance').SummaryStats

/**
 * Response for duplicate entry request
 */
export type DuplicateEntryResponse = import('./finance').Entry;

/**
 * Standard API error response
 */
export type ApiErrorResponse = {
  error: string
  message: string
  statusCode: number
}
