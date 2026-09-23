/**
 * §brief-demo-guard → §inbox-seed-cutoff **승계** (2026-09-22 · 호영님 판정)
 *
 * ── 옛 명제(2026-06-29 · 호영님) ──
 * 운영 브리핑이 ops-store 시드(데모)로 렌더되던 시절, 화면이 실데이터인 척하지 않게 잠갔다:
 *   (1) 헤더에 「데모 데이터」 배지(BRIEF_DATA_IS_LIVE=false 동안) — §11.302 yellow
 *   (2) 견적 통보(QuoteNotifyAction = 실 PATCH)는 LIVE 일 때만 렌더 — 데모 ID 로 실 PATCH 를 쏘면 404
 * 이 sentinel 은 **플래그/게이트 구조**를 핀했다(값이 아니라).
 *
 * ── 왜 승계인가 ──
 * 2026-09-22 시드 경로를 걷어냈다(§inbox-seed-cutoff). 브리핑 목록은 실 endpoint 하나뿐이고,
 * BRIEF_DATA_IS_LIVE·seedInbox·「데모 데이터」 배지·통보 차단 fallback 은 **도달 0 인 죽은 코드**가 됐다.
 * 옛 단언은 그 죽은 코드의 존재를 요구했다 — 그대로 두면 검사가 시드 복귀를 강제한다.
 * 🔑 살아 있는 명제만 남긴다: **브리핑은 시드로 렌더되지 않는다. 그래서 데모 표기가 필요 없다.**
 *    (표기 규칙 자체가 사라진 게 아니라, 표기를 요구하던 조건이 사라졌다.)
 *
 * 형제 계약: regression/inbox-seed-cutoff.test.ts(작업함 · 같은 출처) ·
 *   components/operational-brief/brief-realdata-quotes.test.ts(목록은 실데이터만 · 통보 활성)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const POPUP = readFileSync(
  resolve(__dirname, "../../../components/operational-brief/popup.tsx"),
  "utf8",
);
/** 부정 단언은 주석 제거본에 — 승계 사유를 적은 주석이 스스로 걸리지 않도록 */
const POPUP_CODE = stripComments(POPUP);

describe("§brief-demo-guard(승계) · 브리핑은 시드로 렌더되지 않는다", () => {
  it("시드 출처 0 · 데모 표기를 요구하던 조건 자체가 없다", () => {
    expect(POPUP_CODE).not.toMatch(/\buseOpsStore\b/);
    expect(POPUP_CODE).not.toMatch(/\bbuildFullInbox\b/);
    expect(POPUP_CODE).not.toMatch(/\bseedInbox\b/);
    expect(POPUP_CODE).not.toMatch(/\bBRIEF_DATA_IS_LIVE\b/);
    expect(POPUP_CODE).not.toMatch(/데모 데이터/);
  });

  it("목록은 실 endpoint 하나 · 작업함과 같은 함수", () => {
    expect(POPUP_CODE).toMatch(/fetchRealInboxItems\(\)/);
    expect(POPUP_CODE).toMatch(/const allItems = liveItems \?\? \[\];/);
  });

  it("견적 통보(실 PATCH)는 조건 없이 활성 · 데모 ID 가 없으므로 차단 fallback 도 없다", () => {
    expect(POPUP_CODE).toMatch(/brief\.module === "quote" && <QuoteNotifyAction quoteId=\{item\.entityId\} \/>/);
    expect(POPUP_CODE).not.toMatch(/실데이터 연동 후 활성화/);
  });
});
