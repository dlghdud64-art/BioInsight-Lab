/**
 * §scan-manual-path (호영님 2026-06-30) — 미매칭/저신뢰 = 실패 아닌 정상 "확인 후 입력" 경로
 *
 * 전제(확정): 카탈로그(ProcurementCatalogRef) 미적재 + 조달청은 수입 R&D 시약 미커버 →
 *   원형 병/롱테일 시약은 자동매칭 0이 정상. 그 케이스를 에러처럼 보여주면 안 됨.
 * 변경:
 *   ① 미매칭 시 calm "신규 품목 등록" 안내(에러톤 0, slate 중립) — 매칭 silence 해소.
 *   ② 저신뢰 배너 빨강(에러) → 주의(yellow §11.302) + 문구 calm화. §11.378 게이트(텍스트·로직)는 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

describe("§scan-manual-path — 미매칭 정상 경로", () => {
  it("미매칭 시 calm 신규 품목 안내(에러톤 0)", () => {
    expect(MODAL).toMatch(/!scanResult\.matchedProduct && \(/);
    expect(MODAL).toMatch(/DB에 없는 신규 품목입니다/);
    // 신규 품목 안내는 slate 중립(빨강 에러톤 아님)
    expect(MODAL).toMatch(/border-slate-200 bg-slate-50[\s\S]{0,260}신규 품목/);
  });
});

describe("§scan-manual-path — 저신뢰 주의 톤(에러 아님)", () => {
  it("저신뢰 배너 = yellow 주의 톤 + 신뢰도 텍스트 보존(§11.378)", () => {
    expect(MODAL).toMatch(/text-yellow-800 bg-yellow-50[\s\S]{0,400}신뢰도가 낮습니다/);
  });
  it("§11.378 게이트 로직 보존(low + productNameDirty)", () => {
    expect(MODAL).toMatch(/mapOcrConfidence\(scanResult\.parsed\.confidence\) === "low"/);
    expect(MODAL).toMatch(/!productNameDirty/);
  });
});

describe("§scan-manual-path — 보존(회귀 0)", () => {
  it("DB 매칭(emerald) 배너 유지", () => {
    expect(MODAL).toMatch(/DB 매칭: \{scanResult\.matchedProduct\.name\}/);
  });
  it("criticalUnconfirmed 게이트(Lot/유효기한 확인) 유지 — 필수 확인은 보존", () => {
    expect(MODAL).toMatch(/Lot 번호·유효기한을 확인/);
  });
});
