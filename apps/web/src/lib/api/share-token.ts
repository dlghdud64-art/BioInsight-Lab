import { randomBytes } from "crypto";

/**
 * Generate a secure share token
 * Format: uuidv4 + additional entropy (24 bytes = 48 hex chars)
 * Total length: 36 (uuid) + 48 (entropy) = 84 chars
 */
export function generateShareToken(): string {
  // Generate UUID v4
  const uuid = crypto.randomUUID();

  // Add additional entropy (24 bytes = 48 hex characters)
  const entropy = randomBytes(24).toString("hex");

  // Combine with separator for readability
  return `${uuid}-${entropy}`;
}

/**
 * Validate share token format
 */
export function isValidShareToken(token: string): boolean {
  // Expected format: uuid-hex48
  // uuid: 8-4-4-4-12 = 36 chars
  // hex48: 48 chars
  // total with separator: 85 chars
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{48}$/i;
  return regex.test(token);
}
