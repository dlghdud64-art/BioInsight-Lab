/**
 * §reorder-quote-handoff — 재발주→견적 핸드오프 배선 + 1a~1d UI 정직화 (호영님 지시문 2026-08-05)
 *
 * 원인(Phase 0 실측):
 *   ① "견적 요청 초안 만들기" = query-string prefill 후 /dashboard/quotes 이동 — 소비자 0
 *      → 초안 미생성 no-op 핸드오프 (§11.310 Q30 "DB write 0" 설계가 소비자 부재로 무효).
 *   ② 모바일 재고 KPI 미달 카드 bg-rose-50+border-rose-200 이중 강조 (inventory-main).
 *   ③ 공급사 0 품목에서 바로 발주 버튼 노출(disabled) — 지시문은 hide+안내.
 *   ④ 초안 카드 "공급사 미정" 막다른 표현 + 예상 금액 "견적 대기" 정보 0 행.
 *
 * 수정 계약 (본 파일이 잠금):
 *   P2 배선: 시트 CTA → POST /api/quotes(DB write) → 성공 시 ?prepare={id} 직행, 실패 시 이동 0+에러.
 *   P3 1a: KPI 3장 흰 카드 통일 — 미달은 숫자 #b91c1c + 점만 (rose 배경/보더 금지).
 *   P3 1b: 공급사 0 → 바로 발주 미노출 + 안내 1줄 + CTA "초안 만들고 공급사 지정 →".
 *   P3 1c: QuotePreparePanel — 3스텝, 지정 전 CTA disabled+사유, 지정 시 발송 인텐트(2-step) 연속.
 *   P3 1d: 카드 pill "공급사 지정 필요" + CTA "공급사 지정하고 발송" + 견적 대기 행 숨김.
 *
 * 검증(격리 readFileSync+regex — inventory-mobile-reorder-gate 패턴 승계 → operator 실 vitest 권위).
 * 커버 안 함: 시각 정밀(색 렌더·하이라이트 모션) — P4 호영님 실기기 QA 몫.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const SHEET = read("src/components/inventory/ReorderReviewSheet.tsx");
// ⚠️ 라이브 표면 = inventory-content.tsx (page.tsx → dynamic import).
// 최초 판본은 inventory-main.tsx 를 읽었으나 그 파일은 importer 0 = dead →
// 프로덕션 효과 0인 채 GREEN(false-GREEN, 2026-08-05 prod QA ① NG 로 발각).
// 잠금 대상은 반드시 렌더되는 파일이어야 한다.
const LIVE_INVENTORY = read("src/app/dashboard/inventory/inventory-content.tsx");
const CARD = read("src/components/quotes/mobile-quotes-view.tsx");
const PAGE = read("src/app/dashboard/quotes/page.tsx");
const PANEL_PATH = "src/components/quotes/prepare/quote-prepare-panel.tsx";

describe("§reorder-quote-handoff P2 — 초안 생성 배선 (no-op 해소)", () => {
  it("시트 CTA가 POST /api/quotes 실호출 (query-string 이동 아님)", () => {
    expect(SHEET).toMatch(/csrfFetch\(\s*["']\/api\/quotes["']\s*,[\s\S]{0,200}method:\s*["']POST["']/);
  });

  it("[CSRF] csrfFetch 사용 — raw fetch 는 토큰 미부착 403 (§support-csrf-fix 승계)", () => {
    // 2026-08-05 prod 실측: raw fetch("/api/quotes") → x-labaxis-csrf-token 미부착 →
    // "보안 검증이 완료되지 않아 작업을 진행할 수 없습니다." 403. csrfFetch 가 계약.
    expect(SHEET).toMatch(/import\s*\{\s*csrfFetch\s*\}\s*from\s*"@\/lib\/api-client"/);
    expect(SHEET).toMatch(/csrfFetch\(\s*["']\/api\/quotes["']/);
    expect(SHEET).not.toMatch(/[^a-zA-Z]fetch\(\s*["']\/api\/quotes["']/);
  });

  it("성공 시 ?prepare={id} 직행 (리스트 경유 없음)", () => {
    expect(SHEET).toMatch(/router\.push\([\s\S]{0,120}prepare=/);
  });

  it("실패 시 이동 0 + 에러 표기 (placeholder success 금지)", () => {
    // 실패 분기에서 에러 상태를 세팅하고 return (push 없음)
    expect(SHEET).toMatch(/setCreateError|createError/);
    expect(SHEET).toMatch(/res\.ok|response\.ok/);
  });

  it("생성 중 pending 상태 (disabled + 라벨)", () => {
    expect(SHEET).toMatch(/creating|isCreating|pending/i);
    expect(SHEET).toMatch(/초안 생성 중/);
  });

  it("[사고 가드] 생성 상태 훅이 early return(!data) 위에 선언 — React #310 재발 차단", () => {
    // 2026-08-05 prod 실측: creating/createError useState 가 `if (!data) return null`
    // 뒤에 있으면 data null→값 전환에서 훅 수 변화 → 시트 오픈 즉시 크래시(#310).
    const earlyReturnIdx = SHEET.indexOf("if (!data) return null");
    const creatingIdx = SHEET.indexOf("const [creating, setCreating] = useState");
    expect(earlyReturnIdx).toBeGreaterThan(-1);
    expect(creatingIdx).toBeGreaterThan(-1);
    expect(creatingIdx).toBeLessThan(earlyReturnIdx);
  });

  it("출처 메타 전파 — 재고관리 재발주안에서 생성", () => {
    expect(SHEET).toMatch(/재고관리 재발주안에서 생성/);
  });

  it("구 query-string prefill 이동 잔존 0 (productName 파라미터 라우팅 제거)", () => {
    expect(SHEET).not.toMatch(/dashboard\/quotes\?\$\{params/);
  });
});

describe("§reorder-quote-handoff P3 1a — 모바일 재고 KPI de-red", () => {
  it("미달 카드 rose 배경/보더 채색 0 (흰 카드 통일)", () => {
    // KPI 3장 map 블록에서 alert 분기의 bg-rose-50/border-rose-200 제거
    const kpiBlock = LIVE_INVENTORY.slice(LIVE_INVENTORY.indexOf('"전체 품목"'), LIVE_INVENTORY.indexOf('"전체 품목"') + 2000);
    expect(kpiBlock).not.toMatch(/bg-rose-50/);
    expect(kpiBlock).not.toMatch(/border-rose-200/);
  });

  it("미달 숫자 #b91c1c + 6px 레드 점만", () => {
    const kpiBlock = LIVE_INVENTORY.slice(LIVE_INVENTORY.indexOf('"전체 품목"'), LIVE_INVENTORY.indexOf('"전체 품목"') + 2000);
    expect(kpiBlock).toMatch(/#b91c1c/);
    expect(kpiBlock).toMatch(/h-1\.5 w-1\.5|h-\[6px\] w-\[6px\]/);
  });

  it("[사고 가드] 잠금 대상이 라이브 표면 — page.tsx 가 inventory-content 를 import", () => {
    // 2026-08-05 prod QA ①: 위 두 계약이 dead file(inventory-main.tsx, importer 0)
    // 을 잠가 false-GREEN 이었다. 렌더 경로가 끊기면 이 테스트가 먼저 RED 가 된다.
    const entry = read("src/app/dashboard/inventory/page.tsx");
    expect(entry).toMatch(/import\(\s*["']\.\/inventory-content["']\s*\)/);
  });
});

describe("§reorder-quote-handoff P3 1b — 공급사 0 CTA 정직화", () => {
  it("공급사 0 → 바로 발주 버튼 미노출 (disabled 아님 — hide)", () => {
    // hasVendor 조건부 렌더 안으로 이동
    expect(SHEET).toMatch(/hasVendor\s*&&[\s\S]{0,400}reorder-review-direct-purchase-cta/);
  });

  it("공급사 0 → 대체 안내 1줄", () => {
    expect(SHEET).toMatch(/바로 발주는 공급사·단가 확정 후 가능합니다/);
  });

  it("공급사 0 → 주 CTA 라벨 '초안 만들고 공급사 지정' (다음 화면 예고)", () => {
    expect(SHEET).toMatch(/초안 만들고 공급사 지정/);
  });

  it("공급사 0 안내 — 다음 화면 예고 문구", () => {
    expect(SHEET).toMatch(/이 품목에 등록된 공급사가 없습니다/);
    expect(SHEET).toMatch(/초안을 만든 뒤 바로 공급사 지정 화면으로 이동합니다/);
  });
});

describe("§reorder-quote-handoff P3 1c — 발송 준비 패널 (same-route)", () => {
  it("QuotePreparePanel 컴포넌트 존재", () => {
    expect(existsSync(join(REPO_ROOT, PANEL_PATH))).toBe(true);
  });

  it("3스텝 pill — 품목 확정 / 공급사 지정 / 발송", () => {
    const panel = read(PANEL_PATH);
    expect(panel).toMatch(/품목 확정/);
    expect(panel).toMatch(/공급사 지정/);
    expect(panel).toMatch(/발송/);
  });

  it("지정 전 CTA disabled + 사유 라벨 (dead button 금지)", () => {
    const panel = read(PANEL_PATH);
    expect(panel).toMatch(/disabled/);
    expect(panel).toMatch(/공급사 지정 필요/);
  });

  it("이탈 안전 — 나중에 하기(발송 대기 저장)", () => {
    const panel = read(PANEL_PATH);
    expect(panel).toMatch(/나중에 하기/);
  });

  it("page 가 ?prepare= param 으로 패널 mount + 발송 인텐트(2-step) 연속", () => {
    expect(PAGE).toMatch(/QuotePreparePanel/);
    expect(PAGE).toMatch(/get\(["']prepare["']\)/);
    // 패널 발송 CTA → 기존 sendIntent 게이트 재사용 (VendorRequestModal 직진입 금지)
    expect(PAGE).toMatch(/QuotePreparePanel[\s\S]{0,1500}setSendIntentQuoteId/);
  });
});

describe("§reorder-quote-handoff P3 1d — 리스트 카드 할 일 표현", () => {
  it("pill '공급사 지정 필요' (막다른 '공급사 미정' 교체)", () => {
    expect(CARD).toMatch(/공급사 지정 필요/);
  });

  it("CTA '공급사 지정하고 발송' → prepare 복귀", () => {
    expect(CARD).toMatch(/공급사 지정하고 발송/);
    expect(CARD).toMatch(/onPrepare/);
  });

  it("공급사 미지정 + 금액 없음 → '견적 대기' 행 숨김 (정보 0 행 제거)", () => {
    // needsSupplier 케이스에서 amount row 조건부 — 견적 대기 텍스트가 needsSupplier 아닐 때만
    expect(CARD).toMatch(/!needsSupplier[\s\S]{0,300}견적 대기|needsSupplier\s*\?[\s\S]{0,200}:\s*[\s\S]{0,200}견적 대기/);
  });

  it("page 가 MobileQuotesView 에 onPrepare 전달", () => {
    expect(PAGE).toMatch(/<MobileQuotesView[\s\S]{0,400}onPrepare/);
  });
});
