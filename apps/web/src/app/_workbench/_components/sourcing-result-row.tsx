"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import {
  PenLine, FlaskConical, FileText, ChevronRight, Check,
  AlertTriangle,
} from "lucide-react";

interface SourcingResultRowProps {
  product: any;
  /** §11.337-v3 — 현재 검색어. 매칭 이유 배지("품명 일치"/"Cat.No 일치") 계산용. */
  query?: string;
  isInCompare: boolean;
  isInRequest: boolean;
  isSelected: boolean;
  onToggleCompare: () => void;
  onToggleRequest: () => void;
  onSelect: () => void;
  compareSessionCount?: number;
  /** preview mode — 시각 1단 낮추고 click intercept (실행 금지) */
  isPreview?: boolean;
  triageSections?: SourcingTriageBadge[];
  triageClassification?: SourcingTriageClassification;
  triageActionState?: SourcingTriageActionState;
  onSetTriageAction?: (state: SourcingTriageActionState) => void;
}

// ── 3행: 동적 운영 신호 ──────────────────────────────────────────────────

type ChipColor = "green" | "amber" | "blue" | "neutral";
type SourcingTriageTone = "blue" | "violet" | "emerald" | "red";
type SourcingTriageActionState = "shortlist" | "hold" | "exclude";

interface OpSignal {
  label: string;
  color: ChipColor;
}

interface SourcingTriageBadge {
  key: string;
  label: string;
  count: number;
  tone: SourcingTriageTone;
}

interface SourcingTriageClassification {
  key: string;
  label: string;
  reason: string;
  tone: SourcingTriageTone;
}

/**
 * Compact operational chip 색상 맵
 * green  = 진행 가능 / 유리
 * amber  = 확인 필요 / 위험
 * blue   = 다음 행동 추천
 * neutral = 상태 정보
 */
const CHIP_STYLES: Record<ChipColor, string> = {
  green: "text-emerald-700 bg-emerald-50 border-emerald-200",
  amber: "text-yellow-700 bg-yellow-50 border-yellow-200",
  blue: "text-blue-700 bg-blue-50 border-blue-200",
  neutral: "text-slate-600 bg-slate-50 border-slate-200",
};

const TRIAGE_TONE_STYLES: Record<SourcingTriageTone, string> = {
  blue: "text-blue-700 bg-blue-50 border-blue-200",
  violet: "text-violet-700 bg-violet-50 border-violet-200",
  emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
  red: "text-red-700 bg-red-50 border-red-200",
};

const TRIAGE_ACTION_STYLES: Record<SourcingTriageActionState, string> = {
  shortlist: "border-blue-200 bg-blue-50 text-blue-700",
  hold: "border-yellow-200 bg-yellow-50 text-yellow-700",
  exclude: "border-red-200 bg-red-50 text-red-700",
};

function buildOperatingSignals(product: any, vendor: any, unitPrice: number | null): OpSignal[] {
  // §11.337 Part B — 배지는 "항목 간 차이를 보여줄 때만" 의미. 데이터(납기/가격/재고)가
  //   없어 전 항목이 동일 배지("납기 확인 필요"/"견적 필요"/"요청 전환 권장")가 되는 경우는
  //   정보값 0 + CTA("견적 담기") 중복 → 억제. 실제 신호가 있을 때만 push.
  //   (§11.336-data import 가 price/leadTime 을 null 로 넣어 noise 발생한 케이스 정정.)
  const signals: OpSignal[] = [];
  const lt = vendor?.leadTime;
  const ltSource = vendor?.leadTimeSource; // "supplier" | "historical" | undefined

  // ── 1순위: 납기 — 실제 값 있을 때만 (null = 억제) ──
  if (lt) {
    const str = String(lt).trim().toLowerCase();
    if (str === "즉시" || str === "즉시 출고" || str === "in stock" || str === "0") {
      signals.push({ label: "즉시 출고", color: "green" });
    } else {
      const num = parseInt(str);
      if (!isNaN(num)) {
        if (ltSource === "historical") {
          signals.push({ label: `평균 리드타임 ${num}영업일`, color: "neutral" });
        } else {
          signals.push({ label: `예상 배송기간 ${num}영업일`, color: "neutral" });
        }
      }
      // 파싱 불가한 비정형 lt = 억제(전 항목 동일 noise 방지)
    }
  }

  // ── 2순위: 재고/가격 상태 — 실제 신호 있을 때만 ──
  const hasStock = product.stockStatus === "in_stock" || product.inStock === true;
  const stockAvailable = product.stockStatus === "available" || product.stockAvailable === true;
  const lowStock = product.stockStatus === "low" || product.lowStock === true;

  if (hasStock) {
    signals.push({ label: "재고 확보", color: "green" });
  } else if (stockAvailable) {
    signals.push({ label: "재고 가능", color: "neutral" });
  } else if (lowStock) {
    signals.push({ label: "재고 부족", color: "amber" });
  } else if (unitPrice && unitPrice > 500000) {
    signals.push({ label: "고가 후보", color: "amber" });
  } else if (unitPrice && unitPrice > 100000) {
    signals.push({ label: "예산 검토 필요", color: "amber" });
  }
  // 가격/재고 데이터 0 = 억제("견적 필요" noise 제거, CTA 버튼이 행동 제시)

  // ── 3순위: 행동 방향 — 가격 있을 때 비교 권장/적합만 (요청 전환 권장 noise 제거) ──
  if (unitPrice && unitPrice > 0) {
    const isEquipment = product.category === "EQUIPMENT";
    const ltNum = lt ? parseInt(String(lt)) : NaN;
    const highPrice = unitPrice > 100000;
    if (isEquipment || highPrice || (!isNaN(ltNum) && ltNum > 7 && product.category !== "REAGENT")) {
      signals.push({ label: "비교 권장", color: "blue" });
    } else {
      signals.push({ label: "비교 적합", color: "green" });
    }
  }

  return signals.slice(0, 3);
}

// ── 매칭 이유 배지 (§11.337-v3, 호영님 P1) ───────────────────────────────
//   "왜 이 결과가 떴는가" 를 카드에 명시 → Cat.No/제조사 매칭이 품명과 무관해
//   보여도 사용자가 매칭 근거를 즉시 인지. 우선순위: 품명 > Cat.No > 제조사.
interface MatchReason {
  label: string;
  color: ChipColor;
}

function buildMatchReason(product: any, query?: string): MatchReason | null {
  const q = (query ?? "").trim().toLowerCase();
  // §11.335b — 1글자(미만)는 검색 자체가 안 되므로 배지도 없음.
  if (q.length < 2) return null;
  const name = String(product.name ?? "").toLowerCase();
  const cat = String(product.catalogNumber ?? "").toLowerCase();
  const brand = String(product.brand ?? "").toLowerCase();

  // §11.335b 강도 차등: 품명 시작 > 품명 단어경계/포함 > Cat.No > 제조사.
  //   단어 중간 'p'(Microplate)만 걸리는 약한 매칭은 "품명 시작 일치"로 과표시하지 않음.
  const nameWords = name.split(/[\s\-_/]+/).filter(Boolean);
  const nameStarts = name.startsWith(q);
  const nameWordBoundary = nameWords.slice(1).some((w) => w.startsWith(q));

  if (nameStarts) return { label: "품명 시작 일치", color: "blue" };
  if (nameWordBoundary) return { label: "품명 일치", color: "blue" };
  if (cat.includes(q)) return { label: "Cat.No 일치", color: "neutral" };
  if (name.includes(q)) return { label: "품명 포함", color: "neutral" };
  if (brand.includes(q)) return { label: "제조사 일치", color: "neutral" };
  return null;
}

// ── 2행: 정적 메타 ──────────────────────────────────────────────────────

function buildStaticMeta(product: any, vendor: any): string {
  const parts: string[] = [];
  const brand = product.brand || vendor?.vendor?.name;
  if (brand) parts.push(brand);
  if (product.catalogNumber) parts.push(`Cat. ${product.catalogNumber}`);
  if (product.category) {
    const label = PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES];
    if (label) parts.push(label);
  }
  if (product.specification) {
    parts.push(product.specification.substring(0, 30));
  }
  // §11.344 — 자사 Grade(A~E)는 제품 본연 속성 아님(자사 시약관리 기준) → 소싱 카드 비노출.
  //   데이터(product.grade)는 보존, 표시만 제거.
  return parts.join(" · ");
}

// ── Row 상태 스타일 ─────────────────────────────────────────────────────

function getRowStyle(isSelected: boolean, isInCompare: boolean, isInRequest: boolean): string {
  if (isSelected) {
    return "bg-blue-50 border-blue-200 border-l-2 border-l-blue-500 hover:bg-blue-100";
  }
  if (isInCompare) {
    return "bg-blue-50/50 border-blue-200 hover:bg-blue-100";
  }
  if (isInRequest) {
    return "bg-indigo-50/50 border-indigo-200 hover:bg-indigo-50";
  }
  return "bg-white border-transparent hover:bg-slate-50 hover:shadow-sm";
}

// ── Component ────────────────────────────────────────────────────────────

export function SourcingResultRow({
  product, query, isInCompare, isInRequest, isSelected,
  onToggleCompare, onToggleRequest, onSelect,
  triageSections, triageClassification, triageActionState, onSetTriageAction,
  isPreview = false,
}: SourcingResultRowProps) {
  // §11.203 — imageUrl 없으면 immediate fallback (FlaskConical icon).
  //   기존 `/api/products/${id}/image` fallback 은 endpoint 부재 → 404 spam.
  //   비-canonical search ref (e.g. "p1") 가 console pollution 유발.
  const [imgError, setImgError] = useState(!product.imageUrl);
  const vendor = product.vendors?.[0];
  const unitPrice = vendor?.priceInKRW && vendor.priceInKRW > 0 ? vendor.priceInKRW : null;
  const imageSrc = product.imageUrl ?? "";
  const staticMeta = buildStaticMeta(product, vendor);
  const matchReason = buildMatchReason(product, query);
  const opSignals = buildOperatingSignals(product, vendor, unitPrice);
  const rowStyle = getRowStyle(isSelected, isInCompare, isInRequest);

  // preview mode: saturation/contrast 1단 낮춤
  const previewDim = isPreview ? "opacity-85" : "";

  return (
    <div
      data-testid="sourcing-result-row"
      className={`group relative rounded-lg border transition-all duration-150 cursor-pointer ${rowStyle}`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Thumbnail */}
        <div className="w-12 h-12 shrink-0 rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center mt-0.5">
          {!imgError ? (
            <img src={imageSrc} alt={product.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <FlaskConical className="h-5 w-5 text-slate-500" />
          )}
        </div>

        {/* 3-tier content */}
        <div className="flex-1 min-w-0">
          {/* 1행: 제품명 + 매칭 이유 배지 (§11.337-v3) */}
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-bold text-slate-900 line-clamp-1 leading-tight tracking-tight min-w-0">{product.name}</p>
            {matchReason && (
              <span
                data-testid="sourcing-match-reason"
                className={`shrink-0 inline-flex items-center border rounded-full font-semibold leading-4 ${CHIP_STYLES[matchReason.color]}`}
                style={{ fontSize: "10px", height: "18px", paddingLeft: "7px", paddingRight: "7px" }}
              >
                {matchReason.label}
              </span>
            )}
          </div>

          {/* §11.292 카드 내부 TRIAGE 배지 + Classification + Shortlist/Hold/
              Exclude 제거 (호영님 P1 1단계). 검색이 이미 필터 역할 + 모든
              카드 동일 분류 = 정보가치 0. AI 동등 대체품 분석은 비교 단계
              (2단계 별도 batch). triageSections / triageClassification /
              triageActionState / onSetTriageAction props 는 backward
              compat 유지 (page.tsx 에서 prop 전달 0 → undefined 안전). */}


          {/* 2행: 정적 메타 */}
          {staticMeta && (
            <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-1 leading-tight">{staticMeta}</p>
          )}

          {/* 3행: 동적 운영 신호.
              §11.258a — chip wrapper 잘림 해소. overflow-hidden 제거 +
              flex-wrap 추가하여 3개 이상 시 자연 줄바꿈 (모바일 우측 잘림
              0). 각 chip 의 shrink-0 + h-22px 보존. */}
          {opSignals.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {opSignals.map((sig, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center shrink-0 border rounded-full font-semibold leading-5 ${CHIP_STYLES[sig.color]}`}
                  style={{ fontSize: "12px", height: "22px", paddingLeft: "10px", paddingRight: "10px" }}
                >
                  {sig.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Price column — desktop */}
        <div className="shrink-0 hidden md:flex flex-col items-end gap-0.5 mr-1">
          {unitPrice ? (
            <span className="text-base font-bold tabular-nums text-slate-900 whitespace-nowrap tracking-tight">
              <PriceDisplay price={unitPrice} currency="KRW" />
            </span>
          ) : (
            <span className="text-sm font-semibold text-yellow-600 flex items-center gap-0.5">
              <AlertTriangle className="h-3.5 w-3.5" />견적 필요
            </span>
          )}
          <span className="text-xs text-slate-400">
            {isInRequest ? "견적 후보" : isInCompare ? "비교 후보" : unitPrice ? "VAT 별도" : ""}
          </span>
        </div>

        {/* Desktop CTA — 비교 추가 primary, 견적 담기 secondary */}
        <div className={`shrink-0 hidden sm:flex items-center gap-1.5 ${previewDim}`} onClick={(e) => e.stopPropagation()}>
          {/* Primary: 비교 */}
          {isInCompare ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-semibold inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 cursor-default"
              onClick={() => { onToggleCompare(); toast.info("비교 후보에서 제거되었습니다."); }}
            >
              <Check className="h-3.5 w-3.5" />비교 후보
            </motion.button>
          ) : (
            <motion.button
              data-testid="compare-add-cta"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-colors inline-flex items-center"
              onClick={() => { onToggleCompare(); toast.success("비교 후보에 추가되었습니다."); }}>
              <PenLine className="h-3.5 w-3.5 mr-1" />비교 추가
            </motion.button>
          )}
          {/* Secondary: 견적 */}
          {isInRequest ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-semibold inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-200 cursor-default"
              // #P02-e2e-blocker fix: toast was unconditionally success;
              // now the wrapping onToggleRequest is the toast authority
              // (it sees the addProductToQuote result mode).
              onClick={() => { onToggleRequest(); }}
            >
              <Check className="h-3.5 w-3.5" />견적 후보
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition-colors inline-flex items-center"
              onClick={() => { onToggleRequest(); }}>
              <FileText className="h-3.5 w-3.5 mr-1" />견적 담기
            </motion.button>
          )}
          {/* §11.325b — 명시적 "상세 보기" button (primary affordance). onSelect → page activeResultId
              → sourcing-context-rail ProductDetailSummary same-canvas render. caller stopPropagation 보존. */}
          <motion.button
            data-testid="sourcing-result-row-detail-cta"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="h-8 px-3 rounded-md text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-colors inline-flex items-center"
            onClick={() => { onSelect(); }}
          >
            상세 보기
          </motion.button>
        </div>

        {/* §11.325b — ChevronRight secondary affordance: button wrap + onClick={onSelect} + cursor-pointer
            (옛 dead UI 정리). stopPropagation 으로 카드 본체 onSelect 중복 호출 방지. */}
        <button
          type="button"
          data-testid="sourcing-result-row-detail-chevron"
          aria-label="상세 보기"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="hidden sm:inline-flex items-center justify-center shrink-0 mt-1 cursor-pointer rounded p-1 -m-1 hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-colors ${isSelected ? "text-blue-400" : "text-slate-400 group-hover:text-slate-600"}`} />
        </button>
      </div>

      {/* Mobile bottom: price + CTA */}
      <div className={`flex items-center justify-between px-3 pb-2.5 pt-0 sm:hidden ${previewDim}`} onClick={(e) => e.stopPropagation()}>
        <div className="text-sm">
          {unitPrice ? (
            <span className="font-semibold tabular-nums text-slate-900"><PriceDisplay price={unitPrice} currency="KRW" /></span>
          ) : (
            <span className="text-yellow-600 text-xs">견적 필요</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isInCompare ? (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-semibold inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200"
              onClick={() => { onToggleCompare(); toast.info("비교 후보에서 제거되었습니다."); }}>
              <Check className="h-3.5 w-3.5" />비교 후보
            </motion.button>
          ) : (
            <motion.button data-testid="compare-add-cta" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-medium text-slate-600 border border-slate-200 inline-flex items-center"
              onClick={() => { onToggleCompare(); toast.success("비교 후보에 추가되었습니다."); }}>
              <PenLine className="h-3.5 w-3.5 mr-1" />비교 추가
            </motion.button>
          )}
          {isInRequest ? (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-semibold inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-200"
              // #P02-e2e-blocker fix: toast moved to wrapping onToggleRequest.
              onClick={() => { onToggleRequest(); }}>
              <Check className="h-3.5 w-3.5" />견적 후보
            </motion.button>
          ) : (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-medium text-slate-500 border border-slate-200 inline-flex items-center"
              onClick={() => { onToggleRequest(); }}>
              <FileText className="h-3.5 w-3.5 mr-1" />견적 담기
            </motion.button>
          )}
          {/* §11.325b — 모바일 "상세 보기" button (ChevronRight 는 sm:inline-flex 로 데스크탑만 노출,
              모바일은 명시적 button 으로 affordance). 동일 onSelect 호출. */}
          <motion.button
            data-testid="sourcing-result-row-detail-cta-mobile"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="h-8 px-3 rounded-md text-sm font-medium text-slate-600 border border-slate-200 inline-flex items-center"
            onClick={() => { onSelect(); }}
          >
            상세 보기
          </motion.button>
        </div>
      </div>
    </div>
  );
}
