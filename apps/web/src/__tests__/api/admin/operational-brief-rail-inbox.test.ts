/**
 * §11.145 #operational-brief-rail-dispatch-prep / inbox-context-panel
 *
 * /dashboard/inbox 의 ContextPanel (cross-module unified inbox detail) 가
 * §11.142 운영 브리핑 패턴 정합:
 * "운영 브리핑" + "선택한 작업" + 4 chips + 4 sections + Primary CTA.
 *
 * sourceModule = po / quote / inventory / receiving 모두 동일한 brief 구조 land.
 * Dispatch Prep (PO) 트랙은 inbox?module=po 에서 들어오므로 cross-module 동시 land.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/dashboard/inbox/page.tsx",
);

describe("operational brief rail (inbox unified) — §11.145 regression guard", () => {
  const source = readFileSync(PATH, "utf8");

  it("rail title \"운영 브리핑\" 존재", () => {
    expect(source).toMatch(/운영 브리핑/);
  });

  it("Object label \"선택한 작업\" 존재", () => {
    expect(source).toMatch(/선택한 작업/);
    expect(source).not.toMatch(/SELECTED OBJECT/);
  });

  it("4 preset chips: 상태 요약 / 차단 사유 / 위험도 / 다음 단계", () => {
    expect(source).toMatch(/상태 요약/);
    expect(source).toMatch(/차단 사유/);
    expect(source).toMatch(/위험도/);
    expect(source).toMatch(/다음 단계/);
  });

  it("4 canonical section: 상황 요약 / 핵심 근거 / 리스크 / 다음 조치", () => {
    expect(source).toMatch(/상황 요약/);
    expect(source).toMatch(/핵심 근거/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/다음 조치/);
  });

  it("§11.142 lock: chatbot input 0 (자유 채팅창 부재)", () => {
    expect(source).not.toMatch(/AI에게 물어보기|Ask AI|<textarea[^>]*ai/i);
  });

  it("회귀 0: quickAction primary CTA wiring 보존", () => {
    expect(source).toMatch(/quickAction/);
    expect(source).toMatch(/canExecuteAction/);
  });

  it("회귀 0: 차단 사유 + 위험 badge 보존", () => {
    expect(source).toMatch(/buildInboxItemBlockers/);
    expect(source).toMatch(/riskBadges/);
  });

  it("rail desktop only (hidden lg:block) — same-canvas 보존", () => {
    expect(source).toMatch(/hidden lg:block/);
  });
});
