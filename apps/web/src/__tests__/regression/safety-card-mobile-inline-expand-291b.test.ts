/**
 * §11.291b #safety-card-mobile-inline-expand — 호영님 P0 audit 후속 sentinel.
 *
 * 호영님 P0 audit (2026-05-24):
 *   §11.291 ("지금 확인하기" scroll + highlight) 연장 audit 결과:
 *   카드 큐 nextAction button (line 752) 이 setSelectedItemId(q.id) 만
 *   호출 → detail panel 은 hidden lg:block (데스크탑 lg 이상만 visible)
 *   이라 모바일/태블릿 사용자가 click 시 시각 신호 0 = dead button 인지.
 *
 *   호영님 spec 예시: "위험 요인 점검 및 조치 →" / "폐기 또는 격리 처리 →"
 *   / "MSDS 등록 후 점검기록 생성 →" 카드 nextAction.
 *
 * Fix: selectedItemId === q.id 시 lg:hidden inline detail block 노출.
 *   classifiedMap.get(q.id) 으로 classified 데이터 access. 차단 요인 +
 *   보류 리스크 + 문서 상태 + Action dock (MSDS 등록/점검 기록/폐기 처리).
 *   데스크탑 right rail 그대로 유지 (중복 표시 회피).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/safety/page.tsx"),
  "utf8",
);

describe("§11.291b — 안전 관리 카드 큐 모바일 inline expand", () => {
  it("§11.291b trace marker + safety-card-mobile-inline-expand comment", () => {
    expect(PAGE).toMatch(/§11\.291b/);
    expect(PAGE).toMatch(/safety-card-mobile-inline-expand/);
  });

  it("카드 큐 안 selectedItemId === q.id 시 inline expand IIFE", () => {
    expect(PAGE).toMatch(
      /selectedItemId === q\.id && \(\(\) =>\s*\{[\s\S]{0,200}classifiedMap\.get\(q\.id\)/,
    );
  });

  it("lg:hidden 모바일 전용 노출 (데스크탑 right rail 중복 회피)", () => {
    expect(PAGE).toMatch(/className="lg:hidden mt-3 pt-3 border-t/);
  });

  it("차단 요인 (blockers) section 모바일 노출", () => {
    expect(PAGE).toMatch(
      /classified\.blockers\.length > 0[\s\S]{0,500}차단 요인/,
    );
  });

  it("보류 시 리스크 + 문서 상태 (MSDS/점검) section 노출", () => {
    expect(PAGE).toMatch(/보류 시 리스크[\s\S]{0,200}classified\.holdRisk/);
    expect(PAGE).toMatch(/MSDS:.*classified\.hasMsds/);
    expect(PAGE).toMatch(/점검:.*classified\.lastInspection/);
  });

  it("Action dock — MSDS 등록 / 점검 기록 / 폐기 처리 3 button 조건부", () => {
    expect(PAGE).toMatch(
      /!classified\.hasMsds[\s\S]{0,400}openMsdsDialog\(classified\)/,
    );
    expect(PAGE).toMatch(
      /!classified\.lastInspection[\s\S]{0,400}openInspDialog\(classified\)/,
    );
    expect(PAGE).toMatch(
      /classified\.level === "HIGH"[\s\S]{0,400}openDisposeDialog\(classified\)/,
    );
  });

  it("기존 §11.291 wrapper id=\"ai-action-queue\" + data-priority urgent 보존", () => {
    expect(PAGE).toMatch(/§11\.291/);
    expect(PAGE).toMatch(/id="ai-action-queue"/);
    expect(PAGE).toMatch(/data-priority=\{isUrgent \? "urgent" : "normal"\}/);
  });

  it("기존 데스크탑 right rail (hidden lg:block w-80) 보존 (회귀 0)", () => {
    expect(PAGE).toMatch(/hidden lg:block w-80/);
    expect(PAGE).toMatch(/판단 근거/);
    expect(PAGE).toMatch(/selectedClassified && \(/);
  });

  it("기존 카드 nextAction button setSelectedItemId(q.id) 보존", () => {
    expect(PAGE).toMatch(/onClick=\{\(\)\s*=>\s*setSelectedItemId\(q\.id\)\}/);
    expect(PAGE).toMatch(/\{q\.nextAction\}/);
  });
});
