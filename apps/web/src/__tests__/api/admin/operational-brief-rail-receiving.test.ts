/**
 * §11.149 #operational-brief-rail-receiving — OperationalDetailShell guard.
 *
 * receiving/[receivingId] 외 OperationalDetailShell 사용 surface 모두 자동 land.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHELL_PATH = resolve(
  __dirname,
  "../../../app/dashboard/_components/operational-detail-shell.tsx",
);

describe("§11.149 OperationalDetailShell brief banner", () => {
  const source = readFileSync(SHELL_PATH, "utf8");

  it("운영 브리핑 헤더 존재", () => {
    expect(source).toMatch(/운영 브리핑/);
  });

  it("4 chips: 상태 요약 / 검수 진행 / 리스크 / 다음 조치", () => {
    expect(source).toMatch(/상태 요약/);
    expect(source).toMatch(/검수 진행/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/다음 조치/);
  });

  it("4 anchor IDs: brief-summary / brief-facts / brief-risks / brief-next", () => {
    expect(source).toMatch(/brief-summary/);
    expect(source).toMatch(/brief-facts/);
    expect(source).toMatch(/brief-risks/);
    expect(source).toMatch(/brief-next/);
  });

  it("briefObjectLabel prop optional + default 선택한 작업", () => {
    expect(source).toMatch(/briefObjectLabel/);
    expect(source).toMatch(/선택한 작업/);
  });

  it("회귀 0: 기존 zone (header / contextStrip / blocker / commandSurface / metaRail) 보존", () => {
    expect(source).toMatch(/OperationalHeader/);
    expect(source).toMatch(/InboxContextStrip/);
    expect(source).toMatch(/AggregatedBlockerStrip|BlockerReviewStrip/);
    expect(source).toMatch(/OperationalCommandBar/);
    expect(source).toMatch(/LinkedEntityMetaRail/);
  });

  it("§11.142 lock: chatbot input 0", () => {
    expect(source).not.toMatch(/AI에게 물어보기|Ask AI|<textarea[^>]*ai/i);
  });
});
