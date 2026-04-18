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
  isInCompare: boolean;
  isInRequest: boolean;
  isSelected: boolean;
  onToggleCompare: () => void;
  onToggleRequest: () => void;
  onSelect: () => void;
  compareSessionCount?: number;
  /** preview mode — 시각 1단 낮추고 click intercept (실행 금지) */
  isPreview?: boolean;
}

// ── 3행: 동적 운영 신호 ──────────────────────────────────────────────────

type ChipColor = "green" | "amber" | "blue" | "neutral";

interface OpSignal {
  label: string;
  color: ChipColor;
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
  amber: "text-amber-700 bg-amber-50 border-amber-200",
  blue: "text-blue-700 bg-blue-50 border-blue-200",
  neutral: "text-slate-600 bg-slate-50 border-slate-200",
};

function buildOperatingSignals(product: any, vendor: any, unitPrice: number | null): OpSignal[] {
  const signals: OpSignal[] = [];
  const lt = vendor?.leadTime;
  const ltSource = vendor?.leadTimeSource; // "supplier" | "historical" | undefined

  // ── 1순위: 납기 ──
  if (!lt) {
    signals.push({ label: "납기 확인 필요", color: "amber" });
  } else {
    const str = String(lt).trim().toLowerCase();
    if (str === "즉시" || str === "즉시 출고" || str === "in stock" || str === "0") {
      signals.push({ label: "즉시 출고", color: "green" });
    } else {
      const num = parseInt(str);
      if (!isNaN(num)) {
        // 출처에 따라 표현 구분
        if (ltSource === "historical") {
          signals.push({ label: `평균 리드타임 ${num}영업일`, color: "neutral" });
        } else {
          signals.push({ label: `예상 배송기간 ${num}영업일`, color: "neutral" });
        }
      } else {
        signals.push({ label: "납기 확인 필요", color: "amber" });
      }
    }
  }

  // ── 2순위: 재고/가격 상태 ──
  const hasStock = product.stockStatus === "in_stock" || product.inStock === true;
  const stockAvailable = product.stockStatus === "available" || product.stockAvailable === true;
  const lowStock = product.stockStatus === "low" || product.lowStock === true;

  if (hasStock) {
    signals.push({ label: "재고 확보", color: "green" });
  } else if (stockAvailable) {
    signals.push({ label: "재고 가능", color: "neutral" });
  } else if (lowStock) {
    signals.push({ label: "재고 부족", color: "amber" });
  } else if (!unitPrice || unitPrice <= 0) {
    signals.push({ label: "견적 필요", color: "amber" });
  } else if (unitPrice > 500000) {
    signals.push({ label: "고가 후보", color: "amber" });
  } else if (unitPrice > 100000) {
    signals.push({ label: "예산 검토 필요", color: "amber" });
  } else {
    signals.push({ label: "재고 확인 필요", color: "amber" });
  }

  // ── 3순위: 행동 방향 ──
  if (!unitPrice || unitPrice <= 0) {
    signals.push({ label: "요청 전환 권장", color: "blue" });
  } else {
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
  } else if (product.grade) {
    parts.push(product.grade);
  }
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
  product, isInCompare, isInRequest, isSelected,
  onToggleCompare, onToggleRequest, onSelect,
  isPreview = false,
}: SourcingResultRowProps) {
  const [imgError, setImgError] = useState(false);
  const vendor = product.vendors?.[0];
  const unitPrice = vendor?.priceInKRW && vendor.priceInKRW > 0 ? vendor.priceInKRW : null;
  const imageSrc = product.imageUrl || `/api/products/${product.id}/image`;
  const staticMeta = buildStaticMeta(product, vendor);
  const opSignals = buildOperatingSignals(product, vendor, unitPrice);
  const rowStyle = getRowStyle(isSelected, isInCompare, isInRequest);

  // preview mode: saturation/contrast 1단 낮춤
  const previewDim = isPreview ? "opacity-85" : "";

  return (
    <div
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
          {/* 1행: 제품명 */}
          <p className="text-sm font-bold text-slate-900 line-clamp-1 leading-tight tracking-tight">{product.name}</p>

          {/* 2행: 정적 메타 */}
          {staticMeta && (
            <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-1 leading-tight">{staticMeta}</p>
          )}

          {/* 3행: 동적 운영 신호 */}
          {opSignals.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 overflow-hidden">
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
            <span className="text-sm font-semibold text-amber-600 flex items-center gap-0.5">
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
              onClick={() => { onToggleRequest(); toast.info("견적함에서 제거되었습니다."); }}
            >
              <Check className="h-3.5 w-3.5" />견적 후보
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition-colors inline-flex items-center"
              onClick={() => { onToggleRequest(); toast.success("견적함에 성공적으로 담겼습니다."); }}>
              <FileText className="h-3.5 w-3.5 mr-1" />견적 담기
            </motion.button>
          )}
        </div>

        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-colors hidden sm:block mt-1 ${isSelected ? "text-blue-400" : "text-slate-400 group-hover:text-slate-600"}`} />
      </div>

      {/* Mobile bottom: price + CTA */}
      <div className={`flex items-center justify-between px-3 pb-2.5 pt-0 sm:hidden ${previewDim}`} onClick={(e) => e.stopPropagation()}>
        <div className="text-sm">
          {unitPrice ? (
            <span className="font-semibold tabular-nums text-slate-900"><PriceDisplay price={unitPrice} currency="KRW" /></span>
          ) : (
            <span className="text-amber-600 text-xs">견적 필요</span>
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
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-medium text-slate-600 border border-slate-200 inline-flex items-center"
              onClick={() => { onToggleCompare(); toast.success("비교 후보에 추가되었습니다."); }}>
              <PenLine className="h-3.5 w-3.5 mr-1" />비교 추가
            </motion.button>
          )}
          {isInRequest ? (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-semibold inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-200"
              onClick={() => { onToggleRequest(); toast.info("견적함에서 제거되었습니다."); }}>
              <Check className="h-3.5 w-3.5" />견적 후보
            </motion.button>
          ) : (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              className="h-8 px-3 rounded-md text-sm font-medium text-slate-500 border border-slate-200 inline-flex items-center"
              onClick={() => { onToggleRequest(); toast.success("견적함에 성공적으로 담겼습니다."); }}>
              <FileText className="h-3.5 w-3.5 mr-1" />견적 담기
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
