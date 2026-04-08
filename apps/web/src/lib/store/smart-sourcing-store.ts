/**
 * Smart Sourcing Zustand Store
 *
 * AI 견적 분석(다중 견적 비교 / BOM 자동 발주)의 상태를
 * Zustand store로 중앙 관리합니다.
 *
 * 기존 quote-draft-store.ts 패턴을 따름:
 * - persist middleware로 선택적 저장
 * - calculateTotals / hydrate / reset 유틸리티
 * - 민감정보 제외 partialize
 *
 * 고정 규칙:
 * 1. Handoff snapshot은 canonical source — UI preview가 truth를 덮지 않는다.
 * 2. Store는 state container일 뿐, business logic은 engine에서 처리.
 * 3. 결과가 없으면 stale은 false (context hash guard).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  QuoteComparisonHandoff,
  BomParseHandoff,
} from "@/lib/ai/smart-sourcing-handoff-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type SmartSourcingTab = "multi-vendor" | "bom-sourcing";

export interface VendorQuoteInput {
  id: string;
  vendorName: string;
  rawText: string;
}

export interface ComparisonVendor {
  vendor: string;
  price: number | string;
  leadTime: string;
  shippingFee: number | string;
}

export interface ComparisonResult {
  comparison: ComparisonVendor[];
  recommendation: string;
  negotiationGuide: string;
}

export interface BomItem {
  name: string;
  catalogNumber: string | null;
  quantity: number;
  unit: string;
  category: string;
  estimatedUse: string | null;
  brand: string | null;
}

export interface BomParseResult {
  items: BomItem[];
  summary: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// State Shape
// ══════════════════════════════════════════════════════════════════════════════

interface SmartSourcingState {
  // ── 공통 ──
  activeTab: SmartSourcingTab;

  // ── Multi-Vendor ──
  vendors: VendorQuoteInput[];
  productName: string;
  quantity: string;
  isAnalyzing: boolean;
  comparisonResult: ComparisonResult | null;
  comparisonHandoff: QuoteComparisonHandoff | null;
  resultContextHash: string | null;

  // ── BOM ──
  bomText: string;
  isParsing: boolean;
  bomResult: BomParseResult | null;
  bomHandoff: BomParseHandoff | null;
  bomResultHash: string | null;
  selectedBomItems: number[];
  isRegistering: boolean;

  // ── Actions: 공통 ──
  setActiveTab: (tab: SmartSourcingTab) => void;
  reset: () => void;
  resetMultiVendor: () => void;
  resetBom: () => void;

  // ── Actions: Multi-Vendor ──
  setProductName: (name: string) => void;
  setQuantity: (qty: string) => void;
  setVendors: (vendors: VendorQuoteInput[]) => void;
  addVendor: (vendor: VendorQuoteInput) => void;
  removeVendor: (id: string) => void;
  updateVendor: (id: string, field: keyof VendorQuoteInput, value: string) => void;
  setIsAnalyzing: (v: boolean) => void;
  setComparisonResult: (result: ComparisonResult | null) => void;
  setComparisonHandoff: (handoff: QuoteComparisonHandoff | null) => void;
  setResultContextHash: (hash: string | null) => void;

  // ── Actions: BOM ──
  setBomText: (text: string) => void;
  setIsParsing: (v: boolean) => void;
  setBomResult: (result: BomParseResult | null) => void;
  setBomHandoff: (handoff: BomParseHandoff | null) => void;
  setBomResultHash: (hash: string | null) => void;
  setSelectedBomItems: (indices: number[]) => void;
  toggleBomItem: (idx: number) => void;
  toggleAllBomItems: () => void;
  setIsRegistering: (v: boolean) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Initial State
// ══════════════════════════════════════════════════════════════════════════════

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

const initialMultiVendorState = {
  vendors: [
    { id: generateId(), vendorName: "", rawText: "" },
    { id: generateId(), vendorName: "", rawText: "" },
  ] as VendorQuoteInput[],
  productName: "",
  quantity: "",
  isAnalyzing: false,
  comparisonResult: null as ComparisonResult | null,
  comparisonHandoff: null as QuoteComparisonHandoff | null,
  resultContextHash: null as string | null,
};

const initialBomState = {
  bomText: "",
  isParsing: false,
  bomResult: null as BomParseResult | null,
  bomHandoff: null as BomParseHandoff | null,
  bomResultHash: null as string | null,
  selectedBomItems: [] as number[],
  isRegistering: false,
};

// ══════════════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════════════

export const useSmartSourcingStore = create<SmartSourcingState>()(
  persist(
    (set, get) => ({
      // ── 초기 상태 ──
      activeTab: "multi-vendor" as SmartSourcingTab,
      ...initialMultiVendorState,
      ...initialBomState,

      // ── 공통 Actions ──
      setActiveTab: (tab) => set({ activeTab: tab }),

      reset: () => set({
        activeTab: "multi-vendor",
        ...initialMultiVendorState,
        vendors: [
          { id: generateId(), vendorName: "", rawText: "" },
          { id: generateId(), vendorName: "", rawText: "" },
        ],
        ...initialBomState,
      }),

      resetMultiVendor: () => set({
        ...initialMultiVendorState,
        vendors: [
          { id: generateId(), vendorName: "", rawText: "" },
          { id: generateId(), vendorName: "", rawText: "" },
        ],
      }),

      resetBom: () => set({ ...initialBomState }),

      // ── Multi-Vendor Actions ──
      setProductName: (name) => set({ productName: name }),
      setQuantity: (qty) => set({ quantity: qty }),
      setVendors: (vendors) => set({ vendors }),

      addVendor: (vendor) =>
        set((state) => ({ vendors: [...state.vendors, vendor] })),

      removeVendor: (id) =>
        set((state) => ({ vendors: state.vendors.filter((v) => v.id !== id) })),

      updateVendor: (id, field, value) =>
        set((state) => ({
          vendors: state.vendors.map((v) =>
            v.id === id ? { ...v, [field]: value } : v
          ),
        })),

      setIsAnalyzing: (v) => set({ isAnalyzing: v }),
      setComparisonResult: (result) => set({ comparisonResult: result }),
      setComparisonHandoff: (handoff) => set({ comparisonHandoff: handoff }),
      setResultContextHash: (hash) => set({ resultContextHash: hash }),

      // ── BOM Actions ──
      setBomText: (text) => set({ bomText: text }),
      setIsParsing: (v) => set({ isParsing: v }),
      setBomResult: (result) => set({ bomResult: result }),
      setBomHandoff: (handoff) => set({ bomHandoff: handoff }),
      setBomResultHash: (hash) => set({ bomResultHash: hash }),
      setSelectedBomItems: (indices) => set({ selectedBomItems: indices }),

      toggleBomItem: (idx) =>
        set((state) => {
          const current = new Set(state.selectedBomItems);
          if (current.has(idx)) current.delete(idx);
          else current.add(idx);
          return { selectedBomItems: Array.from(current) };
        }),

      toggleAllBomItems: () =>
        set((state) => {
          if (!state.bomResult) return {};
          if (state.selectedBomItems.length === state.bomResult.items.length) {
            return { selectedBomItems: [] };
          }
          return { selectedBomItems: state.bomResult.items.map((_, i) => i) };
        }),

      setIsRegistering: (v) => set({ isRegistering: v }),
    }),
    {
      name: "smart-sourcing-storage",
      // handoff snapshot은 canonical source — persist로 유지
      // API 결과(comparisonResult, bomResult)는 제외: 재진입 시 재분석 유도
      partialize: (state) => ({
        activeTab: state.activeTab,
        vendors: state.vendors,
        productName: state.productName,
        quantity: state.quantity,
        bomText: state.bomText,
        // handoff는 canonical → persist
        comparisonHandoff: state.comparisonHandoff,
        bomHandoff: state.bomHandoff,
        // context hash도 유지 (staleness 판단용)
        resultContextHash: state.resultContextHash,
        bomResultHash: state.bomResultHash,
      }),
    }
  )
);

// ══════════════════════════════════════════════════════════════════════════════
// Selectors (derived state)
// ══════════════════════════════════════════════════════════════════════════════

/** 다중 견적에 유효 입력이 있는 공급사 수 */
export function selectFilledVendorCount(state: SmartSourcingState): number {
  return state.vendors.filter((v) => v.vendorName.trim() && v.rawText.trim()).length;
}

/** BOM 선택된 품목 수 */
export function selectSelectedBomCount(state: SmartSourcingState): number {
  return state.selectedBomItems.length;
}

/** Multi-Vendor handoff 상태 요약 */
export function selectComparisonStatus(state: SmartSourcingState): string {
  if (!state.comparisonHandoff) return "idle";
  return state.comparisonHandoff.status;
}

/** BOM handoff 상태 요약 */
export function selectBomStatus(state: SmartSourcingState): string {
  if (!state.bomHandoff) return "idle";
  return state.bomHandoff.status;
}
