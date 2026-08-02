/**
 * §receiving-inspection-followup — 검수 판정 화면 follow-up sentinel.
 *
 * T2(cec5f766) 검수 화면의 클라이언트 결함 2건을 RED 로 고정하고, 서버 가드 2종을
 * GREEN 으로 잠근다. 서버 로직은 수정하지 않는다(이미 정확 — PLAN §0).
 *
 * Phase 1 기대치: 클라이언트 4건 RED(패널 미수정) · 서버 3건 GREEN(현행 만족).
 *   Phase 2에서 패널 단일 파일 수정 후 클라이언트 4건이 GREEN 으로 전환된다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(APP_WEB_ROOT, rel), "utf8");

const PANEL = "src/components/receiving/receiving-review-panel.tsx";
const APPROVE = "src/app/api/receiving-drafts/[id]/approve/route.ts";

/** 함수 본문만 잘라 주석·타 영역 문자열 간섭을 줄인다. */
function slice(src: string, start: string, end: string): string {
  const s = src.indexOf(start);
  if (s < 0) return "";
  const e = src.indexOf(end, s + start.length);
  return e > s ? src.slice(s, e) : src.slice(s);
}

describe("§receiving-inspection-followup — 클라이언트 결함 (Phase 2 전 RED)", () => {
  it("blockersOf: 처리 방식 미선택과 사유 미입력을 서로 다른 두 문구로 push", () => {
    const body = slice(read(PANEL), "const blockersOf", "const saveInspection");
    // 두 미충족 조건이 각각 별개 안내로 push 되어야 한다(현재는 사유 단일 push).
    expect(body).toMatch(/out\.push\([^)]*처리\s*방식/);
    expect(body).toMatch(/out\.push\([^)]*사유/);
  });

  it("allRestocked: 전 라인 restockedAt → every 기반 파생값 존재", () => {
    const panel = read(PANEL);
    // 문법이 아니라 의도를 잠근다: every + restockedAt 로 파생될 것.
    //   (구 [^)]* 는 화살표 파라미터 괄호를 통과하지 못해 레포 표준 표기를 배제했다.)
    expect(panel).toMatch(/allRestocked\s*=[\s\S]{0,160}every\([\s\S]{0,60}restockedAt/);
  });

  it("전 라인 반영 완료 시 노출되는 상태 문구 존재", () => {
    const panel = read(PANEL);
    expect(panel).toContain("전 품목 반영 완료");
  });

  it("saveInspection: 빈 payload면 fetch 이전 early-return", () => {
    const body = slice(read(PANEL), "const saveInspection", "const load");
    const guardIdx = body.search(/payload\.length\s*===\s*0/);
    const fetchIdx = body.search(/csrfFetch\(/);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(fetchIdx);
  });
});

describe("§receiving-inspection-followup — 서버 가드 고정 (현행 GREEN, 무수정)", () => {
  it("approve: draft 전량 반영 시 409 ALREADY_SYNCED", () => {
    const src = read(APPROVE);
    expect(src).toMatch(/code:\s*"ALREADY_SYNCED"/);
    expect(src).toMatch(/ALREADY_SYNCED"[\s\S]{0,40}status:\s*409/);
  });

  it("approve: restockable 필터가 RESHIP·RETURN 제외", () => {
    const src = read(APPROVE);
    expect(src).toMatch(/discrepancyAction !== "RETURN"/);
    expect(src).toMatch(/discrepancyAction !== "RESHIP"/);
  });

  it("approve: RESHIP 잔여 시 partial + pendingCount, 발주 DELIVERED 미표기", () => {
    const src = read(APPROVE);
    expect(src).toMatch(/pendingLines[\s\S]{0,400}discrepancyAction === "RESHIP"/);
    expect(src).toMatch(/partial:\s*!isFullyReceived/);
    expect(src).toMatch(/isFullyReceived[\s\S]{0,400}status:\s*"DELIVERED"/);
  });
});
