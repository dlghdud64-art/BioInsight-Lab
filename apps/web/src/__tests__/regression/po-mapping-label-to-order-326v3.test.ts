/**
 * §11.326 v3 (회귀) — 라벨→미입고 발주(Order) 매핑 동선 sentinel
 *
 * 스마트 입고 review 단계에서:
 *   - 미입고 발주(Order, status ORDERED/CONFIRMED/SHIPPING) 후보 조회
 *   - 후보 선택 시 받은 통 개수 prefill + 발주 선택 입고(orders/[id] PATCH DELIVERED)
 *   - 미매칭 시 현행 smart-receiving 신규등록 fallback 보존
 *   - §11.326 데이터모델(packSize vs receivedQuantity) 회귀 0
 *
 * canonical truth = Order. 매핑 입고는 orders PATCH(DELIVERED→restock 자동) 재사용 →
 *   ocrJobId 불필요(§11.290 Phase 5 의존 없이 dead-end 우회).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const ROUTE = "src/app/api/inventory/po-candidates-for-label/route.ts";
const LIB = "src/lib/inventory/match-label-to-order.ts";

describe("§11.326 v3 — 매칭 코어(순수 함수)", () => {
  it("matchLabelToOrders export + 미입고 상태 상수", () => {
    const src = read(LIB);
    expect(src).toMatch(/export function matchLabelToOrders/);
    expect(src).toMatch(/PENDING_ORDER_STATUSES = \["ORDERED", "CONFIRMED", "SHIPPING"\]/);
    // DELIVERED/CANCELLED 는 미입고 후보에서 제외
    expect(src).not.toMatch(/PENDING_ORDER_STATUSES = \[[^\]]*DELIVERED/);
  });
});

describe("§11.326 v3 — 후보 조회 route(읽기 전용, overfetch 가드)", () => {
  it("GET + matchLabelToOrders 위임 + status in PENDING + take 상한", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/matchLabelToOrders\(normalized/);
    expect(src).toMatch(/status: \{ in: \[\.\.\.PENDING_ORDER_STATUSES\] \}/);
    expect(src).toMatch(/take: MAX_SCAN/);
  });
  it("발주를 변경하는 쓰기 메서드 없음(read-only)", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/export async function (POST|PATCH|DELETE|PUT)/);
  });
});

describe("§11.326 v3 — review step 매핑 UI wiring", () => {
  it("후보 state + 핸들러 + review 진입 시 조회", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const \[poCandidates, setPoCandidates\] = useState/);
    expect(src).toMatch(/const \[selectedOrderId, setSelectedOrderId\]/);
    expect(src).toMatch(/const fetchPoCandidates = async/);
    expect(src).toMatch(/const handleSelectCandidate = \(c: PoCandidate\)/);
    expect(src).toMatch(/void fetchPoCandidates\(_initForm\.catalogNumber/);
  });

  it("매칭 카드 + 후보/미매칭 선택 testid(dead button 아님)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/data-testid="srm-po-candidates"/);
    expect(src).toMatch(/data-testid="srm-po-candidate-item"/);
    expect(src).toMatch(/data-testid="srm-po-candidate-none"/);
    expect(src).toMatch(/onClick=\{\(\) => handleSelectCandidate\(c\)\}/);
  });

  it("발주 선택 입고 = orders/[id] PATCH DELIVERED(ocrJobId 불요)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/if \(selectedOrderId\) \{/);
    expect(src).toMatch(/`\/api\/orders\/\$\{selectedOrderId\}`/);
    expect(src).toMatch(/status: "DELIVERED"/);
  });
});

describe("§11.326 v3 회귀 0 — 기존 동선 보존", () => {
  it("미매칭 시 smart-receiving 신규등록 fallback 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/"\/api\/inventory\/smart-receiving"/);
  });
  it("§11.326 데이터모델(packSize vs receivedQuantity) 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/quantity:\s*form\.receivedQuantity/);
    expect(src).toMatch(/packSize:\s*form\.packSize/);
    expect(src).not.toMatch(/quantity:\s*form\.packSize/);
  });
});
