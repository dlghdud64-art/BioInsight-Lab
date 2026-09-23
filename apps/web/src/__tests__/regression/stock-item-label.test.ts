/**
 * §stock-item-label (2026-09-22 · 호영님 판정 · 커밋 4/4) · **화면 문구에 내부 키를 내지 않는다.**
 *
 * ── 왜 ──
 * `inventoryItemId` 는 내부 키다(예: `inv-item-fbs`). 운영 작업함 제목에서 먼저 드러났고
 * (§inbox-seed-cutoff — 「inv-item-fbs 재주문 필요」), 전역 sweep 에서 형제 슬롯이 더 나왔다:
 *   차단 사유(blocker-adapter 4) · 명령 라벨(command-adapters 4) ·
 *   재진입 요약(reentry-context 2) · 중복 사유(reorder-expiry-stock-risk-view-models 1).
 * 시드 여부와 무관한 별개 결함이다(호영님). 찾은 것과 같은 커밋에서 고치지 않고 이 커밋으로 분리했다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 라벨 규칙은 **한 곳**에만 있다 — lib/ops-console/stock-item-label.ts (정의가 둘이면 한쪽만 고쳐진다)
 *   ② 표시명이 없으면 없다고 말한다 — 내부 키로 대체하지 않는다
 *   ③ 화면 문구를 만드는 4개 모듈에 `${…inventoryItemId}` 보간 0 (역계약 · 주석 제거본)
 *
 * ── 자기 한계 ──
 *   1. 지금 이 문구들에 **라이브 생산자가 0** 이다 — 작업함은 실 endpoint(견적 2종)만 읽고,
 *      재고 계열 어댑터를 채우던 ops 시드는 끊겼다. fallback 은 현재 렌더 미도달이다.
 *      "품목명 처리는 됐다" 는 근거로 읽으면 안 된다.
 *   2. fallback 이 실제로 뜨는 조건이 생기면 그건 표시명을 못 채우는 **생산자 쪽 결함**이다(별건 큐).
 *   3. 내부 키 노출의 다른 형태(locationId · lotId 등)는 이 파일의 범위 밖이다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { stockItemLabel, STOCK_ITEM_LABEL_FALLBACK } from "@/lib/ops-console/stock-item-label";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

/** 화면 문구를 만드는 모듈 — 내부 키가 새어 나오던 자리 */
const SURFACES = [
  "lib/ops-console/inbox-adapter.ts",
  "lib/ops-console/blocker-adapter.ts",
  "lib/ops-console/command-adapters.ts",
  "lib/ops-console/reentry-context.ts",
  "lib/review-queue/reorder-expiry-stock-risk-view-models.ts",
];

describe("§stock-item-label · 화면 문구에 내부 키를 내지 않는다", () => {
  it("① 라벨 규칙은 한 곳에만 · 다른 모듈은 import 해서 쓴다", () => {
    expect(code("lib/ops-console/stock-item-label.ts")).toMatch(/export function stockItemLabel/);
    for (const rel of SURFACES) {
      const src = code(rel);
      expect(src, `${rel}: 사본 정의`).not.toMatch(/function stockItemLabel\(/);
      expect(src, `${rel}: import`).toMatch(/import \{ stockItemLabel \} from ["'][^"']*stock-item-label["']/);
    }
  });

  it("② 표시명이 없으면 없다고 말한다 (내부 키로 대체 0)", () => {
    expect(stockItemLabel({ itemDisplayName: "Trypsin-EDTA" })).toBe("Trypsin-EDTA");
    expect(stockItemLabel({ itemDisplayName: "  " })).toBe(STOCK_ITEM_LABEL_FALLBACK);
    expect(stockItemLabel({})).toBe(STOCK_ITEM_LABEL_FALLBACK);
    expect(STOCK_ITEM_LABEL_FALLBACK).toBe("품목명 미확인");
    // 내부 키를 넘겨도 라벨 함수는 그걸 쓰지 않는다(시그니처가 받지 않는다)
    expect(stockItemLabel({ itemDisplayName: undefined })).toBe(STOCK_ITEM_LABEL_FALLBACK);
  });

  it("③ 화면 문구에 inventoryItemId 보간 0 (역계약)", () => {
    for (const rel of SURFACES) {
      expect(code(rel), rel).not.toMatch(/\$\{[A-Za-z.]*inventoryItemId\}/);
    }
  });
});
