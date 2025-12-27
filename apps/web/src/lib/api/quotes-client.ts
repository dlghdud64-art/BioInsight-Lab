/**
 * Client-side API utilities for Quote management
 * Supports both authenticated users and guest users via guestKey
 */

export interface QuoteItem {
  id?: string;
  productId?: string;
  name: string;
  brand?: string;
  catalogNumber?: string;
  unit?: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
  raw?: Record<string, unknown>;
}

export interface Quote {
  id: string;
  userId?: string | null;
  guestKey?: string | null;
  title: string;
  description?: string | null;
  status: string;
  currency: string;
  totalAmount?: number | null;
  items: QuoteItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteInput {
  title?: string;
  description?: string;
  items: QuoteItem[];
}

export interface UpdateQuoteInput {
  title?: string;
  description?: string;
  status?: string;
  items?: QuoteItem[];
}

/**
 * Create a new quote
 */
export async function createQuote(input: CreateQuoteInput): Promise<{ id: string; quote: Quote }> {
  const response = await fetch("/api/quotes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create quote");
  }

  return response.json();
}

/**
 * Get a specific quote by ID
 */
export async function getQuote(id: string): Promise<{ quote: Quote }> {
  const response = await fetch(`/api/quotes/${id}`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch quote");
  }

  return response.json();
}

/**
 * Update a quote
 */
export async function updateQuote(id: string, input: UpdateQuoteInput): Promise<{ quote: Quote }> {
  const response = await fetch(`/api/quotes/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update quote");
  }

  return response.json();
}

/**
 * Delete a quote
 */
export async function deleteQuote(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/quotes/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete quote");
  }

  return response.json();
}

/**
 * Get all quotes for the current user/guest
 */
export async function getQuotes(): Promise<{ quotes: Quote[] }> {
  const response = await fetch("/api/quotes", {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch quotes");
  }

  return response.json();
}

/**
 * Share-related types and functions
 */

export interface ShareInfo {
  shareToken: string;
  enabled: boolean;
  expiresAt?: string | null;
  shareUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateShareInput {
  enabled?: boolean;
  expiresInDays?: number; // 1-365
}

/**
 * Create or update share link for a quote
 */
export async function createQuoteShare(
  quoteId: string,
  input: CreateShareInput = { enabled: true }
): Promise<ShareInfo> {
  const response = await fetch(`/api/quotes/${quoteId}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create share link");
  }

  return response.json();
}

/**
 * Get share information for a quote
 */
export async function getQuoteShare(quoteId: string): Promise<{ share: ShareInfo | null }> {
  const response = await fetch(`/api/quotes/${quoteId}/share`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch share info");
  }

  return response.json();
}

/**
 * Disable share link for a quote
 */
export async function deleteQuoteShare(quoteId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/quotes/${quoteId}/share`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete share link");
  }

  return response.json();
}

/**
 * Get shared quote by token (public endpoint)
 */
export async function getSharedQuote(token: string): Promise<{
  quote: Quote;
  share: { expiresAt?: string | null; createdAt: string };
}> {
  const response = await fetch(`/api/share/${token}`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch shared quote");
  }

  return response.json();
}
