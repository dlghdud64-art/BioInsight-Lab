import { describe, it, expect } from "vitest";
import { extractBlobStoreId } from "@/lib/health/blob-token-probe";

/**
 * §scan-storage-deadend — store id 추출 계약.
 *   Vercel Storage 탭의 store 와 대조하기 위한 식별자만 뽑고 **비밀은 절대 반환하지 않는다.**
 */
describe("§scan-storage-deadend — extractBlobStoreId", () => {
  it("vercel_blob_rw_<storeId>_<secret> 에서 storeId 만", () => {
    expect(extractBlobStoreId("vercel_blob_rw_Ab12Cd34_superSecretPart")).toBe("Ab12Cd34");
  });

  it("비밀 부분은 반환값에 포함되지 않는다", () => {
    const out = extractBlobStoreId("vercel_blob_rw_Store9_TOPSECRET");
    expect(out).not.toContain("TOPSECRET");
    expect(out).toBe("Store9");
  });

  it("토큰 없음·형식 불일치 → null (지어내지 않는다)", () => {
    expect(extractBlobStoreId(undefined)).toBeNull();
    expect(extractBlobStoreId("")).toBeNull();
    expect(extractBlobStoreId("not-a-blob-token")).toBeNull();
  });
});

import { describeBlobToken, BLOB_TOKEN_MARKER } from "@/lib/health/blob-token-probe";

/**
 * §scan-storage-deadend — blobStoreId 가 null 일 때 "파서 버그 vs 값 오류" 를 가르는 축.
 * 🛑 공개 엔드포인트(/api/health)에 실리므로 **시크릿 문자를 한 글자도 반환하면 안 된다.**
 */
describe("§scan-storage-deadend — describeBlobToken (시크릿 미노출)", () => {
  it("정상 blob 토큰 — 마커 분류 · 길이 · clean", () => {
    const t = `${BLOB_TOKEN_MARKER}Store9_${"s".repeat(60)}`;
    const d = describeBlobToken(t);
    expect(d.blobTokenPrefix).toBe(BLOB_TOKEN_MARKER);
    expect(d.blobTokenLength).toBe(t.length);
    expect(d.blobTokenClean).toBe(true);
  });

  it("blob 토큰이 아니면 원문 대신 'other' — 다른 시크릿 앞부분을 흘리지 않는다", () => {
    const secret = "AbCdEf0123456789SuperSecretApiToken";
    const d = describeBlobToken(secret);
    expect(d.blobTokenPrefix).toBe("other");
    // 반환값 어디에도 시크릿 조각이 없어야 한다.
    expect(JSON.stringify(d)).not.toContain(secret.slice(0, 8));
  });

  it("반환 prefix 는 마커 길이(15자)를 넘지 않는다", () => {
    for (const t of [`${BLOB_TOKEN_MARKER}x_y`, "something-else-entirely-long"]) {
      const p = describeBlobToken(t).blobTokenPrefix!;
      expect(p.length).toBeLessThanOrEqual(15);
    }
  });

  it("따옴표·개행 오염 → clean false (붙여넣기 사고 판별)", () => {
    expect(describeBlobToken(`"${BLOB_TOKEN_MARKER}a_b"`).blobTokenClean).toBe(false);
    expect(describeBlobToken(`${BLOB_TOKEN_MARKER}a_b\n`).blobTokenClean).toBe(false);
  });

  it("값 없음 → null/0 (지어내지 않는다)", () => {
    const d = describeBlobToken(undefined);
    // 승계(2026-09-02): blobTokenPrefixTrimmed 축 추가로 shape 확장 — 전 필드 null/0 유지가 계약.
    expect(d).toEqual({
      blobTokenPrefix: null,
      blobTokenLength: 0,
      blobTokenClean: null,
      blobTokenPrefixTrimmed: null,
    });
  });
});

/**
 * §scan-storage-deadend — "값 재입력이면 끝" vs "재발급까지" 를 가르는 축.
 *   호영님 prod 실측: prefix "other" · clean false · length 86 · storeId null →
 *   따옴표/개행 포장 오염 가설. trimmed 재판정이 그 가설을 확정한다.
 */
describe("§scan-storage-deadend — blobTokenPrefixTrimmed", () => {
  const T = `${BLOB_TOKEN_MARKER}Store9_${"s".repeat(60)}`;

  it("큰따옴표 포장 → 원문은 other 인데 trimmed 는 마커 (재입력이면 끝)", () => {
    const d = describeBlobToken(`"${T}"`);
    expect(d.blobTokenPrefix).toBe("other");
    expect(d.blobTokenClean).toBe(false);
    expect(d.blobTokenPrefixTrimmed).toBe(BLOB_TOKEN_MARKER);
  });

  it("작은따옴표·개행·공백 포장도 동일하게 벗겨 재판정", () => {
    for (const wrapped of [`'${T}'`, `${T}\n`, `  ${T}  `, `"${T}"\n`]) {
      expect(describeBlobToken(wrapped).blobTokenPrefixTrimmed).toBe(BLOB_TOKEN_MARKER);
    }
  });

  it("진짜 다른 토큰은 벗겨도 other (재발급 대상)", () => {
    const d = describeBlobToken(`"AbCdEf0123456789SuperSecretApiToken"`);
    expect(d.blobTokenPrefixTrimmed).toBe("other");
  });

  it("trimmed 축도 시크릿을 흘리지 않는다 (분류값만)", () => {
    const secret = "ZZTopSecretValue1234567890";
    const d = describeBlobToken(`"${secret}"`);
    expect(JSON.stringify(d)).not.toContain(secret.slice(0, 8));
    expect(d.blobTokenPrefixTrimmed!.length).toBeLessThanOrEqual(15);
  });

  it("값 없음 → null", () => {
    expect(describeBlobToken(undefined).blobTokenPrefixTrimmed).toBeNull();
  });
});
