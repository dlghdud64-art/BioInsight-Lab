/**
 * §safety-redesign write — 안전 페이지 write no-op 해소 (호영님 2026-06-27)
 *
 * 안전 페이지는 product-scoped(/api/safety/products → Product). write 핸들러가
 * front-only no-op(setTimeout+로컬 setItems+성공 토스트, 영속 0) 이던 기존 LabAxis 위반 해소:
 *  - MSDS  = 실 업로드(POST /api/products/[id]/sds, multipart file) → 성공 시 refetch(canonical 재계산).
 *  - 점검  = §SM-P4b 물질(Product) 단위 실저장(POST /api/products/[id]/inspection, handleInspSaveMaterial) → 서버 201 게이트.
 *  - 폐기  = 재고 단위 처리 → disabled+사유(미배선 유지).
 * 가짜 성공(setTimeout 지연 + 로컬 flip) 전면 제거. (점검·MSDS 성공 토스트는 서버 성공 후 canonical.)
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
  it("로컬 가짜 성공 토스트(MSDS/폐기) 없음 — 점검은 §SM-P4b 서버 201 후 canonical(제외)", () => {
    expect(SRC).not.toMatch(/MSDS가 등록되었습니다/);
    // 점검 성공 토스트("점검이 기록되었습니다")는 handleInspSaveMaterial 내부 res.ok 이후만 — 실저장 canonical(가짜 아님).
    expect(SRC).not.toMatch(/목록에서 제거되었습니다/); // 폐기는 여전히 disabled(가짜 토스트 금지)
  });
});

describe("§safety-redesign write — 점검(§SM-P4b 실배선)·폐기(disabled)", () => {
  it("§SM-P4b 점검 물질 단위 실저장 배선(재고 단위 disabled 사유 반전)", () => {
    expect(CODE).toMatch(/handleInspSaveMaterial/);
    expect(CODE).toMatch(/\/api\/products\/\$\{productId\}\/inspection/);
    expect(CODE).not.toMatch(/점검 기록 \(재고 단위\)/);
  });
  it("폐기 confirm disabled + 재고 단위 사유(미배선 유지)", () => {
    expect(CODE).toMatch(/폐기 처리 \(재고 단위\)/);
    expect(SRC).toMatch(/폐기는 재고\(lot\) 단위 처리/);
  });
  it("가짜 성공 0 — 점검 로컬 flip(setTimeout) 없음 + 폐기 가짜 핸들러(handleDispose) 부재", () => {
    expect(CODE).not.toMatch(/setTimeout\([^)]*setInspDialogOpen/);
    expect(CODE).not.toMatch(/handleDispose/);
  });
});

describe("§safety-redesign — AI 큐 상한(P3)", () => {
  it("큐 상한 8건 + 내부 스크롤(max-h)", () => {
    expect(CODE).toMatch(/queueItems\.slice\(0, 8\)/);
    expect(CODE).toMatch(/max-h-\[480px\] overflow-y-auto/);
  });
});
