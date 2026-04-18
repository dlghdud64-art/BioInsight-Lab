/**
 * A-4. EntityLinkingProcessor — DB Entity 매칭
 *
 * exact_number → vendor+amount → catalog_code 순서 전략.
 * org scope hard block 유지.
 */

import { db } from "@/lib/db";
import type {
  EntityLinkingInput,
  EntityLinkingOutput,
  EntityLinkCandidate,
  EntityLinkingResult,
  StageResult,
  IEntityLinkingProcessor,
  ExtractionResult,
} from "../types";

export class EntityLinkingProcessor implements IEntityLinkingProcessor {
  readonly stage = "ENTITY_LINKING" as const;

  async process(input: EntityLinkingInput): Promise<StageResult<EntityLinkingOutput>> {
    const start = Date.now();

    try {
      // UNKNOWN 문서는 Entity Linking 건너뜀
      if (input.documentType === "UNKNOWN") {
        return {
          success: true,
          stage: this.stage,
          data: {
            linkingResult: {
              bestMatch: null,
              alternatives: [],
              strategiesUsed: ["skipped_unknown"],
            },
          },
          durationMs: Date.now() - start,
          continueToNext: false, // UNKNOWN → 파이프라인 조기 종료
        };
      }

      const candidates: EntityLinkCandidate[] = [];
      const strategiesUsed: string[] = [];
      const ext = input.extractionResult;
      const orgId = input.organizationId;

      // Strategy 1: Exact number match
      const exactCandidate = await this.matchByExactNumber(ext, orgId, input.documentType);
      if (exactCandidate) {
        candidates.push(exactCandidate);
        strategiesUsed.push("exact_number");
      }

      // Strategy 2: Vendor name + amount match
      if (candidates.length === 0 || candidates[0].confidence < 0.9) {
        const vendorCandidates = await this.matchByVendorAmount(ext, orgId, input.documentType);
        candidates.push(...vendorCandidates);
        if (vendorCandidates.length > 0) strategiesUsed.push("fuzzy_vendor+amount");
      }

      // Strategy 3: Catalog code match (for inventory)
      if (candidates.length === 0) {
        const catalogCandidates = await this.matchByCatalogCode(ext, orgId);
        candidates.push(...catalogCandidates);
        if (catalogCandidates.length > 0) strategiesUsed.push("catalog_code");
      }

      // Org scope hard block: 모든 후보에서 org 검증
      const validCandidates = candidates.filter((c) => c.orgScopeValid);
      const blockedCount = candidates.length - validCandidates.length;
      if (blockedCount > 0) {
        strategiesUsed.push(`org_scope_blocked:${blockedCount}`);
      }

      // 최고 신뢰도 선택
      validCandidates.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = validCandidates[0] || null;

      // 애매한 연결 확정 금지: confidence < 0.5 → bestMatch null
      const confirmedBest = bestMatch && bestMatch.confidence >= 0.5 ? bestMatch : null;
      const alternatives = validCandidates.slice(1, 4);

      const result: EntityLinkingResult = {
        bestMatch: confirmedBest,
        alternatives,
        strategiesUsed,
      };

      return {
        success: true,
        stage: this.stage,
        data: { linkingResult: result },
        durationMs: Date.now() - start,
        continueToNext: confirmedBest !== null,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stage: this.stage,
        data: {
          linkingResult: { bestMatch: null, alternatives: [], strategiesUsed: ["error"] },
        },
        error: errMsg,
        durationMs: Date.now() - start,
        continueToNext: false,
      };
    }
  }

  private async matchByExactNumber(
    ext: ExtractionResult,
    orgId: string,
    docType: string,
  ): Promise<EntityLinkCandidate | null> {
    // Quote number → Quote entity
    if (ext.quoteNumber.value && ext.quoteNumber.confidence >= 0.7) {
      const quote = await db.quote.findFirst({
        where: {
          organizationId: orgId,
          OR: [
            { id: { contains: ext.quoteNumber.value } },
          ],
        },
        select: { id: true, organizationId: true },
      });
      if (quote) {
        return {
          entityType: "QUOTE",
          entityId: quote.id,
          confidence: 0.95,
          matchedOn: ["quoteNumber"],
          orgScopeValid: quote.organizationId === orgId,
        };
      }
    }

    // Order number → Order entity
    if (ext.orderNumber.value && ext.orderNumber.confidence >= 0.7) {
      const order = await db.order.findFirst({
        where: {
          organizationId: orgId,
          OR: [
            { id: { contains: ext.orderNumber.value } },
            { orderNumber: ext.orderNumber.value },
          ],
        },
        select: { id: true, organizationId: true },
      });
      if (order) {
        return {
          entityType: "ORDER",
          entityId: order.id,
          confidence: 0.95,
          matchedOn: ["orderNumber"],
          orgScopeValid: order.organizationId === orgId,
        };
      }
    }

    // Invoice number → Purchase entity
    if (ext.invoiceNumber.value && ext.invoiceNumber.confidence >= 0.7) {
      const purchase = await db.purchase.findFirst({
        where: {
          organizationId: orgId,
          invoiceNumber: ext.invoiceNumber.value,
        },
        select: { id: true, organizationId: true },
      });
      if (purchase) {
        return {
          entityType: "PURCHASE",
          entityId: purchase.id,
          confidence: 0.93,
          matchedOn: ["invoiceNumber"],
          orgScopeValid: purchase.organizationId === orgId,
        };
      }
    }

    return null;
  }

  private async matchByVendorAmount(
    ext: ExtractionResult,
    orgId: string,
    docType: string,
  ): Promise<EntityLinkCandidate[]> {
    const vendorName = ext.vendorName.value;
    const totalAmount = ext.totalAmount.value;
    if (!vendorName) return [];

    const results: EntityLinkCandidate[] = [];

    // Order matching by vendor name + approximate amount
    const orders = await db.order.findMany({
      where: {
        organizationId: orgId,
        vendorName: { contains: vendorName, mode: "insensitive" },
        ...(totalAmount
          ? {
              totalAmount: {
                gte: totalAmount * 0.95,
                lte: totalAmount * 1.05,
              },
            }
          : {}),
      },
      take: 3,
      orderBy: { createdAt: "desc" },
      select: { id: true, organizationId: true, vendorName: true, totalAmount: true },
    });

    for (const order of orders) {
      const matchedOn = ["vendorName"];
      let conf = 0.6;
      if (totalAmount && order.totalAmount) {
        const diff = Math.abs(Number(order.totalAmount) - totalAmount) / totalAmount;
        if (diff < 0.01) {
          conf = 0.85;
          matchedOn.push("totalAmount");
        } else if (diff < 0.05) {
          conf = 0.7;
          matchedOn.push("totalAmount_approx");
        }
      }
      results.push({
        entityType: "ORDER",
        entityId: order.id,
        confidence: conf,
        matchedOn,
        orgScopeValid: order.organizationId === orgId,
      });
    }

    return results;
  }

  private async matchByCatalogCode(
    ext: ExtractionResult,
    orgId: string,
  ): Promise<EntityLinkCandidate[]> {
    if (ext.lineItems.length === 0) return [];

    const firstItem = ext.lineItems[0];
    const catalogCode = firstItem.itemCode.value;
    if (!catalogCode) return [];

    const products = await db.product.findMany({
      where: {
        organizationId: orgId,
        catalogNumber: { contains: catalogCode, mode: "insensitive" },
      },
      take: 2,
      select: {
        id: true,
        organizationId: true,
        inventories: { take: 1, select: { id: true } },
      },
    });

    return products.map((p: { id: string; organizationId: string }) => ({
      entityType: "PRODUCT" as const,
      entityId: p.id,
      confidence: 0.55,
      matchedOn: ["catalogNumber"],
      orgScopeValid: p.organizationId === orgId,
    }));
  }
}
