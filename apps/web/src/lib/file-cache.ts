// Store parsed data temporarily (in production, use Redis or session storage)
export const fileCache = new Map<string, { rows: any[]; filename: string; timestamp: number }>();

// Clean up old cache entries (older than 30 minutes)
export function cleanupFileCache() {
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;

  for (const [key, value] of fileCache.entries()) {
    if (now - value.timestamp > thirtyMinutes) {
      fileCache.delete(key);
    }
  }
}
