/**
 * §safety-redesign write — 안전 페이지 write no-op 해소 (호영님 2026-06-27)
 *
 * 안전 페이지는 product-scoped(/api/safety/products → Product). write 핸들러가
 * front-only no-op(setTimeout+로컬 setItems+성공 토스트, 영속 0) 이던 기존 LabAxis 위반 해소:
 *  - MSDS  = 실 업로드(POST /api/products/[id]/sds, multipart file) → 성공 시 refetch(canonical 재계산).
 *  - 점검  = 재고(lot, ProductInventory) 단위 엔드포인트 → 물질 단위 화면에선 disabled+사유.
 *  - 폐기  = 재고 단위 처리 → disabled+사유.
 * 가짜 성공(setTimeout 지연 + 로컬 flip + 등록/기록/제거 완료 토스트) 전면 제거.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"),
  "utf8",
);
// 설명 주석의 토큰이 not.toMatch 오탐 내지 않도록 주석 strip 후 코드만 검사.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§safety-redesign write — MSDS 실 업로드 배선", () => {
  it("productIdByLocalId 맵 캡처(로컬 id → 실 Product.id deep-link)", () => {
    expect(CODE).toMatch(/setProductIdByLocalId/);
    expect(CODE).toMatch(/adaptSafetyProducts\(safetyQuery\.data\)/);
  });
  it("MSDS 핸들러: POST /api/products/[id]/sds (multipart FormData, file)", () => {
    expect(CODE).toMatch(/\/api\/products\/\$\{productId\}\/sds/);
    expect(CODE).toMatch(/method:\s*["']POST["']/);
    expect(CODE).toMatch(/new FormData\(\)/);
    expect(CODE).toMatch(/fd\.append\(["']file["']/);
  });
  it("성공 시 canonical refetch (로컬 낙관 flip 아님)", () => {
    expect(CODE).toMatch(/safetyQuery\.refetch\(\)/);
  });
  it("스토리지 미설정(503)·파일필요(400) 에러 분기", () => {
    expect(CODE).toMatch(/res\.status === 503/);
    expect(CODE).toMatch(/res\.status === 400/);
  });
  it("파일 미첨부 시 업로드 버튼 disabled", () => {
    expect(CODE).toMatch(/disabled=\{msdsSaving \|\| !msdsFile\}/);
  });
});

describe("§safety-redesign write — 가짜 성공 제거(no-op 0)", () => {
  it("write 핸들러 setTimeout 가짜 지연 없음", () => {
    // 배너 하이라이트의 setTimeout(() => ...) 은 별개(코드 보존). 가짜 지연 패턴 setTimeout(r, ms) 만 금지.
    expect(CODE).not.toMatch(/setTimeout\(r,/);
    expect(CODE).not.toMatch(/await new Promise\(\(r\) => setTimeout/);
  });
  it("로컬 가짜 성공 토스트(등록/기록/제거 완료) 없음", () => {
    expect(SRC).not.toMatch(/MSDS가 등록되었습니다/);
    expect(SRC).not.toMatch(/점검이 기록되었습니다/);
    expect(SRC).not.toMatch(/목록에서 제거되었습니다/);
  });
});

describe("§safety-redesign write — 점검·폐기 disable+사유", () => {
  it("점검 confirm disabled + 재고 단위 사유", () => {
    expect(CODE).toMatch(/점검 기록 \(재고 단위\)/);
    expect(SRC).toMatch(/점검 기록은 재고\(lot\) 단위/);
  });
  it("폐기 confirm disabled + 재고 단위 사유", () => {
    expect(CODE).toMatch(/폐기 처리 \(재고 단위\)/);
    expect(SRC).toMatch(/폐기는 재고\(lot\) 단위 처리/);
  });
  it("점검·폐기 가짜 핸들러 제거(handleInspSave/handleDispose 부재)", () => {
    expect(CODE).not.toMatch(/handleInspSave/);
    expect(CODE).not.toMatch(/handleDispose/);
  });
});

describe("§safety-redesign — AI 큐 상한(P3)", () => {
  it("큐 상한 8건 + 내부 스크롤(max-h)", () => {
    expect(CODE).toMatch(/queueItems\.slice\(0, 8\)/);
    expect(CODE).toMatch(/max-h-\[480px\] overflow-y-auto/);
  });
});
