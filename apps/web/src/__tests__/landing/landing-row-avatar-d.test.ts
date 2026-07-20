/**
 * §랜딩 목업 갱신 D — 구매 행 아바타 아이콘 (7/19 개정본 신규, 호영님 2026-07-13)
 *
 * 7/19 목업 개정본에서 구매 운영 행마다 38px 라운드 사각 + 라인 SVG 아바타가 추가됨.
 *   목업 원문 paths(24 viewBox, stroke 2, round cap/join) 그대로 이식.
 *   파랑 기본(#EFF6FF/#2563EB), 경고행(추가 검토)만 앰버(#FFFBEB/#D97706).
 * 행 구조도 목업대로 [아바타][칩+제목+메타][CTA] 한 행으로 재구성.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const OPS = readFileSync(
  resolve(__dirname, "../../app/_components/ops-console-preview-section.tsx"),
  "utf8",
);

describe("§랜딩 D — 아바타 아이콘 정의", () => {
  it("목업 원문 paths(tube/flask)", () => {
    expect(OPS).toMatch(/AV_ICON_PATHS/);
    expect(OPS).toMatch(/tube:\s*\["M9 3h6", "M10 3v13a2 2 0 004 0V3", "M9 10h6"\]/);
    expect(OPS).toMatch(/flask:\s*\["M9 3h6", "M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3", "M7 15h10"\]/);
  });

  it("라인 SVG 스펙 — 24 viewBox · stroke 2 · round cap/join", () => {
    expect(OPS).toMatch(/function AvatarLineIcon/);
    expect(OPS).toMatch(/viewBox="0 0 24 24"/);
    expect(OPS).toMatch(/strokeWidth=\{2\}/);
    expect(OPS).toMatch(/strokeLinecap="round"/);
    expect(OPS).toMatch(/strokeLinejoin="round"/);
  });
});

describe("§랜딩 D — 행별 아바타 배정(파랑 기본 · 경고행 앰버)", () => {
  it("row1 회신완료 = tube · 파랑", () => {
    expect(OPS).toMatch(/ctaLabel:\s*"선택안 확정",[\s\S]{0,80}avKey:\s*"tube",\s*\n\s*avBg:\s*"#EFF6FF"/);
  });
  it("row2 선택안 검토 = flask · 파랑", () => {
    expect(OPS).toMatch(/ctaLabel:\s*"선택안 검토",[\s\S]{0,80}avKey:\s*"flask",\s*\n\s*avBg:\s*"#EFF6FF"/);
  });
  it("row3 추가 검토(경고행) = flask · 앰버", () => {
    expect(OPS).toMatch(/ctaLabel:\s*"추가 확인",[\s\S]{0,80}avKey:\s*"flask",\s*\n\s*avBg:\s*"#FFFBEB"/);
  });
  it("stroke 분기 — 앰버 배경만 #D97706, 그 외 #2563EB", () => {
    expect(OPS).toMatch(/item\.avBg === "#FFFBEB" \? "#D97706" : "#2563EB"/);
  });
});

describe("§랜딩 D — 무회귀(행 내용 보존)", () => {
  it("아바타 라운드 사각 + 행 구조", () => {
    expect(OPS).toMatch(/rounded-\[10px\][\s\S]{0,120}backgroundColor: item\.avBg/);
  });
  it("상태 칩 · blocker 칩 보존", () => {
    expect(OPS).toMatch(/\{item\.statusLabel\}/);
    expect(OPS).toMatch(/\{item\.blocker\}/);
  });
  it("제목 · 회신/가격/공급사 메타 · CTA 보존", () => {
    expect(OPS).toMatch(/\{item\.title\}/);
    expect(OPS).toMatch(/회신 \{item\.replies\} · \{item\.price\} · \{item\.supplier\}/);
    expect(OPS).toMatch(/\{item\.ctaLabel\}/);
  });
  it("Tailwind amber/orange 클래스 0(inline hex 예외만)", () => {
    expect(OPS).not.toMatch(/\b(bg|text|border|from|to)-(amber|orange)-\d{2,3}\b/);
  });
});
