import { describe, it, expect } from "vitest";
import { matchReceiptToOrders } from "../receipt-match";

/**
 * §scan-recognition-upgrade P2 — 명세서↔발주 근사 매칭 순수함수 계약.
 *
 * 잠그는 계약:
 *   1) 점수축: PO 번호 정규화 일치 +3(존재+불일치 -3 · **없으면 감점 0**) ·
 *      공급사 정규화 일치(법인 접미·공백·대소문자 무시) +2 ·
 *      품목 토큰 Jaccard ≥ 0.5 매칭 비율 ×2 · 수량 ±20% 비율 ×1. 채택 임계 = 3.
 *   2) 후보 0(또는 전원 임계 미달) = { mode: "new" } — 연결 강제 0.
 *   3) 자동 선택 축 없음 — 결과는 정렬된 후보 목록뿐(selected 류 필드 금지).
 */

const PARSED_WITH_PO = {
  vendorName: "(주)바이오코리아",
  orderNumber: "PO-2026-0012",
  items: [{ name: "Trypsin-EDTA 0.25%", quantity: 10 }],
};

const CANDIDATE_A = {
  orderId: "ord-a",
  orderNumber: "PO-2026-0012",
  vendorName: "바이오코리아 주식회사",
  items: [{ name: "Trypsin-EDTA 0.25% 100ml", quantity: 10 }],
};

const CANDIDATE_B = {
  orderId: "ord-b",
  orderNumber: "PO-2026-0044",
  vendorName: "머크 코리아",
  items: [{ name: "DMEM High Glucose", quantity: 4 }],
};

describe("§scan-recognition-upgrade P2 — matchReceiptToOrders", () => {
  it("픽스처 1 — PO 번호 일치: 최상위 후보 + matched 모드", () => {
    const r = matchReceiptToOrders(PARSED_WITH_PO, [CANDIDATE_B, CANDIDATE_A]);
    expect(r.mode).toBe("matched");
    if (r.mode !== "matched") return;
    expect(r.candidates[0].orderId).toBe("ord-a");
    // PO(+3)+공급사(+2)+품목(+2)+수량(+1) = 8
    expect(r.candidates[0].score).toBe(8);
    // B(다른 번호 -3 · 무관 품목) 는 임계 미달로 제외
    expect(r.candidates.some((c) => c.orderId === "ord-b")).toBe(false);
  });

  it("픽스처 2 — 번호 없음 + 근사 일치: 감점 0 으로 채택 (공급사+품목+수량)", () => {
    const parsed = {
      vendorName: "바이오코리아",
      orderNumber: null,
      items: [{ name: "Trypsin EDTA 0.25% 100ml", quantity: 9 }], // ±20% 안
    };
    const r = matchReceiptToOrders(parsed, [CANDIDATE_A]);
    expect(r.mode).toBe("matched");
    if (r.mode !== "matched") return;
    // 번호 부재 = 감점 0 → 공급사(+2)+품목(+2)+수량(+1) = 5 ≥ 임계 3
    expect(r.candidates[0].orderId).toBe("ord-a");
    expect(r.candidates[0].score).toBe(5);
  });

  it("픽스처 3 — 발주 없음(후보 0) = mode new (연결 강제 0)", () => {
    expect(matchReceiptToOrders(PARSED_WITH_PO, [])).toEqual({ mode: "new" });
  });

  it("전원 임계 미달도 mode new — 억지 매칭 금지", () => {
    const r = matchReceiptToOrders(
      { vendorName: "전혀다른상사", orderNumber: null, items: [{ name: "피펫 팁", quantity: 1 }] },
      [CANDIDATE_A, CANDIDATE_B],
    );
    expect(r).toEqual({ mode: "new" });
  });

  it("PO 번호 존재 + 불일치 = 감점 (-3) — 번호가 있으면 대조한다", () => {
    const parsed = { ...PARSED_WITH_PO, orderNumber: "PO-2026-9999" };
    const r = matchReceiptToOrders(parsed, [CANDIDATE_A]);
    // 공급사(+2)+품목(+2)+수량(+1)-번호불일치(3) = 2 < 임계 3 → new
    expect(r).toEqual({ mode: "new" });
  });

  it("자동 선택 축 없음 — 후보 shape 는 orderId·orderNumber·score 뿐", () => {
    const r = matchReceiptToOrders(PARSED_WITH_PO, [CANDIDATE_A]);
    if (r.mode !== "matched") throw new Error("expected matched");
    expect(Object.keys(r).sort()).toEqual(["candidates", "mode"]);
    expect(Object.keys(r.candidates[0]).sort()).toEqual(["orderId", "orderNumber", "score"]);
  });
});
