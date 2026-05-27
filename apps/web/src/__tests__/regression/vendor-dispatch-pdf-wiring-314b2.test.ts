/**
 * §11.314-b-2 #vendor-dispatch-pdf-wiring — Regression sentinel (client)
 *
 * 호영님 §11.308 옵션 C + 옵션 A (PDF 다운로드로 교체, 이메일 mock 숨김):
 *   vendor-dispatch-workbench executeDispatch 를 vendor-requests(이메일 mock)
 *   → generate-pdf 다운로드 + mailto 로 교체. 버튼 라벨 PDF 정합.
 *
 * 보존:
 *   - 공급사 선택/이메일 검증/expiresInDays 흐름 (mailto recipient 용)
 *   - sentTracking + localStorage (다운로드 추적)
 *   - sendReadiness 분기 (전송 전 확인 필요)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/components/quotes/dispatch/vendor-dispatch-workbench.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.314-b-2 — executeDispatch PDF 다운로드 + mailto 교체", () => {
  it("generate-pdf endpoint 호출 (vendor-requests 교체)", () => {
    const src = read(PATH);
    expect(src).toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}\/generate-pdf`/);
  });

  it("vendor-requests POST 호출 0 (executeDispatch 에서 제거)", () => {
    const src = read(PATH);
    // executeDispatch 가 vendor-requests 로 POST 하지 않음 (generate-pdf 로 교체)
    expect(src).not.toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}\/vendor-requests`/);
  });

  it("PDF blob 다운로드 (createObjectURL + a.download)", () => {
    const src = read(PATH);
    expect(src).toMatch(/await response\.blob\(\)/);
    expect(src).toMatch(/URL\.createObjectURL\(blob\)/);
    expect(src).toMatch(/a\.download = `견적요청서-/);
    expect(src).toMatch(/URL\.revokeObjectURL\(url\)/);
  });

  it("mailto 공급사 이메일 pre-fill (recipients + subject + body)", () => {
    const src = read(PATH);
    expect(src).toMatch(/validVendors\.map\(\(v\)\s*=>\s*v\.email\)\.filter\(Boolean\)\.join\(","\)/);
    expect(src).toMatch(/window\.location\.href = `mailto:\$\{recipients\}/);
  });

  it("성공 toast — 'PDF 다운로드 완료'", () => {
    const src = read(PATH);
    expect(src).toMatch(/title:\s*"견적서 PDF 다운로드 완료"/);
  });

  it("에러 메시지 개선 — '견적서 생성에 실패' (이전 '견적 요청 전달 실패')", () => {
    const src = read(PATH);
    expect(src).toMatch(/견적서 생성에 실패했습니다\. 다시 시도해 주세요\./);
    expect(src).toMatch(/title:\s*"견적서 생성 실패"/);
  });
});

describe("§11.314-b-2 — 버튼 라벨 PDF 정합", () => {
  it("aria-label '견적서 PDF 다운로드'", () => {
    const src = read(PATH);
    expect(src).toMatch(/aria-label="견적서 PDF 다운로드"/);
  });

  it("visible 라벨 '견적서 PDF 다운로드' (이전 '최종 확인 후 전송')", () => {
    const src = read(PATH);
    expect(src).toMatch(/견적서 PDF 다운로드/);
    expect(src).toMatch(/견적서 생성 중…/);
    expect(src).toMatch(/PDF 다운로드 완료/);
  });
});

describe("§11.314-b-2 — 회귀 0 (공급사 선택/검증 + sendReadiness 보존)", () => {
  it("공급사 이메일 형식 검증 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/emailRegex/);
    expect(src).toMatch(/이메일 형식 오류/);
  });

  it("includedSuppliers → validVendors (email/name) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/const validVendors = includedSuppliers\.map/);
    expect(src).toMatch(/email:\s*s\.email/);
  });

  it("sentTracking + localStorage 보존 (다운로드 추적)", () => {
    const src = read(PATH);
    expect(src).toMatch(/setSentTracking/);
    expect(src).toMatch(/trackingStorageKey/);
    expect(src).toMatch(/window\.localStorage\.setItem/);
  });

  it("sendReadiness 분기 (전송 전 확인 필요) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/sendReadiness !== "ready"/);
    expect(src).toMatch(/전송 전 확인 필요/);
  });

  it("setConfirmationOpen + onSuccess 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/setConfirmationOpen\(false\)/);
    expect(src).toMatch(/onSuccess\?\.\(\)/);
  });
});
