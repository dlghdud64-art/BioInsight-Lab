/**
 * §quote-scan-sian P5 §11 — 견적서 스캔 모달 시안 정합 (AiQuoteParseModal)
 *
 * 지시문 §11: 업로드 → 처리 → 결과 3단계. CEO 2026-06-21 시안(업로드 단계 이미지) 정합.
 *   - 헤더: accent 아이콘 박스(ScanLine) + 제목 + Gemini 배지 + 설명.
 *   - 처리: 파일 카드 + indeterminate 진행바 + 4단계 리스트.
 *     ★ 단일 fetch라 단계 이벤트 없음 → 업로드만 실완료(✓), 나머지 진행 중(가짜 완료 0, no-op 금지).
 *   - 업로드: 암호화 보관 안내.
 *
 * wiring 보존(시각만 정합): parse-pdf/parse-image · match-products · vendor-replies · step state machine.
 * §10 비교 모달은 별도 백엔드 트랙(Gemini 스키마 확장) — 이 sentinel 범위 외.
 */

import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(__dirname, "../../../components/quotes/ai-quote-parse-modal.tsx");
const src = readFileSync(PATH, "utf8");

describe("§quote-scan-sian P5 — 헤더(아이콘 박스 + 배지 + 설명)", () => {
  it("ScanLine accent 아이콘 박스(bg-blue-600)", () => {
    expect(src).toMatch(/import \{[\s\S]{0,200}ScanLine/);
    expect(src).toMatch(/rounded-xl bg-blue-600[\s\S]{0,120}<ScanLine/);
  });
  it("기능명 '견적서 자동 인식' + Gemini 배지 보존(§11.368 AI 라벨 절제)", () => {
    expect(src).toMatch(/견적서 자동 인식/);
    expect(src).toMatch(/Gemini 2\.5 Flash/);
  });
  it("설명 한 줄(자동 추출 안내)", () => {
    expect(src).toMatch(/공급사·단가·납기·조건을 자동 추출/);
  });
});

describe("§quote-scan-sian P5 — 업로드 단계(드롭존 + 취급 안내)", () => {
  it("드롭존 드래그앤드롭 + 형식 안내 보존", () => {
    expect(src).toMatch(/onDrop=/);
    expect(src).toMatch(/PDF, JPG, PNG, WebP|PDF · JPG · PNG · WebP|최대 10MB/);
  });

  /* 🛑 승계 (§quote-scan-public-storage · 호영님 2026-09-12 P0): 옛 판본은 「암호화 보관」 **문구를
   *   강제**하고 있었다(toMatch). 실제로는 Vercel Blob `access: "public"` 이고 업로드 실패도
   *   graceful 이라 "보관됩니다" 가 항상 참이 아니다 — 검사가 거짓 주장을 붙잡아 두는 형태였다
   *   (같은 날 감사 화면 「21 CFR Part 11 정합」 배지와 2건째 · §sentinel-inversion).
   *   원 명제(업로드 단계에 취급 안내가 있다)는 유지하고, 근거 없는 보안 주장만 부재로 잠근다.
   *   🔑 되살리는 조건: access "private" + 서명 URL 전환이 먼저다. */
  it("취급 안내 존재(Lock 아이콘) · 🛑 근거 없는 보안 주장 0", () => {
    expect(src).toMatch(/import \{[\s\S]{0,220}Lock/);
    expect(src).toMatch(/업로드한 견적서는/);
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(/암호화/);
    expect(stripped).not.toMatch(/안전하게 보관|안전 보관/);
  });
});

describe("§quote-scan-sian P5 — 처리 단계(파일 카드 + 진행바 + 4단계, fake 금지)", () => {
  it("파일 카드 — fileName 노출", () => {
    expect(src).toMatch(/step === "parsing"[\s\S]{0,800}\{fileName/);
  });
  it("indeterminate 진행바(determinate 가짜 % 아님)", () => {
    expect(src).toMatch(/step === "parsing"[\s\S]{0,1200}rounded-full bg-slate-100[\s\S]{0,160}animate-pulse/);
  });
  it("4단계 리스트 — 업로드만 실완료 done:true", () => {
    expect(src).toMatch(/label: "업로드", done: true/);
    expect(src).toMatch(/label: "문서 구조 인식", done: false/);
    expect(src).toMatch(/label: "품목·단가 추출", done: false/);
    expect(src).toMatch(/label: "견적 품목 매칭", done: false/);
  });
  it("★ fake 완료 금지 — 구조인식/추출/매칭에 done: true 부재", () => {
    expect(src).not.toMatch(/문서 구조 인식", done: true/);
    expect(src).not.toMatch(/품목·단가 추출", done: true/);
    expect(src).not.toMatch(/견적 품목 매칭", done: true/);
  });
});

describe("§quote-scan-sian P5 — wiring 보존(시각만 정합)", () => {
  it("parse-pdf / parse-image 실배선", () => {
    expect(src).toMatch(/\/api\/quotes\/parse-pdf/);
    expect(src).toMatch(/\/api\/quotes\/parse-image/);
  });
  it("벤더 응답 등록(vendor-replies) + 매칭(match-products)", () => {
    expect(src).toMatch(/\/vendor-replies/);
    expect(src).toMatch(/match-products/);
  });
  it("step state machine 보존(upload/parsing/review/registering/done/error)", () => {
    expect(src).toMatch(/"upload"\s*\|\s*"parsing"\s*\|\s*"review"\s*\|\s*"registering"\s*\|\s*"done"\s*\|\s*"error"/);
  });
  it("결과 신뢰도 라벨(높음/보통/낮음) — 가짜 % 미도입", () => {
    expect(src).toMatch(/신뢰도/);
    expect(src).toMatch(/confidence === "high"/);
  });
});
