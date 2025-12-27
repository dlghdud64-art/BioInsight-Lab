/**
 * Temporary file cache for import operations
 * In production, consider using Redis or session storage
 */

interface CachedFile {
  rows: any[];
  filename: string;
  timestamp: number;
}

export const fileCache = new Map<string, CachedFile>();

/**
 * Clean up old cache entries (older than 30 minutes)
 */
export function cleanupFileCache() {
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;

  for (const [key, value] of fileCache.entries()) {
    if (now - value.timestamp > thirtyMinutes) {
      fileCache.delete(key);
    }
  }
}

