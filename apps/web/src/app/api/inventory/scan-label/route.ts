/**
 * POST /api/inventory/scan-label
 *
 * 시약 라벨 이미지/텍스트를 파싱하여 구조화된 데이터를 반환합니다.
 *
 * - imageBase64가 있으면: Gemini 멀티모달로 직접 파싱 (OCR + 구조화 한 번에)
 * - text만 있으면: 정규식 기반 파서로 파싱 (fallback)
 *
 * Request body:
 *   - text?: string (수동 입력된 라벨 텍스트)
 *   - imageBase64?: string (촬영/업로드된 라벨 이미지 data URI)
 *
 * Response:
 *   - parsed: LabelParseResult
 *   - matchedProduct?: { id, name, brand, catalogNumber }
 *   - matchedInventory?: { id, lotNumber, currentQuantity, unit }
 *   - suggestions: { isNewProduct, isNewLot, isExistingLot, action }
 */

// §11.290 Phase 4a — parseWithGemini 직접 호출 → runOcrPipeline wrapper swap
// (호영님 Phase 0 결정 minimum-diff). STORAGE_PROVIDER 미설정 시 graceful
// fallback (audit/cache 미사용, 기존 동작 보존). Phase 5 SDK install 후
// Cloud Vision + Claude Tier 2 자동 활성. parseReagentLabel (regex fallback)
// 은 보존 — Gemini 호출 실패 시 text input 처리 path 유지.
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseReagentLabel } from "@/lib/ocr/label-parser";
import { runOcrPipeline } from "@/lib/ocr/run-ocr-pipeline";
import { parseGs1 } from "@/lib/scan/gs1-parser";
import { mergeGs1WithOcr, type MergedLabelResult } from "@/lib/ocr/merge-gs1-ocr";

export async function POST(req: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // §11.369-1 — targetEntityId 를 요청별 유니크로(이전 'unknown' 하드코딩 시
    //   sensitive_data_import:unknown 단일 키 lock 으로 cross-user/cross-item 409 발생).
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'inventory',
      targetEntityId: crypto.randomUUID(),
      sourceSurface: 'web_app',
      routePath: '/inventory/scan-label',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const { text, imageBase64, gs1Raw } = body as { text?: string; imageBase64?: string; gs1Raw?: string };

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: "텍스트 또는 이미지 데이터가 필요합니다" },
        { status: 400 }
      );
    }

    // ── 파싱 단계 ──
    // 이미지가 있으면 Gemini 멀티모달, 없으면 정규식 fallback
    let parsed;

    // §11.290 Phase 4b — pipelineResult metadata outer scope retain
    // (jobId / providerUsed / cached). LabelScannerModal review step 에서
    // ProviderBadge + CacheHitIndicator 표시 위해 ocrMetadata response 노출.
    let ocrMetadata: {
      jobId: string | null;
      providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
      cached: boolean;
      // §11.382 P4 — Gemini 채택 사유 노출(silent degradation 제거).
      fallbackReason?: "high_confidence" | "tier2_unconfigured" | "tier2_error" | null;
    } | null = null;

    if (imageBase64) {
      try {
        // §11.290 Phase 4a — parseWithGemini 직접 호출 → runOcrPipeline wrapper
        // (호영님 Phase 0 결정 minimum-diff). result shape 호환 유지 (LabelParseResult).
        // Phase 5 SDK install 후 STORAGE_PROVIDER 설정되면 OcrJob/OcrResult audit
        // + cache + multi-provider fallback 자동 활성.
        const pipelineResult = await runOcrPipeline({
          base64: imageBase64,
          type: "LABEL",
          organizationId: session.user.id, // §11.290 Phase 4a tenant 격리 (Phase 5 에서 실제 organizationId 정합)
          userId: session.user.id,
        });
        parsed = pipelineResult.result;
        ocrMetadata = {
          jobId: pipelineResult.jobId,
          providerUsed: pipelineResult.providerUsed,
          cached: pipelineResult.cached,
          fallbackReason: pipelineResult.fallbackReason,
        };
      } catch (geminiErr) {
        console.error("[scan-label] OCR pipeline failed, falling back to regex:", geminiErr);
        // OCR pipeline 실패 시 텍스트가 있으면 정규식 fallback
        if (text) {
          parsed = parseReagentLabel(text);
        } else {
          return NextResponse.json(
            { error: "AI 라벨 분석에 실패했습니다. 텍스트를 직접 입력해주세요." },
            { status: 422 }
          );
        }
      }
    } else {
      parsed = parseReagentLabel(text!);
    }

    // §11.382 — GS1 datamatrix(결정적, checksum) + Gemini OCR source-based 병합.
    //   gs1Raw 있으면 parseGs1(서버 single impl) → mergeGs1WithOcr 로 결정적 필드(lot/exp) 우선.
    //   gs1Raw 없음/비-GS1 → OCR 단독(Gemini fallback 보존, GS1 대체 아님).
    const gs1 = gs1Raw ? parseGs1(gs1Raw) : null;
    const merged: MergedLabelResult = mergeGs1WithOcr(gs1 && gs1.isGs1 ? gs1 : null, parsed);

    // ── DB 매칭 단계: catalogNo로 기존 제품 검색 ──
    let matchedProduct: {
      id: string;
      name: string;
      brand: string | null;
      catalogNumber: string | null;
    } | null = null;

    if (merged.catalogNo) {
      const product = await db.product.findFirst({
        where: {
          catalogNumber: {
            equals: merged.catalogNo,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          brand: true,
          catalogNumber: true,
        },
      });

      if (product) {
        matchedProduct = product;
      }
    }

    // catalogNo로 못 찾으면 CAS Number로 시도
    if (!matchedProduct && merged.casNumber) {
      const product = await db.product.findFirst({
        where: {
          casNumber: {
            equals: merged.casNumber,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          brand: true,
          catalogNumber: true,
        },
      });

      if (product) {
        matchedProduct = product;
      }
    }

    // ── 기존 재고에서도 매칭 시도 ──
    // §11.253b-1 — matchedInventory shape 확장: updatedAt + user.name 추가.
    //   호영님 spec ③ 행위자 표시 + ⑤ 시간 정보 즉시 충족 (신규 model 0,
    //   migration 0). 기존 4 fields (id/lotNumber/currentQuantity/unit) 보존.
    //   §11.253 conflict banner 안 "X분 전" RelativeTimeText + 행위자 inline.
    //   case 1/2 정확 detection 은 §11.253b-2 (InventoryLock) / §11.253b-3
    //   (BroadcastChannel) 별도 cluster.
    let matchedInventory: {
      id: string;
      lotNumber: string | null;
      currentQuantity: number;
      unit: string | null;
      updatedAt: Date;
      user: { name: string | null } | null;
    } | null = null;

    if (matchedProduct && merged.lotNo) {
      const inventory = await db.inventory.findFirst({
        where: {
          productId: matchedProduct.id,
          lotNumber: {
            equals: merged.lotNo,
            mode: "insensitive",
          },
          userId: session.user.id,
        },
        select: {
          id: true,
          lotNumber: true,
          currentQuantity: true,
          unit: true,
          updatedAt: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      if (inventory) {
        matchedInventory = inventory;
      }
    }

    // §11.369-1 — 성공 응답 직전 lock 해제(이전 complete() 부재로 5분 잔존 → 후속 스캔 409).
    enforcement.complete();
    return NextResponse.json({
      success: true,
      parsed: { ...parsed, ...merged }, // §11.382 — GS1 병합 필드 우선 + OCR 메타(confidence/rawText) 보존
      fieldSources: merged.sources,
      fieldConflicts: merged.conflicts,
      gtin: merged.gtin,
      matchedProduct,
      matchedInventory,
      // §11.290 Phase 4b — OCR pipeline metadata (provider / cache hit / jobId).
      // null = regex fallback path (text-only input, image 미사용).
      ocrMetadata,
      suggestions: {
        isNewProduct: !matchedProduct,
        isNewLot: matchedProduct && !matchedInventory,
        isExistingLot: !!matchedInventory,
        action: matchedInventory
          ? "restock"
          : matchedProduct
            ? "new_lot"
            : "new_product",
      },
    });
  } catch (error) {
    // §11.369-1 — 실패 경로 lock 해제(restock/route.ts L195·L202 패턴 동일).
    enforcement?.fail();
    console.error("[scan-label] Error:", error);
    return NextResponse.json(
      { error: "라벨 파싱 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
