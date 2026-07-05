/**
 * 입고 관리 모바일웹 리디자인(핸드오프, 호영님 2026-07-05) — MobileReceivingView 시안 정합.
 * KPI 흰 카드+7px 도트(꽉 찬 배경 미사용) · 입고 카드 상태=테두리 색만(좌측 세로띠 제거) · CTA no-op 0 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const VIEW = readFileSync(join(__dirname, "..", "..", "components/receiving/mobile-receiving-view.tsx"), "utf8");

describe("입고 모바일 리디자인 — KPI 카드(흰 카드+도트)", () => {
  it("KPI 2카드 흰 배경(bg-white) + 7px 상태 도트, 꽉 찬 배경색 미사용", () => {
    expect(VIEW).toMatch(/h-\[7px\] w-\[7px\] rounded-full/);
    expect(VIEW).toMatch(/bg-rose-500/); // 문서대기 도트
    expect(VIEW).toMatch(/bg-emerald-500/); // 반영가능 도트
    // KPI 컨테이너 = 흰 카드(문서대기/반영가능 둘 다 bg-white). 이전 filled 배경 반전.
    expect(VIEW).toMatch(/border bg-white \$\{blockedCount > 0/);
    expect(VIEW).toMatch(/border bg-white \$\{readyCount > 0/);
  });
});

describe("입고 모바일 리디자인 — 입고 카드(테두리 색만 + 문서박스 + 큰 CTA)", () => {
  it("상태=카드 테두리 색(rose/emerald), 좌측 세로띠 제거", () => {
    expect(VIEW).toMatch(/border-rose-300/);
    expect(VIEW).toMatch(/border-emerald-300/);
    expect(VIEW).toMatch(/relative w-full text-left rounded-xl border bg-white/);
    // 좌측 세로띠(w-1 stripe) 잔재 0
    expect(VIEW).not.toMatch(/w-1 shrink-0/);
  });
  it("문서 상태 박스(rose-weak/emerald-weak) + 큰 primary CTA(문서 첨부/재고 반영)", () => {
    // 문서 상태 박스
    expect(VIEW).toMatch(/bg-rose-50 border-rose-100/);
    expect(VIEW).toMatch(/bg-emerald-50 border-emerald-100/);
    // 큰 CTA(h-11, blue/emerald), 시안 라벨
    expect(VIEW).toMatch(/h-11[\s\S]*?bg-blue-600/);
    expect(VIEW).toMatch(/문서 첨부/);
    expect(VIEW).toMatch(/재고 반영/);
    expect(VIEW).not.toMatch(/문서 검토/); // 구 라벨(작은 링크) 잔재 0
  });
});

describe("입고 모바일 리디자인 — 상단 필터 카운트(핸드오프 정합)", () => {
  it("칩에 카운트 인라인(전체/문서대기/반영가능)", () => {
    expect(VIEW).toMatch(/c\.k === "all" \? items\.length : c\.k === "blocked" \? blockedCount : readyCount/);
    expect(VIEW).toMatch(/tabular-nums/);
  });
});

describe("입고 모바일 리디자인 — 무회귀(no-op 0·wiring 보존)", () => {
  it("CTA 실 라우팅·칩·empty·게이트 매핑 보존", () => {
    expect(VIEW).toMatch(/onClick=\{\(\) => onClick\(item\)\}/); // 카드 탭 실 라우팅
    expect(VIEW).toMatch(/조건에 맞는 입고가 없습니다/); // empty state
    expect(VIEW).toMatch(/gateOf/); // 문서게이트 canonical 매핑
  });
});
