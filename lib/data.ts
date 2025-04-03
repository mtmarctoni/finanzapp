"use client";

import type { Entry, GetEntriesOptions } from "./definitions"

const ITEMS_PER_PAGE = 10

/**
 * Fetches finance entries from the API with optional filtering and pagination
 */
export async function getFinanceEntries(options: GetEntriesOptions = {}) {
  const { search = "", tipo = "", from = "", to = "", page = 1 } = options
  
  try {
    // Build query parameters for API request
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tipo) params.set('tipo', tipo)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('page', page.toString())
    
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
