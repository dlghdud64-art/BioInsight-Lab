"use client";

// §11.283c #inventory-content-traffic-light — amber/orange 토큰 → yellow/red 신호등 sweep (호영님 P0 spec, §11.283 cluster C, 30+ spot byte-level swap).
import { isSuspectReceivedQuantity, countSuspectInventories } from "@/lib/inventory/suspect-received-quantity";
import { inventoryToneClass, INVENTORY_TONE_CLASS } from "@/lib/inventory/state-tone";
import { ToastAction } from "@/components/ui/toast";
import { buildInventoryPatchBody } from "@/lib/inventory/inventory-form-payload";
// §11.374 P3.4 — 헤더 단일 문법(AppPageHeader). 인라인 h1 교체, 모달 액션 클러스터는 보존.
import { AppPageHeader } from "@/components/layout/page-header";
import { useState, useEffect, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserPreferences } from "@/lib/preferences/user-preferences";
import { csrfFetch } from "@/lib/api-client";
import { invalidateBriefNarrative } from "@/lib/hooks/use-operational-brief";
// §11.317 — 헤더 1줄 배너 → 운영 브리핑 popup open (canonical truth 보존, dead button 0)
import { useOperationalBriefPopup } from "@/components/operational-brief/popup-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// Dialog kept static — radix portal needed for SSR hydration
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// §global-filters P3-a2 — 데스크톱 필터 인라인 바(공용). 모바일 Sheet·persist 무접촉(297f 진화).
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { Badge } from "@/components/ui/badge";
import { isReorderNeeded, isReorderNeededByLeadTime } from "@/lib/inventory/reorder-need";
// §11.297f Radix DropdownMenu* import 제거 — 5 dropdown 모두 ActionMenu
// (utility/card/issue alert) 또는 plain dropdown (filter) 으로 swap 완료.
import { ActionMenu } from "@/components/inventory/action-menu";
// §mobile-residual-5 1a — 모바일 ⋮ 더보기 = scrim + 바텀 시트(메뉴 시트 통일 규칙). 드롭다운 0.
import { MobileActionSheet } from "@/components/ui/mobile-sheet";
// §11.196f — dead lucide imports 9 symbol 제거 (ArrowLeftRight Clock
//   FlaskConical GitBranch LayoutDashboard List RotateCcw ShoppingCart X
//   actual JSX/prop 사용 0). 나머지 보존.
import { Plus, Package, AlertTriangle, Trash2, TrendingDown, History, Calendar, MapPin, Loader2, CheckCircle2, ArrowRight, Zap, Upload, Download, Search, LayoutGrid, ListFilter, FileDown, QrCode, PackagePlus, MoreVertical, Printer, Truck, ChevronRight, X } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
const InventorySearch = dynamic(() => import("@/components/inventory/InventorySearch").then((m) => m.InventorySearch), { ssr: false });
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { useQRScanner } from "@/contexts/QRScannerContext";
const DatePicker = dynamic(() => import("@/components/ui/date-picker").then((m) => m.DatePicker), { ssr: false });
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
// Sheet is kept static as it wraps children — radix portal
import { Info, FileText, BellRing, Save, Sparkles, Archive, Maximize2 } from "lucide-react";
import { type LotRecord, type LotEvent, type LotStatusFilter, computeLotStatus, sortLots, computeLotSummary, filterLotsByStatus, searchLots, getLotStatusLabel, getLotStatusColor } from "@/lib/inventory/lot-tracking-engine";
import { getStorageConditionLabel } from "@/lib/constants";
import { resolveDisposal, type DisposalReason } from "@/lib/ontology/contextual-action/disposal-resolver";
import type { SmartReceiveFormData } from "@/components/inventory/LabelScannerModal";
// §11.371-3 — 라벨 직접 입고 영속화 단일점(내부에서 §11.326 mapLabelToReceiving 사용).
import { submitLabelReceive } from "@/lib/inventory/submit-label-receive";
import type { QueueItem } from "@/components/inventory/priority-action-queue";
const LabelScannerModal = dynamic(() => import("@/components/inventory/LabelScannerModal").then((m) => m.LabelScannerModal), { ssr: false });
const LabelPrintModal = dynamic(() => import("@/components/inventory/LabelPrintModal").then((m) => m.LabelPrintModal), { ssr: false });
const BulkImportModal = dynamic(() => import("@/components/inventory/BulkImportModal").then((m) => m.BulkImportModal), { ssr: false });
/* §inventory-import-fake-success (2026-09-26 · 호영님 지시) — 「재고 파일 가져오기」 가 **가짜 성공**이었다. 실측:
 *   import-staging-workbench.tsx  fetch·csrfFetch·useMutation **0건**.
 *     handleFileUpload 은 file.name/size 만 쓰고 **파일을 읽지 않는다** →
 *     컬럼 10개를 하드코딩하고 generateMockRows() 로 행을 만든다.
 *     즉 사용자가 검토하는 표가 **자기 파일이 아니다.**
 *     handleApply 은 setTimeout(1500) 뒤 importStagingStatus="applied" 로 「적용 완료」 를 띄운다.
 *   → 저장되는 것이 0인데 「N건 적용」 이 뜬다. vendor-portal 제출과 같은 등급이다(호영님).
 *
 *   저장 경로는 **있었다**: /api/inventory/import/preview + /commit
 *     commit 은 ImportJob 생성 + productInventory create/update 로 실제로 쓴다.
 *   그 경로를 부르는 UI 도 **이미 있었다**: components/inventory/import-wizard.tsx
 *     서버가 파싱한 columns/fileId 로 매핑 → commit → 서버 ImportResult 로 성공 화면을 그린다.
 *     그런데 importer 가 0이라 **렌더되지 않았다**(§Render-Reachability).
 *   → 라이브 진입점을 실배선 쪽으로 붙인다. 가짜는 배선을 끊는다. */
const ImportWizard = dynamic(() => import("@/components/inventory/import-wizard").then((m) => m.ImportWizard), { ssr: false });
const InventoryTable = dynamic(() => import("@/components/inventory/InventoryTable").then((m) => m.InventoryTable), { ssr: false });
const AddInventoryModal = dynamic(() => import("@/components/inventory/AddInventoryModal").then((m) => m.AddInventoryModal), { ssr: false });
const LotDisposalPanel = dynamic(() => import("@/components/inventory/lot-disposal-panel").then((m) => m.LotDisposalPanel), { ssr: false });
const LotBatchDispatchSheet = dynamic(() => import("@/components/inventory/lot-batch-dispatch-sheet").then((m) => m.LotBatchDispatchSheet), { ssr: false });
const OpsExecutionContext = dynamic(() => import("@/components/ops/ops-execution-context").then((m) => m.OpsExecutionContext), { ssr: false });
const PriorityActionQueue = dynamic(() => import("@/components/inventory/priority-action-queue").then((m) => m.PriorityActionQueue), { ssr: false });
const InventoryContextPanel = dynamic(() => import("@/components/inventory/inventory-context-panel").then((m) => m.InventoryContextPanel), { ssr: false });
const MobileOperationalBriefSheet = dynamic(() => import("@/components/operational-brief/mobile-bottom-sheet").then((m) => m.MobileOperationalBriefSheet), { ssr: false });
// §inventory-reorder-surface-unify P2 — ReorderReviewSheet content-level 승격 래퍼(AiAssistant 비의존 직접 오픈).
const InventoryReorderReviewSheet = dynamic(() => import("@/components/inventory/inventory-reorder-review-sheet").then((m) => m.InventoryReorderReviewSheet), { ssr: false });
// §inventory-mobile-reorder-gate P3 — 중복 발주 위험 소프트 게이트 바텀시트(모바일).
const InventoryReorderBlockedSheet = dynamic(() => import("@/components/inventory/inventory-reorder-blocked-sheet").then((m) => m.InventoryReorderBlockedSheet), { ssr: false });
const OperationalBriefFloatingEntry = dynamic(() => import("@/components/operational-brief/floating-entry").then((m) => m.OperationalBriefFloatingEntry), { ssr: false });
// §11.258-sweep-2 — 모바일 한정 좌측 하단 floating 진입 (방안 1 위치 분리).
//   BarcodeScanFab (right-4) 와 분리 (left-4). dashboard inline link 와 별개.
const MobileBriefInlineButton = dynamic(() => import("@/components/operational-brief/mobile-inline-button").then((m) => m.MobileBriefInlineButton), { ssr: false });
const StorageLocationView = dynamic(() => import("@/components/inventory/storage-location-view").then((m) => m.StorageLocationView), { ssr: false });
const InventoryFlowView = dynamic(() => import("@/components/inventory/inventory-flow-view").then((m) => m.InventoryFlowView), { ssr: false });
const MobileInventoryView = dynamic(() => import("@/components/inventory/mobile-inventory-view").then((m) => m.MobileInventoryView), { ssr: false });
type ContextPanelItem = {
  id: string;
  productId: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;
  currentQuantity: number;
  unit: string;
  safetyStock: number | null;
  location: string | null;
  expiryDate: string | null;
  notes: string | null;
  lotNumber?: string | null;
  storageCondition?: string | null;
  hazard?: boolean;
  vendor?: string | null;
  deliveryPeriod?: string | null;
  inUseOrUnopened?: string | null;
  averageDailyUsage?: number;
  leadTimeDays?: number;
};

interface ProductInventory {
  id: string;
  productId: string;
  currentQuantity: number;
  unit: string;
  safetyStock: number | null;
  minOrderQty: number | null;
  location: string | null;
  expiryDate: string | null;
  notes: string | null;
  lotNumber?: string | null;
  trackingMode?: string | null; // §inventory-phaseB P3-UI-a3 — 차감 게이팅 정책.
  storageCondition?: string | null;
  hazard?: boolean;
  vendor?: string | null;
  deliveryPeriod?: string | null;
  inUseOrUnopened?: string | null;
  averageExpiry?: string | null;
  autoReorderEnabled?: boolean;
  autoReorderThreshold?: number;
  averageDailyUsage?: number;
  leadTimeDays?: number;
  // #inventory-lot-overlay P5 — GET /api/inventory 가 include 로 반환하는 실 입고 lot 이력.
  //   Lot 추적의 canonical lot 소스(품목당 다중 lot). 없으면 undefined.
  restockRecords?: Array<{
    id: string;
    lotNumber: string | null;
    expiryDate: string | null;
    quantity: number;
    restockedAt: string;
  }>;
  product: {
    id: string;
    name: string;
    /** §11.366 D-8 — 영문명 (API 는 product full include 라 payload 에 이미 존재) */
    nameEn?: string | null;
    brand: string | null;
    catalogNumber: string | null;
  };
}

// §inventory-delta-label-kpi P4b (호영님 2026-07-27 핸드오프 §3) — 리스트 상단 활성 필터 칩 라벨.
//   상태 Select 옵션 라벨(부족·만료 임박·입고 대기·LOT 불일치·최근 변경·정상)과 정합.
//   canonical: statusFilter 값 소유 무접촉(표시 계층 전용). "all" 은 칩 미노출 → 맵 제외.
const STATUS_FILTER_LABELS: Record<string, string> = {
  low: "부족 / 재주문 필요",
  expiring: "만료 임박",
  incoming: "입고 대기",
  lot_issue: "LOT 불일치",
  recent: "최근 변경",
  normal: "정상",
};

function InventoryPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { open: openQRScanner } = useQRScanner();
  const searchParams = useSearchParams();
  const pilotProfile = searchParams.get("labaxisPilot") ?? searchParams.get("pilot");
  const isBrowserPilotInventoryDisposal = pilotProfile === "inventory-disposal";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // §11.297d utility dropdown plain state (mutually exclusive).
  const [openInvContentMenuId, setOpenInvContentMenuId] = useState<string | null>(null);
  // §mobile-residual-5 1a — 모바일 재고 작업 시트 open 상태(⋮ 트리거 활성 스타일과 동기).
  const [invMobileSheetOpen, setInvMobileSheetOpen] = useState(false);
  // §11.297f filter dropdown plain state.
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  // §inventory-import-fake-success (2026-09-26 · 호영님 지시) — 이름도 실배선 쪽으로. 「staging」 은 가짜 컴포넌트 이름이었다.
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [isSmartReceiveOpen, setIsSmartReceiveOpen] = useState(false);
  // §11.317 — 헤더 1줄 배너 onClick → 운영 브리핑 popup open (Phase 4 에서 category hint 추가).
  const operationalBriefPopup = useOperationalBriefPopup();
  const [editingInventory, setEditingInventory] = useState<ProductInventory | null>(null);
  const [inventoryView, setInventoryView] = useState<"my" | "team">("my");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  // URL ?filter= 파라미터가 있으면 초기 필터로 세팅 (대시보드 '부족 알림' 카드 진입)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("filter") ?? "all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // §11.326 Phase 4 — 의심 입고수량 필터 + 배너 dismiss
  const [suspectFilterActive, setSuspectFilterActive] = useState(false);
  const [suspectBannerDismissed, setSuspectBannerDismissed] = useState(false);

  const activeFilterCount = [locationFilter, statusFilter, categoryFilter].filter((f) => f !== "all").length;

  // URL 파라미터 변경 시 필터 동기화
  useEffect(() => {
    const f = searchParams.get("filter");
    if (f) setStatusFilter(f);
  }, [searchParams]);

  // §11.230c (a)-5 #inventory-receiving-filter-sync — server-first hydration.
  //   우선순위: URL `?filter` > server preferences > default.
  //   URL param 없을 때만 server preferences.inventoryFilter.status 적용.
  // §11.230c (a)-8 — locationFilter + categoryFilter 추가 (잔여 백로그 처리).
  //   URL param 은 statusFilter 만 (location/category 는 URL 없음).
  const userPrefs = useUserPreferences();
  useEffect(() => {
    const serverInv = userPrefs.preferences?.inventoryFilter;
    if (!serverInv) return;
    // statusFilter — URL ?filter 우선.
    if (serverInv.status) {
      const urlFilter = searchParams.get("filter");
      if (!urlFilter) setStatusFilter(serverInv.status);
    }
    // §11.230c (a)-8 — locationFilter / categoryFilter URL 분기 없음.
    if (serverInv.location) setLocationFilter(serverInv.location);
    if (serverInv.category) setCategoryFilter(serverInv.category);
  }, [userPrefs.preferences, searchParams]);

  // §11.230c (a)-5 — debounced server PATCH on statusFilter change.
  // §11.230c (a)-8 — locationFilter / categoryFilter 도 server-persist (잔여 백로그 처리).
  //   lotStatusFilter / searchQuery 제외 (호영님 scope).
  useEffect(() => {
    userPrefs.updateInventoryFilter({ status: statusFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    userPrefs.updateInventoryFilter({ location: locationFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFilter]);

  useEffect(() => {
    userPrefs.updateInventoryFilter({ category: categoryFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  // 라벨 스캔 결과로 AddInventoryModal 자동 오픈 + 프리필
  useEffect(() => {
    const fromScan = searchParams.get("from");
    if (fromScan !== "label-scan") return;

    const productId = searchParams.get("productId");
    const productName = searchParams.get("productName");
    const brand = searchParams.get("brand");
    const catalogNumber = searchParams.get("catalogNumber");
    const lotNumber = searchParams.get("lotNumber");
    const expiryDate = searchParams.get("expiryDate");
    const quantity = searchParams.get("quantity");

    // 매칭된 DB 제품 또는 스캔된 제품 정보로 프리필
    if (productName) {
      setEditingInventory({
        productId: productId || `manual-${Date.now()}`,
        product: {
          id: productId || `manual-${Date.now()}`,
          name: productName,
          brand: brand ?? null,
          catalogNumber: catalogNumber ?? null,
        },
        currentQuantity: 0,
        unit: "개",
        safetyStock: null,
        minOrderQty: null,
        location: null,
        expiryDate: expiryDate ?? null,
        notes: null,
        lotNumber: lotNumber ?? null,
      } as any);
    }

    setIsDialogOpen(true);

    // URL 정리 (파라미터 제거)
    const url = new URL(window.location.href);
    ["from", "productId", "productName", "brand", "catalogNumber", "lotNumber", "expiryDate", "quantity", "casNumber", "action"].forEach((key) => url.searchParams.delete(key));
    router.replace(url.pathname + url.search, { scroll: false });
  }, [searchParams]);

  // purchase-receiving 모드 진입 (구매 → 재고 반영 플로우)
  useEffect(() => {
    const prId = searchParams.get("purchase-receiving");
    if (prId && status === "authenticated") {
      // 구매 데이터 가져오기
      fetch(`/api/purchases/${prId}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("구매 데이터를 찾을 수 없습니다.");
        })
        .then((purchaseRes) => {
          const purchase = purchaseRes.purchase || purchaseRes;
          setPurchaseContext(purchase);
          setReceivingForm((prev) => ({
            ...prev,
            actualQty: String(purchase.qty || ""),
            lotNumber: "",
            expiryDate: "",
            location: "",
            notes: "",
            restockMethod: "merge",
          }));
          setDrawerMode("purchase-receiving");

          // 해당 품목의 기존 재고 검색 (품목명 기반)
          const matchingItem = displayInventories.find((inv) => inv.product.name.toLowerCase().includes((purchase.itemName || "").toLowerCase()) || (purchase.catalogNumber && inv.product.catalogNumber === purchase.catalogNumber));
          if (matchingItem) {
            setSelectedItem(matchingItem);
            setSheetSafetyStock(String(matchingItem.safetyStock ?? matchingItem.minOrderQty ?? 1));
          }
          setIsSheetOpen(true);
        })
        .catch(() => {
          // 구매 데이터를 못 찾으면 mock context 생성
          setPurchaseContext({
            id: prId,
            itemName: "구매 품목",
            qty: 1,
            vendorName: "-",
          });
          setDrawerMode("purchase-receiving");
          setIsSheetOpen(true);
        });
    }
  }, [searchParams, status]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProductInventory | null>(null);
  const [sheetSafetyStock, setSheetSafetyStock] = useState("");
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [isExportingLabels, setIsExportingLabels] = useState(false);

  // ── Lot Disposal Panel (object-scoped disposal dock) state ──
  const [disposalTarget, setDisposalTarget] = useState<import("@/components/inventory/lot-disposal-panel").DisposalTarget | null>(null);
  const [disposalInventoryId, setDisposalInventoryId] = useState<string | null>(null);
  const [disposalCompletionSummary, setDisposalCompletionSummary] = useState<import("@/components/inventory/lot-disposal-panel").DisposalCompletionSummary | null>(null);
  const disposalPanelOpen = disposalTarget !== null;

  // ── Context Panel (right-side detail drawer) state ──
  const [contextPanelItem, setContextPanelItem] = useState<ContextPanelItem | null>(null);
  // §inventory-panel-unify P3 — 진입 맥락(detail/reorder). 재발주 진입 시 통합 패널 상단 강조 전환(AiAssistant 미오픈).
  const [contextPanelMode, setContextPanelMode] = useState<"detail" | "reorder">("detail");
  const contextPanelOpen = contextPanelItem !== null;

  // §inventory-reorder-surface-unify P2 — ReorderReviewSheet content-level 승격.
  //   AiAssistant 내부 state 비의존 → ContextPanel/모바일이 openReorderReviewSheet(item)로 직접 오픈.
  const [reorderReviewItem, setReorderReviewItem] = useState<ProductInventory | null>(null);
  const openReorderReviewSheet = (item: ProductInventory) => setReorderReviewItem(item);
  // §inventory-mobile-reorder-gate P2 — 추천 미산출 시 안전재고 기준 fallback 수량(출처 배지용, canonical 아님 표기).
  const [reorderReviewFallbackQty, setReorderReviewFallbackQty] = useState<number | null>(null);
  // §inventory-mobile-reorder-gate P3 — 소프트 게이트(중복 발주 위험) 상태 + override 사유(진행 결정 기록).
  const [reorderBlockedState, setReorderBlockedState] = useState<{ item: ProductInventory; reasons: string[] } | null>(null);
  const [reorderOverrideReasons, setReorderOverrideReasons] = useState<string[] | null>(null);
  // canonical recommendedQty 조회(데스크탑 패널 reorderQty와 동일 소스 /reorder-recommendations). 가짜 0 금지.
  // §stock-risk-consolidation P2 — 재발주 차단 사유(canonical /reorder-recommendations 파생). stock-risk 흡수.
  const reorderBlockReasonsFor = (inventoryId: string | undefined): string[] =>
    (inventoryId ? reorderRecommendationsData?.recommendations?.find((r) => r.inventoryId === inventoryId) : undefined)?.blockReasons ?? [];
  const reorderRecommendedQtyFor = (inventoryId: string | undefined): number | null =>
    inventoryId
      ? reorderRecommendationsData?.recommendations?.find((r) => r.inventoryId === inventoryId)?.recommendedQty ?? null
      : null;

  // ── Inventory tab (controlled) ──
  const [activeInventoryTab, setActiveInventoryTab] = useState("manage");
  // ── Lot 추적 tab state ──
  const [lotStatusFilter, setLotStatusFilter] = useState<LotStatusFilter>("all");
  const [lotSearchQuery, setLotSearchQuery] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  // #inventory-lot-overlay P5 — same-canvas 풀스크린 overlay(새 route 금지) + 다건선택 상태.
  const [isLotOverlayOpen, setIsLotOverlayOpen] = useState(false);
  const [lotMultiSelect, setLotMultiSelect] = useState<Set<string>>(new Set());
  const [isBatchDispatchOpen, setIsBatchDispatchOpen] = useState(false);

  const openContextPanel = (inv: ProductInventory, mode: "detail" | "reorder" = "detail") => {
    setContextPanelMode(mode);
    setContextPanelItem({
      id: inv.id,
      productId: inv.productId,
      productName: inv.product.name,
      brand: inv.product.brand,
      catalogNumber: inv.product.catalogNumber,
      currentQuantity: inv.currentQuantity,
      unit: inv.unit,
      safetyStock: inv.safetyStock,
      lotNumber: inv.lotNumber,
      expiryDate: inv.expiryDate,
      location: inv.location,
      storageCondition: inv.storageCondition,
      hazard: inv.hazard,
      vendor: inv.vendor,
      deliveryPeriod: inv.deliveryPeriod,
      inUseOrUnopened: inv.inUseOrUnopened,
      averageDailyUsage: inv.averageDailyUsage,
      leadTimeDays: inv.leadTimeDays,
      notes: inv.notes,
    });
  };

  // §inventory-panel-unify P3 — 재발주 진입 = 통합 패널(ContextPanel mode='reorder')로 라우팅.
  //   별도 AiAssistant 패널 미오픈(시안 ① 단일 패널, 상단 강조만 재발주). reorderQty/추천은 패널이 canonical 흡수(P2).
  // §inventory-mobile-reorder-gate P1 — 모바일(<md) no-op 수정: ContextPanel은 데스크톱 컨테이너에서만
  //   렌더되어 모바일 재발주 진입이 침묵했다. ContextPanel onReorder와 동일 분기(canonical
  //   /reorder-recommendations)를 viewport로 직접 라우팅 — 추천有→검토 시트 / 차단→소프트 게이트 /
  //   미산출→안전재고 fallback(출처 배지). 데스크톱 거동 불변.
  const openReorderReview = (inventory: ProductInventory) => {
    const isDesktop = typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) {
      openContextPanel(inventory, "reorder");
      return;
    }
    const mQty = reorderRecommendedQtyFor(inventory.id);
    const mBlocked = reorderBlockReasonsFor(inventory.id);
    if (mBlocked.length > 0) {
      // §inventory-mobile-reorder-gate P3 — 하드 차단 금지: 게이트 시트로 사유 노출 후 진행 선택 가능.
      setReorderBlockedState({ item: inventory, reasons: mBlocked });
      return;
    }
    if (mQty != null && mQty > 0) {
      setReorderReviewFallbackQty(null);
      setReorderOverrideReasons(null);
      openReorderReviewSheet(inventory);
      return;
    }
    // §inventory-mobile-reorder-gate P2 — 침묵 금지: 추천 미산출/로딩 시 안전재고 기준 fallback.
    const fallback = Math.max(0, (inventory.safetyStock ?? 0) - inventory.currentQuantity);
    if (fallback > 0) {
      setReorderOverrideReasons(null);
      setReorderReviewFallbackQty(fallback);
      openReorderReviewSheet(inventory);
    } else {
      // fallback도 0 — 모바일 브리핑 시트(§11.155)로 '재발주 권장 없음' 사유 가시(침묵 0).
      openContextPanel(inventory, "reorder");
    }
  };

  const entityIdParam = searchParams.get("entity_id");

  // §inventory-reorder-surface-unify P4 — ?ai_panel deep-link retire (AiAssistant 분석 래퍼 미오픈, ReorderReviewSheet 승격으로 대체).

  useEffect(() => {
    if (isBrowserPilotInventoryDisposal) {
      setActiveInventoryTab("overview");
    }
  }, [isBrowserPilotInventoryDisposal]);

  const [restockItem, setRestockItem] = useState<ProductInventory | null>(null);
  const [restockForm, setRestockForm] = useState({
    addQty: "",
    lotNumber: "",
    expiryDate: "",
  });
  const [restockDoneItem, setRestockDoneItem] = useState<ProductInventory | null>(null);
  const [showRestockHistory, setShowRestockHistory] = useState(false);

  // ── 새 라벨 인쇄 모달 (규격 선택 + 미리보기) ──
  const [newLabelPrintOpen, setNewLabelPrintOpen] = useState(false);

  // ── 기존 라벨 인쇄 모달 상태 (레거시) ──
  const [labelPrintOpen, setLabelPrintOpen] = useState(false);
  const [labelPrintTitle, setLabelPrintTitle] = useState("");
  const [labelPrintLots, setLabelPrintLots] = useState<ProductInventory[]>([]);
  const [labelPrintSelected, setLabelPrintSelected] = useState<Set<string>>(new Set());
  const [labelPrintQty, setLabelPrintQty] = useState<Record<string, number>>({});
  const [labelPrintMode, setLabelPrintMode] = useState<"a4-multi" | "single">("a4-multi");

  // ── purchase-receiving mode ──
  type DrawerMode = "view" | "edit" | "purchase-receiving";
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view");
  const [purchaseContext, setPurchaseContext] = useState<any>(null);
  const [receivingForm, setReceivingForm] = useState({
    actualQty: "",
    lotNumber: "",
    expiryDate: "",
    location: "",
    notes: "",
    restockMethod: "merge" as "merge" | "newLot",
  });

  // 사용자 팀 목록 조회
  const { data: teamsData } = useQuery({
    queryKey: ["user-teams"],
    queryFn: async () => {
      const response = await fetch("/api/team");
      if (!response.ok) throw new Error("Failed to fetch teams");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const selectedTeam = teamsData?.teams?.[0];

  // 내 인벤토리 조회
  const { data: inventoryResponse, isLoading, isError: inventoryIsError } = useQuery<{
    inventories: ProductInventory[];
  }>({
    queryKey: ["inventories"],
    queryFn: async () => {
      const response = await fetch("/api/inventory");
      if (!response.ok) throw new Error("Failed to fetch inventories");
      return response.json();
    },
    enabled: status === "authenticated" && inventoryView === "my",
  });

  // Deep-link: entity_id → 해당 아이템 시트 열기 (inventoryResponse 선언 이후)
  useEffect(() => {
    if (entityIdParam && inventoryResponse?.inventories) {
      const target = inventoryResponse.inventories.find((item: ProductInventory) => item.id === entityIdParam);
      if (target) {
        setSelectedItem(target);
        setIsSheetOpen(true);
      }
    }
  }, [entityIdParam, inventoryResponse?.inventories]); // eslint-disable-line react-hooks/exhaustive-deps

  // 팀 인벤토리 조회
  const { data: teamInventoryData, isLoading: isLoadingTeam, isError: teamInventoryIsError } = useQuery<{
    inventories: any[];
  }>({
    queryKey: ["team-inventory", selectedTeam?.id],
    queryFn: async () => {
      if (!selectedTeam?.id) return { inventories: [] };
      const response = await fetch(`/api/team/${selectedTeam.id}/inventory`);
      if (!response.ok) throw new Error("Failed to fetch team inventory");
      return response.json();
    },
    enabled: status === "authenticated" && !!selectedTeam?.id && inventoryView === "team",
  });

  const myInventories = inventoryResponse?.inventories || [];
  const teamInventories = teamInventoryData?.inventories || [];
  const inventories = inventoryView === "my" ? myInventories : teamInventories;

  /* 🛑 §loading-empty-state (호영님 착수 2026-09-14 · 릴레이 prod 측정) · **데이터가 도착하기 전에는 안전 판정을 그리지 않는다.**
   *   옛 판본은 목록 API 응답 전 몇 초 동안 KPI 가 「전체 품목 0종 · 안전재고 미달 0건 · ✓ 정상」 을 그렸다.
   *   prod 에는 안전재고 10 대비 1개인 품목(BCP)이 있었다 · **부족을 정상으로 표시한 화면**이었다.
   *   `isLoading` 으로는 못 막는다 · React Query v5 는 세션 로딩 중(enabled:false) 쿼리의 isLoading 을 false 로 준다.
   *   그래서 기준은 "응답이 도착했는가"(data !== undefined) · 레퍼런스는 dashboard/receiving/page.tsx:234
   *   (불러오는 중 → 오류 → 0건 순서). 팀 뷰에서 팀이 없으면 불러올 것이 없으므로 도착으로 본다. */
  const inventoriesError = inventoryView === "my" ? inventoryIsError : teamInventoryIsError;
  const inventoriesArrived =
    inventoryView === "my" ? inventoryResponse !== undefined : !selectedTeam?.id || teamInventoryData !== undefined;
  const kpiPending = !inventoriesArrived;

  // 리드 타임 기반 재주문 필요: current_stock <= average_daily_usage * lead_time_days
  // §stock-risk-consolidation P3 — 재주문 필요 판정 = canonical isReorderNeeded(공유 lib). 각자 계산 제거(drift 0).
  const lowStockItems = inventories.filter((inv) => isReorderNeeded(inv));

  // §11.317 / §inventory-delta-label-kpi P4 — 헤더 KPI 3 source (전체 품목 / 만료 임박 / 안전재고 미달).
  //   canonical truth: inventories (mutation 0, derived projection 만).
  //   격리 Lot KPI 제거(핸드오프 §3 — 격리 범위 제외 확정).
  const headerKpiTotalItems = inventories.length;
  const headerKpiLowStock = lowStockItems.length;
  const headerKpiExpiringSoon = inventories.filter((inv) => {
    if (!inv.expiryDate || inv.currentQuantity <= 0) return false;
    const diffDays = (new Date(inv.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  // Canonical truth only — mock fallback removed per #P02 (ADR-002 canvas).
  // Empty inventory renders empty state CTA → real /api/inventory POST dialog.
  const displayInventories = useMemo(() => {
    if (!isBrowserPilotInventoryDisposal) return inventories;

    const hasExpiredAction = inventories.some((inv: ProductInventory) => {
      if (!inv.expiryDate || inv.currentQuantity <= 0) return false;
      return new Date(inv.expiryDate).getTime() < Date.now();
    });
    if (hasExpiredAction) return inventories;

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 2);

    const pilotInventory: ProductInventory = {
      id: "pilot-expired-lot",
      productId: "pilot-expired-product",
      currentQuantity: 2,
      unit: "ea",
      safetyStock: 5,
      minOrderQty: 1,
      location: "냉동고 1칸",
      expiryDate: expiredDate.toISOString(),
      notes: "Browser pilot fixture: expired lot disposal action.",
      lotNumber: "PILOT-EXP-001",
      storageCondition: "-20C",
      hazard: false,
      vendor: "LabAxis Pilot Vendor",
      deliveryPeriod: "3일",
      inUseOrUnopened: "unopened",
      averageExpiry: null,
      autoReorderEnabled: false,
      autoReorderThreshold: 0,
      averageDailyUsage: 1,
      leadTimeDays: 7,
      product: {
        id: "pilot-expired-product",
        name: "Pilot Expired PBS Buffer",
        brand: "LabAxis Pilot",
        catalogNumber: "PILOT-PBS-500ML",
      },
    };

    return [pilotInventory, ...inventories];
  }, [inventories, isBrowserPilotInventoryDisposal]);
  const incomingItems = displayInventories.filter((inv) => {
    // 입고 예정 로직 (간단한 예시)
    return inv.currentQuantity <= (inv.safetyStock || 0) * 0.5;
  });

  // 재입고 요청 상태 조회 (각 인벤토리별)

  // 재구매 추천 목록 조회 (인벤토리 하이라이트용)
  // §inventory-mobile-reorder-gate P2 — isLoading 노출: 모바일 상세 시트 CTA 로딩 상태(침묵 no-op 방지).
  const { data: reorderRecommendationsData, isLoading: reorderRecoLoading } = useQuery<{
    // §inventory-panel-unify P2 — recommendedQty 보강(/api/inventory/reorder-recommendations 반환). optional → 없으면 패널 섹션 미표시(가짜 0).
    recommendations: Array<{ inventoryId: string; recommendedQty?: number; blocked?: boolean; blockReasons?: string[]; recommendationBreakdown?: { safetyGap: number; leadTimeConsumption: number; rawQuantity: number; minOrderQty: number } }>;
  }>({
    queryKey: ["reorder-recommendations-for-highlight"],
    queryFn: async () => {
      const response = await fetch("/api/inventory/reorder-recommendations");
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json();
    },
    enabled: status === "authenticated" && inventoryView === "my",
  });

  const recommendedInventoryIds = new Set(reorderRecommendationsData?.recommendations?.map((r) => r.inventoryId) || []);

  // 팀 멤버 조회 (필터용)
  const { data: membersData } = useQuery({
    queryKey: ["team-members", selectedTeam?.id],
    queryFn: async () => {
      if (!selectedTeam?.id) return { members: [] };
      const response = await fetch(`/api/team/${selectedTeam.id}/members`);
      if (!response.ok) return { members: [] };
      return response.json();
    },
    enabled: status === "authenticated" && !!selectedTeam?.id && inventoryView === "team",
  });

  // 재입고 요청 mutation

  const disposeLotMutation = useMutation({
    mutationFn: async ({
      inventory,
      params,
    }: {
      inventory: ProductInventory;
      params: {
        lotNumber: string;
        quantity: number;
        reason: DisposalReason;
        reasonDetail?: string;
        quarantine: boolean;
      };
    }) => {
      const nextQuantity = Math.max(inventory.currentQuantity - params.quantity, 0);
      const reasonLabelMap: Record<DisposalReason, string> = {
        expiry: "유효기간 만료",
        contamination: "오염/변질",
        damage: "파손",
        other: "기타",
      };
      const disposalNote = [`[LOT 폐기 ${format(new Date(), "yyyy.MM.dd", { locale: ko })}]`, `lot=${params.lotNumber}`, `qty=${params.quantity}${inventory.unit || ""}`, `reason=${reasonLabelMap[params.reason]}`, params.reasonDetail ? `detail=${params.reasonDetail}` : null, params.quarantine ? "quarantine=true" : null].filter(Boolean).join(" ");

      const response = await csrfFetch(`/api/inventory/${inventory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: nextQuantity,
          notes: [inventory.notes, disposalNote].filter(Boolean).join("\n"),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "폐기 처리에 실패했습니다.");
      }

      return response.json();
    },
    onSuccess: (_result, variables) => {
      const remainingQuantity = Math.max(variables.inventory.currentQuantity - variables.params.quantity, 0);
      setDisposalCompletionSummary({
        lotNumber: variables.params.lotNumber,
        quantity: variables.params.quantity,
        reason: variables.params.reason,
        remainingQuantity,
        reorderReviewRequired:
          variables.inventory.safetyStock != null
            ? remainingQuantity <= variables.inventory.safetyStock
            : false,
      });
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["reorder-recommendations"] });
      queryClient.invalidateQueries({
        queryKey: ["reorder-recommendations-for-highlight"],
      });
      toast({
        title: variables.params.quarantine ? "격리 후 폐기 처리 완료" : "폐기 처리 완료",
        description: `${variables.inventory.product.name} · Lot ${variables.params.lotNumber} 폐기 처리가 반영되었습니다.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "폐기 처리 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 재고 사용 이력 조회
  const { data: usageData, isLoading: usageLoading } = useQuery<{
    records: Array<{
      id: string;
      quantity: number;
      unit: string | null;
      usageDate: string;
      notes: string | null;
      // #inventory-lot-overlay P5 — usage route 가 include 로 이미 반환(스키마 존재). per-lot use 타임라인 소스.
      //   lotNumber=null(과거 레코드)은 특정 lot 미귀속 → item 스코프로만 처리.
      lotNumber: string | null;
      type: string | null;
      inventory: {
        id: string;
        product: {
          id: string;
          name: string;
          brand: string | null;
          catalogNumber: string | null;
        };
      };
      user: {
        id: string;
        name: string | null;
        email: string;
      };
    }>;
    stats: {
      totalUsage: number;
      recordCount: number;
      uniqueProducts: number;
      dateRange: { start: string; end: string } | null;
    };
  }>({
    queryKey: ["inventory-usage"],
    queryFn: async () => {
      const response = await fetch("/api/inventory/usage?limit=100");
      if (!response.ok) throw new Error("Failed to fetch usage history");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const usageRecords = usageData?.records || [];
  const usageStats = usageData?.stats;

  // #inventory-lot-overlay P5 — lot view 계산(탭·overlay 공유). 실 InventoryRestock/InventoryUsage 기반.
  //   (A) 표시=입고량·입고일·유효기간, lot별 잔량 미표기. 소진은 타임라인 use 이벤트로만.
  const lotView = useMemo(() => {
    const now = new Date();
    const usageByItem = new Map<string, Array<{ usageDate: string; lotNumber: string | null }>>();
    for (const u of usageRecords) {
      const arr = usageByItem.get(u.inventory.id) ?? [];
      arr.push({ usageDate: u.usageDate, lotNumber: u.lotNumber ?? null });
      usageByItem.set(u.inventory.id, arr);
    }
    const latestLotUsage = (itemId: string, lotCode: string | null): string | null => {
      if (lotCode == null) return null;
      const arr = usageByItem.get(itemId);
      if (!arr?.length) return null;
      const matching = arr.filter((x) => x.lotNumber === lotCode);
      if (!matching.length) return null;
      return matching.reduce((max, x) => (x.usageDate > max ? x.usageDate : max), matching[0].usageDate);
    };
    const allLots: LotRecord[] = displayInventories.flatMap((inv: ProductInventory) => {
      const restocks = inv.restockRecords ?? [];
      if (restocks.length > 0) {
        return restocks.map((r) => {
          const lotCode = r.lotNumber || "미지정";
          const expiresAt = r.expiryDate ?? inv.expiryDate;
          const lastUse = latestLotUsage(inv.id, r.lotNumber ?? null);
          return {
            lotId: r.id,
            itemId: inv.id,
            lotCode,
            productName: inv.product.name,
            brand: inv.product.brand,
            catalogNumber: inv.product.catalogNumber,
            qtyOnHand: r.quantity,
            receivedQty: r.quantity,
            unit: inv.unit,
            location: inv.location,
            receivedAt: r.restockedAt,
            expiresAt,
            status: computeLotStatus(r.quantity, expiresAt, now),
            sourceDocumentId: r.id,
            lastEventAt: lastUse && lastUse > r.restockedAt ? lastUse : r.restockedAt,
            storageCondition: inv.storageCondition,
          } as LotRecord;
        });
      }
      if (inv.lotNumber) {
        const lastUse = latestLotUsage(inv.id, inv.lotNumber);
        return [{
          lotId: `${inv.id}-${inv.lotNumber}`,
          itemId: inv.id,
          lotCode: inv.lotNumber,
          productName: inv.product.name,
          brand: inv.product.brand,
          catalogNumber: inv.product.catalogNumber,
          qtyOnHand: inv.currentQuantity,
          receivedQty: null,
          unit: inv.unit,
          location: inv.location,
          receivedAt: "",
          expiresAt: inv.expiryDate,
          status: computeLotStatus(inv.currentQuantity, inv.expiryDate, now),
          sourceDocumentId: null,
          lastEventAt: lastUse ?? "",
          storageCondition: inv.storageCondition,
        } as LotRecord];
      }
      return [];
    });
    // 안전장치(호영님 2026-07-10) — 현재고 있으나 입고 lot·lotNumber 모두 없어 Lot 추적 미노출되는 레거시 품목 수.
    //   "데이터 누락" 오인 방지용 정직 안내.
    const uncoveredCount = displayInventories.filter(
      (inv) => (inv.restockRecords ?? []).length === 0 && !inv.lotNumber && inv.currentQuantity > 0
    ).length;
    return { allLots, summary: computeLotSummary(allLots), sorted: sortLots(allLots), uncoveredCount };
  }, [displayInventories, usageRecords]);

  // #inventory-lot-overlay P5 — 선택 lot 의 실 이벤트 타임라인.
  //   receive = InventoryRestock(restockedAt). use = InventoryUsage(lotNumber 정확 귀속분만).
  //   usage.lotNumber=null(과거) 은 특정 lot 미귀속 → 여기 미포함(overlay 에서 item 스코프로 별도 안내).
  const buildLotTimeline = (lot: LotRecord | null): LotEvent[] => {
    if (!lot) return [];
    const inv = displayInventories.find((i) => i.id === lot.itemId);
    const events: LotEvent[] = [];
    for (const r of inv?.restockRecords ?? []) {
      const code = r.lotNumber || "미지정";
      if (code !== lot.lotCode) continue;
      events.push({
        id: `receive-${r.id}`,
        lotId: lot.lotId,
        type: "receive",
        quantity: r.quantity,
        delta: r.quantity,
        operator: null,
        note: null,
        timestamp: r.restockedAt,
      });
    }
    for (const u of usageRecords) {
      if (u.inventory.id !== lot.itemId) continue;
      if ((u.lotNumber ?? null) !== lot.lotCode) continue; // 정확 귀속만
      events.push({
        id: `use-${u.id}`,
        lotId: lot.lotId,
        type: "use",
        quantity: u.quantity,
        delta: -u.quantity,
        operator: u.user?.name ?? u.user?.email ?? null,
        note: u.notes ?? null,
        timestamp: u.usageDate,
      });
    }
    return events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  };

  // 선택된 재고의 입고 이력 조회
  const { data: restockHistoryData, isLoading: isLoadingRestockHistory } = useQuery<{ records: any[] }>({
    queryKey: ["inventory-restock-history", selectedItem?.id],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/${selectedItem!.id}/restock?limit=20`);
      if (!response.ok) throw new Error("Failed to fetch restock history");
      return response.json();
    },
    enabled: !!selectedItem?.id && isSheetOpen && showRestockHistory,
  });

  const createOrUpdateMutation = useMutation({
    mutationFn: async (formPayload: { id?: string; productId: string; currentQuantity: number; unit: string; safetyStock?: number; minOrderQty?: number; location?: string; expiryDate?: string; autoReorderEnabled?: boolean; autoReorderThreshold?: number; notes?: string; lotNumber?: string; storageCondition?: string; trackingMode?: string; catalogNumber?: string | null }) => {
      const isEdit = Boolean(formPayload.id);

      const url = isEdit ? `/api/inventory/${formPayload.id}` : "/api/inventory";
      // §inventory-notes-erase P1-b — 편집 본문 조립도 lib 한 곳(buildInventoryPatchBody).
      const body = isEdit ? buildInventoryPatchBody(formPayload) : formPayload;

      const response = await csrfFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const e = errData as { error?: string; code?: string; detail?: string; hint?: string; action?: { label: string; href: string } };
        // §inventory-org-required — 422 NO_ORGANIZATION 은 갈 길(action)을 함께 싣는다. 잃지 않고 넘긴다.
        throw Object.assign(new Error(e.error || "저장에 실패했습니다."), { code: e.code, action: e.action, detail: e.detail, hint: e.hint });
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      const isEdit = Boolean(variables.id);
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      queryClient.invalidateQueries({ queryKey: ["reorder-recommendations"] });
      setIsDialogOpen(false);
      setEditingInventory(null);
      router.refresh();
      toast({
        title: isEdit ? "재고가 수정되었습니다." : "재고가 등록되었습니다.",
      });
    },
    onError: (error: Error) => {
      // §inventory-org-required — 조직이 없어 막힌 경우 막다른 길로 끝내지 않는다: 조직 화면으로 가는 버튼.
      const org = error as Error & { action?: { label: string; href: string }; detail?: string; hint?: string };
      const next = org.action;
      toast({
        // 조직 없음(422)은 서버가 준 제목 · 본문 + 초대 안내 문장 · 버튼은 「조직 만들기」 하나(호영님 2026-09-11).
        title: next ? error.message : "저장 실패",
        description: next
          ? [org.detail, org.hint].filter(Boolean).join(" ")
          : error.message || "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
        ...(next
          ? { action: <ToastAction altText={next.label} onClick={() => router.push(next.href)}>{next.label}</ToastAction> }
          : {}),
      });
    },
  });

  const recordUsageMutation = useMutation({
    mutationFn: async (usagePayload: { inventoryId: string; quantity: number; unit?: string; notes?: string; trackingMode?: string | null; lotNumber?: string; operator?: string; destination?: string }) => {
      // §inventory-phaseB P3-UI-a3 — 추적 품목(LOT/GMP_STRICT)은 lot/operator/destination 지원하는
      //   canonical [id]/use 로 라우팅(legacy /usage 는 P3-server에서 비-QUANTITY 422 차단). QUANTITY는 기존 legacy.
      const tracked = !!usagePayload.trackingMode && usagePayload.trackingMode !== "QUANTITY";
      const url = tracked ? `/api/inventory/${usagePayload.inventoryId}/use` : "/api/inventory/usage";
      const body = tracked
        ? { quantity: usagePayload.quantity, unit: usagePayload.unit, notes: usagePayload.notes, lotNumber: usagePayload.lotNumber, destination: usagePayload.destination, operator: usagePayload.operator }
        : { inventoryId: usagePayload.inventoryId, quantity: usagePayload.quantity, unit: usagePayload.unit, notes: usagePayload.notes };
      const response = await csrfFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to record usage");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      queryClient.invalidateQueries({ queryKey: ["reorder-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-usage"] });
    },
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await csrfFetch(`/api/inventory/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete inventory");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      toast({
        title: "삭제 완료",
        description: "재고가 삭제되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 입고 mutation (POST /api/inventory/[id]/restock — 트랜잭션 기반 이력 기록)
  const restockMutation = useMutation({
    mutationFn: async ({ id, addQty, lotNumber, expiryDate }: { id: string; addQty: number; lotNumber?: string; expiryDate?: string }) => {
      const response = await csrfFetch(`/api/inventory/${id}/restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: addQty,
          ...(lotNumber ? { lotNumber } : {}),
          ...(expiryDate ? { expiryDate } : {}),
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "입고에 실패했습니다.");
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      // 입고 완료된 아이템 정보 보존 → "라벨 바로 인쇄" CTA용
      if (restockItem) {
        setRestockDoneItem(restockItem);
      }
      setRestockItem(null);
      setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" });
      toast({
        title: "입고 완료",
        description: "재고 수량이 업데이트되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "입고 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 필터링된 인벤토리 (디바운스된 검색어 + 기타 필터)
  const filteredInventories = displayInventories.filter((inv) => {
    // 검색 필터: 품목명, 제조사, 카탈로그 번호, Lot, 공급사
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      const name = (inv.product?.name ?? "").toLowerCase();
      const brand = (inv.product?.brand ?? "").toLowerCase();
      const catNo = (inv.product?.catalogNumber ?? "").toLowerCase();
      const lot = (inv.lotNumber ?? "").toLowerCase();
      const vendor = (inv.vendor ?? "").toLowerCase();
      const matchesSearch = name.includes(query) || brand.includes(query) || catNo.includes(query) || lot.includes(query) || vendor.includes(query);
      if (!matchesSearch) return false;
    }

    // 위치 필터
    if (locationFilter !== "all") {
      if (locationFilter === "none" && inv.location) return false;
      if (locationFilter !== "none" && inv.location !== locationFilter) return false;
    }

    // 상태 필터 (리드 타임 기반 재주문 필요 포함 + 처리형 필터)
    if (statusFilter !== "all") {
      const isLow = inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock;
      const isOut = inv.currentQuantity === 0;
      const byLeadTime = isReorderNeededByLeadTime(inv);
      const needsAttention = isLow || isOut || byLeadTime;

      if (statusFilter === "low" && !needsAttention) return false;
      if (statusFilter === "normal" && needsAttention) return false;
      if (statusFilter === "expiring") {
        if (!inv.expiryDate) return false;
        const daysLeft = Math.ceil((new Date(inv.expiryDate).getTime() - Date.now()) / 86400000);
        if (daysLeft > 30) return false;
      }
      if (statusFilter === "incoming") {
        // 입고 대기: 안전재고 50% 이하 (발주 진행 추정)
        if (inv.currentQuantity > (inv.safetyStock || 0) * 0.5) return false;
      }
      if (statusFilter === "lot_issue") {
        // Lot 불일치: lot 번호 미등록 또는 보관 조건 미매칭
        /* 🛑 §inventory-edit-blank-fields (2026-09-12 실측) — 뒤쪽 절은 **죽은 분기**다.
         *   inv.storageCondition 은 ProductInventory 에 열이 없어 항상 undefined 이고,
         *   GET /api/inventory 도 product.storageCondition 을 평탄화하지 않는다.
         *   즉 실제 판정은 `!inv.lotNumber` 하나뿐이다. 의도(냉동 보관인데 위치 미지정)는
         *   살아 있으므로 지우지 않고 표기한다 — 되살리려면 읽기 배선이 먼저다(별건). */
        const hasLotIssue = !inv.lotNumber || (inv.storageCondition && inv.storageCondition.includes("freezer") && !inv.location);
        if (!hasLotIssue) return false;
      }
      if (statusFilter === "recent") {
        // 최근 변경은 모든 항목 포함 (실제로는 updatedAt 기반으로 필터)
        // Mock에서는 모든 항목 통과
      }
    }

    // §11.326 Phase 4 — 의심 데이터 검토 필터(라운드 숫자 입고 수량).
    if (suspectFilterActive && !isSuspectReceivedQuantity(inv.currentQuantity)) return false;

    return true;
  });

  // §11.326 Phase 4 — 의심 입고 건수(currentQuantity 라운드 숫자). 0 이면 배너/칩 미노출.
  const suspectCount = countSuspectInventories(inventories);

  // 고유 위치 목록 추출
  const uniqueLocations = Array.from(new Set(displayInventories.map((inv) => inv.location).filter(Boolean))) as string[];

  // §global-filters P3-a2 (§11.297f 진화) — 데스크톱 인라인 필터 바 정의(위치/상태, 옵션·값 = 기존
  //   드롭다운 패널 내장 Select 와 1:1). 단일선택·데스크톱 인라인 → mode "dropdown". 필터 상태는 화면 소유.
  const inventoryDesktopFilters: FilterDef[] = [
    {
      key: "location",
      label: "위치",
      mode: "dropdown",
      options: [
        { value: "all", label: "전체 위치" },
        { value: "none", label: "위치 미지정" },
        ...uniqueLocations.map((loc) => ({ value: loc, label: loc })),
      ],
    },
    {
      key: "status",
      label: "상태",
      mode: "dropdown",
      options: [
        { value: "all", label: "전체 상태" },
        { value: "low", label: "부족 / 재주문" },
        { value: "expiring", label: "만료 임박" },
        { value: "incoming", label: "입고 대기" },
        { value: "lot_issue", label: "LOT 이슈" },
        { value: "recent", label: "최근 변경" },
        { value: "normal", label: "정상" },
      ],
    },
  ];

  // 상단 KPI 카드용 요약 지표 (리드 타임 기반 재주문 포함).
  // §11.302d-5 — totalInventoryCount 제거 (요약 칩 "전체 재고" §11.302c
  //   정합 제거 후 orphan cleanup).
  const lowOrOutOfStockCount = displayInventories.filter((inv) => {
    const isOut = inv.currentQuantity === 0;
    const isLow = inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock;
    const byLeadTime = isReorderNeededByLeadTime(inv);
    return isOut || isLow || byLeadTime;
  }).length;
  const now = new Date();
  const expiringSoonCount = displayInventories.filter((inv) => {
    if (!inv.expiryDate) return false;
    const expiry = new Date(inv.expiryDate);
    if (isNaN(expiry.getTime())) return false;
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  }).length;
  const actionableExpiredLots = useMemo(
    () =>
      displayInventories
        .filter((inv) => {
          if (!inv.expiryDate) return false;
          const expiry = new Date(inv.expiryDate);
          if (isNaN(expiry.getTime())) return false;
          return expiry.getTime() < now.getTime() && inv.currentQuantity > 0;
        })
        .sort((a, b) => {
          const expiryDiff = new Date(a.expiryDate || 0).getTime() - new Date(b.expiryDate || 0).getTime();
          if (expiryDiff !== 0) return expiryDiff;
          return b.currentQuantity - a.currentQuantity;
        }),
    [displayInventories, now],
  );
  const priorityExpiredLot = actionableExpiredLots[0] ?? null;
  const actionableExpiredQuantity = actionableExpiredLots.reduce((sum, inv) => sum + inv.currentQuantity, 0);

  const buildDisposalTarget = (inventory: ProductInventory): import("@/components/inventory/lot-disposal-panel").DisposalTarget => {
    const siblings = displayInventories.filter((inv) => inv.productId === inventory.productId);
    const totalItemQuantity = siblings.reduce((sum, inv) => sum + inv.currentQuantity, 0);

    return {
      productName: inventory.product.name,
      brand: inventory.product.brand || undefined,
      catalogNumber: inventory.product.catalogNumber || undefined,
      unit: inventory.unit || undefined,
      lotNumber: inventory.lotNumber || "N/A",
      lotQuantity: inventory.currentQuantity,
      expiryDate: inventory.expiryDate || new Date().toISOString(),
      location: inventory.location || undefined,
      isHazardous: inventory.hazard || false,
      hasMsds: undefined,
      requiresIsolation: undefined,
      totalItemQuantity,
      safetyStock: inventory.safetyStock || undefined,
      averageDailyUsage: inventory.averageDailyUsage || undefined,
    };
  };

  const openDisposalDock = (inventory: ProductInventory) => {
    setDisposalInventoryId(inventory.id);
    setDisposalTarget(buildDisposalTarget(inventory));
    setDisposalCompletionSummary(null);
  };

  const priorityQueueItems = useMemo<QueueItem[]>(() => {
    const expiredItems = actionableExpiredLots.map((inventory) => {
      const resolution = resolveDisposal({
        productName: inventory.product.name,
        brand: inventory.product.brand || undefined,
        catalogNumber: inventory.product.catalogNumber || undefined,
        unit: inventory.unit || undefined,
        lotNumber: inventory.lotNumber || "N/A",
        lotQuantity: inventory.currentQuantity,
        expiryDate: inventory.expiryDate || new Date().toISOString(),
        location: inventory.location || undefined,
        isHazardous: inventory.hazard || false,
        hasMsds: undefined,
        requiresIsolation: undefined,
        totalItemQuantity: displayInventories.filter((inv) => inv.productId === inventory.productId).reduce((sum, inv) => sum + inv.currentQuantity, 0),
        safetyStock: inventory.safetyStock || undefined,
        averageDailyUsage: inventory.averageDailyUsage || undefined,
      });

      return {
        id: `dispose-${inventory.id}`,
        productName: inventory.product.name,
        lotNumber: inventory.lotNumber || undefined,
        risk: "critical" as const,
        category: "disposal_review" as const,
        reason: `만료 · 잔량 ${inventory.currentQuantity}${inventory.unit}`,
        rationale: resolution.description,
        recommendedAction: resolution.title,
        actionLabel: "폐기 처리",
        meta: {
          actionType: "dispose_lot",
          inventoryId: inventory.id,
        },
      };
    });

    const reorderItems = displayInventories
      .filter((inventory) => recommendedInventoryIds.has(inventory.id) && !actionableExpiredLots.some((expired) => expired.id === inventory.id))
      .slice(0, 6)
      .map((inventory) => ({
        id: `reorder-${inventory.id}`,
        productName: inventory.product.name,
        lotNumber: inventory.lotNumber || undefined,
        risk: "high" as const,
        category: "reorder_priority" as const,
        reason: `재고 ${inventory.currentQuantity}${inventory.unit} · 안전재고 ${inventory.safetyStock ?? "-"}`,
        rationale: "만료 lot 폐기 처리가 없는 품목 중 재주문 검토가 필요한 항목입니다.",
        recommendedAction: "재주문 검토",
        actionLabel: "재주문 검토",
        meta: {
          actionType: "review_reorder",
          inventoryId: inventory.id,
        },
      }));

    return [...expiredItems, ...reorderItems];
  }, [actionableExpiredLots, displayInventories, recommendedInventoryIds]);
  const topPriorityQueueItem = priorityQueueItems[0] ?? null;
  const lotIssueHoldCount = priorityQueueItems.filter((item) => item.risk !== "critical").length;
  const lotIssueImmediateCount = priorityQueueItems.filter((item) => item.risk === "critical").length;
  const lotIssueDisposalReviewCount = actionableExpiredLots.length;
  const lotIssueReorderReviewCount = priorityQueueItems.filter((item) => item.category === "reorder_priority").length;
  const lotIssueApprovalPendingCount = lotIssueDisposalReviewCount > 0 ? 1 : 0;
  const lotIssueExecutableCount = priorityExpiredLot || topPriorityQueueItem ? 1 : 0;
  const showLotIssueDecisionStrip = isBrowserPilotInventoryDisposal || statusFilter === "lot_issue" || activeInventoryTab === "overview";

  // 점검 사항 탭용 이슈 카운트 (부족, 품절, 폐기 임박, 재주문 권장, 위치 미지정)
  const issuesCount = displayInventories.filter((inv) => {
    const isOut = inv.currentQuantity === 0;
    const isLow = inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock;
    const byLeadTime = isReorderNeededByLeadTime(inv);
    const isExpiring =
      inv.expiryDate &&
      (() => {
        const d = new Date(inv.expiryDate);
        const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 30;
      })();
    const noLocation = !inv.location;
    return isOut || isLow || byLeadTime || isExpiring || noLocation;
  }).length;

  /** 이슈 유형 분류 */
  type IssueType = "out_of_stock" | "low_stock" | "reorder_lead" | "expiring" | "expired" | "no_location";
  const classifyIssue = (inv: ProductInventory): IssueType => {
    if (inv.currentQuantity === 0) return "out_of_stock";
    // 유효기간 만료/임박 체크 (부족보다 시급도 높을 수 있음)
    if (inv.expiryDate) {
      const d = new Date(inv.expiryDate);
      const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 0) return "expired";
      if (days <= 30) return "expiring";
    }
    if (inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock) return "low_stock";
    if (isReorderNeededByLeadTime(inv)) return "reorder_lead";
    if (!inv.location) return "no_location";
    return "low_stock"; // fallback
  };
  // §11.302d-3a — ISSUE_CONFIG Badge cls 신호등 정합:
  //   expired / out_of_stock → 위험 (bg-red-600 text-white, Badge 작아서 가독성 OK)
  //   expiring → 검토 (bg-yellow-100 text-yellow-700, 이전 yellow-500/10 정합 강화)
  //   low_stock / reorder_lead → 긴급 (bg-red-100 text-red-700,
  //     이전 yellow / blue 잘못 정정)
  //   no_location → utility 보존
  const ISSUE_CONFIG: Record<IssueType, { label: string; cls: string; priority: number }> = {
    expired: {
      label: "만료됨",
      cls: "bg-red-600 text-white",
      priority: 0,
    },
    out_of_stock: {
      label: "품절",
      cls: "bg-red-600 text-white",
      priority: 1,
    },
    expiring: {
      label: "만료 임박",
      cls: "bg-yellow-100 text-yellow-700",
      priority: 2,
    },
    low_stock: {
      label: "부족",
      cls: "bg-red-100 text-red-700",
      priority: 3,
    },
    reorder_lead: {
      label: "재발주 필요",
      cls: "bg-red-100 text-red-700",
      priority: 4,
    },
    no_location: {
      label: "위치 미지정",
      cls: "bg-el text-slate-400",
      priority: 5,
    },
  };

  const handlePriorityQueueAction = (queueItem: QueueItem) => {
    const inventoryId = queueItem.meta?.inventoryId;
    const match = inventoryId ? displayInventories.find((inv) => inv.id === inventoryId) : displayInventories.find((inv) => inv.product.name === queueItem.productName);

    if (!match) {
      toast({
        title: "대상 항목을 찾을 수 없습니다",
        description: "우선 처리 대상 재고를 다시 불러온 뒤 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (queueItem.meta?.actionType === "dispose_lot") {
      openDisposalDock(match);
      return;
    }

    openReorderReview(match);
  };

  const handleLotIssueDecisionAction = () => {
    setActiveInventoryTab("overview");

    if (priorityExpiredLot) {
      openDisposalDock(priorityExpiredLot);
      toast({
        title: "lot_issue 검토 시작",
        description: `${priorityExpiredLot.product.name} · ${priorityExpiredLot.lotNumber || "Lot 미지정"} 폐기 확인을 열었습니다.`,
      });
      return;
    }

    if (topPriorityQueueItem) {
      handlePriorityQueueAction(topPriorityQueueItem);
      toast({
        title: "운영 현황 검토 시작",
        description: `${topPriorityQueueItem.productName} 다음 조치를 열었습니다.`,
      });
    }
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 프로덕션 환경에서는 인증 체크 필수
  if (process.env.NODE_ENV === "production" && status === "unauthenticated" && !isBrowserPilotInventoryDisposal) {
    router.push("/auth/signin?callbackUrl=/dashboard/inventory");
    return null;
  }

  // ── 라벨 인쇄 공통 유틸 ──
  const getLabelStyles = (mode: "a4-multi" | "single") => {
    const isA4 = mode === "a4-multi";
    return `
    @page { ${isA4 ? "size: A4; margin: 8mm;" : "size: 60mm 40mm; margin: 0mm;"} }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    .label-grid {
      ${isA4 ? "display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; width: 100%;" : ""}
    }
    .label-container {
      width: 60mm; height: ${isA4 ? "38mm" : "40mm"}; overflow: hidden;
      display: flex; flex-direction: row; align-items: center;
      padding: 3mm 3.5mm; gap: 3mm;
      ${isA4 ? "page-break-inside: avoid;" : "page-break-after: always;"}
    }
    .qr-col { flex-shrink: 0; }
    .qr-col img { width: 29mm; height: 29mm; display: block; }
    .info-col { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
    .prod-name {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 7.5pt; font-weight: 700; color: #0f172a; line-height: 1.3;
      word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 1.2mm;
    }
    .meta-row {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 6pt; color: #475569; margin-top: 0.6mm;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .inv-id {
      font-family: 'Courier New', monospace; font-size: 5pt; color: #94a3b8;
      margin-top: 1.5mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    @media screen {
      html, body { background: #f1f5f9; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 16px; padding: 24px; font-family: 'Malgun Gothic','Apple SD Gothic Neo',sans-serif; }
      .screen-hint { font-size: 13px; color: #64748b; text-align: center; line-height: 1.6; }
      ${
        isA4
          ? `.label-grid { max-width: 210mm; margin: 0 auto; padding: 8mm; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      .label-container { border: 1px dashed #e2e8f0; border-radius: 4px; }`
          : `.label-container { background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 8px; }`
      }
      .btn-row { display: flex; gap: 10px; margin-top: 12px; }
      .btn-print { padding: 10px 28px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
      .btn-print:hover { background: #1d4ed8; }
      .btn-close { padding: 10px 20px; background: transparent; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; cursor: pointer; }
    }
    @media print {
      .screen-hint, .btn-row { display: none !important; }
      html, body { margin: 0 !important; padding: 0 !important; background: transparent !important; }
      .label-grid { max-width: none; padding: 0; border: none; box-shadow: none; }
      .label-container { background: #fff !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; }
    }`;
  };

  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const buildLabelHtml = (opts: { qrDataUrl: string; name: string; cat?: string | null; lot?: string | null; loc?: string | null; qty?: number; unitStr?: string | null; invId: string }) => `
    <div class="label-container">
      <div class="qr-col"><img src="${opts.qrDataUrl}" alt="QR" /></div>
      <div class="info-col">
        <div class="prod-name">${escHtml(opts.name)}</div>
        ${opts.cat ? `<div class="meta-row">Cat#: ${escHtml(opts.cat)}</div>` : ""}
        ${opts.lot ? `<div class="meta-row">Lot: ${escHtml(opts.lot)}</div>` : ""}
        ${opts.loc ? `<div class="meta-row">📍 ${escHtml(opts.loc)}</div>` : ""}
        ${opts.qty !== undefined ? `<div class="meta-row">재고: ${opts.qty}${opts.unitStr ? ` ${escHtml(opts.unitStr)}` : ""}</div>` : ""}
        <div class="inv-id">${escHtml(opts.invId.slice(0, 20))}…</div>
      </div>
    </div>`;

  /** 전체 재고 라벨 일괄 인쇄 */
  const handleBulkLabelPrint = async () => {
    const items = displayInventories;
    if (items.length === 0) {
      toast({ title: "인쇄할 재고가 없습니다.", variant: "destructive" });
      return;
    }
    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) {
      toast({
        title: "팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    const { default: QRCode } = await import("qrcode");
    const labels = await Promise.all(
      items.map(async (inv) => {
        const url = `${window.location.origin}/dashboard/inventory/scan?id=${inv.id}`;
        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, url, {
          width: 180,
          margin: 2,
          color: { dark: "#1e293b", light: "#ffffff" },
        });
        return buildLabelHtml({
          qrDataUrl: canvas.toDataURL("image/png"),
          name: inv.product.name,
          cat: inv.product.catalogNumber,
          lot: inv.lotNumber,
          loc: inv.location,
          qty: inv.currentQuantity,
          unitStr: inv.unit,
          invId: inv.id,
        });
      }),
    );
    const modeDesc = labelPrintMode === "a4-multi" ? "A4 멀티 라벨 (3×7)" : "개별 라벨 (60×40mm)";
    printWindow.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>라벨 일괄 인쇄</title><style>${getLabelStyles(labelPrintMode)}</style></head><body>
      <p class="screen-hint">📄 인쇄 미리보기 — <strong>${items.length}개 품목</strong> · ${modeDesc}</p>
      <div class="label-grid">${labels.join("\n")}</div>
      <div class="btn-row"><button class="btn-print" onclick="window.print()">🖨️ 전체 인쇄</button><button class="btn-close" onclick="window.close()">닫기</button></div>
    </body></html>`);
    printWindow.document.close();
  };

  /** 단일 품목 라벨 인쇄 */
  const handleSingleLabelPrint = async (inv: ProductInventory) => {
    const printWindow = window.open("", "_blank", "width=600,height=400");
    if (!printWindow) {
      toast({ title: "팝업이 차단되었습니다.", variant: "destructive" });
      return;
    }

    const { default: QRCode } = await import("qrcode");
    const url = `${window.location.origin}/dashboard/inventory/scan?id=${inv.id}`;
    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(canvas, url, {
      width: 180,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
    });
    const label = buildLabelHtml({
      qrDataUrl: canvas.toDataURL("image/png"),
      name: inv.product.name,
      cat: inv.product.catalogNumber,
      lot: inv.lotNumber,
      loc: inv.location,
      qty: inv.currentQuantity,
      unitStr: inv.unit,
      invId: inv.id,
    });
    printWindow.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>라벨 — ${escHtml(inv.product.name)}</title><style>${getLabelStyles(labelPrintMode)}</style></head><body>
      <p class="screen-hint">📄 인쇄 미리보기 — <strong>${escHtml(inv.product.name)}</strong></p>
      <div class="label-grid">${label}</div>
      <div class="btn-row"><button class="btn-print" onclick="window.print()">🖨️ 인쇄하기</button><button class="btn-close" onclick="window.close()">닫기</button></div>
    </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="w-full max-w-full min-h-screen bg-canvas px-3 sm:px-4 md:px-6 py-4 md:py-8 pb-20 lg:pb-8">
      {/* §11.326 Phase 4 — 의심 입고 데이터 검토 배너(의심 0건이면 미노출, 세션 dismiss).
          닫아도 아래 "검토 권장 N건" 칩으로 재진입 가능(dead-end 방지). */}
      {suspectCount > 0 && !suspectBannerDismissed && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-800">
              입고 등록 방식이 개선됐어요 — 검토 권장 {suspectCount}건
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">
              이전에는 라벨의 용량(예: 100 CAPSULES)이 입고 수량으로 등록되어 통 개수가 부풀려졌을 수 있습니다. 큰 라운드 숫자 입고 건을 확인해 주세요.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setSuspectFilterActive(true)}
                className="inline-flex items-center h-8 px-3 rounded-md bg-yellow-600 text-white text-xs font-semibold hover:bg-yellow-500 active:scale-95 transition-all"
              >
                재고 검토하기
              </button>
              <button
                type="button"
                onClick={() => setSuspectBannerDismissed(true)}
                className="inline-flex items-center h-8 px-3 rounded-md border border-yellow-300 bg-white text-yellow-700 text-xs font-medium hover:bg-yellow-50 active:scale-95 transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* §11.326 Phase 4 — 검토 필터 활성 시 해제 칩(현재 상태 가시화 + 재진입). */}
      {suspectFilterActive && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
          <span className="text-xs text-yellow-800">검토 권장 {suspectCount}건 필터 적용 중</span>
          <button
            type="button"
            onClick={() => setSuspectFilterActive(false)}
            className="ml-auto inline-flex items-center gap-1 text-xs text-yellow-700 hover:text-yellow-900"
          >
            <X className="h-3 w-3" /> 필터 해제
          </button>
        </div>
      )}
      {/* ── Mobile View (below md breakpoint) ── */}
      <div className="md:hidden">
        {/* §11.328 #inventory-mobile-header — 시안 §03 정합: 흰 헤더 + 제목 우측 액션 클러스터(재고등록/⋮) + 흰 KPI(숫자만 색·상태 도트). */}
        <div className="mb-5">
          <div className="flex items-start gap-2.5 mb-3.5">
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">재고 관리</h1>
              <p className="text-[12.5px] text-slate-500 mt-0.5">Lot 단위 추적 · QR 스캔 입·출고</p>
            </div>
            {/* §11.328 — 주 액션(등록)·오버플로를 헤더 제목 우측으로. 본문 부유 제거. */}
            <div className="flex items-center gap-2 flex-none">
              <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                재고 등록
              </Button>
              {/* §mobile-residual-5 1a — ⋮ 드롭다운(KPI 카드·배너와 경계 섞임) → scrim + 바텀 시트.
                  열림 중 ⋮ = 블루 보더 + #eff6ff. 항목 4개 = 기존 액션 wiring 그대로(라우팅·모달·인쇄). */}
              <button
                type="button"
                aria-label="재고 작업 메뉴"
                aria-haspopup="dialog"
                aria-expanded={invMobileSheetOpen}
                onClick={() => setInvMobileSheetOpen(true)}
                className={`inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors touch-manipulation ${
                  invMobileSheetOpen
                    ? "border-blue-600 bg-[#eff6ff] text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              <MobileActionSheet
                open={invMobileSheetOpen}
                onClose={() => setInvMobileSheetOpen(false)}
                title="재고 작업"
                items={[
                  { label: "입고 반영", description: "입고된 건을 재고로 가져오기", accent: true, icon: <PackagePlus />, onClick: () => router.push("/dashboard/receiving") },
                  { label: "재고 파일 가져오기", description: "엑셀·CSV 일괄 등록", icon: <Upload />, onClick: () => setIsImportWizardOpen(true) },
                  { label: "QR 스캔", description: "Lot 조회 · 입출고 처리", icon: <QrCode />, onClick: () => router.push("/dashboard/inventory/scan") },
                  { label: "라벨 인쇄", description: "Lot QR 라벨 출력", icon: <Printer />, onClick: () => handleBulkLabelPrint() },
                ]}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: "전체 품목", value: displayInventories.length, unit: "종", alert: false },
              { label: "안전재고 미달", value: displayInventories.filter((i) => i.currentQuantity === 0 || (i.safetyStock != null && i.currentQuantity <= i.safetyStock)).length, unit: "", alert: true },
              { label: "만료 임박", value: displayInventories.filter((i) => { if (!i.expiryDate) return false; const dd = Math.ceil((new Date(i.expiryDate).getTime() - Date.now()) / 86400000); return dd > 0 && dd <= 30; }).length, unit: "", alert: false },
            ].map((k) => (
              /* §reorder-quote-handoff 1a — KPI 3장 흰 카드 통일 (레드 보더 이중 강조 제거,
                 호영님 지시문 2026-08-05). 미달 신호 = 숫자 + 6px 점만.
                 §inventory-state-tone(2026-09-26) — 색은 lib/inventory/state-tone.ts 정본에서 온다(구 #b91c1c ≡ red-700).
                 강조는 아래 재발주 권장 배너 하나로 일원화.
                 ⚠️ 이 파일이 라이브 표면 (page.tsx → inventory-content). 같은 계약이
                 inventory-main.tsx(dead, importer 0)에도 있었으나 그 파일은
                 §inventory-dead-file-cleanup(2026-08-06)에서 삭제됨. */
              <div key={k.label} className="flex-1 rounded-[13px] px-3 py-2.5 border bg-white border-slate-200 shadow-sm">
                {kpiPending ? (
                  <p className="text-sm font-semibold text-slate-400" aria-busy={!inventoriesError}>{inventoriesError ? "불러오지 못함" : "불러오는 중"}</p>
                ) : (
                <p className={`text-xl font-extrabold ${k.alert && k.value > 0 ? inventoryToneClass("below_safety").text : "text-slate-900"}`}>{k.value}<span className="text-slate-400 text-xs font-semibold">{k.unit ? ` ${k.unit}` : ""}</span></p>
                )}
                <p className="text-[11px] mt-0.5 text-slate-500 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${k.alert && k.value > 0 ? inventoryToneClass("below_safety").dot : INVENTORY_TONE_CLASS.neutral.dot}`} aria-hidden />
                  {k.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <MobileInventoryView
          inventories={displayInventories}
          loading={!inventoriesArrived && !inventoriesError}
          searchQuery={searchQuery}
          reorderRecoLoading={reorderRecoLoading}
          onSearchChange={setSearchQuery}
          onReorder={(inventory) => {
            // §inventory-reorder-surface-unify P3 — 모바일 리스트 재발주 진입 = 통합 패널(reorder mode). AiAssistant 직접 오픈 retire.
            openReorderReview(inventory);
          }}
          onEdit={(inventory) => {
            setEditingInventory(inventory);
            setIsDialogOpen(true);
          }}
          onDelete={(inventory) => {
            if (confirm(`정말 ${inventory.product.name} 재고를 삭제하시겠습니까?`)) {
              deleteMutation.mutate(inventory.id);
            }
          }}
          onRestock={(inventory) => {
            setRestockItem(inventory);
            setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" });
          }}
        />
      </div>

      {/* ── Desktop View (md and above) ── */}
      <div className="hidden md:flex gap-0">
        {/* Main content area */}
        <div className={`flex-1 min-w-0 space-y-4 sm:space-y-6 transition-all ${contextPanelOpen ? "max-w-[calc(100%-420px)]" : "max-w-7xl mx-auto"}`}>
          {/* 상단 타이틀 및 액션 버튼 — 타이틀 좌측 / 버튼 우측 (스크린샷 레이아웃) */}
          <div className="flex items-start justify-between gap-4 mb-3 sm:mb-4">
            {/* §11.374 P3.4 — 인라인 h1 → AppPageHeader. 우측 모달 액션 클러스터는 형제로 보존. */}
            <AppPageHeader
              title="재고 관리"
              description="실험실 재고와 lot 상태를 관리합니다."
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              <AddInventoryModal
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) setEditingInventory(null);
                }}
                onSubmit={(submitValues) => {
                  createOrUpdateMutation.mutate({
                    ...submitValues,
                    id: editingInventory?.id,
                  });
                }}
                inventory={editingInventory}
                isLoading={createOrUpdateMutation.isPending}
              />
              <BulkImportModal
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["inventories"] });
                  queryClient.invalidateQueries({
                    queryKey: ["team-inventory"],
                  });
                }}
              />
              {/* §inventory-import-fake-success (2026-09-26 · 호영님 지시) — 같은 자리(모달)에 실배선 위저드를 올린다. 새 페이지를 만들지 않는다(same-canvas).
                  성공 화면은 위저드 안에서 **서버 ImportResult 를 받은 뒤에만** 그려진다. */}
              <Dialog open={isImportWizardOpen} onOpenChange={setIsImportWizardOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>재고 파일 가져오기</DialogTitle>
                    <DialogDescription>
                      엑셀·CSV 를 올리면 컬럼을 맞추고 등록합니다 · 등록 결과는 서버가 알려줍니다
                    </DialogDescription>
                  </DialogHeader>
                  <ImportWizard
                    onSuccess={() => {
                      setIsImportWizardOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["inventories"] });
                      queryClient.invalidateQueries({
                        queryKey: ["team-inventory"],
                      });
                    }}
                  />
                </DialogContent>
              </Dialog>
              <LabelScannerModal
                open={isSmartReceiveOpen}
                onOpenChange={setIsSmartReceiveOpen}
                onDirectReceive={async (data: SmartReceiveFormData) => {
                  // §11.371-3 — 영속화 단일점(submit-label-receive) 재사용. 토스트는
                  //   inventory 페이지 flavor(shadcn) 유지. front-only success 금지
                  //   (helper 가 /api/inventory 200 일 때만 ok).
                  const r = await submitLabelReceive(data, queryClient);
                  if (r.ok) {
                    toast({
                      title: "입고 완료",
                      description: `${r.productName} ${r.receivedQuantity}${r.receivedUnit} 입고 처리되었습니다.`,
                    });
                  } else {
                    toast({
                      title: "오류",
                      description: "입고 처리 중 오류가 발생했습니다.",
                      variant: "destructive",
                    });
                  }
                }}
              />

              {/* ── Primary CTAs: 품목 추가 + 스마트 재고 등록 (§11.315-b — 라벨 OCR 직접 등록, "스마트 입고"는 거래명세서/PO 입고용으로 분리) ── */}
              <Button onClick={() => setIsDialogOpen(true)} className="h-9 px-4 text-sm shadow-sm active:scale-95 transition-transform">
                <Plus className="h-4 w-4 mr-1.5" />
                품목 추가
              </Button>
              <Button onClick={() => setIsSmartReceiveOpen(true)} className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95 transition-transform">
                <Sparkles className="h-4 w-4 mr-1.5" />
                스마트 입고
              </Button>

              {/* §11.297d D2 utility-desktop 더보기 */}
              <ActionMenu
                menuId="inv-content-utility-desktop"
                currentOpenId={openInvContentMenuId}
                onOpenChange={setOpenInvContentMenuId}
                width="w-52"
                items={[
                  { label: "입고 반영", icon: <PackagePlus className="h-3.5 w-3.5" />, onClick: () => router.push("/dashboard/receiving") },
                  { label: "재고 파일 가져오기", icon: <Upload className="h-3.5 w-3.5" />, onClick: () => setIsImportWizardOpen(true) },
                  { label: "QR 스캔", icon: <QrCode className="h-3.5 w-3.5" />, onClick: () => router.push("/dashboard/inventory/scan") },
                  { label: "라벨 데이터 내보내기 (엑셀)", icon: <FileDown className="h-3.5 w-3.5" />, separator: true, onClick: async () => {
                    if (isExportingLabels) return;
                    setIsExportingLabels(true);
                    try {
                      const res = await fetch("/api/inventory/export-labels");
                      if (!res.ok) {
                        const json = await res.json().catch(() => ({}));
                        throw new Error((json as { error?: string }).error || "내보내기에 실패했습니다.");
                      }
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                      a.href = url;
                      a.download = `Label_Data_${yyyymmdd}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "라벨 데이터가 다운로드되었습니다." });
                    } catch (e: unknown) {
                      toast({
                        title: "라벨 데이터 내보내기 실패",
                        description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsExportingLabels(false);
                    }
                  } },
                ]}
              />
            </div>
          </div>

          {/* §11.317 — 재고 본 목적 KPI 4 + 운영 조치 1줄 배너 (구 폐기 strip 90 lines 제거).
              canonical truth: 카드 = count display-only. 폐기/처분 상세는 운영 브리핑(stock_risk)으로 이관.
              배너 onClick → operationalBriefPopup.open() (Phase 4 에서 category="stock_risk" hint 추가). */}
          <div data-testid="dashboard-inventory-header-kpi-grid" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
            {/* §inventory-redesign P1 (호영님 2026-07-09) — KPI 재설계:
                ① §11.302 순서: dispose(만료임박·격리) 먼저, reorder(안전재고미달) 마지막.
                ② de-red: 경고 배경 채움 제거 → 배경 중립 + 숫자만 색(핸드오프 §1·§9).
                ③ 0값 dim KPI(만료임박·격리) → 큰 0 대신 "✓ 정상"(emerald).
                ④ 안전재고미달 클릭 → 표를 '재발주 필요'(low) 필터(N-safe·투명). 0건이면 비활성.
                testid 4종 보존(§11.317). */}
            {/* §inventory-delta-label-kpi P4 (핸드오프 §3) — 격리 Lot 카드 제거(범위 제외 확정) → KPI 3.
                카운트 카드 클릭=필터 토글(재클릭 해제), 선택 시 파란 보더 + 필터 중 ✕. 0건 비클릭. */}
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {/* 1. 전체 품목 (중립·baseline) */}
              <div
                data-testid="dashboard-inventory-header-kpi-total-items"
                className={`rounded-lg border px-3 py-2 ${headerKpiTotalItems > 0 ? "border-slate-300 bg-white" : "border-dashed border-slate-200 bg-white"}`}
              >
                <span className="block text-[10px] font-semibold text-slate-500">전체 품목</span>
                {kpiPending ? (
                  <KpiPendingValue error={inventoriesError} />
                ) : (
                <span className={`mt-0.5 block text-lg font-extrabold leading-none md:text-xl ${headerKpiTotalItems > 0 ? "text-slate-900" : "text-gray-400"}`}>
                  {headerKpiTotalItems}
                  <span className="ml-0.5 text-[10px] font-bold text-slate-500">종</span>
                </span>
                )}
              </div>
              {/* 2. 만료 임박 (dispose · §11.302 우선) — 클릭 시 expiring 필터 토글(0건 비클릭) */}
              <button
                type="button"
                data-testid="dashboard-inventory-header-kpi-expiring-soon"
                onClick={() => setStatusFilter((prev) => (prev === "expiring" ? "all" : "expiring"))}
                disabled={headerKpiExpiringSoon === 0}
                aria-pressed={statusFilter === "expiring"}
                aria-label="만료 임박 품목만 보기"
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  statusFilter === "expiring"
                    ? "border-blue-400 bg-blue-50/50 ring-1 ring-blue-200"
                    : headerKpiExpiringSoon > 0
                      ? "cursor-pointer border-slate-200 bg-white hover:border-yellow-200 hover:bg-yellow-50/40"
                      : "cursor-default border-slate-200 bg-white"
                }`}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className={`block text-[10px] font-semibold ${headerKpiExpiringSoon > 0 ? inventoryToneClass("expiring_soon").text : INVENTORY_TONE_CLASS.neutral.text}`}>만료 임박</span>
                  {statusFilter === "expiring" && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600">필터 중 ✕</span>
                  )}
                </span>
                {kpiPending ? (
                  <KpiPendingValue error={inventoriesError} />
                ) : headerKpiExpiringSoon > 0 ? (
                  <span className={`mt-0.5 block text-lg font-extrabold leading-none md:text-xl ${inventoryToneClass("expiring_soon").text}`}>
                    {headerKpiExpiringSoon}
                    <span className="ml-0.5 text-[10px] font-bold">건</span>
                  </span>
                ) : (
                  <span className="mt-0.5 block text-sm font-bold text-emerald-600">✓ 정상</span>
                )}
              </button>
              {/* 3. 안전재고 미달 (reorder · §11.302 dispose 뒤) — 클릭 시 low 필터 토글(0건 비클릭) */}
              <button
                type="button"
                data-testid="dashboard-inventory-header-kpi-low-stock"
                onClick={() => setStatusFilter((prev) => (prev === "low" ? "all" : "low"))}
                disabled={headerKpiLowStock === 0}
                aria-pressed={statusFilter === "low"}
                aria-label="안전재고 미달 품목만 보기"
                className={`group rounded-lg border px-3 py-2 text-left transition-colors ${
                  statusFilter === "low"
                    ? "border-blue-400 bg-blue-50/50 ring-1 ring-blue-200"
                    : headerKpiLowStock > 0
                      ? "cursor-pointer border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/40"
                      : "cursor-default border-slate-200 bg-white"
                }`}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className={`block text-[10px] font-semibold ${headerKpiLowStock > 0 ? inventoryToneClass("below_safety").text : INVENTORY_TONE_CLASS.neutral.text}`}>안전재고 미달</span>
                  {statusFilter === "low" ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600">필터 중 ✕</span>
                  ) : headerKpiLowStock > 0 ? (
                    <span className={`hidden items-center text-[10px] font-bold group-hover:flex ${inventoryToneClass("below_safety").text}`}>자세히 →</span>
                  ) : null}
                </span>
                {kpiPending ? (
                  <KpiPendingValue error={inventoriesError} />
                ) : (
                <span className={`mt-0.5 block text-lg font-extrabold leading-none md:text-xl ${headerKpiLowStock > 0 ? inventoryToneClass("below_safety").text : "text-gray-400"}`}>
                  {headerKpiLowStock}
                  <span className="ml-0.5 text-[10px] font-bold">건</span>
                </span>
                )}
              </button>
            </div>
            {/* §inventory-delta-label-kpi P4 (핸드오프 §3) — 운영 배너는 조치 2건+ 복합만(단건=KPI 카드가 역할, 중복 신호 금지). */}
            {(lotIssueDisposalReviewCount + lotIssueApprovalPendingCount + lotIssueExecutableCount) >= 2 && (
              <button
                type="button"
                data-testid="dashboard-inventory-header-action-banner"
                onClick={() => operationalBriefPopup.open({ category: "stock_risk" })}
                className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-left text-xs font-semibold text-yellow-800 transition-colors hover:border-yellow-300 hover:bg-yellow-100"
              >
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {lotIssueDisposalReviewCount + lotIssueApprovalPendingCount + lotIssueExecutableCount}건의 운영 조치가 필요합니다
                </span>
                <span
                  data-testid="dashboard-inventory-header-action-banner-open-brief"
                  className="flex shrink-0 items-center gap-0.5 font-bold text-yellow-900"
                >
                  운영 브리핑 열기
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </button>
            )}
          </div>

          {/* §11.317 — 구 폐기 strip(91 lines) 제거. priorityExpiredLot/topPriorityQueueItem/
              handleLotIssueDecisionAction 등 폐기 mutation 은 폐기 검토 탭(작업 surface)에서
              유지. canonical count(lotIssueDisposalReviewCount 등)는 보존, 운영 브리핑 stock_risk
              카드 source 로 forward (Phase 3). */}
          {/* 🛑 삭제 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정) — `{false && (…)}` 죽은 블록 3개(총 639줄).
          삭제 전 구조(HEAD 기준 행): 2000 블록 = noUnusedLocals 회피용 dead-ref 보존 ·
          2474 블록 = PriorityActionQueue 로 대체된 「조치 필요 항목」 · 3827 블록 = inventory·history·alerts 3탭.
          3827 블록의 InventoryCard 그리드가 「재입고 요청」 POST 를 부르지만 렌더가 0이라 누를 수 있는 사람이 없었다.
          그런데 그 블록에 값을 대는 restock-status 쿼리는 살아 있어서 화면을 열 때마다 품목마다
          GET /api/inventory/[id]/restock-request 를 보냈다 — 렌더는 0인데 네트워크 비용은 실재했다.
          셋 다 지운다. 되살릴 것은 git 이력에 있다.
          재실측 기준(호영님): 재고 화면을 열었을 때 restock-request 요청 0건.
          역계약: __tests__/regression/inventory-dead-tabs-removed.test.ts */}

          {/* 탭 바 — 하단 인디케이터 스타일 */}
          <Tabs value={activeInventoryTab} onValueChange={(v) => setActiveInventoryTab(v)} className="w-full">
            {/* §11.321 — 세그먼트 컨트롤 스타일 (옛 border-b + 하단 인디케이터 → 흰 배경 + shadow).
                canonical 보존: 4 key / aria / testid / min-h-[44px] / badge / showLotIssueDecisionStrip 분기.
                §11.358-1 #4 — "운영 현황" 탭 무의미 "S" suffix 제거(raw label 금지). */}
            <div data-testid="dashboard-inventory-tab-segmented" className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-4">
              {[
                {
                  key: "manage",
                  icon: <ListFilter className="w-5 h-5" />,
                  label: "품목 관리",
                  badge: null,
                },
                {
                  key: "overview",
                  icon: <LayoutGrid className="w-5 h-5" />,
                  // §inventory-state-tone 후속(2026-09-26 · 호영님 판정) — **탭 이름은 하나로 고정한다.**
                  //   옛 판본은 비활성이면 「운영 현황」, 누르면 「폐기 검토」 로 바뀌었는데 내용은 재주문 큐였다.
                  //   이름이 내용과 맞지 않았다. 이 탭은 PriorityActionQueue(폐기·재주문 혼합)를 렌더하므로
                  //   중립 이름인 「운영 현황」 으로 고정한다. 필터 상태는 이름이 아니라 aria-pressed·칩이 말한다.
                  label: "운영 현황",
                  badge: showLotIssueDecisionStrip ? null : issuesCount > 0 ? issuesCount : null,
                },
                {
                  key: "storage-location",
                  icon: <MapPin className="w-5 h-5" />,
                  label: "보관 위치",
                  badge: null,
                },
                {
                  key: "flow",
                  icon: <Truck className="w-5 h-5" />,
                  label: "입출고 흐름",
                  badge: null,
                },
              ].map((tab) => {
                /* §11.266d / §11.321 — min-h-[44px] WCAG SC 2.5.5 / Apple HIG 보존. */
                const isActive = activeInventoryTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    data-testid={tab.key === "overview" ? "labaxis-inventory-overview-tab" : tab.key === "manage" ? "labaxis-inventory-manage-tab" : undefined}
                    onClick={() => {
                      if (tab.key === "manage" && activeInventoryTab === "manage") return;
                      if (tab.key === "overview" && activeInventoryTab === "overview" && showLotIssueDecisionStrip) {
                        handleLotIssueDecisionAction();
                        return;
                      }
                      setActiveInventoryTab(tab.key);
                    }}
                    aria-current={isActive ? "page" : undefined}
                    aria-disabled={tab.key === "manage" && activeInventoryTab === "manage" ? true : undefined}
                    disabled={tab.key === "manage" && activeInventoryTab === "manage"}
                    title={tab.key === "manage" && activeInventoryTab === "manage" ? "현재 품목 관리 화면입니다. 운영 현황이나 조치 시작을 선택하면 화면이 전환됩니다." : tab.key === "overview" && activeInventoryTab === "overview" && showLotIssueDecisionStrip ? "현재 운영 현황입니다. 클릭하면 폐기·재주문 우선 처리 목록으로 필터합니다." : undefined}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 text-sm rounded-md transition-all duration-150 whitespace-nowrap disabled:cursor-default disabled:opacity-100 ${isActive ? "bg-white text-slate-900 shadow-sm font-semibold" : "bg-transparent text-gray-600 hover:bg-gray-200"}`}
                  >
                    <span className={isActive ? "text-blue-600" : "text-gray-500"}>{tab.icon}</span>
                    {tab.label}
                    {tab.badge !== null && <span className="inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 text-white font-bold px-1 text-[10px] ml-0.5">{tab.badge}</span>}
                  </button>
                );
              })}
            </div>

            {/* 통합 카드: 콘텐츠 */}
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="w-full">
                {/* 하단 통합 콘텐츠 */}
                {/* 1. 품목 관리 (item-level 운영 surface) */}
                <TabsContent value="manage" className="m-0 p-4 space-y-4">
                  {/* 검색 + 아이콘 액션 한 줄 — 스크린샷 레이아웃 */}
                  <div className="flex items-center gap-2">
                    {/* 검색창 — flex-1 */}
                    <div className="flex-1 min-w-0">
                      <InventorySearch value={searchQuery} onChange={setSearchQuery} isLoading={isLoading} />
                    </div>

                    {/* §global-filters P3-a2 (§11.297f 진화, 호영님 승인) — 필터-드롭다운 패널 폐기
                        → 공용 FilterBar 인라인(위치/상태, 라벨 병기·활성 강조). 모바일 Sheet(하단)·
                        ?filter/서버 persist·statusFilter 우선순위 무접촉. 필터 값은 화면 소유(표시 계층만). */}
                    <FilterBar
                      filters={inventoryDesktopFilters}
                      values={{ location: locationFilter, status: statusFilter }}
                      onChange={(key, v) => {
                        if (key === "location") setLocationFilter(v);
                        else if (key === "status") setStatusFilter(v);
                      }}
                    />
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 shrink-0 text-xs"
                        onClick={() => {
                          setLocationFilter("all");
                          setStatusFilter("all");
                          setCategoryFilter("all");
                        }}
                      >
                        초기화
                      </Button>
                    )}

                    {/* 라벨 인쇄 */}
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0 text-xs" onClick={() => setNewLabelPrintOpen(true)} title="라벨 인쇄">
                      <Printer className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">라벨 인쇄</span>
                    </Button>

                    {/* 내보내기 (아이콘) */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title="내보내기"
                      onClick={async () => {
                        if (isExportingLabels) return;
                        setIsExportingLabels(true);
                        try {
                          const res = await fetch("/api/inventory/export-labels");
                          if (!res.ok) {
                            const json = await res.json().catch(() => ({}));
                            throw new Error((json as { error?: string }).error || "내보내기에 실패했습니다.");
                          }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                          a.href = url;
                          a.download = `Inventory_${yyyymmdd}.xlsx`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast({ title: "내보내기 완료" });
                        } catch (e: unknown) {
                          toast({
                            title: "내보내기 실패",
                            description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsExportingLabels(false);
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 모바일 필터 바텀시트 */}
                  <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl">
                      <SheetHeader>
                        <SheetTitle>필터</SheetTitle>
                      </SheetHeader>
                      <div className="flex flex-col gap-4 py-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-400  text-slate-400">위치</label>
                          <Select value={locationFilter} onValueChange={setLocationFilter}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="위치별" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">전체 위치</SelectItem>
                              <SelectItem value="none">위치 미지정</SelectItem>
                              {uniqueLocations.map((loc) => (
                                <SelectItem key={loc} value={loc}>
                                  {loc}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-400  text-slate-400">상태</label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="상태별" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">전체 상태</SelectItem>
                              <SelectItem value="low">부족 / 재주문 필요</SelectItem>
                              <SelectItem value="expiring">만료 임박</SelectItem>
                              <SelectItem value="incoming">입고 대기</SelectItem>
                              <SelectItem value="lot_issue">LOT 불일치</SelectItem>
                              <SelectItem value="recent">최근 변경</SelectItem>
                              <SelectItem value="normal">정상</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-400  text-slate-400">카테고리</label>
                          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="카테고리별" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">전체 카테고리</SelectItem>
                              <SelectItem value="reagent">시약</SelectItem>
                              <SelectItem value="equipment">장비</SelectItem>
                              <SelectItem value="consumable">소모품</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setLocationFilter("all");
                              setStatusFilter("all");
                              setCategoryFilter("all");
                            }}
                          >
                            초기화
                          </Button>
                          <Button className="flex-1" onClick={() => setFilterSheetOpen(false)}>
                            적용
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* §inventory-delta-label-kpi P4b (핸드오프 §3) — 리스트 상단 활성 필터 칩.
                      KPI 카드 토글(4a)로 건 statusFilter 를 리스트 머리에서 가시화 + ✕ 해제
                      (KPI 재클릭 없이도 해제). statusFilter !== "all" 일 때만 노출, 표시 계층 전용. */}
                  {statusFilter !== "all" && (
                    <div
                      data-testid="inventory-list-active-filter-chip"
                      className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2"
                    >
                      <ListFilter className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                      <span className="text-xs font-medium text-blue-800">
                        필터 적용 중 · {STATUS_FILTER_LABELS[statusFilter] ?? statusFilter}
                        <span className="ml-1 tabular-nums text-blue-500">{filteredInventories.length}건</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        aria-label="상태 필터 해제"
                        className="ml-auto inline-flex items-center gap-1 min-h-[32px] px-2 -mr-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        <X className="h-3 w-3" /> 해제
                      </button>
                    </div>
                  )}

                  {!inventoriesArrived && !inventoriesError ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-4 px-4 py-3.5 rounded-lg border border-slate-100 bg-white animate-pulse">
                          <div className="h-9 w-9 rounded-lg bg-slate-100" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-32 rounded bg-slate-100" />
                            <div className="h-3 w-48 rounded bg-slate-50" />
                          </div>
                          <div className="h-6 w-16 rounded-full bg-slate-100" />
                          <div className="h-3 w-12 rounded bg-slate-50" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-0">
                        <InventoryTable
                          inventories={filteredInventories}
                          onEdit={(inventory) => {
                            setEditingInventory(inventory);
                            setIsDialogOpen(true);
                          }}
                          onDelete={(inventory) => {
                            if (confirm(`정말 ${inventory.product.name} 재고를 삭제하시겠습니까?`)) {
                              deleteMutation.mutate(inventory.id);
                            }
                          }}
                          onReorder={(inventory) => {
                            // §inventory-reorder-surface-unify P3 — 테이블 행 재발주 진입 = 통합 패널(reorder mode).
                            openReorderReview(inventory);
                          }}
                          onDetailClick={(inventory) => {
                            // Open context panel (right-side) on desktop; Sheet on mobile
                            if (typeof window !== "undefined" && window.innerWidth >= 1280) {
                              openContextPanel(inventory);
                            } else {
                              setSelectedItem(inventory);
                              setSheetSafetyStock(String(inventory.safetyStock ?? inventory.minOrderQty ?? 1));
                              setIsSheetOpen(true);
                            }
                          }}
                          onRestock={(inventory) => {
                            setRestockItem(inventory);
                            setRestockForm({
                              addQty: "",
                              lotNumber: "",
                              expiryDate: "",
                            });
                          }}
                          onConsume={(inventory) => {
                            toast({
                              title: "출고 / 사용 처리",
                              description: `${inventory.product.name} 출고/사용 기능은 곧 제공될 예정입니다.`,
                            });
                          }}
                          onMoveLocation={(inventory) => {
                            // §inventory-redesign P3(호영님 2026-07-10) — fake success 제거.
                            //   위치 저장은 편집 모달(location Input → PATCH /api/inventory/[id]) 실 배선 재사용.
                            setEditingInventory(inventory);
                            setIsDialogOpen(true);
                          }}
                          onDispose={(inventory) => {
                            openDisposalDock(inventory);
                          }}
                          onPrintLabel={(productName, lots) => {
                            setLabelPrintTitle(productName);
                            setLabelPrintLots(lots as ProductInventory[]);
                            const allIds = new Set(lots.map((l) => l.id));
                            setLabelPrintSelected(allIds);
                            const defaultQty: Record<string, number> = {};
                            lots.forEach((l) => {
                              defaultQty[l.id] = 1;
                            });
                            setLabelPrintQty(defaultQty);
                            setLabelPrintOpen(true);
                          }}
                          /* §11.361-2 라이브 이식(§inventory-dead-file-cleanup P1.5, 2026-08-06) —
                             원 수정이 dead file(inventory-main, importer 0)에만 적용돼 라이브는
                             필터 0건을 "등록된 재고 없음"으로 위장하고 있었다(fake empty).
                             우선순위: 검색 > 필터(status/category/location) > 진짜 0건. */
                          /* §11.361-2 후속 — 볼드 타이틀도 분기 (prod 실측: 하드코드 타이틀이
                             필터 0건에서 "등록된 재고가 없습니다" 위장 잔존) */
                          emptyTitle={
                            debouncedSearchQuery.trim()
                              ? "검색 결과가 없습니다"
                              : activeFilterCount > 0
                                ? "이 조건에 맞는 재고가 없습니다"
                                : "등록된 재고가 없습니다"
                          }
                          emptyMessage={
                            debouncedSearchQuery.trim()
                              ? `'${debouncedSearchQuery.trim()}'에 해당하는 재고를 찾지 못했습니다.`
                              : activeFilterCount > 0
                                ? "필터를 초기화하면 전체 재고를 볼 수 있습니다."
                                : "등록된 재고가 없습니다.\n첫 재고를 추가해 운영을 시작하세요."
                          }
                          emptyAction={
                            debouncedSearchQuery.trim()
                              ? () => setSearchQuery("")
                              : activeFilterCount > 0
                                ? () => { setLocationFilter("all"); setStatusFilter("all"); setCategoryFilter("all"); }
                                : () => setIsDialogOpen(true)
                          }
                          emptyActionLabel={
                            debouncedSearchQuery.trim()
                              ? "전체 재고 보기"
                              : activeFilterCount > 0
                                ? "필터 초기화"
                                : "재고 추가하기"
                          }
                        />
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* 2. 운영 현황 (Inventory Operations Cockpit) */}
                <TabsContent value="overview" className="m-0 p-4 sm:p-6 space-y-5">
                  {/* 온톨로지: 만료 lot priority banner */}
                  {!showLotIssueDecisionStrip && (() => {
                    if (!priorityExpiredLot) return null;
                    return (
                      <div data-testid="labaxis-inventory-priority-banner" data-legacy-testid="inventory-priority-banner" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-red-800">1순위: 폐기 처리 · 만료 lot {actionableExpiredLots.length}건 · 잔량 {actionableExpiredQuantity}개</p>
                          <p className="text-xs text-red-600/70">
                            2순위: 재발주 후속 검토 · 폐기 완료 후 안전재고 영향이 있을 때만 진행
                          </p>
                        </div>
                        <Button data-testid="labaxis-inventory-dispose-lot-cta" data-legacy-testid="lot-disposal-cta" size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0" onClick={() => openDisposalDock(priorityExpiredLot)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          폐기 처리 시작
                        </Button>
                      </div>
                    );
                  })()}

                  {/* ── 우선 처리 배너 (최상단 1줄) ──
                      §11.302d-4 신호등 색상 정합 (의미 역전 정정):
                        priorityExpiredLot (이미 만료) → 위험 red (큰 박스 가독성 red-100)
                        expiringSoon (만료 임박)      → 검토 yellow (이전: red 잘못)
                        lowOrOutOfStock (재주문 필요) → 긴급 red (이전: yellow 잘못)
                        fallback                      → slate (그대로) */}
                  {!showLotIssueDecisionStrip && (issuesCount > 0 ? (
                    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${priorityExpiredLot ? "border-red-200 bg-red-100" : expiringSoonCount > 0 ? "border-yellow-200 bg-yellow-100" : lowOrOutOfStockCount > 0 ? "border-red-200 bg-red-100" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${priorityExpiredLot ? "bg-red-200" : expiringSoonCount > 0 ? "bg-yellow-200" : lowOrOutOfStockCount > 0 ? "bg-red-200" : "bg-slate-100"}`}>{priorityExpiredLot ? <Trash2 className="h-4 w-4 text-red-700" /> : expiringSoonCount > 0 ? <Calendar className="h-4 w-4 text-yellow-700" /> : lowOrOutOfStockCount > 0 ? <AlertTriangle className="h-4 w-4 text-red-700" /> : <Zap className="h-4 w-4 text-slate-600" />}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-extrabold text-slate-900">{priorityExpiredLot ? `우선 처리: 만료 lot ${actionableExpiredLots.length}건 — 폐기 처리 필요` : expiringSoonCount > 0 ? `우선 처리: 만료 임박 ${expiringSoonCount}건 — 폐기 또는 우선 소진 필요` : lowOrOutOfStockCount > 0 ? `우선 처리: 재고 부족 ${lowOrOutOfStockCount}건 — 발주 검토 필요` : `처리 대기 ${issuesCount}건 — 아래 큐에서 확인하세요`}</p>
                      </div>
                      <Button
                        size="sm"
                        disabled={!priorityExpiredLot && !topPriorityQueueItem}
                        className={`h-7 px-3 text-[11px] font-bold gap-1 flex-shrink-0 ${expiringSoonCount > 0 && !priorityExpiredLot ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
                        onClick={() => {
                          if (priorityExpiredLot) {
                            openDisposalDock(priorityExpiredLot);
                            return;
                          }
                          if (topPriorityQueueItem) {
                            handlePriorityQueueAction(topPriorityQueueItem);
                          }
                        }}
                      >
                        {priorityExpiredLot ? "폐기 처리 시작" : expiringSoonCount > 0 ? "폐기 처리 시작" : "처리 시작"}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 flex-shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="text-[13px] font-extrabold text-slate-900">모든 재고 정상 — 즉시 처리할 항목 없음</p>
                    </div>
                  ))}

                  {/* ── 요약 칩 (backlog 분류, secondary) ──
                      §11.302d-5 신호등 색상 의미 정합 + "전체 재고" 제거:
                        만료 임박  → 검토 yellow-100 (이전 red-50 잘못 정정)
                        부족/품절 → 긴급 red-100 (이전 yellow-50 잘못 정정)
                        전체 재고  → 제거 (§11.302c KPI "전체 재고" 제거 정합) */}
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      {
                        label: "만료 임박",
                        value: expiringSoonCount,
                        color: "text-yellow-700",
                        bg: "bg-yellow-100 border-yellow-200",
                      },
                      {
                        label: "재주문 필요",
                        value: lowOrOutOfStockCount,
                        color: "text-red-700",
                        bg: "bg-red-100 border-red-200",
                      },
                    ].map((chip) => (
                      <span key={chip.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${chip.bg} ${chip.color}`}>
                        {chip.label}
                        <span className="font-extrabold">{chip.value}</span>
                      </span>
                    ))}
                  </div>

                  {/* Priority Action Queue */}
                  <PriorityActionQueue items={priorityQueueItems} onAction={handlePriorityQueueAction} onItemClick={handlePriorityQueueAction} />

                  {/* 조치 필요 항목 — removed: PriorityActionQueue가 동일 ontology backlog를 surface합니다 */}
                  
                </TabsContent>

                {/* 3. Lot 추적 — contextual drill-down (1급 탭에서 내려옴, 품목 컨텍스트에서 진입) */}
                <TabsContent value="lot-tracking" className="m-0 p-4 sm:p-6 space-y-4">
                  {/* §11.266c — inventory lot-tracking back nav 44x44 touch target
                      (§11.266 P1 cluster 3/5, §11.264h family cross-cutting concern
                      확장). flex → inline-flex + min-h-[44px] + px-2 추가 → Apple
                      HIG / Material / WCAG 2.1 SC 2.5.5 표준 정합. text-xs /
                      text-blue-400 hover:text-blue-300 / mb-1 / setActiveInventoryTab
                      onClick / ChevronRight rotate-180 / "품목 관리로 돌아가기" 보존. */}
                  <button type="button" onClick={() => setActiveInventoryTab("manage")} className="inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px] px-2 text-blue-400 hover:text-blue-300 transition-colors mb-1">
                    <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                    품목 관리로 돌아가기
                  </button>
                  {(() => {
                    // #inventory-lot-overlay P5 — 공유 lotView 소비(실 InventoryRestock/InventoryUsage 기반).
                    const { summary, sorted, uncoveredCount } = lotView;
                    const filtered = filterLotsByStatus(sorted, lotStatusFilter);
                    const searched = lotSearchQuery.trim() ? searchLots(filtered, lotSearchQuery) : filtered;

                    return (
                      <>
                        {/* #inventory-lot-overlay P5 — 전체 화면(same-canvas overlay) 진입 */}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">{summary.totalLots}개 Lot · 만료 임박 {summary.expiringSoonLots}건</p>
                          <button
                            type="button"
                            onClick={() => setIsLotOverlayOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 min-h-[44px] text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                            전체 화면
                          </button>
                        </div>

                        {/* 안전장치 — 입고 lot 기록 없는 현재고 품목 정직 안내(데이터 누락 오인 방지) */}
                        {uncoveredCount > 0 && (
                          <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[11px] text-gray-500">
                            입고 lot 기록이 없어 추적되지 않는 품목 {uncoveredCount}개 (현재고 있음). 입고 처리 시 Lot으로 표시됩니다.
                          </p>
                        )}

                        {/* Summary cards — clickable filters */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                          {[
                            {
                              key: "all" as LotStatusFilter,
                              label: "전체 Lot",
                              count: summary.totalLots,
                              valueClass: "text-slate-900",
                              borderClass: "border-slate-200",
                            },
                            {
                              key: "active" as LotStatusFilter,
                              label: "활성",
                              count: summary.activeLots,
                              valueClass: "text-emerald-600",
                              borderClass: "border-emerald-200",
                            },
                            {
                              key: "expiring_soon" as LotStatusFilter,
                              label: "만료 임박",
                              count: summary.expiringSoonLots,
                              // §11.302d-3 검토 spec 강화 (text-yellow-500 → text-yellow-700)
                              valueClass: "text-yellow-700",
                              borderClass: "border-yellow-200",
                            },
                            {
                              key: "expired" as LotStatusFilter,
                              label: "만료/소진",
                              count: summary.expiredLots + summary.depletedLots,
                              // §11.302d-3 위험/긴급 spec 정합 (text-rose-500 → text-red-700, rose → red 통일)
                              valueClass: "text-red-700",
                              borderClass: "border-red-200",
                            },
                          ].map((card) => (
                            <button key={card.key} onClick={() => setLotStatusFilter(card.key)} className={`rounded-xl p-3 text-left transition-all active:scale-95 bg-white border ${lotStatusFilter === card.key ? "ring-2 ring-blue-500/50 border-blue-500" : card.borderClass}`}>
                              <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-500">{card.label}</p>
                              <p className={`text-xl font-bold ${card.valueClass}`}>{card.count}</p>
                            </button>
                          ))}
                        </div>

                        {/* Search bar */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input value={lotSearchQuery} onChange={(e) => setLotSearchQuery(e.target.value)} placeholder="LOT 번호, 품목명, 위치로 검색..." className="pl-9 h-10 text-sm bg-white border-slate-200 text-slate-700 placeholder:text-slate-400" />
                        </div>

                        {/* Lot row list */}
                        {searched.length === 0 ? (
                          <div className="rounded-xl px-6 py-10 text-center bg-white border border-slate-200">
                            <Archive className="h-8 w-8 mx-auto mb-3 text-slate-400" />
                            <p className="text-sm font-medium text-slate-500">{lotStatusFilter !== "all" ? `${getLotStatusLabel(lotStatusFilter as any)} 상태의 Lot이 없습니다` : "Lot 데이터가 없습니다"}</p>
                          </div>
                        ) : (
                          <>
                            {/* Mobile: card list */}
                            <div className="md:hidden space-y-2">
                              {searched.map((lot) => {
                                const sc = getLotStatusColor(lot.status);
                                return (
                                  <button
                                    key={lot.lotId}
                                    onClick={() => {
                                      setSelectedLotId(lot.lotId);
                                      // Also open context panel with matching inventory
                                      const matchInv = displayInventories.find((i) => i.id === lot.itemId);
                                      if (matchInv) openContextPanel(matchInv);
                                    }}
                                    className={`w-full text-left rounded-xl p-3 transition-all active:scale-[0.98] bg-white border ${selectedLotId === lot.lotId ? "ring-2 ring-blue-500/50 border-blue-500" : "border-slate-200"}`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-900">{lot.lotCode}</span>
                                        <span
                                          className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                                          style={{
                                            backgroundColor: sc.bg,
                                            color: sc.text,
                                            borderColor: sc.border,
                                          }}
                                        >
                                          {getLotStatusLabel(lot.status)}
                                        </span>
                                      </div>
                                      <span className="text-xs font-bold text-slate-900">
                                        {lot.receivedQty != null ? `${lot.receivedQty} ${lot.unit}` : "—"}
                                      </span>
                                    </div>
                                    <p className="text-[11px] truncate text-slate-700">{lot.productName}</p>
                                    <div className="flex items-center gap-3 mt-1.5">
                                      {lot.location && (
                                        <span className="text-[10px] flex items-center gap-1 text-slate-500">
                                          <MapPin className="h-3 w-3" />
                                          {lot.location}
                                        </span>
                                      )}
                                      {lot.expiresAt && (
                                        <span className="text-[10px] flex items-center gap-1 text-slate-500">
                                          <Calendar className="h-3 w-3" />
                                          {format(new Date(lot.expiresAt), "yy.MM.dd")}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Desktop: table */}
                            <div className="hidden md:block rounded-xl overflow-hidden border border-slate-200">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-el">
                                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">LOT 번호</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">품목</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">상태</th>
                                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">입고량</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">위치</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">유효기간</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">마지막 이벤트</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {searched.map((lot) => {
                                    const sc = getLotStatusColor(lot.status);
                                    const isSelected = selectedLotId === lot.lotId;
                                    return (
                                      <tr
                                        key={lot.lotId}
                                        onClick={() => {
                                          setSelectedLotId(lot.lotId);
                                          const matchInv = displayInventories.find((i) => i.id === lot.itemId);
                                          if (matchInv) openContextPanel(matchInv);
                                        }}
                                        className={`cursor-pointer transition-colors border-b border-slate-100 last:border-0 ${isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                                      >
                                        <td className="px-4 py-3">
                                          <span className="text-xs font-bold text-slate-900">{lot.lotCode}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div>
                                            <p className="text-xs font-medium text-slate-900 truncate max-w-[200px]">{lot.productName}</p>
                                            {lot.brand && <p className="text-[10px] text-slate-500">{lot.brand}</p>}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span
                                            className="text-[10px] font-bold px-2 py-0.5 rounded border"
                                            style={{
                                              backgroundColor: sc.bg,
                                              color: sc.text,
                                              borderColor: sc.border,
                                            }}
                                          >
                                            {getLotStatusLabel(lot.status)}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          {lot.receivedQty != null ? (
                                            <>
                                              <span className="text-xs font-bold text-slate-900">{lot.receivedQty}</span>
                                              <span className="text-[10px] ml-0.5 text-slate-500">{lot.unit}</span>
                                            </>
                                          ) : (
                                            <span className="text-xs text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className={`text-xs ${lot.location ? "text-slate-700" : "text-slate-400"}`}>{lot.location || "미지정"}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className="text-xs text-slate-700">{lot.expiresAt ? format(new Date(lot.expiresAt), "yyyy.MM.dd") : "—"}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className="text-[11px] text-slate-500">{lot.lastEventAt ? format(new Date(lot.lastEventAt), "MM.dd HH:mm") : "—"}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <p className="text-[11px] text-right text-slate-400">
                              {searched.length}개 Lot 표시 중{lotStatusFilter !== "all" && ` (${getLotStatusLabel(lotStatusFilter as any)} 필터)`}
                            </p>
                          </>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>

                {/* 4. 저장 위치 */}
                <TabsContent value="storage-location" className="m-0 p-4 sm:p-6 space-y-5">
                  <StorageLocationView />
                </TabsContent>

                <TabsContent value="flow" className="m-0 p-4 sm:p-6 space-y-5">
                  <InventoryFlowView />
                </TabsContent>
              </div>
              {/* end 통합 카드 */}
            </div>
            {/* end rounded card */}
          </Tabs>
          {/* end Tabs */}
        </div>
        {/* end main content */}

        {/* ── Context Panel (right-side operational detail, desktop only) ── */}
        {contextPanelOpen && contextPanelItem && (
          <div className="hidden md:contents">
            <InventoryContextPanel
              item={contextPanelItem}
              isOpen={contextPanelOpen}
              mode={contextPanelMode}
              onClose={() => setContextPanelItem(null)}
              onLotDrillDown={() => setActiveInventoryTab("lot-tracking")}
              reorderQty={reorderRecommendationsData?.recommendations?.find((r) => r.inventoryId === contextPanelItem?.id)?.recommendedQty ?? null}
              reorderBreakdown={reorderRecommendationsData?.recommendations?.find((r) => r.inventoryId === contextPanelItem?.id)?.recommendationBreakdown ?? null}
              onAssignLocation={(location) => {
                // §inventory-redesign A-③ — 위치 미지정 인라인 지정 → 실 location PATCH(기존 update mutation).
                const match = displayInventories.find((inv) => inv.id === contextPanelItem?.id);
                if (match) {
                  createOrUpdateMutation.mutate({
                    id: match.id,
                    productId: match.productId,
                    currentQuantity: match.currentQuantity,
                    unit: match.unit || "ea",
                    location,
                  });
                }
              }}
              onReorder={(cpItem) => {
                // §11.158 cache-bust — reorder 진입 시 inventory brief stale
                invalidateBriefNarrative({
                  inventoryId: cpItem.id,
                  module: "inventory",
                  sourceUpdatedAt: new Date(),
                });
                const match = displayInventories.find((inv) => inv.id === cpItem.id);
                if (!match) return;
                // §inventory-reorder-surface-unify P3 — 추천(canonical /reorder-recommendations) 있으면
                //   ReorderReviewSheet(승격) 직접 오픈, 없으면 reorder mode 강조 유지(빈 시트/no-op 방지).
                // §stock-risk-consolidation P2 — 차단 시 재발주 sheet 미오픈(dead button 방지). reorder mode로 사유 노출.
                const qty = reorderRecommendedQtyFor(match.id);
                const blocked = reorderBlockReasonsFor(match.id).length > 0;
                if (!blocked && qty != null && qty > 0) {
                  setContextPanelItem(null);
                  openReorderReviewSheet(match);
                } else {
                  setContextPanelMode("reorder");
                }
              }}
              onEdit={(cpItem) => {
                const match = displayInventories.find((inv) => inv.id === cpItem.id);
                if (match) {
                  setEditingInventory(match);
                  setIsDialogOpen(true);
                }
                setContextPanelItem(null);
              }}
              onDispose={(cpItem) => {
                const match = displayInventories.find((inv) => inv.id === cpItem.id);
                if (!match) return;
                openDisposalDock(match);
              }}
            />
          </div>
        )}
      </div>
      {/* end flex row */}

      {/* 우측 상세 Sheet (Drawer) */}
      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setShowRestockHistory(false);
            setDrawerMode("view");
            setPurchaseContext(null);
          }
        }}
      >
        <SheetContent className="w-[90vw] overflow-y-auto sm:max-w-[480px]">
          {/* ════ purchase-receiving mode ════ */}
          {drawerMode === "purchase-receiving" && purchaseContext && (
            <>
              <SheetHeader className="mb-3 mt-3 border-b border-emerald-800 pb-3  border-emerald-800">
                <div className="mb-1 flex items-center gap-1.5">
                  <Badge className="border-none bg-emerald-100 text-emerald-700 hover:bg-emerald-100  bg-emerald-100  text-emerald-700 text-xs">구매 → 입고 반영</Badge>
                </div>
                <SheetTitle className="text-lg font-bold leading-tight">{purchaseContext.itemName || "입고 반영"}</SheetTitle>
                <SheetDescription className="text-sm text-slate-400  text-slate-400 mt-0.5">구매 데이터를 기반으로 재고에 입고를 반영합니다</SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                {/* 구매 연동 정보 카드 */}
                <div className="rounded-lg border border-emerald-800 bg-emerald-50  border-emerald-800  bg-emerald-50 p-3.5">
                  <h4 className="text-xs font-semibold text-emerald-700  text-emerald-700 mb-2 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    구매 연동 정보
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">구매일</span>
                      <span className="font-medium">{purchaseContext.purchasedAt ? format(new Date(purchaseContext.purchasedAt), "yyyy.MM.dd", { locale: ko }) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">공급사</span>
                      <span className="font-medium truncate ml-2">{purchaseContext.vendorName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">구매 수량</span>
                      <span className="font-medium">
                        {purchaseContext.qty || 0} {purchaseContext.unit || "ea"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">구매 ID</span>
                      <span className="font-mono text-[10px] text-slate-400 truncate ml-2">{purchaseContext.id?.slice(0, 8) || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* 기존 재고 매칭 정보 */}
                {selectedItem && (
                  <div className="rounded-lg border border-blue-800 bg-blue-50  border-blue-800  bg-blue-50 p-3">
                    <h4 className="text-xs font-semibold text-blue-400  text-blue-400 mb-1.5">매칭된 기존 재고</h4>
                    <p className="text-sm font-medium text-slate-700  text-slate-700">{selectedItem.product.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      현재 {selectedItem.currentQuantity} {selectedItem.unit} · {selectedItem.product.brand} · {selectedItem.product.catalogNumber}
                    </p>
                  </div>
                )}

                {/* 사용자 입력 필드 */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="receiving-qty" className="text-xs">
                      실제 입고 수량 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="receiving-qty"
                      type="number"
                      min="1"
                      placeholder="입고할 수량"
                      value={receivingForm.actualQty}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setReceivingForm((f) => ({
                          ...f,
                          actualQty: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="receiving-lot" className="text-xs">
                      Lot Number <span className="text-slate-400 font-normal">(선택)</span>
                    </Label>
                    <Input
                      id="receiving-lot"
                      placeholder="예: LOT-2026-001"
                      value={receivingForm.lotNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setReceivingForm((f) => ({
                          ...f,
                          lotNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      유효기간 <span className="text-slate-400 font-normal">(선택)</span>
                    </Label>
                    <DatePicker
                      date={receivingForm.expiryDate ? new Date(receivingForm.expiryDate) : undefined}
                      onDateChange={(date: Date | undefined) =>
                        setReceivingForm((f) => ({
                          ...f,
                          expiryDate: date ? date.toISOString().split("T")[0] : "",
                        }))
                      }
                      placeholder="유효기한 선택"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="receiving-location" className="text-xs">
                      보관 위치 <span className="text-slate-400 font-normal">(선택)</span>
                    </Label>
                    <Input
                      id="receiving-location"
                      placeholder="예: 냉동고 1칸"
                      value={receivingForm.location}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setReceivingForm((f) => ({
                          ...f,
                          location: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="receiving-notes" className="text-xs">
                      특이사항 <span className="text-slate-400 font-normal">(선택)</span>
                    </Label>
                    <Input
                      id="receiving-notes"
                      placeholder="입고 관련 메모"
                      value={receivingForm.notes}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setReceivingForm((f) => ({
                          ...f,
                          notes: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* 재고 반영 방식 선택 */}
                <div className="rounded-lg border border-bs p-3">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">재고 반영 방식</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="restockMethod"
                        checked={receivingForm.restockMethod === "merge"}
                        onChange={() =>
                          setReceivingForm((f) => ({
                            ...f,
                            restockMethod: "merge",
                          }))
                        }
                        className="w-4 h-4 text-emerald-600"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700  text-slate-700">기존 재고에 합산</span>
                        <p className="text-[10px] text-slate-400">같은 Product에 수량 추가</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="restockMethod"
                        checked={receivingForm.restockMethod === "newLot"}
                        onChange={() =>
                          setReceivingForm((f) => ({
                            ...f,
                            restockMethod: "newLot",
                          }))
                        }
                        className="w-4 h-4 text-emerald-600"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700  text-slate-700">새 Lot로 추가</span>
                        <p className="text-[10px] text-slate-400">InventoryRestock 이력 생성</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 입고 후 예상 재고 */}
                {receivingForm.actualQty && Number(receivingForm.actualQty) > 0 && selectedItem && (
                  <div className="rounded-lg bg-emerald-100  bg-emerald-100 px-4 py-3 text-sm flex justify-between">
                    <span className="text-emerald-700  text-emerald-700">입고 후 재고</span>
                    <span className="font-bold text-emerald-700  text-emerald-700">
                      {(selectedItem.currentQuantity + Number(receivingForm.actualQty)).toLocaleString()} {selectedItem.unit}
                    </span>
                  </div>
                )}

                {/* Footer CTA */}
                <div className="flex w-full gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsSheetOpen(false);
                      setDrawerMode("view");
                      setPurchaseContext(null);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!receivingForm.actualQty || Number(receivingForm.actualQty) <= 0 || restockMutation.isPending}
                    onClick={() => {
                      const addQty = Number(receivingForm.actualQty);
                      if (!addQty || addQty <= 0) return;

                      if (selectedItem) {
                        // 기존 재고에 입고 반영
                        restockMutation.mutate(
                          {
                            id: selectedItem.id,
                            addQty,
                            lotNumber: receivingForm.lotNumber || undefined,
                            expiryDate: receivingForm.expiryDate || undefined,
                          },
                          {
                            onSuccess: () => {
                              toast({
                                title: "입고 반영 완료",
                                description: `${purchaseContext.itemName || "품목"}의 입고가 반영되었습니다.`,
                              });
                              // 입고 완료된 아이템 → "라벨 바로 인쇄" CTA 표시
                              if (selectedItem) {
                                setRestockDoneItem(selectedItem);
                              }
                              setIsSheetOpen(false);
                              setDrawerMode("view");
                              setPurchaseContext(null);
                              // URL에서 purchase-receiving 파라미터 제거
                              router.replace("/dashboard/inventory");
                            },
                          },
                        );
                      } else {
                        toast({
                          title: "매칭된 재고 없음",
                          description: "재고 목록에서 해당 품목을 먼저 등록해주세요.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {restockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    입고 반영 완료
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ════ 기존 view mode ════ */}
          {drawerMode !== "purchase-receiving" && selectedItem && (
            <>
              {/* ── 헤더: 여백 압축 ── */}
              <SheetHeader className="mb-3 mt-3 border-b border-bd pb-3  border-bd">
                <div className="mb-1 flex items-center gap-1.5">
                  <Badge className="border-none bg-blue-900/50 text-blue-300 hover:bg-blue-100  bg-blue-900/50  text-blue-300 text-xs">시약 상세 정보</Badge>
                  {selectedItem.hazard && (
                    <Badge className="border-none bg-red-100 text-red-700  bg-red-100  text-red-700 text-xs">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      유해 물질
                    </Badge>
                  )}
                </div>
                <SheetTitle className="text-lg font-bold leading-tight">{selectedItem.product.name}</SheetTitle>
                {/* §11.366 D-8 — 영문명(nameEn) 보강 (§inventory-detail-relive 라이브 이식:
                    원 수정이 dead file(inventory-main, importer 0)에만 적용돼 미배송이었음) */}
                {selectedItem.product.nameEn && (
                  <p className="text-xs text-slate-500 leading-tight">{selectedItem.product.nameEn}</p>
                )}
                <SheetDescription className="flex items-center gap-2 text-sm text-slate-400  text-slate-400 mt-0.5">
                  <span>{selectedItem.product.brand ?? "-"}</span>
                  <span className="text-slate-600  text-slate-400">|</span>
                  <span className="font-mono text-xs">{selectedItem.product.catalogNumber ?? "-"}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3">
                {/* §11.366 D-8 — 현재고/안전재고 강조 (조회 핵심 — 기존엔 표시 부재). §inventory-detail-relive 이식 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-pn/50 px-3 py-2">
                    <p className="text-[10px] text-slate-500  text-slate-400">현재고</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {selectedItem.currentQuantity} {selectedItem.unit || "개"}
                    </p>
                  </div>
                  <div className="rounded-md bg-pn/50 px-3 py-2">
                    <p className="text-[10px] text-slate-500  text-slate-400">안전재고</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {selectedItem.safetyStock != null ? `${selectedItem.safetyStock} ${selectedItem.unit || "개"}` : "-"}
                    </p>
                  </div>
                </div>
                {/* ── Lot / 유효기한 카드: 패딩 압축 ── */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-pn/50 px-3 py-2">
                    <p className="text-[10px] text-slate-500  text-slate-400">Lot Number</p>
                    <p className="font-mono text-sm font-bold mt-0.5">{selectedItem.lotNumber ?? "-"}</p>
                  </div>
                  <div className="rounded-md bg-pn/50 px-3 py-2">
                    <p className="text-[10px] text-slate-500  text-slate-400">유효 기한</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedItem.expiryDate ? format(new Date(selectedItem.expiryDate), "yyyy.MM.dd", { locale: ko }) : "-"}</p>
                  </div>
                </div>

                {/* ── 기본 정보 + 관리 정보: 2단 그리드 배치 ── */}
                <div>
                  <h4 className="mb-1.5 flex items-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <Info className="mr-1.5 h-3 w-3 text-slate-400" />
                    기본 정보
                  </h4>
                  {/* §11.366 D-8 Phase 2 — 모바일 세로 스택(grid-cols-1)으로 값 잘림·가로 욱여넣기 0. 데스크탑(sm+) 2칸 유지. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 border-t border-bd pt-2  border-bd">
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">제조사</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.product.brand ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">Cat.No.</span>
                      <span className="font-mono text-xs font-medium truncate text-right">{selectedItem.product.catalogNumber ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">구매처</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.vendor ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">배송기간</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.deliveryPeriod ?? "-"}</span>
                    </div>
                    {/* §11.366 D-8 — 보관위치(location) 보강 */}
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">보관위치</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.location ?? "-"}</span>
                    </div>
                    {/* §11.366 D-8 — 고유 식별자 = inv.id (§11.355-B 라벨 QR 인코딩과 정합). */}
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">고유 식별자</span>
                      <span className="font-mono text-[10px] font-medium truncate text-right">{selectedItem.id}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-1.5 flex items-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <Info className="mr-1.5 h-3 w-3 text-slate-400" />
                    관리 정보
                  </h4>
                  {/* §11.366 D-8 Phase 2 — 모바일 세로 스택. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 border-t border-bd pt-2  border-bd">
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">사용/미개봉</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.inUseOrUnopened ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">평균유효기한</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.averageExpiry ?? "-"}</span>
                    </div>
                    {/* §inventory-edit-blank-fields — 「시험항목」 표시 제거. testPurpose 컬럼이 없어
                        항상 "-" 였다(입력·저장·표시 3단 전부 죽어 있었다). */}
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">보관조건</span>
                      {/* §inventory-edit-blank-fields — 편집은 제거했다(SDS 가 출처인 안전 정보).
                          현재 값 출처가 없어 항상 "-" 다 · 제품 값 평탄화는 별건. */}
                      <span className="text-xs font-medium truncate text-right">{getStorageConditionLabel(selectedItem.storageCondition)}</span>
                    </div>
                  </div>
                </div>

                {/* ── 특이사항: min-h 축소 ── */}
                <div>
                  <h4 className="mb-1.5 flex items-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <FileText className="mr-1.5 h-3 w-3 text-slate-400" />
                    특이사항
                  </h4>
                  <div className="rounded-md border border-blue-900 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-slate-600 min-h-[40px]">{selectedItem.notes || "등록된 특이사항이 없습니다."}</div>
                </div>

                {/* ── 재고 부족 알림 기준: 한 줄 inline 배치 ── */}
                <div className="rounded-md border border-bd bg-pn/30 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <BellRing className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-900">안전 재고 기준</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input id="sheet-minQty" type="number" min={0} value={sheetSafetyStock} onChange={(e) => setSheetSafetyStock(e.target.value)} className="w-20 h-7 text-xs bg-sh" />
                      <span className="text-xs text-slate-500">{selectedItem.unit || "개"}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs shrink-0 border-blue-800 bg-sh text-blue-400 hover:bg-blue-50"
                        disabled={createOrUpdateMutation.isPending}
                        onClick={() => {
                          const value = parseInt(sheetSafetyStock, 10);
                          if (isNaN(value) || value < 0) return;
                          const payload = {
                            id: selectedItem.id,
                            productId: selectedItem.productId,
                            currentQuantity: selectedItem.currentQuantity,
                            unit: selectedItem.unit,
                            safetyStock: value,
                            minOrderQty: selectedItem.minOrderQty ?? undefined,
                            location: selectedItem.location ?? undefined,
                            notes: selectedItem.notes ?? undefined,
                            expiryDate: selectedItem.expiryDate ?? undefined,
                          };
                          createOrUpdateMutation.mutate(payload, {
                            onSuccess: () => {
                              setSelectedItem((prev) => (prev ? { ...prev, safetyStock: value } : null));
                              toast({
                                title: "알림 기준 저장됨",
                                description: `최소 유지 수량이 ${value} ${selectedItem.unit || "개"}(으)로 설정되었습니다.`,
                              });
                            },
                          });
                        }}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400  text-slate-500">이 수량 이하로 떨어지면 대시보드에서 경고 알림이 발생합니다.</p>
                </div>

                {/* 입고 이력 토글 섹션 */}
                <div className="border-t border-bd  border-bd pt-4">
                  <button className="flex w-full items-center justify-between text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors" onClick={() => setShowRestockHistory((v) => !v)}>
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4 text-emerald-600" />
                      입고 이력
                    </span>
                    <span className="text-xs text-slate-400">{showRestockHistory ? "접기" : "펼치기"}</span>
                  </button>
                  {showRestockHistory && (
                    <div className="mt-3 space-y-2">
                      {isLoadingRestockHistory ? (
                        <p className="text-xs text-slate-400 py-2 text-center">불러오는 중...</p>
                      ) : !restockHistoryData?.records?.length ? (
                        <p className="text-xs text-slate-400 py-2 text-center">입고 이력이 없습니다.</p>
                      ) : (
                        restockHistoryData.records.map((r: any) => (
                          <div key={r.id} className="rounded-lg border border-bd  border-bd px-3 py-2.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-emerald-700">
                                +{r.quantity.toLocaleString()} {r.unit || selectedItem.unit}
                              </span>
                              <span className="text-slate-400">{format(new Date(r.restockedAt), "yyyy.MM.dd HH:mm", { locale: ko })}</span>
                            </div>
                            {(r.lotNumber || r.expiryDate) && (
                              <div className="mt-1 flex gap-3 text-slate-500">
                                {r.lotNumber && <span>Lot: {r.lotNumber}</span>}
                                {r.expiryDate && <span>유효: {format(new Date(r.expiryDate), "yyyy.MM.dd", { locale: ko })}</span>}
                              </div>
                            )}
                            {r.user && <div className="mt-0.5 text-slate-400">{r.user.name || r.user.email}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex w-full gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsSheetOpen(false);
                      setEditingInventory(selectedItem);
                      setIsDialogOpen(true);
                    }}
                  >
                    수정하기
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      // §inventory-reorder-surface-unify P3 — 상세 Sheet 재발주 진입 = 통합 패널(reorder mode). AiAssistant retire.
                      setIsSheetOpen(false);
                      openReorderReview(selectedItem);
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    재발주 검토
                  </Button>
                </div>
              </div>

              {/* 운영 실행 현황 */}
              <OpsExecutionContext entityType="INVENTORY_RESTOCK" entityId={selectedItem.id} compact className="mt-4 pt-4 border-t border-bd  border-bd" />
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 입고 Dialog */}
      <Dialog
        open={!!restockItem}
        onOpenChange={(open) => {
          if (!open) {
            setRestockItem(null);
            setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" });
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <span>입고 수량 추가</span>
            </DialogTitle>
            <DialogDescription>
              {restockItem?.product.name}
              {restockItem?.product.catalogNumber && <span className="ml-1 text-xs text-slate-400">{restockItem.product.catalogNumber}</span>}
            </DialogDescription>
          </DialogHeader>
          {restockItem && (
            <div className="space-y-4 pt-1">
              {/* 신규 Lot 이력 안내 */}
              <div className="rounded-lg bg-emerald-100 border border-emerald-800  bg-emerald-100  border-emerald-800 px-3 py-2 text-xs text-emerald-700  text-emerald-700 flex items-start gap-2">
                <PackagePlus className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  입고 수량과 Lot 정보는 <strong>신규 입고 이력</strong>으로 별도 기록됩니다. 기존 Lot 데이터는 유지됩니다.
                </span>
              </div>
              <div className="rounded-lg bg-el px-4 py-3 text-sm flex justify-between">
                <span className="text-slate-500">현재 재고</span>
                <span className="font-semibold">
                  {restockItem.currentQuantity.toLocaleString()} {restockItem.unit}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="restock-qty">
                  추가 수량 <span className="text-red-500">*</span>
                </Label>
                <Input id="restock-qty" type="number" min="1" placeholder="추가할 수량 입력" value={restockForm.addQty} onChange={(e) => setRestockForm((f) => ({ ...f, addQty: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="restock-lot">
                  Lot 번호 <span className="text-slate-400 font-normal text-xs">(선택)</span>
                </Label>
                <Input id="restock-lot" placeholder="예: LOT-2024-001" value={restockForm.lotNumber} onChange={(e) => setRestockForm((f) => ({ ...f, lotNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>
                  유효기간 <span className="text-slate-400 font-normal text-xs">(선택)</span>
                </Label>
                <DatePicker
                  date={restockForm.expiryDate ? new Date(restockForm.expiryDate) : undefined}
                  onDateChange={(date) =>
                    setRestockForm((f) => ({
                      ...f,
                      expiryDate: date ? date.toISOString().split("T")[0] : "",
                    }))
                  }
                  placeholder="유효기한 선택"
                />
              </div>
              {restockForm.addQty && Number(restockForm.addQty) > 0 && (
                <div className="rounded-lg bg-emerald-100  bg-emerald-100 px-4 py-3 text-sm flex justify-between">
                  <span className="text-emerald-700">입고 후 재고</span>
                  <span className="font-bold text-emerald-700">
                    {(restockItem.currentQuantity + Number(restockForm.addQty)).toLocaleString()} {restockItem.unit}
                  </span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setRestockItem(null);
                    setRestockForm({
                      addQty: "",
                      lotNumber: "",
                      expiryDate: "",
                    });
                  }}
                >
                  취소
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!restockForm.addQty || Number(restockForm.addQty) <= 0 || restockMutation.isPending}
                  onClick={() => {
                    const addQty = Number(restockForm.addQty);
                    if (!addQty || addQty <= 0) return;
                    restockMutation.mutate({
                      id: restockItem.id,
                      addQty,
                      lotNumber: restockForm.lotNumber || undefined,
                      expiryDate: restockForm.expiryDate || undefined,
                    });
                  }}
                >
                  {restockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  입고 확정
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 입고 완료 → 라벨 바로 인쇄 CTA ── */}
      <Dialog
        open={!!restockDoneItem}
        onOpenChange={(open) => {
          if (!open) setRestockDoneItem(null);
        }}
      >
        <DialogContent className="max-w-xs text-center">
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100  bg-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-lg">입고 완료</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {restockDoneItem?.product.name} 입고가 반영되었습니다.
                <br />
                라벨을 바로 인쇄하시겠습니까?
              </DialogDescription>
            </DialogHeader>
            <div className="flex w-full gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setRestockDoneItem(null)}>
                닫기
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  if (restockDoneItem) {
                    handleSingleLabelPrint(restockDoneItem);
                  }
                  setRestockDoneItem(null);
                }}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                라벨 인쇄
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 새 라벨 인쇄 모달 (규격 선택 + 미리보기) ── */}
      <LabelPrintModal
        open={newLabelPrintOpen}
        onOpenChange={setNewLabelPrintOpen}
        selectedItems={displayInventories.slice(0, 10).map((inv) => ({
          id: inv.id,
          name: inv.product?.name ?? inv.productName ?? "품목",
          catalogNumber: inv.product?.catalogNumber ?? undefined,
          lotNumber: inv.lotNumber ?? undefined,
          expiryDate: inv.expiryDate ?? undefined,
          brand: inv.product?.brand ?? undefined,
        }))}
      />

      {/* ── 기존 라벨 인쇄 모달 (lot 선택형) ── */}
      <Dialog open={labelPrintOpen} onOpenChange={setLabelPrintOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Printer className="h-4 w-4 text-indigo-600" />
              라벨 인쇄 — {labelPrintTitle}
            </DialogTitle>
            <DialogDescription>인쇄할 Lot를 선택하고 라벨 수량을 지정하세요.</DialogDescription>
          </DialogHeader>
          {/* 인쇄 모드 선택 */}
          <div className="flex items-center gap-2 py-2 px-1">
            <span className="text-xs text-slate-500 shrink-0">인쇄 모드:</span>
            <div className="flex rounded-lg border border-bs overflow-hidden text-xs">
              <button type="button" className={`px-3 py-1.5 transition-colors ${labelPrintMode === "a4-multi" ? "bg-indigo-600 text-white" : "bg-pn text-slate-400 hover:bg-el"}`} onClick={() => setLabelPrintMode("a4-multi")}>
                A4 멀티 라벨 (3×7)
              </button>
              <button type="button" className={`px-3 py-1.5 transition-colors ${labelPrintMode === "single" ? "bg-indigo-600 text-white" : "bg-pn text-slate-400 hover:bg-el"}`} onClick={() => setLabelPrintMode("single")}>
                개별 라벨 (60×40mm)
              </button>
            </div>
          </div>
          <div className="space-y-3 pt-1 max-h-[50vh] overflow-y-auto">
            {labelPrintLots.map((lot) => {
              const isChecked = labelPrintSelected.has(lot.id);
              const qty = labelPrintQty[lot.id] ?? 1;
              return (
                <div key={lot.id} className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${isChecked ? "border-indigo-800 bg-indigo-50" : "border-bs bg-pn"}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      setLabelPrintSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(lot.id)) next.delete(lot.id);
                        else next.add(lot.id);
                        return next;
                      });
                    }}
                    className="mt-1 h-4 w-4 rounded border-bs text-indigo-600 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-semibold text-slate-600">{lot.lotNumber || "Lot 미지정"}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">
                        {lot.currentQuantity} {lot.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      {lot.location && <span>{lot.location}</span>}
                      {lot.expiryDate && (
                        <>
                          <span>·</span>
                          <span>유효: {format(new Date(lot.expiryDate), "yyyy.MM.dd")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Label className="text-[10px] text-slate-400">라벨</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={qty}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                        setLabelPrintQty((prev) => ({ ...prev, [lot.id]: v }));
                      }}
                      className="h-7 w-14 text-xs text-center"
                      disabled={!isChecked}
                    />
                    <span className="text-[10px] text-slate-400">장</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-bd  border-bd mt-1">
            <div className="text-xs text-slate-500">
              선택 {labelPrintSelected.size}개 Lot · 총 {Array.from(labelPrintSelected).reduce((sum, id) => sum + (labelPrintQty[id] ?? 1), 0)}장
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setLabelPrintOpen(false)}>
                취소
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                disabled={labelPrintSelected.size === 0}
                onClick={async () => {
                  const selectedLots = labelPrintLots.filter((l) => labelPrintSelected.has(l.id));
                  if (selectedLots.length === 0) return;
                  const printWindow = window.open("", "_blank", "width=600,height=600");
                  if (!printWindow) {
                    toast({
                      title: "팝업이 차단되었습니다.",
                      variant: "destructive",
                    });
                    return;
                  }
                  const { default: QRCode } = await import("qrcode");
                  const labels = await Promise.all(
                    selectedLots.flatMap((lot) => {
                      const copies = labelPrintQty[lot.id] ?? 1;
                      return Array.from({ length: copies }, async () => {
                        const url = `${window.location.origin}/dashboard/inventory/scan?id=${lot.id}`;
                        const canvas = document.createElement("canvas");
                        await QRCode.toCanvas(canvas, url, {
                          width: 180,
                          margin: 2,
                          color: { dark: "#1e293b", light: "#ffffff" },
                        });
                        return buildLabelHtml({
                          qrDataUrl: canvas.toDataURL("image/png"),
                          name: lot.product.name,
                          cat: lot.product.catalogNumber,
                          lot: lot.lotNumber,
                          loc: lot.location,
                          qty: lot.currentQuantity,
                          unitStr: lot.unit,
                          invId: lot.id,
                        });
                      });
                    }),
                  );
                  const totalLabels = labels.length;
                  const dlgModeDesc = labelPrintMode === "a4-multi" ? "A4 멀티 라벨 (3×7)" : "개별 라벨 (60×40mm)";
                  printWindow.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>라벨 인쇄 — ${escHtml(labelPrintTitle)}</title><style>${getLabelStyles(labelPrintMode)}</style></head><body>
                      <p class="screen-hint">📄 인쇄 미리보기 — <strong>${selectedLots.length}개 Lot · ${totalLabels}장</strong> · ${dlgModeDesc}</p>
                      <div class="label-grid">${labels.join("\n")}</div>
                      <div class="btn-row"><button class="btn-print" onclick="window.print()">🖨️ 인쇄하기</button><button class="btn-close" onclick="window.close()">닫기</button></div>
                    </body></html>`);
                  printWindow.document.close();
                  setLabelPrintOpen(false);
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                라벨 인쇄
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 기존 탭 구조는 숨김 처리 (필요시 나중에 복원 가능) */}
      

      {/* 모바일 하단 고정 액션 — 재고 등록 & 차감 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-sh/95 backdrop-blur-sm border-t border-bd/50 px-4 py-2.5 safe-area-bottom">
        <div className="flex items-center gap-2 max-w-7xl mx-auto">
          <Button variant="outline" size="sm" className="flex-1 h-11 text-xs gap-1.5 border-blue-800 text-blue-400  text-blue-400 hover:bg-blue-50" onClick={() => setIsDialogOpen(true)}>
            <PackagePlus className="h-3.5 w-3.5" />
            재고 등록
          </Button>
          <Button size="sm" className="flex-1 h-11 text-xs gap-1.5 bg-el text-slate-900 hover:bg-slate-200 shadow-sm" onClick={openQRScanner}>
            <TrendingDown className="h-3.5 w-3.5" />
            재고 차감
          </Button>
        </div>
      </div>

      {/* Framer Motion 토스트 알림 (재고 등록/수정 시) */}
      <AnimatePresence>
        {createOrUpdateMutation.isSuccess && (
          <motion.div key="inventory-toast" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }} className="fixed bottom-8 right-8 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-2xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            {/* §inventory-toast-edit-label (2026-09-11 prod 실측 P3) — 문구가 "등록" 으로 하드코딩돼
                수정 때도 "등록되었습니다" 가 떴다. 위 972 의 shadcn 토스트와 같은 판정(variables.id)을 쓴다. */}
            <span className="text-sm font-medium text-emerald-900">
              {createOrUpdateMutation.variables?.id ? "재고가 수정되었습니다." : "재고가 등록되었습니다."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* §inventory-reorder-surface-unify P4 — InventoryAiAssistantPanel(분석 래퍼) inventory 트리거 retire.
          재발주 검토는 ReorderReviewSheet 승격(InventoryReorderReviewSheet)으로 대체. 컴포넌트 파일은 보존(rollback). */}

      {/* §inventory-mobile-reorder-gate P1 — §11.155 모바일 브리핑 시트 재배치: 기존 위치가
          데스크톱 컨테이너(hidden md:flex) 내부라 모바일에서 조상 display:none으로 미렌더(dead).
          top-level 이동으로 모바일 detail/reorder 브리핑 복원. props 무변경. */}
        {/* §11.155 모바일 변종 — desktop context panel (w-[420px]) 와 mutually exclusive */}
        {contextPanelOpen && contextPanelItem && (
          <MobileOperationalBriefSheet
            open={contextPanelOpen}
            mode={contextPanelMode}
            onClose={() => setContextPanelItem(null)}
            objectLabel="선택한 재고"
            chips={[
              { id: "summary", label: "상태 요약" },
              { id: "facts", label: "보유량" },
              { id: "risks", label: "리스크" },
              { id: "next", label: "재발주" },
            ]}
            summary={<p className="text-xs text-slate-700 leading-relaxed">{contextPanelItem.currentQuantity === 0 ? "재고 소진 — 즉시 재발주 필요" : contextPanelItem.safetyStock !== null && contextPanelItem.currentQuantity <= contextPanelItem.safetyStock ? `안전재고 미달 (${contextPanelItem.currentQuantity}/${contextPanelItem.safetyStock} ${contextPanelItem.unit})` : "안정 — 운영 정상"}</p>}
            facts={
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">보유량</span>
                  <span className="font-medium">
                    {contextPanelItem.currentQuantity} {contextPanelItem.unit}
                  </span>
                </div>
                {contextPanelItem.safetyStock !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">안전재고</span>
                    <span>
                      {contextPanelItem.safetyStock} {contextPanelItem.unit}
                    </span>
                  </div>
                )}
                {contextPanelItem.location && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">위치</span>
                    <span>{contextPanelItem.location}</span>
                  </div>
                )}
              </div>
            }
            risks={(() => {
              // §stock-risk-consolidation P2 — 재발주 차단 사유(RFQ 진행·예산 초과) 실데이터 노출.
              const blk = reorderBlockReasonsFor(contextPanelItem.id);
              if (blk.length > 0) return <div className="space-y-0.5">{blk.map((b, i) => <p key={i} className="text-xs font-semibold text-[#b45821]">차단 · {b}</p>)}</div>;
              return contextPanelItem.expiryDate && new Date(contextPanelItem.expiryDate).getTime() < Date.now() ? <p className={`text-xs ${inventoryToneClass("expired").text}`}>유효기간 만료</p> : <p className="text-xs text-slate-500">차단 없음</p>;
            })()}
            next={<p className="text-xs text-slate-700">재발주 또는 정보 수정</p>}
            primaryCta={(() => {
              // §inventory-reorder-surface-unify P2 — 모바일 재발주 진입 = ReorderReviewSheet(승격) 직접 오픈.
              //   recommendedQty = canonical(/reorder-recommendations). 추천 없으면 disabled(dead button 0, 가짜 0 금지).
              const qty = reorderRecommendedQtyFor(contextPanelItem.id);
              const blocked = reorderBlockReasonsFor(contextPanelItem.id).length > 0;
              const hasRec = qty != null && qty > 0;
              return {
                // §stock-risk-consolidation P2 — 차단(RFQ 진행·예산 초과) 시 재발주 flow 차단(dead button 방지, 사유는 risks에 노출).
                label: blocked ? "재발주 차단됨" : hasRec ? `재발주안 검토 (${qty}${contextPanelItem.unit})` : "재발주 권장 없음",
                disabled: blocked || !hasRec,
                onClick: () => {
                  if (blocked) return;
                  const match = displayInventories.find((inv) => inv.id === contextPanelItem.id);
                  setContextPanelItem(null);
                  if (match) openReorderReviewSheet(match);
                },
              };
            })()}
          />
        )}

      {/* §inventory-reorder-surface-unify P2 — content-level 재발주안 검토 시트(ReorderReviewSheet 승격).
          recommendedQty = canonical(/reorder-recommendations) — 데스크탑 패널과 동일 소스. null이면 미표시(가짜 0 금지). */}
      <InventoryReorderReviewSheet
        open={reorderReviewItem !== null}
        onClose={() => {
          setReorderReviewItem(null);
          // §inventory-mobile-reorder-gate — fallback/override 일회성 상태 정리(다음 오픈 오염 방지).
          setReorderReviewFallbackQty(null);
          setReorderOverrideReasons(null);
        }}
        productId={reorderReviewItem?.productId ?? null}
        productName={reorderReviewItem?.product.name ?? null}
        recommendedQty={reorderRecommendedQtyFor(reorderReviewItem?.id)}
        unit={reorderReviewItem?.unit ?? undefined}
        storageLocation={reorderReviewItem?.location ?? undefined}
        fallbackQty={reorderReviewFallbackQty}
        currentQuantity={reorderReviewItem?.currentQuantity ?? null}
        safetyStock={reorderReviewItem?.safetyStock ?? null}
        breakdown={reorderRecommendationsData?.recommendations?.find((r) => r.inventoryId === reorderReviewItem?.id)?.recommendationBreakdown ?? null}
        overrideReasons={reorderOverrideReasons}
        onSearchVendors={() => {
          // §inventory-reorder-surface-unify P4 / §11.381c — 공급사 소싱 검색 진입(AiAssistant onViewVendors 대체).
          if (reorderReviewItem) router.push(`/app/search?q=${encodeURIComponent(reorderReviewItem.product.name)}`);
        }}
      />

      {/* §inventory-mobile-reorder-gate P3 — 중복 발주 위험 소프트 게이트(하드 차단 금지).
          canonical blockReasons(/reorder-recommendations: RFQ 진행·예산 초과) 노출 후
          '그래도 재발주 검토 진행'으로 경로 유지 + override 사유를 검토 시트·견적 초안 reason에 전파. */}
      <InventoryReorderBlockedSheet
        open={reorderBlockedState !== null}
        onClose={() => setReorderBlockedState(null)}
        productName={reorderBlockedState?.item.product.name ?? null}
        reasons={reorderBlockedState?.reasons ?? []}
        currentQuantity={reorderBlockedState?.item.currentQuantity ?? null}
        safetyStock={reorderBlockedState?.item.safetyStock ?? null}
        unit={reorderBlockedState?.item.unit ?? undefined}
        onViewQuotes={() => {
          setReorderBlockedState(null);
          router.push("/dashboard/quotes");
        }}
        onProceed={() => {
          const blockedItem = reorderBlockedState?.item;
          const reasons = reorderBlockedState?.reasons ?? [];
          setReorderBlockedState(null);
          if (!blockedItem) return;
          setReorderOverrideReasons(reasons);
          const pQty = reorderRecommendedQtyFor(blockedItem.id);
          setReorderReviewFallbackQty(pQty != null && pQty > 0 ? null : Math.max(0, (blockedItem.safetyStock ?? 0) - blockedItem.currentQuantity));
          openReorderReviewSheet(blockedItem);
        }}
      />

      {/* ── #inventory-lot-overlay P5 — Lot 추적 same-canvas 풀스크린 overlay (새 route 금지) ── */}
      {isLotOverlayOpen && (() => {
        const { sorted, summary, uncoveredCount } = lotView;
        const filtered = filterLotsByStatus(sorted, lotStatusFilter);
        const searched = lotSearchQuery.trim() ? searchLots(filtered, lotSearchQuery) : filtered;
        const selectedLot = selectedLotId ? searched.find((l) => l.lotId === selectedLotId) ?? sorted.find((l) => l.lotId === selectedLotId) ?? null : null;
        const timeline = buildLotTimeline(selectedLot);
        return (
          <div
            data-testid="lot-tracking-overlay"
            className="fixed inset-0 z-50 flex flex-col bg-white"
            role="dialog"
            aria-modal="true"
            aria-label="Lot 추적"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-6">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  Lot 추적 <span className="font-medium text-slate-400">· {summary.totalLots}건</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsLotOverlayOpen(false)}
                className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter chips + search */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 md:px-6">
              {([
                { key: "all" as LotStatusFilter, label: "전체", count: summary.totalLots },
                { key: "expiring_soon" as LotStatusFilter, label: "만료 임박", count: summary.expiringSoonLots },
                { key: "expired" as LotStatusFilter, label: "만료/소진", count: summary.expiredLots + summary.depletedLots },
                { key: "active" as LotStatusFilter, label: "활성", count: summary.activeLots },
              ]).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setLotStatusFilter(c.key)}
                  className={`shrink-0 rounded-full px-3 min-h-[36px] text-xs font-medium border transition-colors ${lotStatusFilter === c.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                >
                  {c.label} {c.count}
                </button>
              ))}
              <div className="relative ml-auto hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={lotSearchQuery} onChange={(e) => setLotSearchQuery(e.target.value)} placeholder="LOT·품목·위치 검색..." className="pl-9 h-9 w-64 text-sm bg-white border-slate-200" />
              </div>
            </div>

            {/* Body: list + timeline */}
            <div className="flex flex-1 min-h-0 flex-col md:flex-row">
              {/* Left — lot list */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 md:px-6 md:border-r md:border-slate-100">
                {uncoveredCount > 0 && (
                  <p className="mb-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[11px] text-gray-500">
                    입고 lot 기록이 없어 추적되지 않는 품목 {uncoveredCount}개 (현재고 있음).
                  </p>
                )}
                {searched.length === 0 ? (
                  <div className="rounded-xl px-6 py-10 text-center bg-white border border-slate-200">
                    <Archive className="h-8 w-8 mx-auto mb-3 text-slate-400" />
                    <p className="text-sm font-medium text-slate-500">{lotStatusFilter !== "all" ? `${getLotStatusLabel(lotStatusFilter as any)} 상태의 Lot이 없습니다` : "Lot 데이터가 없습니다"}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searched.map((lot) => {
                      const sc = getLotStatusColor(lot.status);
                      const isSel = selectedLotId === lot.lotId;
                      const isChecked = lotMultiSelect.has(lot.lotId);
                      return (
                        <div
                          key={lot.lotId}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${isSel ? "ring-2 ring-blue-500/50 border-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:bg-slate-50"}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setLotMultiSelect((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(lot.lotId); else next.delete(lot.lotId);
                                return next;
                              });
                            }}
                            aria-label={`${lot.lotCode} 선택`}
                            className="h-4 w-4 shrink-0"
                          />
                          <button type="button" onClick={() => setSelectedLotId(lot.lotId)} className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold text-slate-900 shrink-0">{lot.lotCode}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0" style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}>
                                  {getLotStatusLabel(lot.status)}
                                </span>
                                <span className="text-[11px] text-slate-600 truncate">{lot.productName}</span>
                              </div>
                              <span className="text-xs font-bold text-slate-900 shrink-0">
                                {lot.receivedQty != null ? `${lot.receivedQty} ${lot.unit}` : "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                              {lot.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{lot.location}</span>}
                              {lot.expiresAt && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />유효 {format(new Date(lot.expiresAt), "yy.MM.dd")}</span>}
                              {lot.receivedAt && <span className="flex items-center gap-1"><PackagePlus className="h-3 w-3" />입고 {format(new Date(lot.receivedAt), "yy.MM.dd")}</span>}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right — lot event timeline */}
              <div data-testid="lot-event-timeline" className="w-full md:w-96 shrink-0 overflow-y-auto border-t border-slate-100 md:border-t-0 px-4 py-3 md:px-6 bg-slate-50/50">
                {!selectedLot ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <p className="text-xs text-slate-400">Lot을 선택하면 입고·사용 이력이 표시됩니다.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <p className="text-xs font-bold text-slate-900">{selectedLot.lotCode} 이력</p>
                      <p className="text-[11px] text-slate-500">{selectedLot.productName}</p>
                    </div>
                    {timeline.length === 0 ? (
                      <p className="rounded-lg bg-white border border-slate-200 px-3 py-3 text-[11px] text-slate-400">이 Lot에 귀속된 입고·사용 이력이 없습니다.</p>
                    ) : (
                      <ol className="space-y-2">
                        {timeline.map((ev) => {
                          const isReceive = ev.type === "receive";
                          return (
                            <li key={ev.id} className="flex items-start gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
                              <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isReceive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                {isReceive ? <PackagePlus className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold text-slate-900">{isReceive ? "입고" : "사용"}</span>
                                  <span className={`text-[11px] font-bold ${isReceive ? "text-emerald-700" : "text-slate-700"}`}>{isReceive ? "+" : "−"}{ev.quantity} {selectedLot.unit}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  <span>{format(new Date(ev.timestamp), "yyyy.MM.dd HH:mm", { locale: ko })}</span>
                                  {ev.operator && <span className="truncate">· {ev.operator}</span>}
                                </div>
                                {ev.note && <p className="mt-0.5 text-[10px] text-slate-500 truncate">{ev.note}</p>}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    <p className="mt-2 text-[10px] text-slate-400">사용 이력은 Lot 번호가 귀속된 기록만 표시됩니다. 과거 미귀속 사용은 품목 단위로만 집계됩니다.</p>
                  </>
                )}
              </div>
            </div>

            {/* Bottom bar — 다건 선택 시 일괄출고(정직-disabled) */}
            {lotMultiSelect.size > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 md:px-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">{lotMultiSelect.size}개 Lot 선택됨</span>
                  <button type="button" onClick={() => setLotMultiSelect(new Set())} className="text-[11px] text-slate-400 hover:text-slate-600">선택 해제</button>
                </div>
                <button
                  type="button"
                  data-lot-batch-dispatch-open="true"
                  onClick={() => setIsBatchDispatchOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 min-h-[44px] text-xs font-semibold text-white transition-colors"
                >
                  <Truck className="h-4 w-4" />
                  일괄 출고
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── #inventory-batch-dispatch — 다건 배치출고 sheet ── */}
      <LotBatchDispatchSheet
        open={isBatchDispatchOpen}
        onOpenChange={setIsBatchDispatchOpen}
        lots={lotView.sorted.filter((l) => lotMultiSelect.has(l.lotId)).map((l) => ({ inventoryId: l.itemId, lotCode: l.lotCode, productName: l.productName, unit: l.unit }))}
        onDispatched={() => setLotMultiSelect(new Set())}
      />

      {/* ── LOT Disposal Panel (object-scoped disposal dock) ── */}
      <LotDisposalPanel
        open={disposalPanelOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDisposalTarget(null);
            setDisposalInventoryId(null);
            setDisposalCompletionSummary(null);
          }
        }}
        target={disposalTarget}
        isSubmitting={disposeLotMutation.isPending}
        completionSummary={disposalCompletionSummary}
        onConfirmDisposal={(params) => {
          const sourceInventory = displayInventories.find((inv) => inv.id === disposalInventoryId);
          if (!sourceInventory) {
            toast({
              title: "폐기 대상 LOT를 찾을 수 없습니다",
              description: "재고 목록을 새로고침한 뒤 다시 시도해주세요.",
              variant: "destructive",
            });
            return;
          }
          disposeLotMutation.mutate({
            inventory: sourceInventory,
            params,
          });
        }}
        onNavigateToReorder={(productName) => {
          setDisposalTarget(null);
          setDisposalInventoryId(null);
          setDisposalCompletionSummary(null);
          const matchingItem = displayInventories.find((inv) => inv.product.name === productName);
          if (matchingItem) {
            openReorderReview(matchingItem);
          }
        }}
      />

      {/* §11.181 — 운영 브리핑 floating entry (default = popup open).
          §11.258-sweep — §11.257 후속: 모바일 (<lg) 에서 BarcodeScanFab 과
          좌표 겹침 (둘 다 bottom-[72px] right-4 z-40) 해소. 데스크탑 한정 노출.
          모바일 inline 진입 동선은 §11.258-sweep-2 백로그. */}
      <div className="hidden lg:block">
        <OperationalBriefFloatingEntry controls="operational-brief-popup" />
      </div>
      {/* §11.258-sweep-2 — 모바일 좌측 하단 ✨ 운영 브리핑 진입 (방안 1). */}
      <MobileBriefInlineButton />
    </div>
  );
}

// 🛑 삭제 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정) — 소비자 0 이 된 고아 컴포넌트 3개(481줄).
//   InventoryCard · TeamInventoryCard — 유일한 렌더 지점이 지운 `{false && (…)}` 블록 안이었다(HEAD 3944 · 4020).
//   InventoryForm — HEAD 에서도 사용 지점 0 이었다. 이번 삭제와 무관한 원래 고아다.
//   · InventoryCard 의 차감 GMP 명제는 살아 있는 다른 표면이 이어받는다 —
//     inventory/scan/page.tsx · GlobalQRScannerModal.tsx 와 그 센티넬 2개(scan-gmp-usage-fields-p3uia · qr-gmp-usage-fields-p3uia2).
//   역계약: __tests__/regression/inventory-dead-tabs-removed.test.ts
export function InventoryContent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <InventoryPageContent />
    </Suspense>
  );
}

/** §loading-empty-state · KPI 값 자리 · 데이터 도착 전에는 숫자·「✓ 정상」 대신 이것만 그린다. */
function KpiPendingValue({ error }: { error: boolean }) {
  return (
    <span className="mt-0.5 block text-sm font-semibold text-slate-400" aria-busy={!error}>
      {error ? "불러오지 못함" : "불러오는 중"}
    </span>
  );
}
