/**
 * §3-batch — 배치 발송 확인 관문 (호영님 견적 고도화 P3, 2026-07-13)
 *
 * 재정의: §3 단일 경로(vendor-dispatch-workbench)는 이미 충족(§11.217/274/279) → Complete.
 *   실사용 갭은 배치 경로 — "전체 발송"이 중간 확인 없이 allSettled 팬아웃(되돌릴 수 없는
 *   대량 액션). 이를 확인 AlertDialog 로 게이팅.
 *
 * 설계 원칙(배치 전용, 단일 복제 금지):
 *   - 구성 요약형 관문(발송 가능 N · 보류 M 제외) — 단일 yellow/green 이분기 복제 아님.
 *   - (a) 자동 제외 정책 — 발송 가능분만 발송(handleDispatch=dispatchableQuotes), 보류는 제외.
 *   - front-only success 0 — allSettled 결과 기반 labToast, 낙관적 전체성공 금지.
 *   - amber Tailwind 0 (신호등 유지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHEET = readFileSync(
  resolve(
    __dirname,
    "../../../components/quotes/dispatch/batch-dispatch-sheet.tsx",
  ),
  "utf8",
);

describe("§3-batch — 확인 관문 배선", () => {
  it("AlertDialog import (확인 관문)", () => {
    expect(SHEET).toMatch(/import\s*\{[\s\S]*?AlertDialog[\s\S]*?\}\s*from\s*["']@\/components\/ui\/alert-dialog["']/);
  });

  it("confirmOpen state 존재", () => {
    expect(SHEET).toMatch(/const\s*\[confirmOpen,\s*setConfirmOpen\]\s*=\s*useState\(false\)/);
  });

  it("'전체 발송' CTA 가 handleDispatch 직접 호출 아님 → 게이트 경유(setConfirmOpen)", () => {
    // 푸터 primary CTA onClick 은 확인 관문을 연다.
    expect(SHEET).toMatch(/onClick=\{\(\)\s*=>\s*setConfirmOpen\(true\)\}/);
    // 관문 없이 바로 발송하는 onClick={handleDispatch} 는 부재.
    expect(SHEET).not.toMatch(/onClick=\{handleDispatch\}/);
  });

  it("확인 모달 testid + 헤더 '발송할까요'", () => {
    expect(SHEET).toMatch(/data-testid="batch-dispatch-confirm-modal"/);
    expect(SHEET).toMatch(/견적을 발송할까요\?/);
  });

  it("되돌릴 수 없음 안내 (실제 이메일 발송 · 취소 불가)", () => {
    expect(SHEET).toMatch(/실제 이메일이 발송/);
    expect(SHEET).toMatch(/취소할 수 없습니다/);
  });

  it("구성 요약형 — 발송 가능 N · 보류 M 제외", () => {
    expect(SHEET).toMatch(/data-testid="batch-dispatch-confirm-summary"/);
    expect(SHEET).toMatch(/발송 가능 \{dispatchableCount\}건/);
    expect(SHEET).toMatch(/보류 \{hardBlockCount\}건 제외/);
  });

  it("green 확인 CTA → handleDispatch, disabled dispatchable 0", () => {
    expect(SHEET).toMatch(/setConfirmOpen\(false\);\s*[\s\S]{0,40}void handleDispatch\(\)/);
    expect(SHEET).toMatch(/확인 · \{dispatchableCount\}건 지금 발송/);
    // green 확인 버튼 disabled 분기(dispatchableCount 0 방어).
    expect(SHEET).toMatch(/disabled=\{isDispatching \|\| dispatchableCount === 0\}/);
  });
});

describe("§3-batch — 무회귀(canonical truth 보존)", () => {
  it("(a) 자동 제외 — handleDispatch 는 dispatchableQuotes 만 발송", () => {
    expect(SHEET).toMatch(/dispatchableQuotes\.map\(\(\{ quote \}\)/);
  });

  it("front-only success 0 — Promise.allSettled 실집계 유지", () => {
    expect(SHEET).toMatch(/Promise\.allSettled/);
    expect(SHEET).toMatch(/labToast/);
  });

  it("canonical dispatch path 보존 — csrfFetch vendor-requests POST", () => {
    expect(SHEET).toMatch(/csrfFetch/);
    expect(SHEET).toMatch(/\/api\/quotes\/.+\/vendor-requests/);
    expect(SHEET).toMatch(/method:\s*["']POST["']/);
  });

  it("'전체 발송' 라벨 + disabled dispatchable 0 보존(§11.217 정합)", () => {
    expect(SHEET).toMatch(/전체 발송/);
    expect(SHEET).toMatch(/disabled=\{isDispatching \|\| dispatchableCount === 0\}/);
  });

  it("amber/orange Tailwind 0 (신호등 유지)", () => {
    expect(SHEET).not.toMatch(/\b(bg|text|border)-(amber|orange)-\d{2,3}\b/);
  });
});
