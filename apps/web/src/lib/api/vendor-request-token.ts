import { randomBytes } from "crypto";

/**
 * Generate a secure vendor request token
 * 32 bytes → base64url 43 chars (padding 없음), cryptographically secure
 *
 * §vendor-token-length (2026-08-18 프로덕션 실측) — 생성기는 43자를 만드는데
 * 검증기가 정확히 48자만 통과시켜 견적 회신(/vendor/[token])·입고 회신
 * (/receiving/[token]) 링크가 전부 "Invalid token format" 으로 죽어 있었다.
 * 생성 길이는 유지(기존 발급 토큰 호환), 검증기가 43~48 을 받는다.
 */
export const VENDOR_REQUEST_TOKEN_MIN_LENGTH = 43;
export const VENDOR_REQUEST_TOKEN_MAX_LENGTH = 48;

export function generateVendorRequestToken(): string {
  const bytes = randomBytes(32);

  // Convert to base64url (URL-safe, no padding) — 43 chars
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, VENDOR_REQUEST_TOKEN_MAX_LENGTH);
}

/**
 * Validate vendor request token format
 * base64url alphabet, 43~48 chars (43 = 현행 생성기 · 48 = 과거 문서 상한)
 */
export function isValidVendorRequestToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43,48}$/.test(token);
}
