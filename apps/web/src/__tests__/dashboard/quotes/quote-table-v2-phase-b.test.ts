/**
 * §11.227 #quote-management-v2-phase-b — 호영님 v2 P1 Phase B
 *
 * Audit 후 실제 신규 작업:
 *   #9  테이블 default + sort by column header
 *   #10c 공급사 응답 미니 타임라인 (vendor 3 stage)
 *
 * Audit 결과 이미 land (invariant 보존):
 *   #10a AI 요약 = signals.summary (line 473)
 *   #10b 최근 활동 = RelativeTimeText + §11.221 긴급
 *   #13   카드 AI 추천 = §11.217 Phase 1 에서 제거됨 (signals.summary 는 다른 field)
 *   #14   popup context-aware = #operational-brief-context-aware-category land
 *
 * canonical truth lock:
 *   - viewMode useState + localStorage persist (§11.217 Phase 6) 보존
 *   - vendor 미니 타임라인 = quote.vendorRequests + quote.responses 데이터 활용
 *   - popup-context spec 변경 0
 *   - §11.221 + §11.223 + §11.224 + §11.225 + §11.226 + §11.226b cluster invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.227 #9 — 테이블 default + sort by column header", () => {
  it("viewMode default = 'table' (이전 'card')", () => {
    // useState<"card" | "table">("table") 패턴
    expect(page).toMatch(/useState<"card"\s*\|\s*"table">\("table"\)|useState<"table"\s*\|\s*"card">\("table"\)/);
  });

  it("sortState useState 정의 — { key, direction }", () => {
    expect(page).toMatch(/const\s+\[sortState,\s*setSortState\]/);
  });

  it("sortState 타입 — column key + direction", () => {
    // 타입: { key: ... | null; direction: 'asc' | 'desc' }
    // §quote-management-p3b — key union 에 "price" 추가로 sortState→direction 거리 확대(200→300 window).
    expect(page).toMatch(/sortState[\s\S]{0,300}direction[\s\S]{0,100}"asc"\s*\|\s*"desc"|sortState[\s\S]{0,300}direction[\s\S]{0,100}'asc'\s*\|\s*'desc'/);
  });

  it("thead 컬럼 헤더 onClick → sort callback 호출 (sortable column)", () => {
    // handleSortColumn callback 또는 setSortState 직접 호출 둘 다 허용
    expect(page).toMatch(/<th[\s\S]{0,400}onClick=\{[\s\S]{0,200}(setSortState|handleSortColumn)/);
  });

  it("tbody 정렬 fn — filteredQuotes 또는 sortedQuotes 변수 derive", () => {
    expect(page).toMatch(/const\s+sortedQuotes\s*=|sortedQuotes\s*=\s*useMemo/);
  });

  it("정렬 아이콘 — ChevronUp / ChevronDown lucide-react import", () => {
    expect(page).toMatch(/ChevronUp[\s\S]{0,50}ChevronDown|ChevronDown[\s\S]{0,50}ChevronUp/);
  });

  it("정렬 가능 컬럼 — 제목 / 상태 / 품목 / 회신 / 등록 매핑", () => {
    // sortState.key 값 매핑 (예: 'title', 'status', 'itemCount', 'responseCount', 'createdAt')
    expect(page).toMatch(/sortState\.key === ["'](title|status|itemCount|responseCount|createdAt)["']/);
  });
});

describe("§11.227 #10c — 공급사 응답 미니 타임라인", () => {
  it("미니 타임라인 component / element 정의", () => {
    // 카드 분기 안 vendor 응답 3 stage element
    // element 패턴: "공급사 응답" 또는 "발송 → 대기 → 수신" text 또는 vendor-timeline className
    expect(page).toMatch(/공급사 응답[\s\S]{0,200}\b(timeline|진행|stage)\b|vendor-timeline|공급사\s*응답\s*진행/);
  });

  it("3 stage 분기 — sent / waiting / received (호영님 v2 '발송 → 대기 → 수신')", () => {
    // canonical truth = quote.status + responseCount (vendorRequests model 변경 0).
    // sent = quote.status !== 'PENDING', waiting = SENT && responseCount === 0,
    // received = responseCount > 0
    expect(page).toMatch(/공급사 응답[\s\S]{0,800}(sent|발송)[\s\S]{0,400}(waiting|대기)[\s\S]{0,400}(received|수신)/);
  });

  it("stage 색상 분기 — emerald (complete) / amber (pending) / slate (waiting)", () => {
    // 미니 타임라인 stage dot 분기
    expect(page).toMatch(/(bg-emerald-500|bg-emerald-400)[\s\S]{0,500}(bg-amber-500|bg-amber-400|bg-slate-300)/);
  });
});

describe("§11.227 invariant 보존 (cluster lineage)", () => {
  it("§11.217 Phase 6 — viewMode toggle + localStorage 보존", () => {
    expect(page).toMatch(/labaxis-quote-view-mode/);
    expect(page).toMatch(/setViewMode\("card"\)/);
    expect(page).toMatch(/setViewMode\("table"\)/);
    expect(page).toMatch(/aria-pressed=\{viewMode === "table"\}/);
  });

  it("§11.221 긴급 뱃지 보존", () => {
    expect(page).toMatch(/bg-rose-500[\s\S]{0,80}긴급|긴급[\s\S]{0,80}bg-rose-500/);
  });

  it("§11.223 RelativeDeliveryText 보존", () => {
    expect(page).toMatch(/RelativeDeliveryText/);
  });

  it("§quote-table-sian P2 — thead 8 컬럼: 예상금액 포함·납기 제거", () => {
    expect(page).toMatch(/(<th[^>]{0,200}>예상금액<\/th>|price:\s*"예상금액")/);
    expect(page).not.toMatch(/delivery:\s*"납기"/);
  });

  it("§11.225 organizationVendorProducts 인자 forward 보존", () => {
    expect(page).toMatch(/getQuoteDispatchPreflight\([\s\S]{0,200}organizationVendorProducts/);
  });

  it("§11.226 shortenActionLabel 8 매핑 보존", () => {
    expect(page).toMatch(/shortenActionLabel/);
    expect(page).toMatch(/견적 요청 발송[\s\S]{0,200}["']발송["']/);
  });

  it("§quote-table-sian P2 — 예상금액 always(hasData 게이트 제거) + 공급사 분리", () => {
    // 이전 §11.226 #4 price/delivery hasData 게이트는 시안 P2 에서 supersede.
    expect(page).toMatch(/key\s*===\s*["']price["']\)\s*return true/);
    expect(page).toMatch(/key === "supplier"[\s\S]{0,400}<SupplierAvatars suppliers=\{toSuppliers\(quote\.vendorRequests\)\}/);
  });

  it("§11.226b popup auto-close (briefIsOpen dep) 보존", () => {
    expect(page).toMatch(/useEffect\([\s\S]{0,500}viewMode === "table"[\s\S]{0,200}(briefIsOpen|isOpen)[\s\S]{0,200}close[a-zA-Z]*\(\)/);
  });

  it("§11.226 #5 tableDisplayTitle (firstItemName + 외 N건) 보존", () => {
    expect(page).toMatch(/tableDisplayTitle/);
  });

  it("§11.217 Phase 1 — 카드 안 signals.summary (decision summary) 보존 (#13 invariant)", () => {
    // 호영님 v2 #13 spec 은 AI 추천 중복 제거. signals.summary 는 다른 field 라 보존.
    expect(page).toMatch(/\{signals\.summary\}/);
  });

  it("cluster trace marker (§11.227)", () => {
    expect(page).toMatch(/§11\.227|#quote-management-v2-phase-b|sort by header|미니 타임라인/);
  });
});
