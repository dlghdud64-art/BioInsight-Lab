"use client";

/**
 * §11.310 #reorder-review-sheet — 재발주안 검토 바텀시트.
 *
 * 호영님 P1 spec (2026-05-26):
 *   재고 운영 도우미 (inventory-ai-assistant-panel) 하단 CTA "재발주안 검토하기"
 *   탭 → 본 시트 노출. 품목 / 권장 수량 / 보관 위치 / 추천 벤더 / 최근 구매 /
 *   예상 금액 요약 + [견적 요청] / [바로 발주] 분기.
 *
 * 호영님 결정 (Q30/Q31/Q32):
 *   - Q30 = A: 견적 pre-fill = query string (DB write 0)
 *   - Q31 = A: PO pre-fill = query string + 클라이언트 draft auto-create
 *   - Q32 = A: 추천 벤더 = PurchaseRecord 집계 (caller 가 props 로 주입)
 *
 * §inventory-mobile-reorder-gate P2/P3/P4 (시안 ①, 호영님 2026-07-28):
 *   - 권장 수량 스테퍼(± 34px) + 근거 캡션(canonical recommendationBreakdown)
 *   - qtySource 배지: AI 권장 pill / "AI 추천 미산출 · 안전재고 기준 수량"(가짜 AI 라벨 금지)
 *   - 상태 표기: ● 안전재고 미달(rose 도트, 실값 조건 시에만)
 *   - overrideReasons(소프트 게이트 진행): 시트 표기 + 견적 초안 reason 전파(결정 기록)
 *   - 예상 금액·CTA 수량 = 스테퍼 qty (§11.310 estimatedAmount 정의 supersede)
 *   - CTA 재구성: 견적 요청 초안 만들기(primary) / 바로 발주(green, flag 게이팅 유지) /
 *     공급사 소싱에서 먼저 찾기(outline, 기존 onSearchVendors 재사용)
 *   - overlay "!top-14" — scrim이 fixed 헤더를 덮지 않음
 *
 * 색상:
 *   - primary "바로 발주" = bg-green-600 (실행 가능 액션, §11.302 정합)
 *   - amber/orange 0 (§11.310 scope 정합)
 *
 * dead button 0 — 추천 벤더 0건 시 "바로 발주" disabled + "견적 요청" only.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Building2, History, DollarSign, FileText, ShoppingCart, Search, Minus, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
// §reorder-quote-handoff CSRF 교정 — raw fetch 는 x-labaxis-csrf-token 미부착으로
// POST /api/quotes 403("보안 검증이 완료되지 않아…"). §support-csrf-fix 패턴 승계.
import { csrfFetch } from "@/lib/api-client";
// §inventory-reorder-surface-unify P3b — 바로 발주(PO)는 ENABLE_PURCHASING off 시 정직 disabled+사유(§purchasing-hide 일관).
import { getFlag } from "@/lib/feature-flags";

/** 추천 벤더 (PurchaseRecord 집계, 최근 3개월 해당 품목). */
export interface VendorSuggestion {
  vendorName: string;
  unitPrice: number;
  lastPurchasedAt?: string | null; // ISO date — 최근 구매처 표시
}

/** 최근 구매 이력 (PurchaseRecord). */
export interface PurchaseHistoryEntry {
  poNumber: string;
  purchasedAt: string; // ISO date
  quantity: number;
  unitPrice: number;
}

/** 재발주안 요약 입력 (panel → sheet 전달). */
export interface ReorderReviewInput {
  productId: string | null;        // 기존 ProductInventory.productId (신규 시 null)
  productName: string;
  recommendedQty: number;
  unit?: string;
  storageLocation?: string | null; // "Lab-A · Cold-4C" 형태
  vendors: VendorSuggestion[];     // 최대 2~3개
  recentPurchases: PurchaseHistoryEntry[]; // 최대 3개
}

interface ReorderReviewSheetProps {
  open: boolean;
  onClose: () => void;
  data: ReorderReviewInput | null;
  /** §inventory-mobile-reorder-gate P2 — 수량 출처. "ai"=canonical 추천, "safety-fallback"=안전재고 기준. */
  qtySource?: "ai" | "safety-fallback";
  /** §inventory-mobile-reorder-gate P2 — 상태 표기·부족 요약용 실값(없으면 미표시, 가짜 금지). */
  currentQuantity?: number | null;
  safetyStock?: number | null;
  /** §inventory-mobile-reorder-gate P2 — canonical recommendationBreakdown(스테퍼 근거 캡션). */
  breakdown?: { safetyGap: number; leadTimeConsumption: number; rawQuantity: number; minOrderQty: number } | null;
  /** §inventory-mobile-reorder-gate P3 — 소프트 게이트 진행(override) 사유. 표기 + 견적 reason 전파. */
  overrideReasons?: string[] | null;
  /** §inventory-reorder-surface-unify P4 — 공급사 소싱 검색 진입(/app/search?q=). caller(content)가 주입.
   *  §11.381c canonical 재배선(inventory 소싱 진입점 유지) — AiAssistant retire로 잃은 onViewVendors 대체. */
  onSearchVendors?: () => void;
}

export function ReorderReviewSheet({
  open,
  onClose,
  data,
  qtySource = "ai",
  currentQuantity = null,
  safetyStock = null,
  breakdown = null,
  overrideReasons = null,
  onSearchVendors,
}: ReorderReviewSheetProps) {
  const router = useRouter();

  // §inventory-mobile-reorder-gate P2 — 권장 수량 스테퍼 상태(초기값 = 주입 수량, 오픈/추천 갱신 시 동기화).
  const baseQty = data?.recommendedQty ?? 0;
  const [qty, setQty] = useState<number>(baseQty);
  useEffect(() => {
    setQty(baseQty);
  }, [baseQty, open]);
  // §reorder-quote-handoff P2 — 생성 배선 상태. ⚠️ 반드시 early return(!data) 위:
  // 아래 배치 시 data null→값 전환에서 훅 수 변화 → React #310 크래시
  // (2026-08-05 prod Chrome 검증에서 실측된 사고 — 원복 금지).
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (!data) return null;

  // 예상 금액 = 검토 수량(스테퍼) × 최근 단가 (최우선 vendor) — §inventory-mobile-reorder-gate 정의
  const primaryVendor = data.vendors[0];
  const estimatedAmount = primaryVendor ? qty * primaryVendor.unitPrice : 0;
  const hasVendor = data.vendors.length > 0;
  // §inventory-reorder-surface-unify P3b — 발주(PO) 라이브 표면 게이팅. off면 바로 발주 disabled+사유, 견적 요청은 live.
  const purchasingOn = getFlag("ENABLE_PURCHASING");

  const shortage =
    safetyStock != null && currentQuantity != null
      ? Math.max(0, safetyStock - currentQuantity)
      : null;
  const belowSafety =
    safetyStock != null && currentQuantity != null && currentQuantity <= safetyStock;

  // §inventory-mobile-reorder-gate P3 — override 사유(중복 위험 확인 후 진행)를 견적 초안 reason에 전파.
  const overrideNote =
    overrideReasons && overrideReasons.length > 0
      ? ` [중복 위험 확인 후 진행: ${overrideReasons.join(" / ")}]`
      : "";

  /**
   * §reorder-quote-handoff P2 (호영님 지시문 2026-08-05) — 견적 요청 = 초안 실제
   * 생성(POST /api/quotes) 후 발송 준비 패널(?prepare={id}) 직행.
   *
   * 구 §11.310 Q30 "query-string prefill, DB write 0" 설계 폐기 — Phase 0 실측:
   * quotes 표면에 prefill 소비자 0 → 초안 미생성 no-op 핸드오프였음
   * (PLAN_reorder-quote-handoff §12 측정1). 실패 시 이동 0 + 에러 표기
   * (placeholder success 금지). 상태 훅은 early return 위에 선언(#310 가드).
   */
  const handleRequestQuote = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    const reason =
      qtySource === "safety-fallback"
        ? "안전재고 기준 수량 (AI 추천 미산출)" + overrideNote
        : "안전 재고 미달 · 재고 운영 도우미 권장" + overrideNote;
    try {
      const res = await csrfFetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${data.productName} 재발주 견적`,
          items: [
            {
              productId: data.productId, // nullable 허용 (quote-create-schema 실측)
              quantity: qty,
              notes: reason,
            },
          ],
          // 출처 메타 — 도착 화면·카드의 "재고관리 재발주안에서 생성" 근거
          specialNotes: `재고관리 재발주안에서 생성 · ${reason}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setCreateError(body?.message ?? body?.error ?? "초안 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return; // 이동 0 — 실패를 성공처럼 보이게 하지 않는다
      }
      const body = await res.json();
      const quoteId: string | undefined = body?.quote?.id;
      if (!quoteId) {
        setCreateError("초안은 생성됐으나 이동 정보를 받지 못했습니다. 견적 관리에서 확인해주세요.");
        return;
      }
      // 발송 준비 패널 직행 (리스트 경유 없음 — 지시문 1c)
      router.push(`/dashboard/quotes?prepare=${encodeURIComponent(quoteId)}`);
      onClose();
    } catch {
      setCreateError("네트워크 오류로 초안을 생성하지 못했습니다.");
    } finally {
      setCreating(false);
    }
  };

  /** §11.310 Q31 — 바로 발주 = query string + PO 화면 진입 시 draft auto-create */
  const handleDirectPurchase = () => {
    if (!hasVendor || !purchasingOn) return;
    const params = new URLSearchParams({
      productName: data.productName,
      quantity: String(qty),
      supplier: primaryVendor.vendorName,
      unitPrice: String(primaryVendor.unitPrice),
      prefill: "reorder-recommendation",
    });
    router.push(`/dashboard/purchase-orders/new?${params.toString()}`);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto"
        overlayClassName="!top-14"
        data-testid="reorder-review-sheet"
      >
        <SheetHeader className="text-left">
          {/* §inventory-mobile-reorder-gate P2 — 수량 출처 pill + 상태(실값 조건 시에만). */}
          <div className="flex items-center gap-2 flex-wrap">
            {qtySource === "ai" ? (
              <span
                data-testid="reorder-review-qty-source-ai"
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-bold text-blue-700"
              >
                <Sparkles className="h-3 w-3" />
                AI 권장
              </span>
            ) : (
              <span
                data-testid="reorder-review-qty-source-fallback"
                className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600"
              >
                AI 추천 미산출 · 안전재고 기준 수량
              </span>
            )}
            {belowSafety && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                <span className="h-[7px] w-[7px] rounded-full bg-rose-500" aria-hidden />
                안전재고 미달
              </span>
            )}
          </div>
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            재발주안 요약
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            재고 운영 도우미 권장안 검토 후 견적 요청 또는 바로 발주를 선택하세요.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* ── 품목 요약 ── */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  품목
                </p>
                <p className="text-sm font-bold text-slate-900 break-keep">
                  {data.productName}
                </p>
                {/* 현재/부족 요약 — 실값 있을 때만 */}
                {shortage != null && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    현재 {currentQuantity}
                    {data.unit ?? "ea"} · 부족 <b className="font-bold text-rose-700">{shortage}</b>
                    {data.unit ?? "ea"}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  권장 발주 수량
                </p>
                {/* §inventory-mobile-reorder-gate P2 — 스테퍼(± 34px) + 근거 캡션 */}
                <div className="flex items-center gap-2 mt-1" data-testid="reorder-review-qty-stepper">
                  <button
                    type="button"
                    aria-label="수량 줄이기"
                    disabled={qty <= 1}
                    onClick={() => setQty((v) => Math.max(1, v - 1))}
                    className="flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40"
                    style={{ width: 34, height: 34 }}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <p className="text-base font-bold text-emerald-700 tabular-nums min-w-[3.5rem] text-center">
                    {qty}
                    <span className="text-xs font-medium text-slate-400 ml-0.5">
                      {data.unit ?? "ea"}
                    </span>
                  </p>
                  <button
                    type="button"
                    aria-label="수량 늘리기"
                    onClick={() => setQty((v) => v + 1)}
                    className="flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700"
                    style={{ width: 34, height: 34 }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {breakdown && (
                  <p className="text-[11px] text-slate-500 mt-1" data-testid="reorder-review-qty-breakdown">
                    부족 {breakdown.safetyGap} + 리드타임 소비 {breakdown.leadTimeConsumption}
                    {breakdown.minOrderQty > 1 ? ` · 최소주문 ${breakdown.minOrderQty} 반영` : ""}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  보관 위치
                </p>
                {/* 운영상 의미 있는 공백은 대시가 아니라 "미지정" 으로 정직 표기한다.
                    🛑 `??` 가 아니라 `||` 다. 호출부(inventory-content L4272)가
                       `location ?? undefined` 로 넘겨 **빈 문자열이 그대로 통과**하므로
                       `??` 로는 라벨만 있고 값이 빈 줄이 된다(null 은 대시, "" 는 빈칸). */}
                <p className={`text-sm font-medium truncate ${data.storageLocation ? "text-slate-900" : "text-slate-500"}`}>
                  {data.storageLocation || "미지정"}
                </p>
              </div>
            </div>
          </div>

          {/* §inventory-mobile-reorder-gate P3 — 소프트 게이트 진행(override) 사유 표기.
              중복 발주를 알고 결정했음을 시트에 남기고, 견적 초안 reason에도 전파된다. */}
          {overrideReasons && overrideReasons.length > 0 && (
            <div
              data-testid="reorder-review-override-note"
              className="rounded-lg p-3 space-y-1"
              style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}
            >
              <p className="text-[11px] font-bold" style={{ color: "#92400e" }}>
                중복 위험 확인 후 진행
              </p>
              {overrideReasons.map((r, i) => (
                <p key={i} className="text-xs text-slate-700 leading-relaxed">{r}</p>
              ))}
            </div>
          )}

          {/* ── 추천 벤더 ── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <p className="text-xs font-bold text-slate-700">최근 구매 공급사</p>
            </div>
            {data.vendors.length === 0 ? (
              /* §reorder-quote-handoff 1b — 다음 화면 예고형 안내 (지시문 색: #fffbeb/#fde68a/#92400e) */
              <div
                data-testid="reorder-review-no-vendor"
                className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3"
              >
                <p className="text-xs font-semibold text-[#92400e] leading-relaxed">
                  이 품목에 등록된 공급사가 없습니다
                </p>
                <p className="mt-0.5 text-xs text-[#92400e]/80 leading-relaxed">
                  초안을 만든 뒤 바로 공급사 지정 화면으로 이동합니다.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {data.vendors.slice(0, 3).map((v, idx) => (
                  <div
                    key={`${v.vendorName}-${idx}`}
                    data-testid="reorder-review-vendor-row"
                    className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                        {idx + 1}.
                      </span>
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {v.vendorName}
                      </span>
                      {idx === 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                          최근 구매
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums flex-shrink-0">
                      ₩{v.unitPrice.toLocaleString("ko-KR")}/{data.unit ?? "ea"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 최근 구매 이력 ── */}
          {data.recentPurchases.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-bold text-slate-700">최근 구매</p>
              </div>
              <div className="space-y-1">
                {data.recentPurchases.slice(0, 3).map((p) => (
                  <div
                    key={p.poNumber}
                    data-testid="reorder-review-purchase-row"
                    className="flex items-center justify-between text-xs text-slate-600"
                  >
                    <span className="font-mono text-[11px] text-slate-500">
                      {p.poNumber}
                    </span>
                    <span className="text-slate-500">
                      {p.purchasedAt.slice(0, 10)}
                    </span>
                    <span className="tabular-nums">
                      {p.quantity}
                      {data.unit ?? "ea"} · ₩{p.unitPrice.toLocaleString("ko-KR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 예상 금액 ── */}
          {hasVendor && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-700" />
                <p className="text-xs font-bold text-emerald-700">예상 금액</p>
              </div>
              <p
                data-testid="reorder-review-estimated-amount"
                className="text-base font-bold text-emerald-700 tabular-nums"
              >
                ₩{estimatedAmount.toLocaleString("ko-KR")}
              </p>
            </div>
          )}

          {/* ── CTA: 견적 요청 초안 / 바로 발주 / 공급사 소싱 ──
              §reorder-quote-handoff 1b — 공급사 0이면 바로 발주 hide(dead button 제거)
              + 주 CTA 라벨 다음 화면 예고형. 배선 실패 시 에러 표기(placeholder success 금지). */}
          {createError && (
            <p data-testid="reorder-review-create-error" className="text-xs font-semibold text-red-600">
              {createError}
            </p>
          )}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              data-testid="reorder-review-request-quote-cta"
              onClick={handleRequestQuote}
              disabled={creating}
              className="flex-1 h-11 min-h-[44px] text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              {creating
                ? "초안 생성 중…"
                : hasVendor
                  ? "견적 요청 초안 만들기"
                  : "초안 만들고 공급사 지정 →"}
            </Button>
            {hasVendor && (
              <Button
                type="button"
                data-testid="reorder-review-direct-purchase-cta"
                onClick={handleDirectPurchase}
                disabled={!purchasingOn}
                className="flex-1 h-11 min-h-[44px] text-sm bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4 mr-1.5" />
                바로 발주
              </Button>
            )}
          </div>
          {!hasVendor && (
            <p data-testid="reorder-review-direct-purchase-hidden-note" className="text-[11px] text-slate-500">
              바로 발주는 공급사·단가 확정 후 가능합니다
            </p>
          )}
          {/* §inventory-mobile-reorder-gate P2 — 공급사 소싱 진입(§11.381c 기존 배선 재사용, outline 승격). */}
          {onSearchVendors && (
            <Button
              type="button"
              variant="outline"
              data-testid="reorder-review-search-vendors"
              onClick={onSearchVendors}
              className="w-full h-11 min-h-[44px] text-sm border-slate-300 text-slate-700"
            >
              <Search className="h-4 w-4 mr-1.5" />
              공급사 소싱에서 먼저 찾기
            </Button>
          )}
          {/* §inventory-reorder-surface-unify P3b — 발주 OFF 정직 사유(dead button 아님, 견적 요청은 live). */}
          {!purchasingOn && (
            <p
              data-testid="reorder-review-purchasing-off"
              className="pt-1 text-[11px] text-slate-500"
            >
              발주 기능은 준비 중입니다. 지금은 견적 요청으로 진행하세요.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
