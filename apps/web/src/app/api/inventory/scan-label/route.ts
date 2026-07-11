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
import { enforcePlanLimit, PlanLimitError } from "@/lib/billing/enforce-plan-limit";
import { parseReagentLabel } from "@/lib/ocr/label-parser";
import { runOcrPipeline } from "@/lib/ocr/run-ocr-pipeline";
import { isTransientGeminiError } from "@/lib/ocr/gemini-config";
import { parseGs1 } from "@/lib/scan/gs1-parser";
import { mergeGs1WithOcr, type MergedLabelResult } from "@/lib/ocr/merge-gs1-ocr";
// §scan-cas-match-restore — casNo 컬럼(P1) 복원. CAS 정규화(매칭 키).
import { normalizeCas } from "@/lib/safety/cas-ghs-table";
// §scan-reverse-match-v2 (호영님 2026-06-30) — catalogNo 미매칭 시 양방향·토큰·신뢰도 역매칭(승인형).
//   §scan-secondary-match(matchProduct 단방향) 보정: 양방향 정규화 contains + 토큰(≥2 가드) + per-candidate 신뢰도·정렬·cap3.
import { rankReverseCandidates, type ScoredCandidate, type ReverseMatcherDb } from "@/lib/inventory/reverse-match";

export async function POST(req: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // §pricing-enforce-p2 — Free 라벨 스캔 월 한도(10회) enforce. OCR 비용 발생 前 차단.
    //   grandfather/유료(null)/env미설정은 통과. 초과 시 429 + 한도·사용량·업그레이드 안내.
    try {
      await enforcePlanLimit(session.user.id, "labelScan");
    } catch (e) {
      if (e instanceof PlanLimitError) {
        return NextResponse.json(
          { error: e.message, code: e.code, limit: e.limit, used: e.used },
          { status: 429 },
        );
      }
      throw e;
    }
    // §11.369-1 — targetEntityId 를 요청별 유니크로(이전 'unknown' 하드코딩 시
    //   sensitive_data_import:unknown 단일 키 lock 으로 cross-user/cross-item 409 발생).
    // §scan-role-scope (호영님 2026-06-16) — 단건 라벨 스캔은 수동 등록(inventory_create)의
    //   빠른 입력 방식일 뿐(결과=재고 1건). 입력 방식(스캔/수동)으로 권한이 갈리는 불일치 제거:
    //   sensitive_data_import(buyer/ops_admin) → inventory_create(requester 허용). 단건이라
    //   대량 오염 위험 0 + OCR 신뢰도 게이트(§375/378)·datamatrix verified·확인단계가 품질 보장.
    //   ⚠️ 대량 유입(BulkImport)은 sensitive_data_import 유지(엄격) — 본 변경은 단건 scan-label 한정.
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'inventory_create',
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
          // §scan-stability — 정직성: backoff 재시도(gemini-config) 후에도 실패한 게
          //   일시적(429/timeout/5xx)이면 "실패" 단정 금지 → 재시도 안내. 영구 오류만 "실패".
          const transient = isTransientGeminiError(geminiErr);
          return NextResponse.json(
            {
              error: transient
                ? "일시적 오류로 분석이 지연되고 있습니다. 잠시 후 다시 시도하거나, 텍스트를 직접 입력해주세요."
                : "AI 라벨 분석에 실패했습니다. 텍스트를 직접 입력해주세요.",
              transient,
            },
            { status: transient ? 503 : 422 }
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

    // §label-scan-extraction 1단계 — 실패 분해 진단(운영 로그 grep "[OCR-DIAG]"). 배포 후 골든 3종 실행으로 A/B/C/D 단계 확정. 동작 변경 0(로그만).
    console.info("[OCR-DIAG] scan-label", JSON.stringify({
      providerUsed: ocrMetadata?.providerUsed ?? null,
      fallbackReason: ocrMetadata?.fallbackReason ?? null,
      cached: ocrMetadata?.cached ?? null,
      geminiMatchedFields: (parsed as { matchedFields?: number }).matchedFields ?? null,
      geminiConfidence: (parsed as { confidence?: string }).confidence ?? null,
      gs1Present: !!(gs1 && gs1.isGs1),
      mergedSources: merged.sources,
      fieldsPresent: {
        productName: !!merged.productName, catalogNo: !!merged.catalogNo,
        lotNo: !!merged.lotNo, expirationDate: !!merged.expirationDate,
        brand: !!merged.brand, casNumber: !!merged.casNumber, quantity: !!merged.quantity,
      },
    }));

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

    // §scan-cas-match-restore (호영님 2026-07-04) — CAS 매칭 복원(casNo 컬럼 P1 이후).
    //   과거 §scan-casnumber-500-fix(2026-06-30)는 casNumber 컬럼 부재로 500 회피차 제거했으나,
    //   casNo 컬럼 추가로 복원. 단 CAS = 물질 식별자(SKU 아님) → **auto-match 금지**,
    //   아래 후보(candidate) 블록에서 동일 CAS 제품을 승인형 후보로만 제시(오매칭 방지).

    // ── §scan-reverse-match-v2 — catalogNo 미매칭 시 양방향·토큰·신뢰도 역매칭(승인형) ──
    //   곡면 라벨(원형 병) 등 catalogNo OCR 실패 시, 이름으로 기존 품목 후보를 신뢰도순으로 제시.
    //   자동확정 금지: matchedProduct 는 역매칭으로 세팅하지 않음(canonical 무접촉, 오매칭 방지).
    //   사용자가 후보 선택 → 폼 채움 → 입고 완료 시 기존 find-or-create(name+catalog)로 연결.
    let productCandidates: ScoredCandidate[] = [];
    let matchType: "fuzzy_name" | null = null;
    if (!matchedProduct) {
      // 양방향 정규화 contains + 토큰(≥2 가드) + per-candidate 신뢰도. brand 보조 only.
      const nameCands = (merged.productName || merged.brand)
        ? await rankReverseCandidates(
            { productName: merged.productName, brand: merged.brand },
            { db: db as unknown as ReverseMatcherDb },
          )
        : [];
      // §scan-cas-match-restore (호영님 2026-07-04) — casNo 컬럼 복원 후 CAS 매칭 복구.
      //   ⚠ CAS = 물질 식별자(같은 CAS·다른 brand/grade/pack = 다른 SKU) → **auto-match 금지**.
      //   동일 CAS 제품을 후보로만 제시(승인형, 오매칭 방지·canonical 무접촉·중복 마스터 방지).
      const normCas = normalizeCas(merged.casNumber);
      let casCands: ScoredCandidate[] = [];
      if (normCas) {
        const rows = await db.product.findMany({
          where: { casNo: normCas },
          select: { id: true, name: true, brand: true, catalogNumber: true },
          take: 3,
        });
        casCands = (rows as Array<{ id: string; name: string; brand: string | null; catalogNumber: string | null }>).map((p) => ({
          id: p.id, name: p.name, brand: p.brand, catalogNumber: p.catalogNumber,
          confidence: 0.9, level: "high" as const, basis: "cas" as const,
        }));
      }
      // 병합: CAS(동일물질) 우선 dedup → 신뢰도 정렬 → cap3.
      const byId = new Map<string, ScoredCandidate>();
      for (const c of [...casCands, ...nameCands]) if (!byId.has(c.id)) byId.set(c.id, c);
      productCandidates = [...byId.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
      if (productCandidates.length > 0) matchType = "fuzzy_name";
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

    // §pricing-enforce-p2 — 성공 스캔 1건 카운트(실패/일시오류 경로는 미카운트 — 정직). enforce SoT.
    await db.labelScanEvent.create({ data: { userId: session.user.id } });
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
      // §scan-secondary-match — fuzzy 후보(승인형, 자동확정 X). catalogNo 매칭 시/후보 0 → 빈 배열·null.
      matchType,
      productCandidates,
      // §11.290 Phase 4b — OCR pipeline metadata (provider / cache hit / jobId).
      // null = regex fallback path (text-only input, image 미사용).
      ocrMetadata,
      suggestions: {
        isNewProduct: !matchedProduct,
        isNewLot: matchedProduct && !matchedInventory,
        isExistingLot: !!matchedInventory,
        // §scan-cat-guard (호영님 2026-07-03) — Cat.No.(품목 유일 식별키) 미추출 시 신규 단정 금지.
        //   Cat 없이 신규 등록하면 실제 DB 존재 품목을 신규로 오판 → 중복 등록·GMP Lot 추적 붕괴.
        //   catalogMissing=true → 소비 UI가 신규 확정 보류(Cat 입력/기존 선택/override 전까지).
        catalogMissing: !merged.catalogNo,
        action: matchedInventory
          ? "restock"
          : matchedProduct
            ? "new_lot"
            : merged.catalogNo
              ? "new_product"
              : "identify_required",
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
