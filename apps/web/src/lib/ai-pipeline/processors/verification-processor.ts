/**
 * A-5. VerificationProcessor — 교차 검증 판정
 *
 * Extraction 결과와 Linked Entity의 DB 값을 비교하여
 * auto_verified / review_needed / mismatch / missing 판정.
 *
 * 우선순위: mismatch > missing > review_needed > auto_verified
 */

import { db } from "@/lib/db";
import type {
  VerificationInput,
  VerificationOutput,
  VerificationResult,
  FieldVerificationDetail,
  StageResult,
  IVerificationProcessor,
} from "../types";

/** 금액 허용 오차 (1%) */
const AMOUNT_TOLERANCE = 0.01;
/** 예산 초과 임계치 (원) — 외부 config으로 분리 가능 */
const BUDGET_THRESHOLD = 5_000_000;

export class VerificationProcessor implements IVerificationProcessor {
  readonly stage = "VERIFICATION" as const;

  async process(input: VerificationInput): Promise<StageResult<VerificationOutput>> {
    const start = Date.now();

    try {
      // Entity 데이터 로드
      const entityData = await this.loadEntityData(
        input.linkedEntityType,
        input.linkedEntityId,
        input.organizationId,
      );

      if (!entityData) {
        // Entity를 DB에서 못 찾음 → MISSING
        const result: VerificationResult = {
          status: "MISSING",
          reason: "연결된 Entity를 DB에서 찾을 수 없습니다",
          fieldDetails: [],
          mismatchedFields: [],
          missingFields: ["linked_entity"],
          policyFlags: { approvalRequired: false },
        };
        return {
          success: true,
          stage: this.stage,
          data: { verificationResult: result },
          durationMs: Date.now() - start,
          continueToNext: true,
        };
      }

      const ext = input.extractionResult;
      const details: FieldVerificationDetail[] = [];
      const mismatchedFields: string[] = [];
      const missingFields: string[] = [];

      // 금액 비교
      if (entityData.totalAmount != null) {
        if (ext.totalAmount.value != null) {
          const extracted = ext.totalAmount.value;
          const expected = Number(entityData.totalAmount);
          const diff = Math.abs(extracted - expected) / Math.max(expected, 1);
          const matched = diff <= AMOUNT_TOLERANCE;
          details.push({
            fieldName: "totalAmount",
            extractedValue: extracted,
            expectedValue: expected,
            matched,
            toleranceApplied: diff > 0 && matched,
          });
          if (!matched) mismatchedFields.push("totalAmount");
        } else {
          missingFields.push("totalAmount");
        }
      }

      // 수량 비교 (line items의 첫 번째 항목)
      if (entityData.quantity != null && ext.lineItems.length > 0) {
        const extractedQty = ext.lineItems[0].quantity.value;
        if (extractedQty != null) {
          const matched = extractedQty === entityData.quantity;
          details.push({
            fieldName: "quantity",
            extractedValue: extractedQty,
            expectedValue: entityData.quantity,
            matched,
          });
          if (!matched) mismatchedFields.push("quantity");
        }
      }

      // 벤더명 비교
      if (entityData.vendorName && ext.vendorName.value) {
        const extracted = ext.vendorName.value.toLowerCase().trim();
        const expected = entityData.vendorName.toLowerCase().trim();
        const matched = extracted === expected || extracted.includes(expected) || expected.includes(extracted);
        details.push({
          fieldName: "vendorName",
          extractedValue: ext.vendorName.value,
          expectedValue: entityData.vendorName,
          matched,
        });
        if (!matched) mismatchedFields.push("vendorName");
      }

      // 필수 문서 체크 (INVOICE 유형인데 invoiceNumber 없으면)
      if (input.documentType === "INVOICE" && !ext.invoiceNumber.value) {
        missingFields.push("invoiceNumber");
      }

      // ── 판정: mismatch > missing > review_needed > auto_verified ──
      let status: VerificationResult["status"];
      let reason: string;

      if (mismatchedFields.length > 0) {
        status = "MISMATCH";
        reason = `${mismatchedFields.join(", ")} 필드에서 불일치가 감지되었습니다`;
      } else if (missingFields.length > 0) {
        status = "MISSING";
        reason = `${missingFields.join(", ")} 항목이 누락되었습니다`;
      } else if (ext.overallConfidence < 0.7 || details.some((d) => !d.matched)) {
        status = "REVIEW_NEEDED";
        reason = "추출 신뢰도가 낮거나 일부 필드 확인이 필요합니다";
      } else {
        status = "AUTO_VERIFIED";
        reason = "모든 핵심 필드가 일치합니다";
      }

      // ── Policy Flags ──
      const totalAmount = ext.totalAmount.value ?? 0;
      const budgetExceeded = totalAmount > BUDGET_THRESHOLD;
      const mandatoryDocumentMissing = missingFields.includes("invoiceNumber") || missingFields.includes("linked_entity");
      const approvalRequired = budgetExceeded || (status === "MISMATCH" && input.documentType === "INVOICE");

      const result: VerificationResult = {
        status,
        reason,
        fieldDetails: details,
        mismatchedFields,
        missingFields,
        policyFlags: {
          budgetExceeded: budgetExceeded || undefined,
          amountThreshold: budgetExceeded ? BUDGET_THRESHOLD : undefined,
          mandatoryDocumentMissing: mandatoryDocumentMissing || undefined,
          approvalRequired,
        },
      };

      return {
        success: true,
        stage: this.stage,
        data: { verificationResult: result },
        durationMs: Date.now() - start,
        continueToNext: true,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stage: this.stage,
        data: null,
        error: errMsg,
        durationMs: Date.now() - start,
        continueToNext: false,
      };
    }
  }

  private async loadEntityData(
    entityType: string,
    entityId: string,
    orgId: string,
  ): Promise<EntityDataSnapshot | null> {
    switch (entityType) {
      case "QUOTE": {
        const q = await db.quote.findFirst({
          where: { id: entityId, organizationId: orgId },
          select: {
            vendorName: true,
            totalAmount: true,
            items: { select: { quantity: true, unitPrice: true, productName: true } },
          },
        });
        if (!q) return null;
        return {
          vendorName: q.vendorName,
          totalAmount: q.totalAmount ? Number(q.totalAmount) : null,
          quantity: q.items[0]?.quantity ?? null,
        };
      }
      case "ORDER": {
        const o = await db.order.findFirst({
          where: { id: entityId, organizationId: orgId },
          select: {
            vendorName: true,
            totalAmount: true,
            items: { select: { quantity: true, unitPrice: true, productName: true } },
          },
        });
        if (!o) return null;
        return {
          vendorName: o.vendorName,
          totalAmount: o.totalAmount ? Number(o.totalAmount) : null,
          quantity: o.items[0]?.quantity ?? null,
        };
      }
      case "PURCHASE": {
        const p = await db.purchase.findFirst({
          where: { id: entityId, organizationId: orgId },
          select: {
            vendorName: true,
            totalAmount: true,
            items: { select: { quantity: true, unitPrice: true } },
          },
        });
        if (!p) return null;
        return {
          vendorName: p.vendorName,
          totalAmount: p.totalAmount ? Number(p.totalAmount) : null,
          quantity: p.items[0]?.quantity ?? null,
        };
      }
      default:
        return null;
    }
  }
}

interface EntityDataSnapshot {
  vendorName: string | null;
  totalAmount: number | null;
  quantity: number | null;
}
