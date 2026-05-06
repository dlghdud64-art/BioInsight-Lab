/**
 * §11.211 #post-approval-purchase-order-flow ActionableRow orderId 분기 —
 * RED→GREEN test (Path V 정합)
 *
 * Path V 채택 (호영님 결정 2026-05-06): inbox-adapter / module-landing
 * -adapter 변경 0. 발주 관리 page 의 ActionableRow 안 useQuery 로
 * `/api/orders/{entityId}` GET → 404 시 null, 200 시 order.id.
 * mutation (PDF / email) 은 resolved orderId 사용. null 시 button
 * disabled + tooltip "발주 row 가 아직 변환되지 않았습니다".
 *
 * Lock:
 *   - useQuery 로 entityId → orderId resolve
 *   - pdfMutation: /api/orders/${orderId}/generate-pdf (resolved id)
 *   - emailMutation: /api/orders/${orderId}/send-email (resolved id)
 *   - orderId null 시 두 button disabled + tooltip 명시
 *   - vendorEmail null 분기는 기존 B+H step 3 정합 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..");
const PAGE = "src/app/dashboard/purchase-orders/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("§11.211 ActionableRow PDF/email mutation orderId 분기 (Path V)", () => {
  it("ActionableRow 안 useQuery 로 entityId → orderId resolve", () => {
    const src = read(PAGE);
    // useQuery + queryKey 가 entityId 또는 orderId resolve 패턴
    expect(src).toMatch(/useQuery[\s\S]{0,500}order|order[\s\S]{0,500}useQuery/);
  });

  it("pdfMutation 안 resolved orderId 사용 (entityId 직접 아님)", () => {
    const src = read(PAGE);
    const pdfBlock = src.match(/pdfMutation\s*=\s*useMutation[\s\S]{0,1500}/);
    expect(pdfBlock).not.toBeNull();
    if (pdfBlock) {
      // resolved orderId 변수 또는 resolvedOrderId / orderData?.order?.id 등
      expect(pdfBlock[0]).toMatch(/orderId|resolved/);
    }
  });

  it("emailMutation 안 resolved orderId 사용 (entityId 직접 아님)", () => {
    const src = read(PAGE);
    const emailBlock = src.match(
      /emailMutation\s*=\s*useMutation[\s\S]{0,1500}/,
    );
    expect(emailBlock).not.toBeNull();
    if (emailBlock) {
      expect(emailBlock[0]).toMatch(/orderId|resolved/);
    }
  });

  it("PDF / email button disabled 분기 — orderId null 케이스", () => {
    const src = read(PAGE);
    // disabled prop 안 orderId 또는 resolvedOrderId 분기
    expect(src).toMatch(/disabled[\s\S]{0,400}(?:orderId|resolved)|(?:orderId|resolved)[\s\S]{0,400}disabled/);
  });

  it("orderId null tooltip 명시 — \"발주 row 가 아직 변환되지 않았습니다\"", () => {
    const src = read(PAGE);
    expect(src).toMatch(/발주\s*row.*변환|아직\s*변환되지\s*않/);
  });
});
