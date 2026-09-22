/**
 * §render-literal-data-ratchet (2026-09-21 · 호영님 판정) · **래칫**
 *
 * 🔒 래칫이다. 항상 GREEN 이어야 하고 RED 면 기준선 원장에 올리지 않고 **즉시 처리**한다.
 *
 * ── 왜 ──
 * 렌더 경로에 코드로 박힌 데이터(지어낸 KPI·티켓·팀 지출·알림)가 이 세션에서 연달아 나왔다.
 * 1차 전수(2026-09-20 · 27파일)는 **이름**(MOCK_·dummy…)으로 셌고 `TEAM_DATA` 를 놓쳐 **무효 처리**됐다.
 * 재전수는 이름 무관 3축 합집합이다(탐지기 `_helpers/literal-data-scan.ts` 참조):
 *   ⓐ 표지 주석이 모듈 const 바로 위 · ⓑ 숫자 값을 품은 모듈 스코프 레코드 배열(본축) · ⓒ MOCK_/DUMMY_/SAMPLE_ 이름
 * 카나리 3종(TEAM_DATA 현행 · MOCK_TICKETS c3f046fb^ · MOCK_STAGES d03906d1^)을 모두 잡은 뒤에 측정했다.
 *
 * ── 기준선 (2026-09-21 실측 · 로컬 operator-shell · 렌더 뿌리 129 · 도달 700파일) ──
 *   25파일 · 37건 (ⓐ 16 · ⓑ 17 · ⓒ 4). 전수 보고용 넓은 축: ⓐ-broad 104파일 · ⓑ-all 레코드 배열 120.
 *   목록에는 지어낸 데이터셋과 정당한 설정표가 **섞여 있다** — 목록에 있다는 것은 "허용" 이 아니라
 *   "이 조항 도입 시점에 이미 있었다" 는 뜻이다. 줄이는 방향으로만 움직인다.
 *   소유자: 운영 트랙. 재검토: 2026-12-21.
 *
 * ── 이 래칫이 막는 것 ──
 *   ① 목록 밖 파일에 새 코드 박힌 데이터 0  ② 유령 경로 0  ③ 총계 ≤ 37(목록에 추가해 ①을 우회하는 경로 차단)
 *   ④ 탐지기 자기검증(카나리 형태를 잡고 · 숫자 없는 설정표는 안 잡는다)
 *
 * ── 새로 생긴 것이 정당한 설정표라면 ──
 *   목록에 추가하지 말 것(그 순간 래칫이 꺼진다). 숫자 없는 형태(id·label)로 쓰거나, 서버·DB 에서 읽는다.
 *   숫자가 꼭 필요한 설정(규격·임계값)은 `lib/` 의 **렌더 밖 모듈**에 두고 이름으로 의미를 밝힌다 —
 *   그래도 걸리면 그건 설정이 아니라 데이터일 가능성이 높다.
 *
 * ── 자기 한계 ──
 *   1. API route.ts 가 지어낸 값을 내려주는 형태(렌더 뿌리 아님). 2. 함수 **안**의 리터럴 배열(모듈 스코프만 본다).
 *   3. 🛑 **문자열만으로 된 가짜 데이터**(팀명·공급사명 배열 · 고정 AI 인사이트 문구 등)는 ⓑ-data 축에 안 걸린다.
 *      ⓐ 표지 주석이 있으면 일부 덮지만 **주석 없는 것은 뚫린다.** ⓑ 를 숫자 배열로 좁힌 대가다(호영님 승인 ·
 *      2026-09-22 — 전체 레코드 배열로 걸면 정상 설정 배열마다 목록 추가밖에 길이 없어 래칫이 죽는다).
 *      → 다음 전수 때는 **렌더 도달 여부**를 축으로 문자열 레코드 배열까지 재측정한다(래칫 밖 전수).
 *   4. 여러 줄에 걸친 선언 머리(`const X =\n [`) — 선언과 `[` 가 같은 줄일 때만 본다.
 */
import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { renderReachableSources, scanLiteralData } from "@/__tests__/_helpers/literal-data-scan";

const SRC = join(__dirname, "..", "..");

/** 기준선 파일 집합(2026-09-21). 줄이는 방향으로만. 줄일 때는 그 변경을 만든 커밋을 옆에 적는다. */
const LEGACY = [
  "app/_components/final-cta-section.tsx",
  "app/_workbench/_components/step-nav.tsx",
  "app/_workbench/search/page.tsx",
  "app/app/step-nav.tsx",
  "app/dashboard/analytics/_components/team-analytics-view.tsx",
  "app/dashboard/analytics/monthly/page.tsx",
  "app/dashboard/analytics/page.tsx",
  "app/dashboard/audit/page.tsx",
  "app/dashboard/budget/[id]/page.tsx",
  // 제거됨: "app/dashboard/notifications/page.tsx" — §notifications-single-source(2026-09-22) · 가짜 알림 20건 삭제(1건 ↓)
  "app/dashboard/page.tsx",
  "app/dashboard/safety/page.tsx",
  "components/approval/quote-chain-progress-strip.tsx",
  "components/approval/quote-chain-workbenches.tsx",
  "components/inventory/LabelPrintModal.tsx",
  "components/inventory/priority-action-queue.tsx",
  "components/layout/barcode-scan-fab.tsx",
  "lib/ai/governance-grammar-registry.ts",
  "lib/ai/quote-approval-governance-engine.ts",
  "lib/db.ts",
  "lib/layout-system/work-window-system.ts",
  "lib/ops-console/seed-data.ts",
  "lib/organization/default-name.ts",
  "lib/review-queue/operator-console-contract.ts",
  "lib/vendor-portal/vendor-portal-store.ts",
];

/** 기준선 총계. 올리지 않는다. 37(2026-09-21) → 36(2026-09-22 · 알림 센터 가짜 알림 삭제). */
const CEILING = 36;

const reachable = renderReachableSources(SRC);
const perFile = [...reachable]
  .map(([file, src]) => ({ file, hits: scanLiteralData(src).hits }))
  .filter((r) => r.hits.length > 0);

describe("§render-literal-data-ratchet · 렌더 경로에 코드로 박힌 데이터 (래칫)", () => {
  it("① 목록 밖 파일에 새 코드 박힌 데이터 0", () => {
    const legacy = new Set(LEGACY);
    const offenders = perFile
      .filter((r) => !legacy.has(r.file))
      .map((r) => `${r.file}  ${r.hits.map((h) => `${h.axis}:L${h.line}:${h.name}`).join(" · ")}`);
    expect(offenders).toEqual([]);
  });

  it("② 목록에 유령 경로 0 (파일이 사라지거나 렌더 밖으로 나가면 목록에서 지운다)", () => {
    const ghosts = LEGACY.filter((f) => !reachable.has(f));
    expect(ghosts).toEqual([]);
  });

  it("③ 총계 ≤ 기준선 (예외 목록이 커지는 방향 차단)", () => {
    const total = perFile.reduce((n, r) => n + r.hits.length, 0);
    expect(total).toBeLessThanOrEqual(CEILING);
  });

  it("④ 탐지기 자기검증 · 카나리 형태는 잡고 숫자 없는 설정표는 안 잡는다", () => {
    const team = ["// ── 더미 데이터 ──", "const TEAM_X = [", '  { id: "t1", name: "분자생물학팀", budget: 48000000 },', "];"].join("\n");
    const tickets = ["const MOCK_Y = [", '  { id: "TK-001", slaHours: 3 },', "];"].join("\n");
    const config = ["const TABS = [", '  { id: "a", label: "가" },', '  { id: "b", label: "나" },', "];"].join("\n");
    const axes = (s: string) => [...new Set(scanLiteralData(s).hits.map((h) => h.axis))].sort();
    expect(axes(team)).toEqual(["a-adjacent", "b-data"]);
    expect(axes(tickets)).toEqual(["b-data", "c-name"]);
    expect(axes(config)).toEqual([]);
  });
});
