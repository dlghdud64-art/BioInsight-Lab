/**
 * P1-1 Slice-1E — Date Normalization Utility
 *
 * Absorbs Date handling differences between MEMORY and PRISMA adapters.
 * Memory repos use JSON.parse(JSON.stringify()) which converts Date → ISO string.
 * Prisma repos return native Date objects.
 *
 * This normalizer ensures a consistent Date contract at the runtime boundary.
 */

/**
 * Normalize a value to a JavaScript Date instance.
 * Accepts: Date, ISO string, epoch number.
 * Throws TypeError for invalid/unparseable input.
 */
export function normalizeDate(value: Date | string | number): Date {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      throw new TypeError("normalizeDate: received invalid Date instance");
    }
    return value;
  }

  if (typeof value === "string") {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new TypeError(`normalizeDate: cannot parse string "${value}" as Date`);
    }
    return d;
  }

  if (typeof value === "number") {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new TypeError(`normalizeDate: cannot parse number ${value} as Date`);
    }
    return d;
  }

  throw new TypeError(`normalizeDate: unsupported type ${typeof value}`);
}

/**
 * Same as normalizeDate but returns null for null/undefined.
 */
export function normalizeDateOptional(
  value: Date | string | number | null | undefined
): Date | null {
  if (value === null || value === undefined) return null;
  return normalizeDate(value);
}
