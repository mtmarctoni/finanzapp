"use client";

import type { Entry, GetEntriesOptions } from "./definitions"

// Number of items to display per page
const ITEMS_PER_PAGE = 50

/**
 * Fetches finance entries from the API with optional filtering and pagination
 */
export async function getFinanceEntries(options: GetEntriesOptions = {}) {
  const { search = "", accion = "todos", from = "", to = "", page = 1 } = options

  try {
    // Build query parameters for API request
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (accion && accion !== 'todos') params.set('accion', accion)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('page', page.toString())
    params.set('itemsPerPage', ITEMS_PER_PAGE.toString())

    // Call API route instead of connecting directly to database
    // Use absolute URL to avoid parsing errors
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const response = await fetch(`${baseUrl}/api/entries?${params.toString()}`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("API Error:", error)
    return {
      data: [],
      totalItems: 0,
      totalPages: 0,
      currentPage: page,
    }
  }
}

/**
 * Fetches a single entry by ID from the API
 */
export async function getEntryById(id: string): Promise<Entry | null> {
  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const response = await fetch(`${baseUrl}/api/entries/${id}`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("API Error:", error)
    return null
  }
}

/**
 * Duplicates an existing entry by ID
 */
export async function duplicateEntry(id: string): Promise<Entry | null> {
  try {
    // call duplicate api request with the entry id to duplicate
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const response = await fetch(`${baseUrl}/api/entries/${id}/duplicate`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error duplicating entry:", error)
    throw error // Re-throw to allow handling in the component
  }
}

/**
 * Fetches summary statistics from the API
 */
export async function getSummaryStats() {
  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const response = await fetch(`${baseUrl}/api/stats`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("API Error:", error)
    return {
      totalIncome: 0,
      incomeCount: 0,
      totalExpense: 0,
      totalInvestment: 0,
      investmentCount: 0,
      expenseCount: 0,
      balance: 0
    }
  }
}
