/**
 * §intro-honesty-a11y — /intro 고칠점 패치 (신뢰성 + 접근성)
 *   (호영님 spec — "intro 고칠점 패치": 룩앤필 유지, 지적된 부분만 정밀 수정)
 *
 * 4 항목:
 *   ① 지어낸 수치 → 정직화 — 데이터 섹션 "예시 화면 · 실제 데이터 아님" 배지
 *      + KPI 완전 중립화(−58%/+142%/68% 제거 → 정성 라벨) [호영님 §11.318 결정]
 *   ② 연결 포인트 막대 — "(막대는 연결 강도 예시)" 부제로 근거 없는 수치 오해 차단
 *   ③ lot → Lot (대소문자 통일)
 *   ④ prefers-reduced-motion 존중 — Reveal useReducedMotion 분기(전 섹션 진입 모션)
 *
 * canonical 보존:
 *   - 차트/KPI 레이아웃(grid-cols-3) 불변, L 토큰 불변, Reveal once/whileInView 불변
 *   - framer-motion AnimatePresence 보존
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const INTRO = readFileSync(join(ROOT, "src/app/intro/page.tsx"), "utf8");

describe("§intro-honesty-a11y — 4 항목 적용", () => {
  it("① 데이터 섹션 '예시 화면 · 실제 데이터 아님' 배지(과장 오해 차단)", () => {
    expect(INTRO).toMatch(/예시 화면 · 실제 데이터 아님/);
    expect(INTRO).not.toMatch(/구매 의사결정 효율 · 최근 8주/); // 실측 오인 라벨 제거
  });

  it("① KPI 완전 중립화 — 지어낸 증감률 제거(§11.318 fake data 0)", () => {
    expect(INTRO).toMatch(/value: "리드타임", change: "요청→발주 추적"/);
    expect(INTRO).toMatch(/value: "처리량", change: "주차별 흐름"/);
    expect(INTRO).toMatch(/value: "재사용", change: "이전 결정 활용"/);
    expect(INTRO).not.toMatch(/8주 전 대비 −58%/);
    expect(INTRO).not.toMatch(/8주 전 대비 \+142%/);
  });

  it("② 연결 막대 — '(막대는 연결 강도 예시)' 부제(근거 없는 수치 오해 차단)", () => {
    expect(INTRO).toMatch(/\(막대는 연결 강도 예시\)/);
  });

  it("③ lot → Lot 대소문자 통일", () => {
    expect(INTRO).toMatch(/입고 반영 → Lot 기록/);
    expect(INTRO).not.toMatch(/입고 반영 → lot 기록/);
  });

  it("④ reduced-motion 존중 — useReducedMotion import + Reveal 분기", () => {
    expect(INTRO).toMatch(/import \{ motion, AnimatePresence, useReducedMotion \} from "framer-motion";/);
    expect(INTRO).toMatch(/const reduce = useReducedMotion\(\);/);
    expect(INTRO).toMatch(/initial=\{reduce \? false : \{ opacity: 0, y \}\}/);
    expect(INTRO).toMatch(/transition=\{\{ duration: reduce \? 0 : 0\.7, delay: reduce \? 0 : delay/);
  });
});

describe("§intro-honesty-a11y — 룩앤필 보존(회귀 0)", () => {
  it("KPI grid-cols-3 레이아웃 + L 토큰 보존(시각 불변)", () => {
    expect(INTRO).toMatch(/grid grid-cols-3 gap-px/);
    expect(INTRO).toMatch(/blueText/);
    expect(INTRO).toMatch(/blueSoft/);
  });

  it("Reveal whileInView/once + framer AnimatePresence 보존", () => {
    expect(INTRO).toMatch(/whileInView=\{\{ opacity: 1, y: 0 \}\}/);
    expect(INTRO).toMatch(/viewport=\{\{ once: true, margin: "-60px" \}\}/);
    expect(INTRO).toMatch(/AnimatePresence/);
  });

  it("③ 본문 다른 Lot 표기 + 연결 단계 라벨 보존", () => {
    expect(INTRO).toMatch(/각 단계가 다음 작업으로 자연스럽게 이어집니다\./);
  });
});
