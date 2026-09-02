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
