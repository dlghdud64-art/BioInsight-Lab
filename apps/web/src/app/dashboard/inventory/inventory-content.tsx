"use client";

// §11.283c #inventory-content-traffic-light — amber/orange 토큰 → yellow/red 신호등 sweep (호영님 P0 spec, §11.283 cluster C, 30+ spot byte-level swap).
import { isSuspectReceivedQuantity, countSuspectInventories } from "@/lib/inventory/suspect-received-quantity";
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
import { requiredUsageFields, DEFAULT_TRACKING_MODE, type TrackingMode } from "@/lib/inventory/tracking-mode";
import { invalidateBriefNarrative } from "@/lib/hooks/use-operational-brief";
// §11.317 — 헤더 1줄 배너 → 운영 브리핑 popup open (canonical truth 보존, dead button 0)
import { useOperationalBriefPopup } from "@/components/operational-brief/popup-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// Dialog kept static — radix portal needed for SSR hydration
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { isReorderNeeded, isReorderNeededByLeadTime } from "@/lib/inventory/reorder-need";
import { Switch } from "@/components/ui/switch";
// §11.297f Radix DropdownMenu* import 제거 — 5 dropdown 모두 ActionMenu
// (utility/card/issue alert) 또는 plain dropdown (filter) 으로 swap 완료.
import { ActionMenu } from "@/components/inventory/action-menu";
// §11.196f — dead lucide imports 9 symbol 제거 (ArrowLeftRight Clock
//   FlaskConical GitBranch LayoutDashboard List RotateCcw ShoppingCart X
//   actual JSX/prop 사용 0). 나머지 보존.
import { Plus, Package, AlertTriangle, Edit, Trash2, TrendingDown, History, Calendar, Users, MapPin, Loader2, CheckCircle2, ArrowRight, Zap, Check, Upload, Download, Filter, Search, LayoutGrid, ListFilter, FileDown, QrCode, PackagePlus, MoreVertical, Eye, Printer, Truck, XCircle, ChevronRight, ScanLine, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
const ImportStagingWorkbench = dynamic(() => import("@/components/inventory/import-staging-workbench").then((m) => m.ImportStagingWorkbench), { ssr: false });
const StockLifespanGauge = dynamic(() => import("@/components/inventory/stock-lifespan-gauge").then((m) => m.StockLifespanGauge), { ssr: false });
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
  testPurpose?: string | null;
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
  testPurpose?: string | null;
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
    brand: string | null;
    catalogNumber: string | null;
  };
}

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
  // §11.297f filter dropdown plain state.
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportStagingOpen, setIsImportStagingOpen] = useState(false);
  const [isSmartReceiveOpen, setIsSmartReceiveOpen] = useState(false);
  // §11.317 — 헤더 1줄 배너 onClick → 운영 브리핑 popup open (Phase 4 에서 category hint 추가).
  const operationalBriefPopup = useOperationalBriefPopup();
  const [editingInventory, setEditingInventory] = useState<ProductInventory | null>(null);
  const [inventoryView, setInventoryView] = useState<"my" | "team">("my");
  const [restockRequestedIds, setRestockRequestedIds] = useState<Set<string>>(new Set());
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
      testPurpose: inv.testPurpose,
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
  const openReorderReview = (inventory: ProductInventory) => {
    openContextPanel(inventory, "reorder");
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
  const { data: inventoryResponse, isLoading } = useQuery<{
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
  const { data: teamInventoryData, isLoading: isLoadingTeam } = useQuery<{
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

  // 리드 타임 기반 재주문 필요: current_stock <= average_daily_usage * lead_time_days
  // §stock-risk-consolidation P3 — 재주문 필요 판정 = canonical isReorderNeeded(공유 lib). 각자 계산 제거(drift 0).
  const lowStockItems = inventories.filter((inv) => isReorderNeeded(inv));

  // §11.317 — 헤더 KPI 4 source (전체 품목 / 안전재고 미달 / 만료 임박 / 격리 Lot).
  //   canonical truth: inventories (mutation 0, derived projection 만).
  //   격리 Lot = schema 에 quarantine_status 미존재 → 0 fallback (호영님 spec §4-2 후속 확장 가능).
  const headerKpiTotalItems = inventories.length;
  const headerKpiLowStock = lowStockItems.length;
  const headerKpiExpiringSoon = inventories.filter((inv) => {
    if (!inv.expiryDate || inv.currentQuantity <= 0) return false;
    const diffDays = (new Date(inv.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  }).length;
  const headerKpiQuarantineLot = 0; // schema 미정의 — backend 확장 시 source 교체

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
      testPurpose: "browser-pilot",
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
  const { data: restockStatusData } = useQuery({
    queryKey: ["restock-status", myInventories.map((inv: any) => inv.id).join(",")],
    queryFn: async () => {
      const statuses: Record<string, boolean> = {};
      await Promise.all(
        myInventories.map(async (inv: any) => {
          try {
            const response = await fetch(`/api/inventory/${inv.id}/restock-request`);
            if (response.ok) {
              const restockRes = await response.json();
              statuses[inv.id] = restockRes.hasRequest || false;
            }
          } catch (error) {
            // 에러는 무시하고 계속 진행
          }
        }),
      );
      return statuses;
    },
    enabled: status === "authenticated" && myInventories.length > 0 && inventoryView === "my",
  });

  // 재구매 추천 목록 조회 (인벤토리 하이라이트용)
  const { data: reorderRecommendationsData } = useQuery<{
    // §inventory-panel-unify P2 — recommendedQty 보강(/api/inventory/reorder-recommendations 반환). optional → 없으면 패널 섹션 미표시(가짜 0).
    recommendations: Array<{ inventoryId: string; recommendedQty?: number; blocked?: boolean; blockReasons?: string[] }>;
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
  const restockRequestMutation = useMutation({
    mutationFn: async (inventoryId: string) => {
      const response = await fetch(`/api/inventory/${inventoryId}/restock-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create restock request");
      }
      return response.json();
    },
    onSuccess: (_result, inventoryId) => {
      setRestockRequestedIds((prev) => new Set(prev).add(inventoryId));
      queryClient.invalidateQueries({ queryKey: ["restock-status"] });
      toast({
        title: "재입고 요청 완료",
        description: "관리자에게 구매 요청을 보냈습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "재입고 요청 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    mutationFn: async (formPayload: { id?: string; productId: string; currentQuantity: number; unit: string; safetyStock?: number; minOrderQty?: number; location?: string; expiryDate?: string; autoReorderEnabled?: boolean; autoReorderThreshold?: number; notes?: string; lotNumber?: string; storageCondition?: string; testPurpose?: string; trackingMode?: string; catalogNumber?: string | null }) => {
      const isEdit = Boolean(formPayload.id);

      const url = isEdit ? `/api/inventory/${formPayload.id}` : "/api/inventory";
      const body = isEdit
        ? {
            quantity: formPayload.currentQuantity,
            location: formPayload.location ?? undefined,
            notes: formPayload.notes ?? undefined,
            expiryDate: formPayload.expiryDate ?? undefined,
            minOrderQty: formPayload.minOrderQty ?? undefined,
            safetyStock: formPayload.safetyStock ?? undefined,
            lotNumber: formPayload.lotNumber ?? undefined,
            storageCondition: formPayload.storageCondition ?? undefined,
            testPurpose: formPayload.testPurpose ?? undefined,
            trackingMode: formPayload.trackingMode ?? undefined, // §inventory-phaseB P3-UI-b
            // §11.336 — 편집모드 Cat.No 수동 입력 → PATCH 로 Product 마스터 반영.
            catalogNumber: formPayload.catalogNumber,
          }
        : formPayload;

      const response = await csrfFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "저장에 실패했습니다.");
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
      toast({
        title: "저장 실패",
        description: error.message || "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
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
      const response = await fetch(`/api/inventory/${id}`, {
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
      const response = await fetch(`/api/inventory/${id}/restock`, {
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
              <ActionMenu
                menuId="inv-content-utility-mobile"
                currentOpenId={openInvContentMenuId}
                onOpenChange={setOpenInvContentMenuId}
                width="w-48"
                items={[
                  { label: "구매 반영", icon: <PackagePlus className="h-3.5 w-3.5" />, onClick: () => router.push("/dashboard/purchases") },
                  { label: "재고 파일 가져오기", icon: <Upload className="h-3.5 w-3.5" />, onClick: () => setIsImportStagingOpen(true) },
                  { label: "QR 스캔", icon: <QrCode className="h-3.5 w-3.5" />, onClick: () => router.push("/dashboard/inventory/scan") },
                  { label: "라벨 인쇄", icon: <Printer className="h-3.5 w-3.5" />, onClick: () => handleBulkLabelPrint() },
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
              <div key={k.label} className={`flex-1 rounded-[13px] px-3 py-2.5 border bg-white shadow-sm ${k.alert && k.value > 0 ? "border-rose-200" : "border-slate-200"}`}>
                <p className={`text-xl font-extrabold ${k.alert && k.value > 0 ? "text-rose-700" : "text-slate-900"}`}>{k.value}<span className="text-slate-400 text-xs font-semibold">{k.unit ? ` ${k.unit}` : ""}</span></p>
                <p className="text-[11px] mt-0.5 text-slate-500 flex items-center gap-1.5">
                  <span className={`h-[7px] w-[7px] rounded-full ${k.alert && k.value > 0 ? "bg-rose-500" : "bg-slate-300"}`} aria-hidden />
                  {k.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <MobileInventoryView
          inventories={displayInventories}
          searchQuery={searchQuery}
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
              <ImportStagingWorkbench
                open={isImportStagingOpen}
                onClose={() => setIsImportStagingOpen(false)}
                onApplyComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ["inventories"] });
                  queryClient.invalidateQueries({
                    queryKey: ["team-inventory"],
                  });
                }}
              />
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
                  { label: "구매 반영", icon: <PackagePlus className="h-3.5 w-3.5" />, onClick: () => router.push("/dashboard/purchases") },
                  { label: "재고 파일 가져오기", icon: <Upload className="h-3.5 w-3.5" />, onClick: () => setIsImportStagingOpen(true) },
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
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              {/* 1. 전체 품목 (중립) */}
              <div
                data-testid="dashboard-inventory-header-kpi-total-items"
                className={`rounded-lg border px-3 py-2 ${headerKpiTotalItems > 0 ? "border-slate-300 bg-white" : "border-slate-200 bg-gray-50"}`}
              >
                <span className="block text-[10px] font-semibold text-slate-500">전체 품목</span>
                <span className={`mt-0.5 block text-lg font-extrabold leading-none md:text-xl ${headerKpiTotalItems > 0 ? "text-slate-900" : "text-gray-400"}`}>
                  {headerKpiTotalItems}
                  <span className="ml-0.5 text-[10px] font-bold text-slate-500">종</span>
                </span>
              </div>
              {/* 2. 만료 임박 (dispose · §11.302 우선) — de-red, 0=✓정상 */}
              <div
                data-testid="dashboard-inventory-header-kpi-expiring-soon"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span className={`block text-[10px] font-semibold ${headerKpiExpiringSoon > 0 ? "text-yellow-700" : "text-slate-500"}`}>만료 임박</span>
                {headerKpiExpiringSoon > 0 ? (
                  <span className="mt-0.5 block text-lg font-extrabold leading-none md:text-xl text-yellow-700">
                    {headerKpiExpiringSoon}
                    <span className="ml-0.5 text-[10px] font-bold">건</span>
                  </span>
                ) : (
                  <span className="mt-0.5 block text-sm font-bold text-emerald-600">✓ 정상</span>
                )}
              </div>
              {/* 3. 격리 Lot (dispose · §11.302 우선) — de-red, 0=✓정상 */}
              <div
                data-testid="dashboard-inventory-header-kpi-quarantine-lot"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span className={`block text-[10px] font-semibold ${headerKpiQuarantineLot > 0 ? "text-rose-700" : "text-slate-500"}`}>격리 Lot</span>
                {headerKpiQuarantineLot > 0 ? (
                  <span className="mt-0.5 block text-lg font-extrabold leading-none md:text-xl text-rose-700">
                    {headerKpiQuarantineLot}
                    <span className="ml-0.5 text-[10px] font-bold">건</span>
                  </span>
                ) : (
                  <span className="mt-0.5 block text-sm font-bold text-emerald-600">✓ 정상</span>
                )}
              </div>
              {/* 4. 안전재고 미달 (reorder · §11.302 dispose 뒤) — de-red + 클릭 시 low 필터(N-safe) */}
              <button
                type="button"
                data-testid="dashboard-inventory-header-kpi-low-stock"
                onClick={() => setStatusFilter("low")}
                disabled={headerKpiLowStock === 0}
                aria-label="안전재고 미달 품목만 보기"
                className={`group rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors ${headerKpiLowStock > 0 ? "cursor-pointer hover:border-rose-200 hover:bg-rose-50/40" : "cursor-default"}`}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className={`block text-[10px] font-semibold ${headerKpiLowStock > 0 ? "text-rose-700" : "text-slate-500"}`}>안전재고 미달</span>
                  {headerKpiLowStock > 0 && (
                    <span className="hidden items-center text-[10px] font-bold text-rose-600 group-hover:flex">자세히 →</span>
                  )}
                </span>
                <span className={`mt-0.5 block text-lg font-extrabold leading-none md:text-xl ${headerKpiLowStock > 0 ? "text-rose-700" : "text-gray-400"}`}>
                  {headerKpiLowStock}
                  <span className="ml-0.5 text-[10px] font-bold">건</span>
                </span>
              </button>
            </div>
            {/* 운영 조치 1줄 배너 — 합산 0건이면 hide */}
            {(lotIssueDisposalReviewCount + lotIssueApprovalPendingCount + lotIssueExecutableCount) > 0 && (
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
          {/* §11.317 — 폐기 mutation handler/variable 은 폐기 검토 탭(작업 surface)에서 유지.
              본 hidden block 은 TypeScript noUnusedLocals 회피용 dead-ref 보존(렌더 0). */}
          {false && (
            <div className="hidden">
              <Button
                onClick={handleLotIssueDecisionAction}
                disabled={!priorityExpiredLot && !topPriorityQueueItem}
                className="bg-blue-600 text-white"
              >
                    폐기 처리
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <p
                    data-testid="labaxis-inventory-lot-issue-reorder-secondary-action"
                    className="px-1 text-xs font-semibold text-slate-500"
                  >
                    후속: 폐기 완료 후 재발주 검토
                  </p>
              {!priorityExpiredLot && !topPriorityQueueItem && <p className="mt-2 text-xs font-medium text-slate-500">처리할 lot_issue가 없어 조치 버튼을 비활성화했습니다.</p>}
            </div>
          )}

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
                  label: showLotIssueDecisionStrip ? "폐기 검토" : "운영 현황",
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
                    title={tab.key === "manage" && activeInventoryTab === "manage" ? "현재 품목 관리 화면입니다. 운영 현황이나 조치 시작을 선택하면 화면이 전환됩니다." : tab.key === "overview" && activeInventoryTab === "overview" && showLotIssueDecisionStrip ? "현재 운영 현황입니다. 클릭하면 lot_issue 폐기 검토를 엽니다." : undefined}
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

                    {/* §11.297f 필터 dropdown — Radix DropdownMenu → plain
                        (Select form 포함, ActionMenu 부적합). */}
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="필터"
                        aria-expanded={isFilterDropdownOpen}
                        aria-haspopup="menu"
                        onClick={() => setIsFilterDropdownOpen((v) => !v)}
                        className="inline-flex items-center justify-center h-9 w-9 shrink-0 relative rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                      >
                        <Filter className="h-4 w-4 pointer-events-none" />
                        {activeFilterCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold px-1 pointer-events-none">
                            {activeFilterCount}
                          </span>
                        )}
                      </button>
                      {isFilterDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)} aria-hidden="true" />
                          <div role="menu" aria-label="필터 메뉴" className="absolute right-0 top-full mt-1 w-56 p-3 space-y-3 rounded-md border border-slate-200 bg-white shadow-lg z-50">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">위치</label>
                              <Select value={locationFilter} onValueChange={setLocationFilter}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="전체 위치" />
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
                              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">상태</label>
                              <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="전체 상태" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">전체 상태</SelectItem>
                                  <SelectItem value="low">부족 / 재주문</SelectItem>
                                  <SelectItem value="expiring">만료 임박</SelectItem>
                                  <SelectItem value="incoming">입고 대기</SelectItem>
                                  <SelectItem value="lot_issue">LOT 이슈</SelectItem>
                                  <SelectItem value="recent">최근 변경</SelectItem>
                                  <SelectItem value="normal">정상</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => {
                                  setLocationFilter("all");
                                  setStatusFilter("all");
                                  setCategoryFilter("all");
                                }}
                              >
                                초기화
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

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

                  {isLoading ? (
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
                          emptyMessage={debouncedSearchQuery.trim() ? `'${debouncedSearchQuery.trim()}'에 해당하는 재고를 찾지 못했습니다.` : "등록된 재고가 없습니다.\n첫 재고를 추가해 운영을 시작하세요."}
                          emptyAction={debouncedSearchQuery.trim() ? () => setSearchQuery("") : () => setIsDialogOpen(true)}
                          emptyActionLabel={debouncedSearchQuery.trim() ? "전체 재고 보기" : "재고 추가하기"}
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
                  {false && (
                    <Card className="shadow-sm border-yellow-200 bg-yellow-50/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-sm font-bold text-slate-800">
                          <Zap className="mr-2 h-4 w-4 text-yellow-500" />
                          조치 필요 항목
                          <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 border-yellow-300 bg-yellow-100 text-yellow-700">
                            {issuesCount}건
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const urgent = displayInventories
                            .filter((inv) => {
                              if (dismissedAlertIds.has(inv.id)) return false;
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
                              const isExpired =
                                inv.expiryDate &&
                                (() => {
                                  const d = new Date(inv.expiryDate);
                                  return d.getTime() < now.getTime();
                                })();
                              const noLocation = !inv.location;
                              return isOut || isLow || byLeadTime || isExpiring || isExpired || noLocation;
                            })
                            // 이슈 우선순위로 정렬: 만료 > 품절 > 임박 > 부족 > 재주문 > 위치 미지정
                            .sort((a, b) => ISSUE_CONFIG[classifyIssue(a)].priority - ISSUE_CONFIG[classifyIssue(b)].priority)
                            .slice(0, 10);
                          if (urgent.length === 0) {
                            return (
                              <div className="flex flex-col items-center py-8 text-center">
                                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                </div>
                                <p className="text-sm font-medium text-slate-700">모든 재고가 정상 범위입니다.</p>
                                <p className="text-xs text-slate-400 mt-1">긴급 조치가 필요한 항목이 없습니다.</p>
                              </div>
                            );
                          }
                          const getDaysLeft = (inv: ProductInventory) => {
                            if (!inv.expiryDate) return null;
                            const d = new Date(inv.expiryDate);
                            const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            if (days <= 0) return "만료됨";
                            return `D-${days}`;
                          };
                          /** 이슈 유형별 카드 배경 (§11.302d-3 신호등 spec 강화) */
                          const getCardBg = (issueType: IssueType) => {
                            switch (issueType) {
                              case "expired":
                              case "out_of_stock":
                                // 큰 카드 가독성 — bg-red-100 (긴급 색상, KPI 카드 위험 red-600 white 회피)
                                return "bg-red-100 border-red-200";
                              case "expiring":
                                return "bg-yellow-100 border-yellow-200";
                              case "low_stock":
                              case "reorder_lead":
                                return "bg-red-100 border-red-200";
                              case "no_location":
                                return "bg-slate-50 border-slate-200";
                            }
                          };
                          return (
                            <div className="space-y-2">
                              {urgent.map((inv) => {
                                const issueType = classifyIssue(inv);
                                const issueInfo = ISSUE_CONFIG[issueType];
                                const daysLeft = getDaysLeft(inv);
                                const cardBg = getCardBg(issueType);
                                return (
                                  <div key={inv.id} className={`flex items-start justify-between p-3 border rounded-lg gap-3 hover:shadow-sm transition-all ${cardBg}`}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedItem(inv);
                                        setSheetSafetyStock(String(inv.safetyStock ?? inv.minOrderQty ?? 1));
                                        setIsSheetOpen(true);
                                      }}
                                      className="flex-1 min-w-0 text-left"
                                    >
                                      {/* Line 1: 배지 + 품목명 + D-day */}
                                      <div className="flex items-center gap-2">
                                        <Badge className={`text-[10px] px-1.5 py-0 border-none whitespace-nowrap shrink-0 ${issueInfo.cls}`}>{issueInfo.label}</Badge>
                                        <h5 className="text-sm font-bold text-slate-900 truncate flex-1">{inv.product.name}</h5>
                                        {daysLeft && (issueType === "expiring" || issueType === "expired") && <span className={`text-[10px] font-bold shrink-0 ${issueType === "expired" ? "text-red-700" : "text-yellow-700"}`}>{daysLeft}</span>}
                                      </div>
                                      {/* Line 2: 핵심 수치 1줄 (축약) */}
                                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                        {/* §11.302d-3 stock badge — lowStock yellow → red 긴급 spec 정합 */}
                                        <span className={`font-semibold ${inv.currentQuantity === 0 ? "text-red-700" : inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock ? "text-red-700" : "text-slate-600"}`}>{inv.currentQuantity}</span> {inv.unit}
                                        {inv.safetyStock != null && <span className="text-slate-500"> / 안전재고 {inv.safetyStock}</span>}
                                        {inv.expiryDate && issueType !== "expiring" && issueType !== "expired" && <span className="text-slate-500"> · {format(new Date(inv.expiryDate), "MM.dd")} 만료</span>}
                                        {!inv.location && issueType !== "no_location" && <span className="text-yellow-500"> · 위치 없음</span>}
                                      </p>
                                    </button>
                                    {/* ── 이슈 유형별 조치 액션 ── */}
                                    <div className="flex gap-1.5 flex-shrink-0 items-start pt-0.5">
                                      {/* 1차 대표 조치 (이슈 유형별 분기) */}
                                      {(issueType === "out_of_stock" || issueType === "low_stock" || issueType === "reorder_lead") && (
                                        /* 품절/부족/재주문 → 재발주 (AI 패널) */
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          /* §11.302d-3 button 신호등 정합 — out_of_stock 위험 + low_stock/reorder_lead 긴급 (이전 blue/yellow 정정) */
                                          className={`h-7 px-2 text-[11px] whitespace-nowrap gap-1 ${issueType === "out_of_stock" ? "text-red-700 border-red-500/30 hover:bg-red-50" : "text-red-700 border-red-500/30 hover:bg-red-50"}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // §inventory-reorder-surface-unify P3 — 이슈얼럿 재발주 진입 = 통합 패널(reorder mode).
                                            openReorderReview(inv);
                                          }}
                                        >
                                          <Sparkles className="h-3 w-3 shrink-0" />
                                          재발주 검토
                                        </Button>
                                      )}
                                      {issueType === "expiring" && (
                                        /* §11.302d-3 우선 사용 Badge — 검토 spec 정합 (yellow-50 → yellow-100, border-yellow-700 → yellow-200) + duplicate cleanup */
                                        <Badge variant="outline" className="h-6 px-1.5 text-[10px] font-semibold whitespace-nowrap bg-yellow-100 text-yellow-700 border-yellow-200 shrink-0" title="유효기간 임박 또는 먼저 소진해야 하는 항목입니다.">
                                          <Truck className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                                          우선 사용
                                        </Badge>
                                      )}
                                      {issueType === "expired" && (
                                        /* 만료됨 → 폐기 처리 (온톨로지 1순위) */
                                        <Button
                                          size="sm"
                                          className="h-7 px-3 text-[11px] whitespace-nowrap gap-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openDisposalDock(inv);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3 shrink-0" />
                                          폐기 처리
                                        </Button>
                                      )}
                                      {issueType === "no_location" && (
                                        /* 위치 미지정 → 위치 지정 */
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[11px] whitespace-nowrap gap-1 text-violet-400 border-violet-800 hover:bg-violet-50  text-violet-400  border-violet-800  hover:bg-violet-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingInventory(inv);
                                            setIsDialogOpen(true);
                                          }}
                                        >
                                          <MapPin className="h-3 w-3 shrink-0" />
                                          위치 지정
                                        </Button>
                                      )}
                                      {/* §11.297e D4 issue alert (issueType 분기) */}
                                      <ActionMenu
                                        menuId={`inv-content-issue-${inv.id}`}
                                        currentOpenId={openInvContentMenuId}
                                        onOpenChange={setOpenInvContentMenuId}
                                        width="w-44"
                                        items={[
                                          { label: "상세 보기", icon: <Eye className="h-3.5 w-3.5 text-blue-500 shrink-0" />, onClick: () => {
                                            setSelectedItem(inv);
                                            setSheetSafetyStock(String(inv.safetyStock ?? inv.minOrderQty ?? 1));
                                            setIsSheetOpen(true);
                                          } },
                                          { label: "정보 수정", icon: <Edit className="h-3.5 w-3.5 text-slate-500 shrink-0" />, onClick: () => {
                                            setEditingInventory(inv);
                                            setIsDialogOpen(true);
                                          } },
                                          ...(issueType === "expiring" ? [
                                            { label: "폐기 검토", icon: <Trash2 className="h-3.5 w-3.5 shrink-0" />, danger: true, separator: true, onClick: () => toast({
                                              title: "폐기 검토",
                                              description: `${inv.product.name} 폐기 절차를 확인하세요.`,
                                            }) },
                                            // §inventory-panel-unify P3b-1 — 행 메뉴 재발주 진입 = 통합 패널(reorder) 라우팅. AiAssistant 직접 오픈 retire.
                                            { label: "재발주 검토", icon: <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />, onClick: () => openReorderReview(inv) },
                                          ] : []),
                                          ...(issueType === "expired" ? [
                                            // §inventory-panel-unify P3b-1 — 대체품 재발주 진입도 통합 패널(reorder) 라우팅.
                                            { label: "대체품 재발주 검토", icon: <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />, separator: true, onClick: () => openReorderReview(inv) },
                                          ] : []),
                                          ...((issueType === "out_of_stock" || issueType === "low_stock") ? [
                                            { label: "입고 등록", icon: <PackagePlus className="h-3.5 w-3.5 text-emerald-600 shrink-0" />, separator: true, onClick: () => {
                                              setRestockItem(inv);
                                              setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" });
                                            } },
                                          ] : []),
                                          { label: "목록에서 제외", icon: <XCircle className="h-3.5 w-3.5 shrink-0" />, separator: true, onClick: () => {
                                            setDismissedAlertIds((prev) => new Set(prev).add(inv.id));
                                            toast({
                                              title: "이슈 처리 완료",
                                              description: `${inv.product.name} 이슈를 목록에서 제외했습니다.`,
                                            });
                                          } },
                                        ]}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
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
              return contextPanelItem.expiryDate && new Date(contextPanelItem.expiryDate).getTime() < Date.now() ? <p className="text-xs text-rose-700">유효기간 만료</p> : <p className="text-xs text-slate-500">차단 없음</p>;
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
                <SheetDescription className="flex items-center gap-2 text-sm text-slate-400  text-slate-400 mt-0.5">
                  <span>{selectedItem.product.brand ?? "-"}</span>
                  <span className="text-slate-600  text-slate-400">|</span>
                  <span className="font-mono text-xs">{selectedItem.product.catalogNumber ?? "-"}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3">
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
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-bd pt-2  border-bd">
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
                  </div>
                </div>

                <div>
                  <h4 className="mb-1.5 flex items-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <Info className="mr-1.5 h-3 w-3 text-slate-400" />
                    관리 정보
                  </h4>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-bd pt-2  border-bd">
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">사용/미개봉</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.inUseOrUnopened ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">평균유효기한</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.averageExpiry ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">시험항목</span>
                      <span className="text-xs font-medium truncate text-right">{selectedItem.testPurpose ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="text-[11px] text-slate-500  text-slate-400 shrink-0">보관조건</span>
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
      {false && (
        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 md:mb-6">
            <TabsTrigger value="inventory" className="text-xs md:text-sm">
              <Package className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              재고 목록
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs md:text-sm">
              <History className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              사용 이력
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs md:text-sm">
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              알림 설정
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4 md:space-y-6">
            {/* 온톨로지: 만료 lot priority banner (inventory 목록 탭) */}
            {(() => {
              if (!priorityExpiredLot) return null;
              return (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-red-800">
                      우선 처리: 만료 lot {actionableExpiredLots.length}건 · 잔량 {actionableExpiredQuantity}개
                    </p>
                    <p className="text-xs text-red-600/70">사용 금지 상태입니다. 재주문보다 폐기 처리를 먼저 진행하세요.</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0" onClick={() => openDisposalDock(priorityExpiredLot)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    폐기 처리 시작
                  </Button>
                </div>
              );
            })()}
            {/* 내 자산 / 우리 랩 전체 탭 */}
            <Tabs value={inventoryView} onValueChange={(v) => setInventoryView(v as "my" | "team")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="my">
                  <Package className="h-4 w-4 mr-2" />내 자산
                </TabsTrigger>
                <TabsTrigger value="team" disabled={!selectedTeam}>
                  <Users className="h-4 w-4 mr-2" />
                  우리 랩 전체
                </TabsTrigger>
              </TabsList>

              {/* 검색 및 필터 */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input placeholder="품목명, 제조사, CAS No. 또는 카탈로그 번호로 검색하세요" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 w-full" />
                </div>
                {inventoryView === "team" && (
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="작성자 필터" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">전체</SelectItem>
                      {membersData?.members?.map((member: any) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.name || member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <TabsContent value="my" className="mt-0">
                {isLoading ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">재고 목록을 불러오는 중...</p>
                    </CardContent>
                  </Card>
                ) : (inventoryView === "my" ? myInventories : teamInventories).length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">{inventoryView === "my" ? "등록된 재고가 없습니다." : "팀 인벤토리가 비어있습니다."}</p>
                      {inventoryView === "my" && (
                        <Button onClick={() => setIsDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />첫 재고 추가하기
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(inventoryView === "my" ? myInventories : teamInventories)
                      .filter((inv) => {
                        // 검색 필터
                        if (searchQuery) {
                          const query = searchQuery.toLowerCase();
                          const matchesSearch = inv.product?.name?.toLowerCase().includes(query) || inv.product?.brand?.toLowerCase().includes(query) || inv.product?.catalogNumber?.toLowerCase().includes(query);
                          if (!matchesSearch) return false;
                        }
                        return true;
                      })
                      .sort((a, b) => {
                        // 재입고 요청된 아이템을 최상단으로 정렬
                        const aHasRequest = restockStatusData?.[a.id] || restockRequestedIds.has(a.id);
                        const bHasRequest = restockStatusData?.[b.id] || restockRequestedIds.has(b.id);
                        if (aHasRequest && !bHasRequest) return -1;
                        if (!aHasRequest && bHasRequest) return 1;
                        return 0;
                      })
                      .map((inventory) => {
                        const hasRequest = restockStatusData?.[inventory.id] || restockRequestedIds.has(inventory.id);
                        const isRecommended = recommendedInventoryIds.has(inventory.id);
                        return (
                          <InventoryCard
                            key={inventory.id}
                            inventory={inventory}
                            blockReasons={reorderBlockReasonsFor(inventory.id)}
                            onEdit={() => {
                              setEditingInventory(inventory);
                              setIsDialogOpen(true);
                            }}
                            onRecordUsage={(quantity, notes, gmp) => {
                              recordUsageMutation.mutate({
                                inventoryId: inventory.id,
                                quantity,
                                unit: inventory.unit,
                                notes,
                                trackingMode: inventory.trackingMode,
                                lotNumber: gmp?.lotNumber,
                                operator: gmp?.operator,
                                destination: gmp?.destination,
                              });
                            }}
                            onRestockRequest={() => {
                              restockRequestMutation.mutate(inventory.id);
                            }}
                            onPrintLabel={() => handleSingleLabelPrint(inventory)}
                            onDispose={() => openDisposalDock(inventory)}
                            isRestockRequested={hasRequest}
                            isRequestingRestock={restockRequestMutation.isPending && restockRequestMutation.variables === inventory.id}
                            isRecommended={isRecommended}
                          />
                        );
                      })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="team" className="mt-0">
                {isLoadingTeam ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">팀 인벤토리를 불러오는 중...</p>
                    </CardContent>
                  </Card>
                ) : !selectedTeam ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">팀에 가입되어 있지 않습니다.</p>
                      <Button onClick={() => router.push("/team/settings")}>
                        <Users className="h-4 w-4 mr-2" />팀 설정으로 이동
                      </Button>
                    </CardContent>
                  </Card>
                ) : teamInventories.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">팀 인벤토리가 비어있습니다.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {teamInventories
                      .filter((inv: any) => {
                        // 검색 필터
                        if (searchQuery) {
                          const query = searchQuery.toLowerCase();
                          const matchesSearch = inv.productName?.toLowerCase().includes(query) || inv.brand?.toLowerCase().includes(query) || inv.catalogNumber?.toLowerCase().includes(query) || inv.user?.name?.toLowerCase().includes(query) || inv.user?.email?.toLowerCase().includes(query);
                          if (!matchesSearch) return false;
                        }
                        // 작성자 필터
                        if (ownerFilter && inv.userId !== ownerFilter) {
                          return false;
                        }
                        return true;
                      })
                      .map((inventory: any) => (
                        <TeamInventoryCard
                          key={inventory.id}
                          inventory={inventory}
                          onLocationClick={(inv) => {
                            setEditingInventory(inv);
                            setIsDialogOpen(true);
                          }}
                          onQuantityUpdate={(qty) => {
                            if (inventory.id && inventory.product?.id) {
                              createOrUpdateMutation.mutate({
                                id: inventory.id,
                                productId: inventory.product.id,
                                currentQuantity: qty,
                                unit: inventory.unit || "ea",
                                location: inventory.location,
                              });
                            }
                          }}
                          onReorder={() => {
                            setRestockItem(inventory);
                            setRestockForm({
                              addQty: "",
                              lotNumber: "",
                              expiryDate: "",
                            });
                          }}
                        />
                      ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 md:space-y-6">
            {/* 통계 카드 */}
            {usageStats && (
              <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">총 사용량</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg md:text-2xl font-bold">{usageStats?.totalUsage?.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">기록 수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg md:text-2xl font-bold">{usageStats?.recordCount || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">제품 수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg md:text-2xl font-bold">{usageStats?.uniqueProducts || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">기간</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {usageStats?.dateRange ? (
                      <div className="text-xs md:text-sm">
                        {format(new Date(usageStats?.dateRange?.start || new Date()), "yyyy.MM.dd", { locale: ko })} ~ {format(new Date(usageStats?.dateRange?.end || new Date()), "yyyy.MM.dd", { locale: ko })}
                      </div>
                    ) : (
                      <div className="text-xs md:text-sm text-muted-foreground">데이터 없음</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 이력 테이블 */}
            {usageLoading ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-xs md:text-sm text-muted-foreground">이력 로딩 중...</p>
                </CardContent>
              </Card>
            ) : usageRecords.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <History className="h-8 w-8 md:h-12 md:w-12 mx-auto text-muted-foreground mb-3 md:mb-4" />
                  <p className="text-xs md:text-sm text-muted-foreground mb-2">사용 이력이 없습니다.</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">재고 카드에서 "사용 기록" 버튼을 눌러 사용량을 기록하세요.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm md:text-base">사용 이력</CardTitle>
                  <CardDescription className="text-xs md:text-sm">최근 100건의 사용 기록을 표시합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm">날짜</TableHead>
                          <TableHead className="text-xs md:text-sm">제품명</TableHead>
                          <TableHead className="text-xs md:text-sm">사용량</TableHead>
                          <TableHead className="text-xs md:text-sm">사용자</TableHead>
                          <TableHead className="text-xs md:text-sm">비고</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usageRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="text-xs md:text-sm">{format(new Date(record.usageDate), "yyyy.MM.dd HH:mm", { locale: ko })}</TableCell>
                            <TableCell className="text-xs md:text-sm">
                              <div>
                                <div className="font-medium">{record.inventory.product.name}</div>
                                {record.inventory.product.brand && <div className="text-[10px] md:text-xs text-muted-foreground">{record.inventory.product.brand}</div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs md:text-sm font-medium">
                              {record.quantity} {record.unit || "개"}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm">{record.user.name || record.user.email}</TableCell>
                            <TableCell className="text-xs md:text-sm text-muted-foreground max-w-[200px] truncate">{record.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4 md:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm md:text-base">재고 부족 알림 설정</CardTitle>
                <CardDescription className="text-xs md:text-sm">안전 재고 이하로 떨어질 때 알림을 받을 제품을 선택하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-xs md:text-sm text-muted-foreground text-center py-8">로딩 중...</p>
                ) : inventories.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-8 w-8 md:h-12 md:w-12 mx-auto text-muted-foreground mb-3 md:mb-4" />
                    <p className="text-xs md:text-sm text-muted-foreground mb-2">등록된 재고가 없습니다.</p>
                    <Button onClick={() => setIsDialogOpen(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      재고 추가하기
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inventories.map((inventory) => {
                      const hasSafetyStock = inventory.safetyStock !== null && inventory.safetyStock > 0;
                      const isLowStock = hasSafetyStock && inventory.safetyStock !== null && inventory.currentQuantity <= inventory.safetyStock;

                      return (
                        <div key={inventory.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs md:text-sm">{inventory.product.name}</div>
                            <div className="text-[10px] md:text-xs text-muted-foreground mt-1">
                              현재: {inventory.currentQuantity} {inventory.unit}
                              {hasSafetyStock && inventory.safetyStock !== null && (
                                <>
                                  {" "}
                                  · 안전 재고: {inventory.safetyStock} {inventory.unit}
                                </>
                              )}
                            </div>
                            {isLowStock && (
                              <Badge variant="outline" dot="amber" className="mt-1 bg-yellow-50 text-yellow-700 border-yellow-700 text-[11px]">
                                재고 부족
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {!hasSafetyStock && <span className="text-[10px] md:text-xs text-muted-foreground">안전 재고 설정 필요</span>}
                            {hasSafetyStock && (
                              <Badge variant="outline" dot={isLowStock ? "red" : "emerald"} dotPulse={isLowStock} className={isLowStock ? "bg-red-100 text-red-700 border-red-800 text-[11px]" : "bg-emerald-100 text-emerald-700 border-emerald-800 text-[11px]"}>
                                {isLowStock ? "알림 활성" : "정상"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm md:text-base">알림 이력</CardTitle>
                <CardDescription className="text-xs md:text-sm">최근 재고 부족 알림 내역을 확인할 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 md:h-12 md:w-12 mx-auto text-muted-foreground mb-3 md:mb-4" />
                  <p className="text-xs md:text-sm text-muted-foreground">알림 이력 기능은 곧 제공될 예정입니다.</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-2">재고가 안전 재고 이하로 떨어지면 자동으로 알림이 기록됩니다.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

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
            <span className="text-sm font-medium text-emerald-900">재고가 등록되었습니다.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* §inventory-reorder-surface-unify P4 — InventoryAiAssistantPanel(분석 래퍼) inventory 트리거 retire.
          재발주 검토는 ReorderReviewSheet 승격(InventoryReorderReviewSheet)으로 대체. 컴포넌트 파일은 보존(rollback). */}

      {/* §inventory-reorder-surface-unify P2 — content-level 재발주안 검토 시트(ReorderReviewSheet 승격).
          recommendedQty = canonical(/reorder-recommendations) — 데스크탑 패널과 동일 소스. null이면 미표시(가짜 0 금지). */}
      <InventoryReorderReviewSheet
        open={reorderReviewItem !== null}
        onClose={() => setReorderReviewItem(null)}
        productId={reorderReviewItem?.productId ?? null}
        productName={reorderReviewItem?.product.name ?? null}
        recommendedQty={reorderRecommendedQtyFor(reorderReviewItem?.id)}
        unit={reorderReviewItem?.unit ?? undefined}
        storageLocation={reorderReviewItem?.location ?? undefined}
        onSearchVendors={() => {
          // §inventory-reorder-surface-unify P4 / §11.381c — 공급사 소싱 검색 진입(AiAssistant onViewVendors 대체).
          if (reorderReviewItem) router.push(`/app/search?q=${encodeURIComponent(reorderReviewItem.product.name)}`);
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

function InventoryCard({ inventory, onEdit, onRecordUsage, onRestockRequest, onPrintLabel, onDispose, isRestockRequested = false, isRequestingRestock = false, isRecommended = false, blockReasons = [] }: { inventory: ProductInventory; onEdit: () => void; onRecordUsage: (quantity: number, notes?: string, gmp?: { lotNumber?: string; operator?: string; destination?: string }) => void; onRestockRequest?: () => void; onPrintLabel?: () => void; onDispose?: () => void; isRestockRequested?: boolean; isRequestingRestock?: boolean; isRecommended?: boolean; blockReasons?: string[] }) {
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  // §11.297d InventoryCard plain dropdown state.
  const [openContentCardMenuId, setOpenContentCardMenuId] = useState<string | null>(null);
  const [usageQuantity, setUsageQuantity] = useState("");
  const [usageNotes, setUsageNotes] = useState("");
  // §inventory-phaseB P3-UI-a3 — GMP/LOT 추적 품목 차감 시 lot·operator·destination 수집.
  const [usageLot, setUsageLot] = useState("");
  const [usageOperator, setUsageOperator] = useState("");
  const [usageDestination, setUsageDestination] = useState("");
  const usageTrackingMode: TrackingMode = (inventory.trackingMode as TrackingMode) ?? DEFAULT_TRACKING_MODE;
  const usageRequired = requiredUsageFields(usageTrackingMode);
  const usageNeeds = (f: "lotNumber" | "operator" | "destination") => usageRequired.includes(f);
  const usageGmpMissing: string[] = [];
  if (usageNeeds("lotNumber") && !usageLot.trim()) usageGmpMissing.push("로트번호");
  if (usageNeeds("operator") && !usageOperator.trim()) usageGmpMissing.push("담당자");
  if (usageNeeds("destination") && !usageDestination.trim()) usageGmpMissing.push("사용처");
  const usageGmpOk = usageGmpMissing.length === 0;

  const isLowStock = inventory.safetyStock !== null && inventory.currentQuantity <= inventory.safetyStock;
  const isOutOfStock = inventory.currentQuantity <= 0;
  const hasRestockRequest = isRestockRequested;
  const expiryTime = inventory.expiryDate ? new Date(inventory.expiryDate).getTime() : Number.NaN;
  const isExpiredLotWithQty = Number.isFinite(expiryTime) && expiryTime < Date.now() && inventory.currentQuantity > 0;
  const needsReorderAfterDisposal = isExpiredLotWithQty && inventory.safetyStock !== null && 0 < inventory.safetyStock;

  const handleRecordUsage = () => {
    const qty = parseFloat(usageQuantity);
    if (!usageGmpOk) return; // §inventory-phaseB P3-UI-a3 — GMP 필수 누락 차단(서버도 422)
    if (qty > 0 && qty <= inventory.currentQuantity) {
      onRecordUsage(qty, usageNotes || undefined, {
        lotNumber: usageLot.trim() || undefined,
        operator: usageOperator.trim() || undefined,
        destination: usageDestination.trim() || undefined,
      });
      setShowUsageDialog(false);
      setUsageQuantity("");
      setUsageNotes("");
      setUsageLot(""); setUsageOperator(""); setUsageDestination("");
    }
  };

  return (
    <motion.div whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.03)" }} transition={{ duration: 0.18, ease: "easeOut" }} className="rounded-xl">
      <Card className={isExpiredLotWithQty ? "border-red-300 bg-red-50/70 ring-2 ring-red-100" : hasRestockRequest ? "border-red-500 bg-red-100 ring-2 ring-red-200" : isRecommended ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200" : isOutOfStock ? "border-red-300 bg-red-100" : isLowStock ? "border-red-300 bg-red-50" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{inventory.product.name}</CardTitle>
                {isRecommended && (
                  <Badge variant="outline" dot="blue" className="bg-blue-50 text-blue-400 border-blue-800 text-[11px]">
                    재구매 추천
                  </Badge>
                )}
                {/* §stock-risk-consolidation P2 — 재발주 차단 배지(사유 hover). RFQ 진행·예산 초과 실데이터. */}
                {blockReasons.length > 0 && (
                  <Badge variant="outline" className="bg-[#fdf3ec] text-[#b45821] border-[#f3d4bf] text-[11px]" title={blockReasons.join(" · ")}>
                    재발주 차단
                  </Badge>
                )}
                {isExpiredLotWithQty && (
                  <Badge variant="outline" dot="red" dotPulse className="bg-red-50 text-red-700 border-red-200 text-[11px]">
                    우선 처리
                  </Badge>
                )}
              </div>
              {inventory.product.brand && <CardDescription>{inventory.product.brand}</CardDescription>}
            </div>
            <div className="flex flex-col items-end gap-1">
              {hasRestockRequest && (
                <Badge variant="outline" dot="red" dotPulse className="bg-red-100 text-red-700 border-red-800 text-[11px]">
                  <Check className="h-3 w-3 mr-1" />
                  요청됨
                </Badge>
              )}
              {isExpiredLotWithQty && (
                <Badge variant="outline" dot="red" className="bg-white text-red-700 border-red-200 text-[11px]">
                  사용 금지
                </Badge>
              )}
              {isOutOfStock && !hasRestockRequest && !isExpiredLotWithQty && (
                <Badge variant="outline" dot="red" dotPulse className="bg-red-100 text-red-700 border-red-800">
                  품절
                </Badge>
              )}
              {isLowStock && !isOutOfStock && !hasRestockRequest && !isExpiredLotWithQty && (
                <Badge variant="outline" dot="amber" className="bg-yellow-50 text-yellow-700 border-yellow-700">
                  재고 부족
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isExpiredLotWithQty && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-red-800">
                  만료 lot 1건 · 잔량 {inventory.currentQuantity}
                  {inventory.unit}
                </span>
                <Badge variant="outline" dot="red" className="bg-white text-red-700 border-red-200 text-[11px]">
                  만료
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-red-700/80">사용 금지 상태입니다. 재입고 요청보다 폐기 처리를 먼저 진행해야 합니다.</p>
              {needsReorderAfterDisposal && <p className="text-[11px] leading-relaxed text-blue-700">폐기 후 안전재고 영향이 발생할 수 있어, 폐기 dock에서 재주문 검토로 이어집니다.</p>}
            </div>
          )}

          {/* primary action: expired lot disposal takes priority over reorder */}
          {isExpiredLotWithQty && onDispose ? (
            <div className="space-y-2">
              <Button size="lg" onClick={onDispose} className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl">
                <Trash2 className="h-5 w-5 mr-2" />
                폐기 처리
              </Button>
              {onRestockRequest && (
                <Button size="sm" variant="outline" disabled className="w-full cursor-not-allowed bg-white text-slate-500">
                  재주문 검토는 폐기 후 진행
                </Button>
              )}
            </div>
          ) : (
            onRestockRequest && (
              <Button size="lg" variant={hasRestockRequest ? "secondary" : "default"} onClick={onRestockRequest} disabled={hasRestockRequest || isRequestingRestock} className={`w-full ${hasRestockRequest ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"}`}>
                {isRequestingRestock ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    요청 중...
                  </>
                ) : hasRestockRequest ? (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    요청됨
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    재입고 요청
                  </>
                )}
              </Button>
            )
          )}

          {/* 재고 수명 게이지 */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">재고 수명</div>
            <StockLifespanGauge inventoryId={inventory.id} currentQuantity={inventory.currentQuantity} safetyStock={inventory.safetyStock} unit={inventory.unit} onReorder={isExpiredLotWithQty ? undefined : onRestockRequest} />
          </div>

          {/* 추가 정보 (안전 재고) */}
          {inventory.safetyStock !== null && (
            <div className="text-xs text-muted-foreground">
              안전 재고: {inventory.safetyStock} {inventory.unit}
            </div>
          )}

          {inventory.location && (
            <div className="text-sm">
              <span className="text-muted-foreground">보관 위치:</span> {inventory.location}
            </div>
          )}

          {inventory.expiryDate && (
            <div className="text-sm">
              <span className="text-muted-foreground">유통기한:</span> {new Date(inventory.expiryDate).toLocaleDateString()}
            </div>
          )}

          <div className="flex gap-2">
            {onPrintLabel && (
              <Button size="sm" variant="outline" onClick={onPrintLabel} className="flex-1 gap-1">
                <Printer className="h-3.5 w-3.5" />
                라벨 인쇄
              </Button>
            )}
            <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1 gap-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  사용 기록
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>사용량 기록</DialogTitle>
                  <DialogDescription>제품 사용량을 기록하면 재고가 자동으로 감소합니다.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>사용량 ({inventory.unit})</Label>
                    <Input type="number" min="0" max={inventory.currentQuantity} value={usageQuantity} onChange={(e) => setUsageQuantity(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label>비고 (선택)</Label>
                    <Textarea value={usageNotes} onChange={(e) => setUsageNotes(e.target.value)} placeholder="예: 실험 A에 사용" rows={3} />
                  </div>

                  {/* §inventory-phaseB P3-UI-a3 — GMP/LOT 추적 품목 필수 필드(QUANTITY 미노출). */}
                  {usageTrackingMode !== "QUANTITY" && (
                    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                      <p className="text-[11px] font-medium text-blue-700">
                        {usageTrackingMode === "GMP_STRICT"
                          ? "GMP 추적 품목 — 로트·담당자·사용처 필수"
                          : "로트 추적 품목 — 로트번호 필수"}
                      </p>
                      <Input value={usageLot} onChange={(e) => setUsageLot(e.target.value)} placeholder={`로트번호${usageNeeds("lotNumber") ? " *" : ""}`} />
                      {usageTrackingMode === "GMP_STRICT" && (
                        <>
                          <Input value={usageOperator} onChange={(e) => setUsageOperator(e.target.value)} placeholder="담당자 *" />
                          <Input value={usageDestination} onChange={(e) => setUsageDestination(e.target.value)} placeholder="사용처 *" />
                        </>
                      )}
                      {!usageGmpOk && <p className="text-[11px] text-red-600">필수 항목 누락: {usageGmpMissing.join(", ")}</p>}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setShowUsageDialog(false); setUsageLot(""); setUsageOperator(""); setUsageDestination(""); }} className="flex-1">
                      취소
                    </Button>
                    <Button onClick={handleRecordUsage} disabled={!usageQuantity || parseFloat(usageQuantity) <= 0 || !usageGmpOk} className="flex-1">
                      기록
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* §11.297d D5 InventoryCard actions */}
            <ActionMenu
              menuId="inv-content-card-actions"
              currentOpenId={openContentCardMenuId}
              onOpenChange={setOpenContentCardMenuId}
              width="w-40"
              items={[
                { label: "정보 수정", icon: <Edit className="h-3.5 w-3.5 text-slate-500" />, onClick: onEdit },
                { label: "상세 보기", icon: <Eye className="h-3.5 w-3.5 text-blue-500" />, onClick: () => setShowUsageDialog(false) },
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function InventoryForm({ inventory, onSubmit, onCancel }: { inventory?: ProductInventory | null; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [productId, setProductId] = useState(inventory?.productId || "");
  const [currentQuantity, setCurrentQuantity] = useState(inventory?.currentQuantity.toString() || "0");
  const [unit, setUnit] = useState(inventory?.unit || "개");
  const [safetyStock, setSafetyStock] = useState(inventory?.safetyStock?.toString() || "");
  const [minOrderQty, setMinOrderQty] = useState(inventory?.minOrderQty?.toString() || "");
  const [location, setLocation] = useState(inventory?.location || "");
  const [expiryDate, setExpiryDate] = useState(inventory?.expiryDate ? new Date(inventory.expiryDate).toISOString().split("T")[0] : "");
  const [autoReorderEnabled, setAutoReorderEnabled] = useState(inventory?.autoReorderEnabled || false);
  const [autoReorderThreshold, setAutoReorderThreshold] = useState(inventory?.autoReorderThreshold?.toString() || inventory?.safetyStock?.toString() || "");
  const [notes, setNotes] = useState(inventory?.notes || "");

  // 제품 검색 (간단한 구현, 실제로는 제품 검색 API 필요)
  const { data: productsData } = useQuery({
    queryKey: ["products", "search"],
    queryFn: async () => {
      const response = await fetch("/api/products/search?limit=100");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: !inventory, // 수정 모드가 아닐 때만 제품 검색
  });

  const products = productsData?.products || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      productId: inventory?.productId || productId,
      currentQuantity: parseFloat(currentQuantity) || 0,
      unit,
      safetyStock: safetyStock ? parseFloat(safetyStock) : undefined,
      minOrderQty: minOrderQty ? parseFloat(minOrderQty) : undefined,
      location: location || undefined,
      expiryDate: expiryDate || undefined,
      autoReorderEnabled,
      autoReorderThreshold: autoReorderThreshold ? parseFloat(autoReorderThreshold) : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!inventory && (
        <div>
          <Label htmlFor="product">제품 선택</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue placeholder="제품을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product: any) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} {product.brand && `(${product.brand})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="currentQuantity">현재 재고량</Label>
          <Input id="currentQuantity" type="number" min="0" value={currentQuantity} onChange={(e) => setCurrentQuantity(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="unit">단위</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="개">개</SelectItem>
              <SelectItem value="mL">mL</SelectItem>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="mg">mg</SelectItem>
              <SelectItem value="L">L</SelectItem>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="test">test</SelectItem>
              <SelectItem value="box">box</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="safetyStock">안전 재고 (선택)</Label>
          <Input id="safetyStock" type="number" min="0" value={safetyStock} onChange={(e) => setSafetyStock(e.target.value)} placeholder="이 수량 이하로 떨어지면 재주문 추천" />
        </div>
        <div>
          <Label htmlFor="minOrderQty">최소 주문 수량 (선택)</Label>
          <Input id="minOrderQty" type="number" min="0" value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} placeholder="최소 주문 수량" />
        </div>
      </div>

      <div>
        <Label htmlFor="location">보관 위치 (선택)</Label>
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 냉장고 A-1, 선반 3층" />
      </div>

      <div>
        <Label htmlFor="expiryDate">유통기한 (선택)</Label>
        <Input id="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
      </div>

      <div className="space-y-3 p-4 border rounded-lg bg-el">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="autoReorderEnabled">자동 재주문</Label>
            <p className="text-xs text-muted-foreground mt-1">재고가 임계값 이하로 떨어지면 자동으로 재주문 리스트를 생성합니다.</p>
          </div>
          <input id="autoReorderEnabled" type="checkbox" checked={autoReorderEnabled} onChange={(e) => setAutoReorderEnabled(e.target.checked)} className="h-4 w-4" />
        </div>
        {autoReorderEnabled && (
          <div>
            <Label htmlFor="autoReorderThreshold">자동 재주문 임계값 (선택)</Label>
            <Input id="autoReorderThreshold" type="number" min="0" value={autoReorderThreshold} onChange={(e) => setAutoReorderThreshold(e.target.value)} placeholder={safetyStock || "안전 재고와 동일"} />
            <p className="text-xs text-muted-foreground mt-1">이 수량 이하로 떨어지면 자동 재주문이 실행됩니다. 비워두면 안전 재고를 사용합니다.</p>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="notes">비고 (선택)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="추가 메모" rows={3} />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          취소
        </Button>
        <Button type="submit" className="flex-1">
          저장
        </Button>
      </div>
    </form>
  );
}

// 팀 인벤토리 카드 컴포넌트 (소유자 정보 표시)
function TeamInventoryCard({ inventory, onLocationClick, onQuantityUpdate, onReorder, isReordering = false, isAddedToCart = false }: { inventory: any; onLocationClick: (inventory: any) => void; onQuantityUpdate: (quantity: number) => void; onReorder: (inventory: any) => void; isReordering?: boolean; isAddedToCart?: boolean }) {
  const [quantity, setQuantity] = useState(inventory.quantity?.toString() || "0");
  const isOutOfStock = inventory.quantity === 0;
  const isLowStock = inventory.status === "LOW_STOCK";
  const isLocationMissing = inventory.location === "미지정";

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      onQuantityUpdate(numValue);
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${isOutOfStock ? "border-red-300 bg-red-100 opacity-75" : isLocationMissing ? "border-yellow-300 bg-yellow-50 ring-2 ring-yellow-200" : isLowStock ? "border-red-800 bg-red-50/30" : "border-bd bg-pn"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold line-clamp-2">{inventory.productName}</CardTitle>
            {(inventory.brand || inventory.catalogNumber) && (
              <CardDescription className="text-xs mt-1">
                {inventory.brand && <span>{inventory.brand}</span>}
                {inventory.brand && inventory.catalogNumber && <span> · </span>}
                {inventory.catalogNumber && <span className="font-mono">{inventory.catalogNumber}</span>}
              </CardDescription>
            )}
            {/* 소유자 정보 */}
            {inventory.user && (
              <div className="flex items-center gap-2 mt-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={inventory.user.image || undefined} />
                  <AvatarFallback className="text-xs">{inventory.user.name?.[0] || inventory.user.email[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{inventory.user.name || inventory.user.email}</span>
              </div>
            )}
          </div>
          {isOutOfStock && (
            <Badge variant="outline" dot="red" dotPulse className="flex-shrink-0 bg-red-100 text-red-700 border-red-800">
              품절
            </Badge>
          )}
          {isLowStock && !isOutOfStock && (
            <Badge variant="outline" dot="amber" className="flex-shrink-0 bg-yellow-50 text-yellow-700 border-yellow-700">
              부족
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 수량 정보 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground mb-1">현재 수량</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{inventory.quantity || 0}</span>
              <span className="text-sm text-muted-foreground">{inventory.unit || "ea"}</span>
            </div>
          </div>
        </div>

        {/* 위치 정보 */}
        <div className={`flex items-center gap-2 text-sm p-2 rounded transition-colors -mx-2 ${isLocationMissing ? "bg-yellow-100 border border-yellow-300" : "hover:bg-el"}`}>
          <MapPin className={`h-4 w-4 flex-shrink-0 ${isLocationMissing ? "text-yellow-600" : "text-muted-foreground"}`} />
          <span className={`flex-1 ${isLocationMissing ? "text-yellow-700 font-semibold" : "text-slate-600"}`}>{inventory.location || "미지정"}</span>
          {isLocationMissing && (
            <Badge variant="outline" dot="amber" className="bg-yellow-50 text-yellow-700 border-yellow-700 text-[11px]">
              설정 필요
            </Badge>
          )}
        </div>

        {/* 입고일 */}
        {inventory.receivedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              입고:{" "}
              {format(new Date(inventory.receivedAt), "yyyy.MM.dd", {
                locale: ko,
              })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
