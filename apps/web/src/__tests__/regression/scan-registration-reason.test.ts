/**
 * §scan-registration-reason (호영님 2026-09-04) — 등록 실패에 사유가 따라붙는지 잠근다.
 *
 * 왜:
 *   smart-receiving 의 catch-all 이 `console.error` + 고정 문구만 반환해서,
 *   `"OTHER" as ProductCategory`(존재하지 않는 enum 값)로 신규 품목 등록이 100% 실패하는데도
 *   prod 에서 완전히 침묵했다. UI 는 `스마트 입고 처리에 실패했습니다` 한 줄만 띄웠다.
 *   스캔 차단의 `skipReason` 과 같은 계약 — 실패에는 사유가 따라붙는다.
 *
 * 잠그는 것:
 *   1) 서버 500 응답이 failReason 을 싣는다(고정 문구 단독 반환 차단)
 *   2) 클라이언트가 단품·다품목 **양쪽** 경로에서 failReason 을 문구에 붙인다
 *   3) 오류 화면이 그 문구를 실제로 렌더한다
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";

describe("§scan-registration-reason — 서버가 사유를 싣는다", () => {
  it("catch-all 500 응답에 failReason 이 붙는다", () => {
    const src = read(ROUTE);
    // 창은 catch 블록 시작부터(② 창 시작점 — status 500 부터 열면 앞의 error 문구가 창 밖).
    const catchIdx = src.indexOf('catch (error) {\n    console.error("[SmartReceiving/POST]"');
    expect(catchIdx).toBeGreaterThan(-1);
    const win = src.slice(catchIdx, catchIdx + 700);
    expect(win).toMatch(/failReason:\s*describeFailure\(error\)/);
    expect(win).toMatch(/status:\s*500/);
  });

  it("describeFailure 를 실제로 import 한다 (미배선 차단)", () => {
    expect(read(ROUTE)).toMatch(
      /import \{ describeFailure \} from "@\/lib\/api-failure-reason"/,
    );
  });

  it("고정 문구 단독 반환으로 회귀하지 않는다", () => {
    const src = read(ROUTE);
    // 사유 없이 error 만 담아 500 을 반환하던 형태(이번 침묵의 원형).
    expect(src).not.toMatch(
      /\{ error: "스마트 입고 처리에 실패했습니다\." \},\s*\n\s*\{ status: 500 \}/,
    );
  });
});

describe("§scan-registration-reason — 클라이언트가 사유를 붙인다 (경로 2개 각각)", () => {
  it("withFailReason 헬퍼 — 사유 없으면 문구만(지어내지 않는다)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/function withFailReason\(message: string, failReason\?: string \| null\)/);
    expect(src).toMatch(/return reason \? `\$\{message\} · \$\{reason\}` : message/);
  });

  it("다품목 경로가 failReason 을 붙인다", () => {
    // ④ 경로는 OR 로 묶지 않고 각각 단언한다 — 하나가 끊기는 것도 회귀다.
    expect(read(MODAL)).toMatch(
      /withFailReason\(data\.error \|\| "다품목 입고 등록 실패", data\.failReason\)/,
    );
  });

  it("단품 경로가 failReason 을 붙인다", () => {
    expect(read(MODAL)).toMatch(
      /withFailReason\(data\.error \|\| "입고 등록 실패", data\.failReason\)/,
    );
  });

  it("응답 타입에 failReason 이 선언돼 있다 (타입에서 탈락 방지)", () => {
    const src = read(MODAL);
    const ifaceIdx = src.indexOf("interface SmartReceivingApiResponse");
    expect(ifaceIdx).toBeGreaterThan(-1);
    expect(src.slice(ifaceIdx, ifaceIdx + 600)).toMatch(/failReason\?: string \| null/);
  });
});

describe("§scan-registration-reason — 오류 화면이 사유를 렌더한다", () => {
  it("error step 이 errorMessage 를 testid 붙여 노출한다", () => {
    const src = read(MODAL);
    // 창은 여는 태그부터(② 창 시작점).
    const idx = src.indexOf('<p\n              data-testid="smart-receiving-error-reason"');
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 400);
    expect(win).toMatch(/\{errorMessage \?\? "알 수 없는 오류"\}/);
    // 긴 Prisma 사유가 잘리지 않아야 한다.
    expect(win).toMatch(/break-words/);
  });

  it("회귀 0 — 실패 시 error step 진입 + errorMessage 세팅 보존", () => {
    const src = read(MODAL);
    expect((src.match(/setErrorMessage\(msg\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/setStep\("error"\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
