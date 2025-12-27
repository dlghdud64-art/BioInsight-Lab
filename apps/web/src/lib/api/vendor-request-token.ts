import { randomBytes } from "crypto";

/**
 * Generate a secure vendor request token
 * 32-48 characters, cryptographically secure
 */
export function generateVendorRequestToken(): string {
  // Generate 32 bytes = 64 hex characters (48 chars after base64url)
  const bytes = randomBytes(32);

  // Convert to base64url (URL-safe, no padding)
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 48); // Ensure 48 chars
}

/**
 * Validate vendor request token format
 */
export function isValidVendorRequestToken(token: string): boolean {
  // Should be 48 characters, alphanumeric + - and _
  return /^[A-Za-z0-9_-]{48}$/.test(token);
}
