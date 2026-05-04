/**
 * §11.209d-notification Phase 1 #approval-email-templates — RED test
 *
 * 3 email template export 검증 + EmailTemplate interface 정합:
 *   - generatePurchaseApprovalRequestEmail (approver 대상)
 *   - generatePurchaseApprovedEmail (requester 대상)
 *   - generatePurchaseRejectedEmail (requester 대상 + 반려 사유)
 *
 * canonical truth: EmailTemplate { subject, html, text } 형식 정합
 * (기존 generateLowStockAlertEmail / generateQuoteResponseEmail 패턴 흡수).
 */

import { describe, it, expect } from "vitest";
import {
  generatePurchaseApprovalRequestEmail,
  generatePurchaseApprovedEmail,
  generatePurchaseRejectedEmail,
} from "@/lib/email/templates";

describe("§11.209d-notification — approval email templates", () => {
  describe("generatePurchaseApprovalRequestEmail (approver)", () => {
    it("EmailTemplate 형식 (subject + html + text) 반환", () => {
      const result = generatePurchaseApprovalRequestEmail({
        approverName: "김관리",
        requesterName: "이실험",
        quoteTitle: "테스트 견적",
        totalAmount: 350000,
        currency: "KRW",
        quoteUrl: "https://labaxis.app/dashboard/quotes/q-1",
      });
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    it("subject 에 '결재 요청' 라벨 + 견적 제목 포함", () => {
      const result = generatePurchaseApprovalRequestEmail({
        approverName: "김관리",
        requesterName: "이실험",
        quoteTitle: "테스트 견적",
        totalAmount: 350000,
        currency: "KRW",
        quoteUrl: "https://labaxis.app/dashboard/quotes/q-1",
      });
      expect(result.subject).toMatch(/결재 요청/);
      expect(result.subject).toMatch(/테스트 견적/);
    });

    it("html / text 에 quoteUrl + 운영자 친화 CTA 포함", () => {
      const result = generatePurchaseApprovalRequestEmail({
        approverName: "김관리",
        requesterName: "이실험",
        quoteTitle: "테스트 견적",
        totalAmount: 350000,
        currency: "KRW",
        quoteUrl: "https://labaxis.app/dashboard/quotes/q-1",
      });
      expect(result.html).toContain("https://labaxis.app/dashboard/quotes/q-1");
      expect(result.text).toContain("https://labaxis.app/dashboard/quotes/q-1");
      // 운영자 친화 CTA — "결재 검토" 또는 "확인" 등
      expect(result.html).toMatch(/결재\s*(검토|확인|진행)/);
    });
  });

  describe("generatePurchaseApprovedEmail (requester)", () => {
    it("subject 에 '결재 승인' + 견적 제목 포함", () => {
      const result = generatePurchaseApprovedEmail({
        requesterName: "이실험",
        approverName: "김관리",
        quoteTitle: "테스트 견적",
        totalAmount: 350000,
        currency: "KRW",
        quoteUrl: "https://labaxis.app/dashboard/quotes/q-1",
      });
      expect(result.subject).toMatch(/결재\s*(승인|완료)/);
      expect(result.subject).toMatch(/테스트 견적/);
    });

    it("html 에 approver 이름 + 발주 진행 안내 포함", () => {
      const result = generatePurchaseApprovedEmail({
        requesterName: "이실험",
        approverName: "김관리",
        quoteTitle: "테스트 견적",
        totalAmount: 350000,
        currency: "KRW",
        quoteUrl: "https://labaxis.app/dashboard/quotes/q-1",
      });
      expect(result.html).toContain("김관리");
      expect(result.html).toMatch(/발주\s*(전환|진행|가능)/);
    });
  });

  describe("generatePurchaseRejectedEmail (requester + reason)", () => {
    it("subject 에 '결재 반려' + 견적 제목 포함", () => {
      const result = generatePurchaseRejectedEmail({
        requesterName: "이실험",
        approverName: "박반려",
        quoteTitle: "테스트 견적",
        totalAmount: 350000,
        currency: "KRW",
        rejectionReason: "예산 초과 — 다음 분기 재요청 권장",
        quoteUrl: "https://labaxis.app/dashboard/quotes/q-1",
      });
      expect(result.subject).toMatch(/결재\s*반려/);
      expect(result.subject).toMatch(/테스트 견적/);
    });

    it("html / text 에 rejectionReason 포함", () => {
      const result = generatePurchaseRejectedEmail({
        requesterName: "이실험",
        approverName: "박반려",
        quoteTitle: "테스트 견적",
        totalAmount: 350000,
        currency: "KRW",
        rejectionReason: "예산 초과 — 다음 분기 재요청 권장",
        quoteUrl: "https://labaxis.app/dashboard/quotes/q-1",
      });
      expect(result.html).toContain("예산 초과 — 다음 분기 재요청 권장");
      expect(result.text).toContain("예산 초과 — 다음 분기 재요청 권장");
    });

    it("html 에 재요청 또는 대안 검토 안내 포함", () => {
      const result = generatePurchaseRejectedEmail({
        requesterName: "이실험",
        approverName: "박반려",
        quoteTitle: "테스트 견적",
        totalAmount: 350000,
        currency: "KRW",
        rejectionReason: "예산 초과",
        quoteUrl: "https://labaxis.app/dashboard/quotes/q-1",
      });
      expect(result.html).toMatch(/재요청|대안\s*검토|수정\s*후/);
    });
  });
});
