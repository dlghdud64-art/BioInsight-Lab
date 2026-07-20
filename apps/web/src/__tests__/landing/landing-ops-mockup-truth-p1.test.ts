/**
 * §랜딩 목업 갱신 P1 — 히어로 구매운영 카드 광고-실물 정합 guard (호영님 2026-07-13)
 *
 * 왜: 랜딩 제품 미리보기가 "개선 전 작업창"(발주 전환 큐)을 담아 광고-실물 불일치.
 *   발주 전환(order conversion) 기능은 제품에서 제거 → 목업 전반에서 삭제.
 *   전환 대기 → 회신 대기, 전환 가능 → 비교 가능, 발주 전환 준비 → 선택안 확정.
 *
 * 대상: bioinsight-hero-section.tsx(캡션·KPI) + ops-console-preview-section.tsx(statusLabel·ctaLabel·탭·운영상태).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERO = readFileSync(
  resolve(__dirname, "../../app/_components/bioinsight-hero-section.tsx"),
  "utf8",
);
const OPS = readFileSync(
  resolve(__dirname, "../../app/_components/ops-console-preview-section.tsx"),
  "utf8",
);

describe("§랜딩 P1 — 발주 전환/전환 대기/전환 가능 전면 부재(광고-실물 정합)", () => {
  it("hero: '발주 전환' 문구 0", () => {
    expect(HERO).not.toMatch(/발주 전환/);
  });
  it("hero: '전환 대기' KPI 라벨 0", () => {
    expect(HERO).not.toMatch(/전환 대기/);
  });
  it("ops-preview: '발주 전환' 문구/버튼 0(주석 포함)", () => {
    expect(OPS).not.toMatch(/발주 전환/);
  });
  it("ops-preview: '전환 가능' 라벨 0(탭·운영상태)", () => {
    expect(OPS).not.toMatch(/전환 가능/);
  });
});

describe("§랜딩 P1 — 갱신 라벨 존재", () => {
  // §P4 진화 — 목업 원본 확보 후 카피 정합(이전 추정 카피 "견적 요청부터 선택안 확정까지" 폐기).
  it("hero 캡션 = 목업 원문(발주 전환 제거 카피)", () => {
    expect(HERO).toMatch(/견적 비교부터 재고 운영까지, 한 화면에서 관리합니다/);
  });
  it("hero KPI '회신 대기'", () => {
    expect(HERO).toMatch(/회신 대기/);
  });
  it("ops-preview statusLabel '비교 가능'", () => {
    expect(OPS).toMatch(/statusLabel:\s*"비교 가능"/);
  });
  it("ops-preview 행 CTA '선택안 확정'", () => {
    expect(OPS).toMatch(/ctaLabel:\s*"선택안 확정"/);
  });
  it("ops-preview 탭 '비교 가능 1'", () => {
    expect(OPS).toMatch(/비교 가능 1/);
  });
  it("ops-preview 운영상태 '비교 가능'", () => {
    expect(OPS).toMatch(/label:\s*"비교 가능"/);
  });
});

describe("§랜딩 P1 — 무회귀(랜딩 골격 보존)", () => {
  it("hero 카피 '한 화면에서 관리합니다'(목업 원문) 보존", () => {
    expect(HERO).toMatch(/한 화면에서 관리합니다/);
  });
  it("ops-preview KPI '처리 필요/승인 대기/위험' 운영상태 dock 보존", () => {
    expect(OPS).toMatch(/처리 필요/);
    expect(OPS).toMatch(/승인 대기/);
    expect(OPS).toMatch(/위험\/차단/);
  });
  // §P4 진화 — 목업은 선택 건 자체를 공급사 미정 케이스(PBS-3 재요청)로 교체해 칩 모순 해소.
  //   이전 (b) 최저가·기존거래 유지 결정은 목업 원본 확인 후 철회.
  it("ops-preview 선택된 건 = PBS-3(재요청) + 공급사 미정·마감임박 칩(목업 정합)", () => {
    expect(OPS).toMatch(/PBS-3 \(재요청\)/);
    expect(OPS).toMatch(/공급사 미정 · 마감 D-3/);
    expect(OPS).toMatch(/>공급사 미정</);
    expect(OPS).toMatch(/>마감임박</);
  });

  it("이전 추정 칩(최저가·기존 거래) 잔재 0", () => {
    expect(OPS).not.toMatch(/최저가/);
    expect(OPS).not.toMatch(/기존 거래/);
  });
});
