/**
 * §11.226 #quote-management-v2-phase-a — 호영님 v2 P0 CRITICAL 6항목
 *
 * 호영님 v2 spec sheet (2026-05-11):
 *   #1 테이블 상태 뱃지 nowrap + min-width 72px (열 100px) + 축약 규칙
 *   #2 테이블 액션 버튼 nowrap + min-width 80px (열 120px) + 축약
 *   #3 테이블 뷰 진입 시 popup 자동 닫음 (가로 스크롤 차단)
 *   #4 가격/납기 컬럼 데이터 0 시 자동 hide
 *   #5 테이블 제목 열 = firstItemName + 외 N건 (§11.217 helper reuse)
 *   #8 CTA min-width — 카드 140px / 테이블 80px
 *
 * canonical truth lock:
 *   - quote.responses[].totalPrice / quote.deliveryDate / quote.items[0].name 변경 0
 *   - popup-context spec 변경 0 (page.tsx 에서 close() 호출만)
 *   - RAIL_STATE_MAP badge / ctaLabel 변경 0 (축약은 별도 함수)
 *   - §11.217 firstItemName + §11.220d popup model + §11.221 + §11.223 +
 *     §11.224 + §11.225 cluster invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.226 #1 — 테이블 상태 뱃지 nowrap + min-width lock", () => {
  it("thead 상태 컬럼 min-w-[100px] (§11.230b dynamic 후 status key 분기)", () => {
    // §11.230b dynamic refactor — minWClass 분기 안 key === "status" → "min-w-[100px]"
    expect(page).toMatch(/key\s*===\s*["']status["'][\s\S]{0,200}min-w-\[100px\]|<th[\s\S]{0,500}min-w-\[100px\][\s\S]{0,500}상태|상태[\s\S]{0,500}min-w-\[100px\]/);
  });

  it("tbody 상태 뱃지 whitespace-nowrap", () => {
    // §quote-screen-sian P6 — 상태칩 §12 색 정합으로 status 셀 verbose 주석 추가 → 앵커를 키보드핸들러
    //   (viewMode==="table" L1460)가 아닌 tbody 렌더 분기 if(key==="status")로 교정. nowrap+min-w-[72px]은 L2853 실재.
    expect(page).toMatch(/if \(key === "status"\)[\s\S]{0,1700}whitespace-nowrap[\s\S]{0,1200}signals\.badge/);
  });

  it("tbody 상태 뱃지 min-w-[72px]", () => {
    expect(page).toMatch(/if \(key === "status"\)[\s\S]{0,1700}min-w-\[72px\][\s\S]{0,1200}signals\.badge/);
  });
});

describe("§11.226 #2 — 테이블 액션 버튼 nowrap + min-width + 축약", () => {
  it("thead 액션 컬럼 min-w-[120px] (§11.230b dynamic 후 actions key 분기)", () => {
    // §11.230b dynamic refactor — minWClass 분기 안 key === "actions" → "min-w-[120px]"
    expect(page).toMatch(/key\s*===\s*["']actions["'][\s\S]{0,200}min-w-\[120px\]|<th[^>]{0,200}min-w-\[120px\][^>]{0,80}>액션<\/th>|<th[^>]{0,200}>액션<\/th>[\s\S]{0,200}min-w-\[120px\]/);
  });

  it("tbody 액션 Button whitespace-nowrap + min-w-[80px]", () => {
    // 테이블 분기 안 Button className 에 nowrap + min-w-[80px]
    // §quote-table-sian P3 — tbody 액션 <Button> 안 onClick(§11.279d 주석블록)이 className 까지 거리를
    //   1409자로 확대(min-w-[80px]·whitespace-nowrap 은 L2979 실재). 거리 한도 500→1600(impl 정상, 보호 의도 불변).
    expect(page).toMatch(/viewMode === "table"[\s\S]*?Button[\s\S]{0,1600}whitespace-nowrap[\s\S]{0,200}min-w-\[80px\]|viewMode === "table"[\s\S]*?Button[\s\S]{0,1600}min-w-\[80px\][\s\S]{0,200}whitespace-nowrap/);
  });

  it("shortenActionLabel 함수 정의 (테이블 한정 축약)", () => {
    // 축약 매핑: '견적 요청 발송' → '발송', '새 회신 보기' → '회신 확인',
    // '재요청 보내기' → '재요청', '추가 회신 확보' → '추가 회신', '비교 결과 정리' → '비교 정리'
    expect(page).toMatch(/function shortenActionLabel|const shortenActionLabel/);
  });

  it("shortenActionLabel 매핑 — '견적 요청 발송' → '발송'", () => {
    expect(page).toMatch(/shortenActionLabel[\s\S]{0,1500}견적 요청 발송[\s\S]{0,200}["']발송["']/);
  });

  it("shortenActionLabel 매핑 — '새 회신 보기' → '회신 확인'", () => {
    expect(page).toMatch(/shortenActionLabel[\s\S]{0,1500}새 회신 보기[\s\S]{0,200}["']회신 확인["']/);
  });

  it("테이블 분기 Button 안 shortenActionLabel(signals.ctaLabel) 호출", () => {
    expect(page).toMatch(/viewMode === "table"[\s\S]*?shortenActionLabel\(signals\.ctaLabel\)|viewMode === "table"[\s\S]*?\{shortenActionLabel/);
  });
});

describe("§11.226 #3 — 테이블 진입 시 popup auto-close", () => {
  it("useOperationalBriefPopup hook import", () => {
    expect(page).toMatch(/useOperationalBriefPopup/);
  });

  it("close 함수 useEffect 안 호출 (viewMode === 'table' 분기)", () => {
    // useEffect deps [viewMode] + viewMode === 'table' → close 호출 패턴
    // close / closeOperationalBrief 등 prefix 일치 (rename 허용).
    expect(page).toMatch(/useEffect\([\s\S]{0,500}viewMode === "table"[\s\S]{0,300}close[a-zA-Z]*\(\)|useEffect\([\s\S]{0,500}close[a-zA-Z]*\(\)[\s\S]{0,300}viewMode === "table"/);
  });

  it("useEffect deps 에 viewMode 포함", () => {
    expect(page).toMatch(/useEffect\([\s\S]{0,800}viewMode === "table"[\s\S]{0,500}\},\s*\[[\s\S]{0,200}viewMode/);
  });

  // §11.226b hot fix — viewMode 가 이미 'table' 인 fresh load 시 사용자가
  //   popup 을 새로 open 해도 close() 가 호출 안 되는 회귀 차단.
  //   isOpen dep 추가로 popup open 시점마다 viewMode 'table' 분기 trigger.
  it("§11.226b — isOpen / briefIsOpen destructure 추가 (useOperationalBriefPopup)", () => {
    // const { isOpen: briefIsOpen, close } = useOperationalBriefPopup() 또는
    // const { isOpen, close } = useOperationalBriefPopup() 패턴
    expect(page).toMatch(/useOperationalBriefPopup\(\)[\s\S]{0,200}isOpen|isOpen[\s\S]{0,200}useOperationalBriefPopup\(\)|const\s*\{\s*isOpen[\s\S]{0,200}close[\s\S]{0,200}\}\s*=\s*useOperationalBriefPopup/);
  });

  it("§11.226b — useEffect 안 briefIsOpen && close 분기 (popup 열린 상태에서만 close)", () => {
    expect(page).toMatch(/useEffect\([\s\S]{0,500}viewMode === "table"[\s\S]{0,200}(briefIsOpen|isOpen)[\s\S]{0,200}close[a-zA-Z]*\(\)|useEffect\([\s\S]{0,500}(briefIsOpen|isOpen)[\s\S]{0,200}viewMode === "table"[\s\S]{0,200}close[a-zA-Z]*\(\)/);
  });

  it("§11.226b — useEffect deps 에 briefIsOpen / isOpen 포함", () => {
    expect(page).toMatch(/useEffect\([\s\S]{0,800}viewMode === "table"[\s\S]{0,500}\},\s*\[[\s\S]{0,200}(briefIsOpen|isOpen)/);
  });
});

describe("§quote-table-sian P2 #4 — 예상금액 always 노출 (이전 §11.226 빈컬럼 hide supersede)", () => {
  // CEO 2026-06-21 시안 정합: 납기 컬럼 제거 + 예상금액 always. priceColumnHasData/
  // deliveryColumnHasData 게이트는 제거됨(canonical truth quote.responses 변경 0, 표시 정책만 진화).
  it("예상금액(price) 컬럼 visibleColumns 무조건 통과", () => {
    expect(page).toMatch(/key\s*===\s*["']price["']\)\s*return true/);
  });

  it("공급사(supplier) 컬럼 — vendorRequests 아바타 분리 td", () => {
    expect(page).toMatch(/key === "supplier"[\s\S]{0,400}<SupplierAvatars suppliers=\{toSuppliers\(quote\.vendorRequests\)\}/);
  });

  it("tbody 예상금액 td — 실값 없음 시 '견적 대기' 약화(§quote-table-sian P3, 가짜 금액 금지)", () => {
    expect(page).toMatch(/key\s*===\s*["']price["'][\s\S]{0,2000}prices\.length === 0[\s\S]{0,200}견적 대기/);
  });

  it("납기(delivery) 컬럼 키 제거 — tbody/visibleColumns delivery 분기 부재", () => {
    expect(page).not.toMatch(/key\s*===\s*["']delivery["']/);
  });
});

describe("§11.226 #5 — 테이블 제목 열 품목명 (§11.217 helper reuse)", () => {
  it("테이블 tbody 안 deriveTitle helper 호출 또는 displayTitle inline", () => {
    // (a) helper 함수 deriveQuoteDisplayTitle / (b) tbody scope 안 inline derive
    expect(page).toMatch(/viewMode === "table"[\s\S]*?(deriveQuoteDisplayTitle|firstItemName[\s\S]{0,100}moreCount[\s\S]{0,200}외 \$\{moreCount\}건)/);
  });

  it("테이블 제목 td 가 quote.title 단순 노출이 아님 (drift sentinel)", () => {
    // tbody 안 첫 td (제목) 에서 직접 quote.title 사용 0 (helper / displayTitle 통과)
    expect(page).not.toMatch(/viewMode === "table"[\s\S]*?<td className="px-3 py-2 font-medium[\s\S]{0,300}\{quote\.title\}/);
  });
});

describe("§11.226 #8 — CTA min-width 강제", () => {
  it("카드 분기 Button min-w-[140px] (테이블 분기 외 영역)", () => {
    // 카드 QuoteCard / 카드 분기 안 Button className 에 min-w-[140px]
    expect(page).toMatch(/min-w-\[140px\]/);
  });

  it("테이블 분기 Button min-w-[80px] (이미 #2 에서 검증)", () => {
    // #2 에서 검증한 패턴 재확인
    // §quote-table-sian P3 — 거리 800→1600(위 #2 와 동일, onClick 주석블록 1409자).
    expect(page).toMatch(/viewMode === "table"[\s\S]*?Button[\s\S]{0,1600}min-w-\[80px\]/);
  });
});

describe("§11.226 invariant 보존 (cluster lineage)", () => {
  it("§11.217 firstItemName + displayTitle helper 보존", () => {
    expect(page).toMatch(/firstItemName/);
    expect(page).toMatch(/displayTitle/);
  });

  it("§11.220d popup-context spec 변경 0 — close() 호출만", () => {
    // close 호출만 추가, setIsOpen 직접 호출 없음
    expect(page).not.toMatch(/popupContext\.setIsOpen\(/);
  });

  it("§11.221 긴급 뱃지 (delayed bg-rose-500) 보존", () => {
    expect(page).toMatch(/bg-rose-500[\s\S]{0,80}긴급|긴급[\s\S]{0,80}bg-rose-500/);
  });

  it("§11.223 RelativeDeliveryText helper 보존", () => {
    expect(page).toMatch(/RelativeDeliveryText/);
  });

  it("§quote-table-sian P2 — 테이블 thead 8 컬럼: 예상금액 포함·납기 제거", () => {
    // CEO 시안 정합: 가격→예상금액(always), 납기 컬럼 제거.
    expect(page).toMatch(/(<th[^>]{0,200}>예상금액<\/th>|price:\s*"예상금액")/);
    expect(page).not.toMatch(/delivery:\s*"납기"/);
  });

  it("§11.225 organizationVendorProducts 인자 3 caller forward 보존", () => {
    expect(page).toMatch(/getQuoteDispatchPreflight\([\s\S]{0,200}organizationVendorProducts/);
  });

  it("cluster trace marker (§11.226)", () => {
    expect(page).toMatch(/§11\.226|#quote-management-v2-phase-a|v2 P0 CRITICAL/);
  });
});
