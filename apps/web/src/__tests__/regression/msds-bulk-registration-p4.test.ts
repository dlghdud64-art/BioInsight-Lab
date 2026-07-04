/**
 * §msds-bulk-registration B-P4 — 일괄 등록 워크벤치 UI + 안전페이지 배선.
 * 실 등록 진입점(문서 첨부). 점검 준비(체크리스트)와 구분. no-op·fake success 0.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");

describe("§msds-bulk B-P4 — 워크벤치 컴포넌트", () => {
  const M = rd("components/safety/MsdsBulkRegisterModal.tsx");
  it("2-phase API 호출(preview + commit)", () => {
    expect(M).toMatch(/\/api\/safety\/sds\/bulk"/);
    expect(M).toMatch(/\/api\/safety\/sds\/bulk\/commit"/);
  });
  it("3단계 흐름(선택→검토→완료) + 매칭 확인", () => {
    expect(M).toMatch(/phase === "select"/);
    expect(M).toMatch(/phase === "review"/);
    expect(M).toMatch(/phase === "done"/);
    expect(M).toMatch(/setMapping/);
  });
  it("미지정=건너뛰기(no-op 아님) + 실등록 결과 표시", () => {
    expect(M).toMatch(/등록 안 함\(건너뛰기\)/);
    expect(M).toMatch(/registeredCount/);
    expect(M).toMatch(/등록됨/);
  });
});

describe("§msds-bulk B-P4 — 안전페이지 배선", () => {
  const P = rd("app/dashboard/safety/page.tsx");
  it("컴포넌트 import + 마운트 + refetch", () => {
    expect(P).toMatch(/import \{ MsdsBulkRegisterModal \}/);
    expect(P).toMatch(/<MsdsBulkRegisterModal[\s\S]*?onRegistered=\{[\s\S]*?safetyQuery\.refetch/);
  });
  it("실 등록 트리거 버튼(점검 준비 CSV export와 구분)", () => {
    expect(P).toMatch(/onClick=\{\(\) => setBulkOpen\(true\)\}/);
    expect(P).toMatch(/MSDS 일괄 등록 \(문서 첨부\)/);
    // Track A 라벨(체크리스트 export) 보존 — 거짓 '일괄 등록' 회귀 아님(이건 실 등록).
    expect(P).toMatch(/MSDS 점검 준비 목록 내보내기/);
  });
});
