"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// Dialog kept static — radix portal needed for SSR hydration
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Package, AlertTriangle, Edit, Trash2, TrendingDown, History, Calendar, Users, MapPin, Loader2, CheckCircle2, ShoppingCart, ArrowRight, Zap, Check, Upload, Download, Filter, Search, List, LayoutDashboard, X, LayoutGrid, FlaskConical, ListFilter, FileDown, QrCode, PackagePlus, MoreVertical, Eye, Printer, RotateCcw, Truck, ArrowLeftRight, XCircle, ChevronRight, ScanLine } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
const InventorySearch = dynamic(() => import("@/components/inventory/InventorySearch").then(m => m.InventorySearch), { ssr: false });
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { useQRScanner } from "@/contexts/QRScannerContext";
const DatePicker = dynamic(() => import("@/components/ui/date-picker").then(m => m.DatePicker), { ssr: false });
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
// Sheet is kept static as it wraps children — radix portal
import { Info, FileText, BellRing, Save, Sparkles, GitBranch, Clock, Archive } from "lucide-react";
import {
  type LotRecord,
  type LotStatusFilter,
  computeLotStatus,
  sortLots,
  computeLotSummary,
  filterLotsByStatus,
  searchLots,
  getLotStatusLabel,
  getLotStatusColor,
} from "@/lib/inventory/lot-tracking-engine";
import { getStorageConditionLabel } from "@/lib/constants";
import { useInventoryAiPanel } from "@/hooks/use-inventory-ai-panel";
import { resolveDisposal, type DisposalReason } from "@/lib/ontology/contextual-action/disposal-resolver";
import type { SmartReceiveFormData } from "@/components/inventory/LabelScannerModal";
import type { QueueItem } from "@/components/inventory/priority-action-queue";
const LabelScannerModal = dynamic(() => import("@/components/inventory/LabelScannerModal").then(m => m.LabelScannerModal), { ssr: false });
const LabelPrintModal = dynamic(() => import("@/components/inventory/LabelPrintModal").then(m => m.LabelPrintModal), { ssr: false });
const BulkImportModal = dynamic(() => import("@/components/inventory/BulkImportModal").then(m => m.BulkImportModal), { ssr: false });
const ImportStagingWorkbench = dynamic(() => import("@/components/inventory/import-staging-workbench").then(m => m.ImportStagingWorkbench), { ssr: false });
const StockLifespanGauge = dynamic(() => import("@/components/inventory/stock-lifespan-gauge").then(m => m.StockLifespanGauge), { ssr: false });
const InventoryTable = dynamic(() => import("@/components/inventory/InventoryTable").then(m => m.InventoryTable), { ssr: false });
const AddInventoryModal = dynamic(() => import("@/components/inventory/AddInventoryModal").then(m => m.AddInventoryModal), { ssr: false });
const InventoryAiAssistantPanel = dynamic(() => import("@/components/ai/inventory-ai-assistant-panel").then(m => m.InventoryAiAssistantPanel), { ssr: false });
const LotDisposalPanel = dynamic(() => import("@/components/inventory/lot-disposal-panel").then(m => m.LotDisposalPanel), { ssr: false });
const OpsExecutionContext = dynamic(() => import("@/components/ops/ops-execution-context").then(m => m.OpsExecutionContext), { ssr: false });
const PriorityActionQueue = dynamic(() => import("@/components/inventory/priority-action-queue").then(m => m.PriorityActionQueue), { ssr: false });
const InventoryContextPanel = dynamic(() => import("@/components/inventory/inventory-context-panel").then(m => m.InventoryContextPanel), { ssr: false });
const StorageLocationView = dynamic(() => import("@/components/inventory/storage-location-view").then(m => m.StorageLocationView), { ssr: false });
const InventoryFlowView = dynamic(() => import("@/components/inventory/inventory-flow-view").then(m => m.InventoryFlowView), { ssr: false });
const MobileInventoryView = dynamic(() => import("@/components/inventory/mobile-inventory-view").then(m => m.MobileInventoryView), { ssr: false });
type ContextPanelItem = { id: string; productId: string; productName: string; brand: string | null; catalogNumber: string | null; currentQuantity: number; unit: string; safetyStock: number | null; location: string | null; expiryDate: string | null; notes: string | null; lotNumber?: string | null; storageCondition?: string | null; hazard?: boolean; testPurpose?: string | null; vendor?: string | null; deliveryPeriod?: string | null; inUseOrUnopened?: string | null; averageDailyUsage?: number; leadTimeDays?: number; };

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
  const aiPanelParam = searchParams.get("ai_panel") === "open";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportStagingOpen, setIsImportStagingOpen] = useState(false);
  const [isSmartReceiveOpen, setIsSmartReceiveOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<ProductInventory | null>(null);
  const [inventoryView, setInventoryView] = useState<"my" | "team">("my");
  const [restockRequestedIds, setRestockRequestedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  // URL ?filter= 파라미터가 있으면 초기 필터로 세팅 (대시보드 '부족 알림' 카드 진입)
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("filter") ?? "all"
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const activeFilterCount = [locationFilter, statusFilter, categoryFilter].filter((f) => f !== "all").length;

  // URL 파라미터 변경 시 필터 동기화
  useEffect(() => {
    const f = searchParams.get("filter");
    if (f) setStatusFilter(f);
  }, [searchParams]);

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
    ["from", "productId", "productName", "brand", "catalogNumber", "lotNumber", "expiryDate", "quantity", "casNumber", "action"].forEach(
      (key) => url.searchParams.delete(key)
    );
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
          const matchingItem = displayInventories.find(
            (inv) =>
              inv.product.name.toLowerCase().includes((purchase.itemName || "").toLowerCase()) ||
              (purchase.catalogNumber && inv.product.catalogNumber === purchase.catalogNumber)
          );
          if (matchingItem) {
            setSelectedItem(matchingItem);
            setSheetSafetyStock(String(matchingItem.safetyStock ?? matchingItem.minOrderQty ?? 1));
          }
          setIsSheetOpen(true);
        })
        .catch(() => {
          // 구매 데이터를 못 찾으면 mock context 생성
          setPurchaseContext({ id: prId, itemName: "구매 품목", qty: 1, vendorName: "-" });
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
  const aiPanel = useInventoryAiPanel();

  // ── Lot Disposal Panel (object-scoped disposal dock) state ──
  const [disposalTarget, setDisposalTarget] = useState<import("@/components/inventory/lot-disposal-panel").DisposalTarget | null>(null);
  const [disposalInventoryId, setDisposalInventoryId] = useState<string | null>(null);
  const disposalPanelOpen = disposalTarget !== null;

  // ── Context Panel (right-side detail drawer) state ──
  const [contextPanelItem, setContextPanelItem] = useState<ContextPanelItem | null>(null);
  const contextPanelOpen = contextPanelItem !== null;

  // ── Inventory tab (controlled) ──
  const [activeInventoryTab, setActiveInventoryTab] = useState("manage");
  // ── Lot 추적 tab state ──
  const [lotStatusFilter, setLotStatusFilter] = useState<LotStatusFilter>("all");
  const [lotSearchQuery, setLotSearchQuery] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  const openContextPanel = (inv: ProductInventory) => {
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

  const openReorderReview = (inventory: ProductInventory) => {
    aiPanel.preparePanel({
      id: inventory.id,
      productId: inventory.productId,
      productName: inventory.product.name,
      brand: inventory.product.brand || undefined,
      catalogNumber: inventory.product.catalogNumber || undefined,
      currentQuantity: inventory.currentQuantity,
      unit: inventory.unit || undefined,
      safetyStock: inventory.safetyStock || undefined,
      minOrderQty: inventory.minOrderQty || undefined,
      location: inventory.location || undefined,
      expiryDate: inventory.expiryDate || undefined,
      lotNumber: inventory.lotNumber || undefined,
      autoReorderEnabled: inventory.autoReorderEnabled || false,
      averageDailyUsage: inventory.averageDailyUsage || undefined,
      leadTimeDays: inventory.leadTimeDays || undefined,
      lastInspectedAt: undefined,
    });
  };

  const entityIdParam = searchParams.get("entity_id");

  // Deep-link: ?ai_panel=open 시 패널 자동 오픈
  useEffect(() => {
    if (aiPanelParam && !aiPanel.isOpen) {
      aiPanel.setIsOpen(true);
    }
  }, [aiPanelParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const [restockItem, setRestockItem] = useState<ProductInventory | null>(null);
  const [restockForm, setRestockForm] = useState({ addQty: "", lotNumber: "", expiryDate: "" });
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
  const { data: inventoryResponse, isLoading } = useQuery<{ inventories: ProductInventory[] }>({
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
  const { data: teamInventoryData, isLoading: isLoadingTeam } = useQuery<{ inventories: any[] }>({
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
  const isReorderNeededByLeadTime = (inv: ProductInventory) => {
    const dailyUsage = inv.averageDailyUsage ?? 0;
    const leadTime = inv.leadTimeDays ?? 0;
    if (dailyUsage > 0 && leadTime > 0) {
      return inv.currentQuantity <= dailyUsage * leadTime;
    }
    return false;
  };
  const lowStockItems = inventories.filter((inv) => {
    const bySafetyStock = inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock;
    const byLeadTime = isReorderNeededByLeadTime(inv);
    return bySafetyStock || byLeadTime || inv.currentQuantity === 0;
  });

  // Canonical truth only — mock fallback removed per #P02 (ADR-002 canvas).
  // Empty inventory renders empty state CTA → real /api/inventory POST dialog.
  const displayInventories = inventories;
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
        })
      );
      return statuses;
    },
    enabled: status === "authenticated" && myInventories.length > 0 && inventoryView === "my",
  });

  // 재구매 추천 목록 조회 (인벤토리 하이라이트용)
  const { data: reorderRecommendationsData } = useQuery<{ recommendations: Array<{ inventoryId: string }> }>({
    queryKey: ["reorder-recommendations-for-highlight"],
    queryFn: async () => {
      const response = await fetch("/api/inventory/reorder-recommendations");
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json();
    },
    enabled: status === "authenticated" && inventoryView === "my",
  });

  const recommendedInventoryIds = new Set(
    reorderRecommendationsData?.recommendations?.map((r) => r.inventoryId) || []
  );

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
      const disposalNote = [
        `[LOT 폐기 ${format(new Date(), "yyyy.MM.dd", { locale: ko })}]`,
        `lot=${params.lotNumber}`,
        `qty=${params.quantity}${inventory.unit || ""}`,
        `reason=${reasonLabelMap[params.reason]}`,
        params.reasonDetail ? `detail=${params.reasonDetail}` : null,
        params.quarantine ? "quarantine=true" : null,
      ]
        .filter(Boolean)
        .join(" ");

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
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["reorder-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["reorder-recommendations-for-highlight"] });
      setDisposalTarget(null);
      setDisposalInventoryId(null);
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
    mutationFn: async (formPayload: {
      id?: string;
      productId: string;
      currentQuantity: number;
      unit: string;
      safetyStock?: number;
      minOrderQty?: number;
      location?: string;
      expiryDate?: string;
      autoReorderEnabled?: boolean;
      autoReorderThreshold?: number;
      notes?: string;
      lotNumber?: string;
      storageCondition?: string;
      testPurpose?: string;
    }) => {
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
    mutationFn: async (usagePayload: { inventoryId: string; quantity: number; unit?: string; notes?: string }) => {
      const response = await csrfFetch("/api/inventory/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usagePayload),
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
      toast({ title: "입고 완료", description: "재고 수량이 업데이트되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "입고 실패", description: error.message, variant: "destructive" });
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
      const matchesSearch =
        name.includes(query) ||
        brand.includes(query) ||
        catNo.includes(query) ||
        lot.includes(query) ||
        vendor.includes(query);
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

    return true;
  });

  // 고유 위치 목록 추출
  const uniqueLocations = Array.from(
    new Set(displayInventories.map((inv) => inv.location).filter(Boolean))
  ) as string[];

  // 상단 KPI 카드용 요약 지표 (리드 타임 기반 재주문 포함)
  const totalInventoryCount = displayInventories.length;
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
    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
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
          const expiryDiff =
            new Date(a.expiryDate || 0).getTime() - new Date(b.expiryDate || 0).getTime();
          if (expiryDiff !== 0) return expiryDiff;
          return b.currentQuantity - a.currentQuantity;
        }),
    [displayInventories, now]
  );
  const priorityExpiredLot = actionableExpiredLots[0] ?? null;
  const actionableExpiredQuantity = actionableExpiredLots.reduce(
    (sum, inv) => sum + inv.currentQuantity,
    0
  );

  const buildDisposalTarget = (
    inventory: ProductInventory
  ): import("@/components/inventory/lot-disposal-panel").DisposalTarget => {
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
        totalItemQuantity: displayInventories
          .filter((inv) => inv.productId === inventory.productId)
          .reduce((sum, inv) => sum + inv.currentQuantity, 0),
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
      .filter(
        (inventory) =>
          recommendedInventoryIds.has(inventory.id) &&
          !actionableExpiredLots.some((expired) => expired.id === inventory.id)
      )
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
  const ISSUE_CONFIG: Record<IssueType, { label: string; cls: string; priority: number }> = {
    expired:       { label: "만료됨",     cls: "bg-red-500/10 text-red-400",       priority: 0 },
    out_of_stock:  { label: "품절",       cls: "bg-red-500/10 text-red-400",       priority: 1 },
    expiring:      { label: "만료 임박",  cls: "bg-amber-500/10 text-amber-400",   priority: 2 },
    low_stock:     { label: "부족",       cls: "bg-amber-500/10 text-amber-400",   priority: 3 },
    reorder_lead:  { label: "재발주 필요", cls: "bg-blue-500/10 text-blue-400",    priority: 4 },
    no_location:   { label: "위치 미지정", cls: "bg-el text-slate-400",            priority: 5 },
  };

  const handlePriorityQueueAction = (queueItem: QueueItem) => {
    const inventoryId = queueItem.meta?.inventoryId;
    const match = inventoryId
      ? displayInventories.find((inv) => inv.id === inventoryId)
      : displayInventories.find((inv) => inv.product.name === queueItem.productName);

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
  if (process.env.NODE_ENV === "production" && status === "unauthenticated") {
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
      ${isA4
        ? "display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; width: 100%;"
        : ""}
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
      ${isA4
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
    if (!printWindow) { toast({ title: "팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.", variant: "destructive" }); return; }

    const { default: QRCode } = await import("qrcode");
    const labels = await Promise.all(
      items.map(async (inv) => {
        const url = `${window.location.origin}/dashboard/inventory/scan?id=${inv.id}`;
        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, url, { width: 180, margin: 2, color: { dark: "#1e293b", light: "#ffffff" } });
        return buildLabelHtml({ qrDataUrl: canvas.toDataURL("image/png"), name: inv.product.name, cat: inv.product.catalogNumber, lot: inv.lotNumber, loc: inv.location, qty: inv.currentQuantity, unitStr: inv.unit, invId: inv.id });
      })
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
    if (!printWindow) { toast({ title: "팝업이 차단되었습니다.", variant: "destructive" }); return; }

    const { default: QRCode } = await import("qrcode");
    const url = `${window.location.origin}/dashboard/inventory/scan?id=${inv.id}`;
    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(canvas, url, { width: 180, margin: 2, color: { dark: "#1e293b", light: "#ffffff" } });
    const label = buildLabelHtml({ qrDataUrl: canvas.toDataURL("image/png"), name: inv.product.name, cat: inv.product.catalogNumber, lot: inv.lotNumber, loc: inv.location, qty: inv.currentQuantity, unitStr: inv.unit, invId: inv.id });
    printWindow.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>라벨 — ${escHtml(inv.product.name)}</title><style>${getLabelStyles(labelPrintMode)}</style></head><body>
      <p class="screen-hint">📄 인쇄 미리보기 — <strong>${escHtml(inv.product.name)}</strong></p>
      <div class="label-grid">${label}</div>
      <div class="btn-row"><button class="btn-print" onclick="window.print()">🖨️ 인쇄하기</button><button class="btn-close" onclick="window.close()">닫기</button></div>
    </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-4 md:px-6 py-4 md:py-8 pb-20 lg:pb-8">
      {/* ── Mobile View (below md breakpoint) ── */}
      <div className="md:hidden">
        <div className="flex flex-col space-y-1 mb-4">
          <h1 className="text-xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Inter', 'Pretendard', system-ui, sans-serif" }}>재고 관리</h1>
          <p className="text-slate-500 text-xs">실험실 재고와 lot 상태를 관리합니다.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2 mb-5">
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            재고 등록
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/dashboard/purchases")}
          >
            <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
            구매 반영
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setIsImportStagingOpen(true)}
                className="flex items-center gap-2 text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                재고 파일 가져오기
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/inventory/scan")}
                className="flex items-center gap-2 text-xs"
              >
                <QrCode className="h-3.5 w-3.5" />
                QR 스캔
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkLabelPrint()}
                className="flex items-center gap-2 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                라벨 인쇄
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsSmartReceiveOpen(true)}
                className="flex items-center gap-2 text-xs text-blue-600"
              >
                <ScanLine className="h-3.5 w-3.5" />
                스마트 입고
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <MobileInventoryView
          inventories={displayInventories}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onReorder={(inventory) => {
            aiPanel.preparePanel({
              id: inventory.id,
              productId: inventory.productId,
              productName: inventory.product.name,
              brand: inventory.product.brand || undefined,
              catalogNumber: inventory.product.catalogNumber || undefined,
              currentQuantity: inventory.currentQuantity,
              unit: inventory.unit || undefined,
              safetyStock: inventory.safetyStock || undefined,
              minOrderQty: inventory.minOrderQty || undefined,
              location: inventory.location || undefined,
              expiryDate: inventory.expiryDate || undefined,
              lotNumber: inventory.lotNumber || undefined,
              autoReorderEnabled: inventory.autoReorderEnabled || false,
              averageDailyUsage: inventory.averageDailyUsage || undefined,
              leadTimeDays: inventory.leadTimeDays || undefined,
              lastInspectedAt: undefined,
            });
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
          <div className="flex flex-col space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: "'Inter', 'Pretendard', system-ui, sans-serif" }}>재고 관리</h1>
            <p className="text-sm text-slate-500 hidden sm:block" style={{ fontFamily: "'Pretendard', 'Inter', system-ui, sans-serif" }}>
              실험실 재고와 lot 상태를 관리합니다.
            </p>
          </div>
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
                queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
              }}
            />
            <ImportStagingWorkbench
              open={isImportStagingOpen}
              onClose={() => setIsImportStagingOpen(false)}
              onApplyComplete={() => {
                queryClient.invalidateQueries({ queryKey: ["inventories"] });
                queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
              }}
            />
            <LabelScannerModal
              open={isSmartReceiveOpen}
              onOpenChange={setIsSmartReceiveOpen}
              onDirectReceive={async (data: SmartReceiveFormData) => {
                try {
                  const res = await csrfFetch("/api/inventory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      productName: data.productName,
                      brand: data.brand || null,
                      catalogNumber: data.catalogNumber || null,
                      lotNumber: data.lotNumber || null,
                      expiryDate: data.expirationDate || null,
                      currentQuantity: parseInt(data.quantity) || 1,
                      unit: data.unit || "개",
                    }),
                  });
                  if (!res.ok) throw new Error("입고 등록 실패");
                  toast({ title: "입고 완료", description: `${data.productName} ${data.quantity}${data.unit} 입고 처리되었습니다.` });
                  queryClient.invalidateQueries({ queryKey: ["inventories"] });
                  queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
                } catch {
                  toast({ title: "오류", description: "입고 처리 중 오류가 발생했습니다.", variant: "destructive" });
                }
              }}
            />

            {/* ── Primary CTAs: 품목 추가 + 스마트 입고 ── */}
            <Button onClick={() => setIsDialogOpen(true)} className="h-9 px-4 text-sm shadow-sm active:scale-95 transition-transform">
              <Plus className="h-4 w-4 mr-1.5" />
              품목 추가
            </Button>
            <Button
              onClick={() => setIsSmartReceiveOpen(true)}
              className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95 transition-transform"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              스마트 입고
            </Button>

            {/* ── 더보기: 보조 기능 통합 ── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/purchases")}
                  className="flex items-center gap-2 text-xs"
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  구매 반영
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsImportStagingOpen(true)}
                  className="flex items-center gap-2 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  재고 파일 가져오기
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/inventory/scan")}
                  className="flex items-center gap-2 text-xs"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  QR 스캔
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
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
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  라벨 데이터 내보내기 (엑셀)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 탭 바 — 하단 인디케이터 스타일 */}
        <Tabs value={activeInventoryTab} onValueChange={(v) => setActiveInventoryTab(v)} className="w-full">
          <div className="flex items-center gap-0.5 border-b border-slate-200 mb-4 overflow-x-auto scrollbar-hide">
            {[
              { key: "manage", icon: <ListFilter className="w-3.5 h-3.5" />, label: "품목 관리", badge: null },
              { key: "overview", icon: <LayoutGrid className="w-3.5 h-3.5" />, label: "운영 현황", badge: issuesCount > 0 ? issuesCount : null, suffix: "S" },
              { key: "storage-location", icon: <MapPin className="w-3.5 h-3.5" />, label: "보관 위치", badge: null },
              { key: "flow", icon: <Truck className="w-3.5 h-3.5" />, label: "입출고 흐름", badge: null },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveInventoryTab(tab.key)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeInventoryTab === tab.key ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
              >
                {tab.icon}
                {tab.label}
                {"suffix" in tab && tab.suffix && (
                  <span className="text-[10px] font-bold text-blue-500 ml-0.5">{tab.suffix}</span>
                )}
                {tab.badge !== null && (
                  <span className="inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 text-white font-bold px-1 text-[10px] ml-0.5">
                    {tab.badge}
                  </span>
                )}
                {activeInventoryTab === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-blue-600" />
                )}
              </button>
            ))}
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
                  <InventorySearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    isLoading={isLoading}
                  />
                </div>

                {/* 필터 드롭다운 (아이콘) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 relative">
                      <Filter className="h-4 w-4" />
                      {activeFilterCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold px-1">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-3 space-y-3">
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
                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
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
                      <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => { setLocationFilter("all"); setStatusFilter("all"); setCategoryFilter("all"); }}>
                        초기화
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 라벨 인쇄 */}
                <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0 text-xs" onClick={() => setNewLabelPrintOpen(true)} title="라벨 인쇄">
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">라벨 인쇄</span>
                </Button>

                {/* 내보내기 (아이콘) */}
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" title="내보내기" onClick={async () => {
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
                    toast({ title: "내보내기 실패", description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.", variant: "destructive" });
                  } finally {
                    setIsExportingLabels(false);
                  }
                }}>
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
                      <Button
                        className="flex-1"
                        onClick={() => setFilterSheetOpen(false)}
                      >
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
                      aiPanel.preparePanel({
                        id: inventory.id,
                        productId: inventory.productId,
                        productName: inventory.product.name,
                        brand: inventory.product.brand || undefined,
                        catalogNumber: inventory.product.catalogNumber || undefined,
                        currentQuantity: inventory.currentQuantity,
                        unit: inventory.unit || undefined,
                        safetyStock: inventory.safetyStock || undefined,
                        minOrderQty: inventory.minOrderQty || undefined,
                        location: inventory.location || undefined,
                        expiryDate: inventory.expiryDate || undefined,
                        lotNumber: inventory.lotNumber || undefined,
                        autoReorderEnabled: inventory.autoReorderEnabled || false,
                        averageDailyUsage: inventory.averageDailyUsage || undefined,
                        leadTimeDays: inventory.leadTimeDays || undefined,
                        lastInspectedAt: undefined,
                      });
                    }}
                    onDetailClick={(inventory) => {
                      // Open context panel (right-side) on desktop; Sheet on mobile
                      if (typeof window !== "undefined" && window.innerWidth >= 1280) {
                        openContextPanel(inventory);
                      } else {
                        setSelectedItem(inventory);
                        setSheetSafetyStock(
                          String(inventory.safetyStock ?? inventory.minOrderQty ?? 1)
                        );
                        setIsSheetOpen(true);
                      }
                    }}
                    onRestock={(inventory) => {
                      setRestockItem(inventory);
                      setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" });
                    }}
                    onConsume={(inventory) => {
                      toast({
                        title: "출고 / 사용 처리",
                        description: `${inventory.product.name} 출고/사용 기능은 곧 제공될 예정입니다.`,
                      });
                    }}
                    onMoveLocation={(inventory) => {
                      toast({
                        title: "위치 이동",
                        description: `${inventory.product.name} 위치 이동 기능은 곧 제공될 예정입니다.`,
                      });
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
                      lots.forEach((l) => { defaultQty[l.id] = 1; });
                      setLabelPrintQty(defaultQty);
                      setLabelPrintOpen(true);
                    }}
                    emptyMessage={
                      debouncedSearchQuery.trim()
                        ? `'${debouncedSearchQuery.trim()}'에 해당하는 재고를 찾지 못했습니다.`
                        : "등록된 재고가 없습니다.\n첫 재고를 추가해 운영을 시작하세요."
                    }
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
            {(() => {
              if (!priorityExpiredLot) return null;
              return (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">우선 처리: 만료 lot {actionableExpiredLots.length}건 폐기 필요</p>
                    <p className="text-xs text-red-600/70">만료 lot {actionableExpiredLots.length}건 · 잔량 {actionableExpiredQuantity}개. 폐기 처리를 먼저 진행하세요.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
                    onClick={() => openDisposalDock(priorityExpiredLot)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    폐기 처리 시작
                  </Button>
                </div>
              );
            })()}

            {/* ── 우선 처리 배너 (최상단 1줄) ── */}
            {issuesCount > 0 ? (
              <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                priorityExpiredLot
                  ? "border-red-200 bg-red-50"
                  : expiringSoonCount > 0
                  ? "border-red-200 bg-red-50"
                  : lowOrOutOfStockCount > 0
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
              }`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                  priorityExpiredLot
                    ? "bg-red-100"
                    : expiringSoonCount > 0
                    ? "bg-red-100"
                    : lowOrOutOfStockCount > 0
                      ? "bg-amber-100"
                      : "bg-slate-100"
                }`}>
                  {priorityExpiredLot
                    ? <Trash2 className="h-4 w-4 text-red-600" />
                    : expiringSoonCount > 0
                    ? <Calendar className="h-4 w-4 text-red-600" />
                    : lowOrOutOfStockCount > 0
                      ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                      : <Zap className="h-4 w-4 text-slate-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-extrabold text-slate-900">
                    {priorityExpiredLot
                      ? `우선 처리: 만료 lot ${actionableExpiredLots.length}건 — 폐기 처리 필요`
                      : expiringSoonCount > 0
                      ? `우선 처리: 만료 임박 ${expiringSoonCount}건 — 폐기 또는 우선 소진 필요`
                      : lowOrOutOfStockCount > 0
                        ? `우선 처리: 재고 부족 ${lowOrOutOfStockCount}건 — 발주 검토 필요`
                        : `처리 대기 ${issuesCount}건 — 아래 큐에서 확인하세요`
                    }
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!priorityExpiredLot && !topPriorityQueueItem}
                  className={`h-7 px-3 text-[11px] font-bold gap-1 flex-shrink-0 ${
                    priorityExpiredLot || expiringSoonCount > 0
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  }`}
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
            )}

            {/* ── 요약 칩 (backlog 분류, secondary) ── */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "만료 임박", value: expiringSoonCount, color: "text-red-600", bg: "bg-red-50 border-red-200" },
                { label: "부족/품절", value: lowOrOutOfStockCount, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                { label: "전체 재고", value: totalInventoryCount, color: "text-slate-600", bg: "bg-white border-slate-200" },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${chip.bg} ${chip.color}`}
                >
                  {chip.label}
                  <span className="font-extrabold">{chip.value}</span>
                </span>
              ))}
            </div>

            {/* Priority Action Queue */}
            <PriorityActionQueue
              items={priorityQueueItems}
              onAction={handlePriorityQueueAction}
              onItemClick={handlePriorityQueueAction}
            />

            {/* 조치 필요 항목 — removed: PriorityActionQueue가 동일 ontology backlog를 surface합니다 */}
            {false && <Card className="shadow-sm border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-sm font-bold text-slate-800">
                  <Zap className="mr-2 h-4 w-4 text-amber-500" />
                  조치 필요 항목
                  <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 border-amber-300 bg-amber-100 text-amber-700">{issuesCount}건</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const urgent = displayInventories
                    .filter((inv) => {
                      if (dismissedAlertIds.has(inv.id)) return false;
                      const isOut = inv.currentQuantity === 0;
                      const isLow =
                        inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock;
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
                        <p className="text-sm font-medium text-slate-700">
                          모든 재고가 정상 범위입니다.
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          긴급 조치가 필요한 항목이 없습니다.
                        </p>
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
                  /** 이슈 유형별 카드 배경 */
                  const getCardBg = (issueType: IssueType) => {
                    switch (issueType) {
                      case "expired":
                      case "out_of_stock":
                        return "bg-red-50 border-red-200";
                      case "expiring":
                        return "bg-amber-50 border-amber-200";
                      case "low_stock":
                      case "reorder_lead":
                        return "bg-orange-50 border-orange-200";
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
                        <div
                          key={inv.id}
                          className={`flex items-start justify-between p-3 border rounded-lg gap-3 hover:shadow-sm transition-all ${cardBg}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(inv);
                              setSheetSafetyStock(
                                String(inv.safetyStock ?? inv.minOrderQty ?? 1)
                              );
                              setIsSheetOpen(true);
                            }}
                            className="flex-1 min-w-0 text-left"
                          >
                            {/* Line 1: 배지 + 품목명 + D-day */}
                            <div className="flex items-center gap-2">
                              <Badge className={`text-[10px] px-1.5 py-0 border-none whitespace-nowrap shrink-0 ${issueInfo.cls}`}>{issueInfo.label}</Badge>
                              <h5 className="text-sm font-bold text-slate-900 truncate flex-1">
                                {inv.product.name}
                              </h5>
                              {daysLeft && (issueType === "expiring" || issueType === "expired") && (
                                <span className={`text-[10px] font-bold shrink-0 ${issueType === "expired" ? "text-red-400" : "text-amber-400"}`}>{daysLeft}</span>
                              )}
                            </div>
                            {/* Line 2: 핵심 수치 1줄 (축약) */}
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                              <span className={`font-semibold ${
                                inv.currentQuantity === 0 ? "text-red-400" :
                                (inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock) ? "text-amber-400" :
                                "text-slate-600"
                              }`}>{inv.currentQuantity}</span> {inv.unit}
                              {inv.safetyStock != null && <span className="text-slate-500"> / 안전재고 {inv.safetyStock}</span>}
                              {inv.expiryDate && issueType !== "expiring" && issueType !== "expired" && <span className="text-slate-500"> · {format(new Date(inv.expiryDate), "MM.dd")} 만료</span>}
                              {!inv.location && issueType !== "no_location" && <span className="text-amber-500"> · 위치 없음</span>}
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
                                className={`h-7 px-2 text-[11px] whitespace-nowrap gap-1 ${
                                  issueType === "out_of_stock"
                                    ? "text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                                    : "text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  aiPanel.preparePanel({
                                    id: inv.id,
                                    productId: inv.productId,
                                    productName: inv.product.name,
                                    brand: inv.product.brand || undefined,
                                    catalogNumber: inv.product.catalogNumber || undefined,
                                    currentQuantity: inv.currentQuantity,
                                    unit: inv.unit || undefined,
                                    safetyStock: inv.safetyStock || undefined,
                                    minOrderQty: inv.minOrderQty || undefined,
                                    location: inv.location || undefined,
                                    expiryDate: inv.expiryDate || undefined,
                                    lotNumber: inv.lotNumber || undefined,
                                    autoReorderEnabled: inv.autoReorderEnabled || false,
                                    averageDailyUsage: inv.averageDailyUsage || undefined,
                                    leadTimeDays: inv.leadTimeDays || undefined,
                                    lastInspectedAt: undefined,
                                  });
                                }}
                              >
                                <Sparkles className="h-3 w-3 shrink-0" />
                                재발주 검토
                              </Button>
                            )}
                            {(issueType === "expiring") && (
                              /* 유효기간 임박 → 우선 사용 배지 (읽기 전용 상태 표시) */
                              <Badge variant="outline" className="h-6 px-1.5 text-[10px] font-semibold whitespace-nowrap bg-amber-950/30 text-amber-400 border-amber-800  bg-amber-950/30  text-amber-400  border-amber-800 shrink-0" title="유효기간 임박 또는 먼저 소진해야 하는 항목입니다.">
                                <Truck className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                                우선 사용
                              </Badge>
                            )}
                            {(issueType === "expired") && (
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
                            {(issueType === "no_location") && (
                              /* 위치 미지정 → 위치 지정 */
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] whitespace-nowrap gap-1 text-violet-400 border-violet-800 hover:bg-violet-950/30  text-violet-400  border-violet-800  hover:bg-violet-950/30"
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
                            {/* 더보기 — 보조 조치 */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-slate-600 hover:bg-slate-700 shrink-0"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  className="gap-2 text-xs"
                                  onClick={() => {
                                    setSelectedItem(inv);
                                    setSheetSafetyStock(String(inv.safetyStock ?? inv.minOrderQty ?? 1));
                                    setIsSheetOpen(true);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  상세 보기
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2 text-xs"
                                  onClick={() => {
                                    setEditingInventory(inv);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  정보 수정
                                </DropdownMenuItem>
                                {/* 이슈별 보조 조치 */}
                                {issueType === "expiring" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-xs text-red-400"
                                      onClick={() => {
                                        toast({
                                          title: "폐기 검토",
                                          description: `${inv.product.name} 폐기 절차를 확인하세요.`,
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                      폐기 검토
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="gap-2 text-xs"
                                      onClick={() => {
                                        aiPanel.preparePanel({
                                          id: inv.id,
                                          productId: inv.productId,
                                          productName: inv.product.name,
                                          brand: inv.product.brand || undefined,
                                          catalogNumber: inv.product.catalogNumber || undefined,
                                          currentQuantity: inv.currentQuantity,
                                          unit: inv.unit || undefined,
                                          safetyStock: inv.safetyStock || undefined,
                                          minOrderQty: inv.minOrderQty || undefined,
                                          location: inv.location || undefined,
                                          expiryDate: inv.expiryDate || undefined,
                                          lotNumber: inv.lotNumber || undefined,
                                          autoReorderEnabled: inv.autoReorderEnabled || false,
                                          averageDailyUsage: inv.averageDailyUsage || undefined,
                                          leadTimeDays: inv.leadTimeDays || undefined,
                                          lastInspectedAt: undefined,
                                        });
                                      }}
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      재발주 검토
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {issueType === "expired" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-xs"
                                      onClick={() => {
                                        aiPanel.preparePanel({
                                          id: inv.id,
                                          productId: inv.productId,
                                          productName: inv.product.name,
                                          brand: inv.product.brand || undefined,
                                          catalogNumber: inv.product.catalogNumber || undefined,
                                          currentQuantity: inv.currentQuantity,
                                          unit: inv.unit || undefined,
                                          safetyStock: inv.safetyStock || undefined,
                                          minOrderQty: inv.minOrderQty || undefined,
                                          location: inv.location || undefined,
                                          expiryDate: inv.expiryDate || undefined,
                                          lotNumber: inv.lotNumber || undefined,
                                          autoReorderEnabled: inv.autoReorderEnabled || false,
                                          averageDailyUsage: inv.averageDailyUsage || undefined,
                                          leadTimeDays: inv.leadTimeDays || undefined,
                                          lastInspectedAt: undefined,
                                        });
                                      }}
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      대체품 재발주 검토
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(issueType === "out_of_stock" || issueType === "low_stock") && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-xs"
                                      onClick={() => {
                                        setRestockItem(inv);
                                        setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" });
                                      }}
                                    >
                                      <PackagePlus className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      입고 등록
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-xs text-slate-500"
                                  onClick={() => {
                                    setDismissedAlertIds((prev) => new Set(prev).add(inv.id));
                                    toast({
                                      title: "이슈 처리 완료",
                                      description: `${inv.product.name} 이슈를 목록에서 제외했습니다.`,
                                    });
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                                  목록에서 제외
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>}
            </TabsContent>

            {/* 3. Lot 추적 — contextual drill-down (1급 탭에서 내려옴, 품목 컨텍스트에서 진입) */}
            <TabsContent value="lot-tracking" className="m-0 p-4 sm:p-6 space-y-4">
              {/* Back to item view */}
              <button
                type="button"
                onClick={() => setActiveInventoryTab("manage")}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors mb-1"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                품목 관리로 돌아가기
              </button>
              {(() => {
                const now = new Date();
                // Build lot records from inventory data
                const allLots: LotRecord[] = displayInventories
                  .filter((inv) => inv.lotNumber)
                  .map((inv) => ({
                    lotId: `${inv.id}-${inv.lotNumber}`,
                    itemId: inv.id,
                    lotCode: inv.lotNumber!,
                    productName: inv.product.name,
                    brand: inv.product.brand,
                    catalogNumber: inv.product.catalogNumber,
                    qtyOnHand: inv.currentQuantity,
                    unit: inv.unit,
                    location: inv.location,
                    receivedAt: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
                    expiresAt: inv.expiryDate,
                    status: computeLotStatus(inv.currentQuantity, inv.expiryDate, now),
                    sourceDocumentId: null,
                    lastEventAt: new Date(Date.now() - Math.random() * 14 * 86400000).toISOString(),
                    storageCondition: inv.storageCondition,
                  }));

                const summary = computeLotSummary(allLots);
                const sorted = sortLots(allLots);

                // Local state isn't possible inside render — use URL-like approach with closure
                // Use parent-level state for lot filter and search (added above)
                const filtered = filterLotsByStatus(sorted, lotStatusFilter);
                const searched = lotSearchQuery.trim()
                  ? searchLots(filtered, lotSearchQuery)
                  : filtered;

                return (
                  <>
                    {/* Summary cards — clickable filters */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {([
                        { key: "all" as LotStatusFilter, label: "전체 Lot", count: summary.totalLots, color: "#C8D4E5", borderColor: "#2E3B50" },
                        { key: "active" as LotStatusFilter, label: "활성", count: summary.activeLots, color: "#34D399", borderColor: "#16A34A33" },
                        { key: "expiring_soon" as LotStatusFilter, label: "만료 임박", count: summary.expiringSoonLots, color: "#FBBF24", borderColor: "#F59E0B33" },
                        { key: "expired" as LotStatusFilter, label: "만료/소진", count: summary.expiredLots + summary.depletedLots, color: "#F87171", borderColor: "#EF444433" },
                      ]).map((card) => (
                        <button
                          key={card.key}
                          onClick={() => setLotStatusFilter(card.key)}
                          className={`rounded-xl p-3 text-left transition-all active:scale-95 ${lotStatusFilter === card.key ? "ring-2 ring-blue-500/50" : ""}`}
                          style={{ backgroundColor: "#1E2738", border: `1px solid ${lotStatusFilter === card.key ? "#3B82F6" : card.borderColor}` }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#8A99AF" }}>{card.label}</p>
                          <p className="text-xl font-bold" style={{ color: card.color }}>{card.count}</p>
                        </button>
                      ))}
                    </div>

                    {/* Search bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#667389" }} />
                      <Input
                        value={lotSearchQuery}
                        onChange={(e) => setLotSearchQuery(e.target.value)}
                        placeholder="LOT 번호, 품목명, 위치로 검색..."
                        className="pl-9 h-10 text-sm"
                        style={{ backgroundColor: "#151C26", borderColor: "#2E3B50", color: "#C8D4E5" }}
                      />
                    </div>

                    {/* Lot row list */}
                    {searched.length === 0 ? (
                      <div className="rounded-xl px-6 py-10 text-center" style={{ backgroundColor: "#1E2738", border: "1px solid #2E3B50" }}>
                        <Archive className="h-8 w-8 mx-auto mb-3" style={{ color: "#4A5E78" }} />
                        <p className="text-sm font-medium" style={{ color: "#8A99AF" }}>
                          {lotStatusFilter !== "all" ? `${getLotStatusLabel(lotStatusFilter as any)} 상태의 Lot이 없습니다` : "Lot 데이터가 없습니다"}
                        </p>
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
                                className={`w-full text-left rounded-xl p-3 transition-all active:scale-[0.98] ${selectedLotId === lot.lotId ? "ring-2 ring-blue-500/50" : ""}`}
                                style={{ backgroundColor: "#1E2738", border: "1px solid #2E3B50" }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white">{lot.lotCode}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                                      {getLotStatusLabel(lot.status)}
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold text-white">{lot.qtyOnHand} {lot.unit}</span>
                                </div>
                                <p className="text-[11px] truncate" style={{ color: "#C8D4E5" }}>{lot.productName}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  {lot.location && <span className="text-[10px] flex items-center gap-1" style={{ color: "#8A99AF" }}><MapPin className="h-3 w-3" />{lot.location}</span>}
                                  {lot.expiresAt && <span className="text-[10px] flex items-center gap-1" style={{ color: "#8A99AF" }}><Calendar className="h-3 w-3" />{format(new Date(lot.expiresAt), "yy.MM.dd")}</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Desktop: table */}
                        <div className="hidden md:block rounded-xl overflow-hidden" style={{ border: "1px solid #2E3B50" }}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ backgroundColor: "#151C26" }}>
                                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>LOT 번호</th>
                                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>품목</th>
                                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>상태</th>
                                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>잔량</th>
                                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>위치</th>
                                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>유효기간</th>
                                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>마지막 이벤트</th>
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
                                    className="cursor-pointer transition-colors"
                                    style={{
                                      backgroundColor: isSelected ? "#232D3C" : "#1E2738",
                                      borderBottom: "1px solid #2E3B50",
                                    }}
                                  >
                                    <td className="px-4 py-3">
                                      <span className="text-xs font-bold text-white">{lot.lotCode}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div>
                                        <p className="text-xs font-medium text-white truncate max-w-[200px]">{lot.productName}</p>
                                        {lot.brand && <p className="text-[10px]" style={{ color: "#8A99AF" }}>{lot.brand}</p>}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                                        {getLotStatusLabel(lot.status)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <span className="text-xs font-bold text-white">{lot.qtyOnHand}</span>
                                      <span className="text-[10px] ml-0.5" style={{ color: "#8A99AF" }}>{lot.unit}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs" style={{ color: lot.location ? "#C8D4E5" : "#667389" }}>
                                        {lot.location || "미지정"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs" style={{ color: "#C8D4E5" }}>
                                        {lot.expiresAt ? format(new Date(lot.expiresAt), "yyyy.MM.dd") : "—"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-[11px]" style={{ color: "#8A99AF" }}>
                                        {format(new Date(lot.lastEventAt), "MM.dd HH:mm")}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <p className="text-[11px] text-right" style={{ color: "#667389" }}>
                          {searched.length}개 Lot 표시 중
                          {lotStatusFilter !== "all" && ` (${getLotStatusLabel(lotStatusFilter as any)} 필터)`}
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
          </div>{/* end 통합 카드 */}
        </div>{/* end rounded card */}
        </Tabs>{/* end Tabs */}

        </div>{/* end main content */}

        {/* ── Context Panel (right-side operational detail) ── */}
        {contextPanelOpen && contextPanelItem && (
          <InventoryContextPanel
            item={contextPanelItem}
            isOpen={contextPanelOpen}
            onClose={() => setContextPanelItem(null)}
            onLotDrillDown={() => setActiveInventoryTab("lot-tracking")}
            onReorder={(cpItem) => {
              const match = displayInventories.find((inv) => inv.id === cpItem.id);
              if (match) {
                aiPanel.preparePanel({
                  id: match.id,
                  productId: match.productId,
                  productName: match.product.name,
                  brand: match.product.brand || undefined,
                  catalogNumber: match.product.catalogNumber || undefined,
                  currentQuantity: match.currentQuantity,
                  unit: match.unit || undefined,
                  safetyStock: match.safetyStock || undefined,
                  minOrderQty: match.minOrderQty || undefined,
                  location: match.location || undefined,
                  expiryDate: match.expiryDate || undefined,
                  lotNumber: match.lotNumber || undefined,
                  autoReorderEnabled: match.autoReorderEnabled || false,
                  averageDailyUsage: match.averageDailyUsage || undefined,
                  leadTimeDays: match.leadTimeDays || undefined,
                  lastInspectedAt: undefined,
                });
              }
              setContextPanelItem(null);
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
        )}
        </div>{/* end flex row */}

        {/* 우측 상세 Sheet (Drawer) */}
        <Sheet open={isSheetOpen} onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setShowRestockHistory(false);
            setDrawerMode("view");
            setPurchaseContext(null);
          }
        }}>
          <SheetContent className="w-[90vw] overflow-y-auto sm:max-w-[480px]">
            {/* ════ purchase-receiving mode ════ */}
            {drawerMode === "purchase-receiving" && purchaseContext && (
              <>
                <SheetHeader className="mb-3 mt-3 border-b border-emerald-800 pb-3  border-emerald-800">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Badge className="border-none bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900/40  bg-emerald-900/50  text-emerald-300 text-xs">
                      구매 → 입고 반영
                    </Badge>
                  </div>
                  <SheetTitle className="text-lg font-bold leading-tight">
                    {purchaseContext.itemName || "입고 반영"}
                  </SheetTitle>
                  <SheetDescription className="text-sm text-slate-400  text-slate-400 mt-0.5">
                    구매 데이터를 기반으로 재고에 입고를 반영합니다
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-4">
                  {/* 구매 연동 정보 카드 */}
                  <div className="rounded-lg border border-emerald-800 bg-emerald-950/20  border-emerald-800  bg-emerald-950/20 p-3.5">
                    <h4 className="text-xs font-semibold text-emerald-400  text-emerald-400 mb-2 flex items-center gap-1.5">
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
                        <span className="font-medium">{purchaseContext.qty || 0} {purchaseContext.unit || "ea"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">구매 ID</span>
                        <span className="font-mono text-[10px] text-slate-400 truncate ml-2">{purchaseContext.id?.slice(0, 8) || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* 기존 재고 매칭 정보 */}
                  {selectedItem && (
                    <div className="rounded-lg border border-blue-800 bg-blue-950/20  border-blue-800  bg-blue-950/20 p-3">
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
                      <Label htmlFor="receiving-qty" className="text-xs">실제 입고 수량 <span className="text-red-500">*</span></Label>
                      <Input
                        id="receiving-qty"
                        type="number"
                        min="1"
                        placeholder="입고할 수량"
                        value={receivingForm.actualQty}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReceivingForm((f) => ({ ...f, actualQty: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="receiving-lot" className="text-xs">Lot Number <span className="text-slate-400 font-normal">(선택)</span></Label>
                      <Input
                        id="receiving-lot"
                        placeholder="예: LOT-2026-001"
                        value={receivingForm.lotNumber}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReceivingForm((f) => ({ ...f, lotNumber: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">유효기간 <span className="text-slate-400 font-normal">(선택)</span></Label>
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
                      <Label htmlFor="receiving-location" className="text-xs">보관 위치 <span className="text-slate-400 font-normal">(선택)</span></Label>
                      <Input
                        id="receiving-location"
                        placeholder="예: 냉동고 1칸"
                        value={receivingForm.location}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReceivingForm((f) => ({ ...f, location: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="receiving-notes" className="text-xs">특이사항 <span className="text-slate-400 font-normal">(선택)</span></Label>
                      <Input
                        id="receiving-notes"
                        placeholder="입고 관련 메모"
                        value={receivingForm.notes}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReceivingForm((f) => ({ ...f, notes: e.target.value }))}
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
                          onChange={() => setReceivingForm((f) => ({ ...f, restockMethod: "merge" }))}
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
                          onChange={() => setReceivingForm((f) => ({ ...f, restockMethod: "newLot" }))}
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
                    <div className="rounded-lg bg-emerald-900/20  bg-emerald-900/20 px-4 py-3 text-sm flex justify-between">
                      <span className="text-emerald-400  text-emerald-400">입고 후 재고</span>
                      <span className="font-bold text-emerald-400  text-emerald-400">
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
                            }
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
                    <Badge className="border-none bg-blue-900/50 text-blue-300 hover:bg-blue-100  bg-blue-900/50  text-blue-300 text-xs">
                      시약 상세 정보
                    </Badge>
                    {selectedItem.hazard && (
                      <Badge className="border-none bg-red-950/30 text-red-400  bg-red-950/50  text-red-400 text-xs">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        유해 물질
                      </Badge>
                    )}
                  </div>
                  <SheetTitle className="text-lg font-bold leading-tight">
                    {selectedItem.product.name}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-2 text-sm text-slate-400  text-slate-400 mt-0.5">
                    <span>{selectedItem.product.brand ?? "-"}</span>
                    <span className="text-slate-600  text-slate-400">|</span>
                    <span className="font-mono text-xs">
                      {selectedItem.product.catalogNumber ?? "-"}
                    </span>
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-3">
                  {/* ── Lot / 유효기한 카드: 패딩 압축 ── */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-pn/50 px-3 py-2">
                      <p className="text-[10px] text-slate-500  text-slate-400">Lot Number</p>
                      <p className="font-mono text-sm font-bold mt-0.5">
                        {selectedItem.lotNumber ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-md bg-pn/50 px-3 py-2">
                      <p className="text-[10px] text-slate-500  text-slate-400">유효 기한</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {selectedItem.expiryDate
                          ? format(new Date(selectedItem.expiryDate), "yyyy.MM.dd", { locale: ko })
                          : "-"}
                      </p>
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
                    <div className="rounded-md border border-blue-900 bg-blue-950/30 px-3 py-2 text-xs leading-relaxed text-slate-600 min-h-[40px]">
                      {selectedItem.notes || "등록된 특이사항이 없습니다."}
                    </div>
                  </div>

                  {/* ── 재고 부족 알림 기준: 한 줄 inline 배치 ── */}
                  <div className="rounded-md border border-bd bg-pn/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <BellRing className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-900">안전 재고 기준</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          id="sheet-minQty"
                          type="number"
                          min={0}
                          value={sheetSafetyStock}
                          onChange={(e) => setSheetSafetyStock(e.target.value)}
                          className="w-20 h-7 text-xs bg-sh"
                        />
                        <span className="text-xs text-slate-500">{selectedItem.unit || "개"}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs shrink-0 border-blue-800 bg-sh text-blue-400 hover:bg-blue-950/30"
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
                                setSelectedItem((prev) =>
                                  prev ? { ...prev, safetyStock: value } : null
                                );
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
                    <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400  text-slate-500">
                      이 수량 이하로 떨어지면 대시보드에서 경고 알림이 발생합니다.
                    </p>
                  </div>

                  {/* 입고 이력 토글 섹션 */}
                  <div className="border-t border-bd  border-bd pt-4">
                    <button
                      className="flex w-full items-center justify-between text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                      onClick={() => setShowRestockHistory((v) => !v)}
                    >
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
                                <span className="font-semibold text-emerald-400">+{r.quantity.toLocaleString()} {r.unit || selectedItem.unit}</span>
                                <span className="text-slate-400">{format(new Date(r.restockedAt), "yyyy.MM.dd HH:mm", { locale: ko })}</span>
                              </div>
                              {(r.lotNumber || r.expiryDate) && (
                                <div className="mt-1 flex gap-3 text-slate-500">
                                  {r.lotNumber && <span>Lot: {r.lotNumber}</span>}
                                  {r.expiryDate && <span>유효: {format(new Date(r.expiryDate), "yyyy.MM.dd", { locale: ko })}</span>}
                                </div>
                              )}
                              {r.user && (
                                <div className="mt-0.5 text-slate-400">{r.user.name || r.user.email}</div>
                              )}
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
                        setIsSheetOpen(false);
                        aiPanel.preparePanel({
                          id: selectedItem.id,
                          productId: selectedItem.productId,
                          productName: selectedItem.product.name,
                          brand: selectedItem.product.brand || undefined,
                          catalogNumber: selectedItem.product.catalogNumber || undefined,
                          currentQuantity: selectedItem.currentQuantity,
                          unit: selectedItem.unit || undefined,
                          safetyStock: selectedItem.safetyStock || undefined,
                          minOrderQty: selectedItem.minOrderQty || undefined,
                          location: selectedItem.location || undefined,
                          expiryDate: selectedItem.expiryDate || undefined,
                          lotNumber: selectedItem.lotNumber || undefined,
                          autoReorderEnabled: selectedItem.autoReorderEnabled || false,
                          averageDailyUsage: selectedItem.averageDailyUsage || undefined,
                          leadTimeDays: selectedItem.leadTimeDays || undefined,
                          lastInspectedAt: undefined,
                        });
                      }}
                    >
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      재발주 검토
                    </Button>
                  </div>
                </div>

                {/* 운영 실행 현황 */}
                <OpsExecutionContext
                  entityType="INVENTORY_RESTOCK"
                  entityId={selectedItem.id}
                  compact
                  className="mt-4 pt-4 border-t border-bd  border-bd"
                />
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* 입고 Dialog */}
        <Dialog open={!!restockItem} onOpenChange={(open) => { if (!open) { setRestockItem(null); setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" }); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-400">
                <span>입고 수량 추가</span>
              </DialogTitle>
              <DialogDescription>
                {restockItem?.product.name}
                {restockItem?.product.catalogNumber && (
                  <span className="ml-1 text-xs text-slate-400">{restockItem.product.catalogNumber}</span>
                )}
              </DialogDescription>
            </DialogHeader>
            {restockItem && (
              <div className="space-y-4 pt-1">
                {/* 신규 Lot 이력 안내 */}
                <div className="rounded-lg bg-emerald-900/20 border border-emerald-800  bg-emerald-900/20  border-emerald-800 px-3 py-2 text-xs text-emerald-400  text-emerald-400 flex items-start gap-2">
                  <PackagePlus className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>입고 수량과 Lot 정보는 <strong>신규 입고 이력</strong>으로 별도 기록됩니다. 기존 Lot 데이터는 유지됩니다.</span>
                </div>
                <div className="rounded-lg bg-el px-4 py-3 text-sm flex justify-between">
                  <span className="text-slate-500">현재 재고</span>
                  <span className="font-semibold">{restockItem.currentQuantity.toLocaleString()} {restockItem.unit}</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="restock-qty">추가 수량 <span className="text-red-500">*</span></Label>
                  <Input
                    id="restock-qty"
                    type="number"
                    min="1"
                    placeholder="추가할 수량 입력"
                    value={restockForm.addQty}
                    onChange={(e) => setRestockForm((f) => ({ ...f, addQty: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="restock-lot">Lot 번호 <span className="text-slate-400 font-normal text-xs">(선택)</span></Label>
                  <Input
                    id="restock-lot"
                    placeholder="예: LOT-2024-001"
                    value={restockForm.lotNumber}
                    onChange={(e) => setRestockForm((f) => ({ ...f, lotNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>유효기간 <span className="text-slate-400 font-normal text-xs">(선택)</span></Label>
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
                  <div className="rounded-lg bg-emerald-900/20  bg-emerald-900/20 px-4 py-3 text-sm flex justify-between">
                    <span className="text-emerald-400">입고 후 재고</span>
                    <span className="font-bold text-emerald-400">
                      {(restockItem.currentQuantity + Number(restockForm.addQty)).toLocaleString()} {restockItem.unit}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setRestockItem(null); setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" }); }}>
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
        <Dialog open={!!restockDoneItem} onOpenChange={(open) => { if (!open) setRestockDoneItem(null); }}>
          <DialogContent className="max-w-xs text-center">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900/40  bg-emerald-900/40">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-lg">입고 완료</DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  {restockDoneItem?.product.name} 입고가 반영되었습니다.
                  <br />라벨을 바로 인쇄하시겠습니까?
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
              <DialogDescription>
                인쇄할 Lot를 선택하고 라벨 수량을 지정하세요.
              </DialogDescription>
            </DialogHeader>
            {/* 인쇄 모드 선택 */}
            <div className="flex items-center gap-2 py-2 px-1">
              <span className="text-xs text-slate-500 shrink-0">인쇄 모드:</span>
              <div className="flex rounded-lg border border-bs overflow-hidden text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 transition-colors ${labelPrintMode === "a4-multi" ? "bg-indigo-600 text-white" : "bg-pn text-slate-400 hover:bg-el"}`}
                  onClick={() => setLabelPrintMode("a4-multi")}
                >
                  A4 멀티 라벨 (3×7)
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 transition-colors ${labelPrintMode === "single" ? "bg-indigo-600 text-white" : "bg-pn text-slate-400 hover:bg-el"}`}
                  onClick={() => setLabelPrintMode("single")}
                >
                  개별 라벨 (60×40mm)
                </button>
              </div>
            </div>
            <div className="space-y-3 pt-1 max-h-[50vh] overflow-y-auto">
              {labelPrintLots.map((lot) => {
                const isChecked = labelPrintSelected.has(lot.id);
                const qty = labelPrintQty[lot.id] ?? 1;
                return (
                  <div
                    key={lot.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${isChecked ? "border-indigo-800 bg-indigo-950/20" : "border-bs bg-pn"}`}
                  >
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
                        <span className="font-mono font-semibold text-slate-600">
                          {lot.lotNumber || "Lot 미지정"}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{lot.currentQuantity} {lot.unit}</span>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLabelPrintOpen(false)}
                >
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
                    if (!printWindow) { toast({ title: "팝업이 차단되었습니다.", variant: "destructive" }); return; }
                    const { default: QRCode } = await import("qrcode");
                    const labels = await Promise.all(
                      selectedLots.flatMap((lot) => {
                        const copies = labelPrintQty[lot.id] ?? 1;
                        return Array.from({ length: copies }, async () => {
                          const url = `${window.location.origin}/dashboard/inventory/scan?id=${lot.id}`;
                          const canvas = document.createElement("canvas");
                          await QRCode.toCanvas(canvas, url, { width: 180, margin: 2, color: { dark: "#1e293b", light: "#ffffff" } });
                          return buildLabelHtml({ qrDataUrl: canvas.toDataURL("image/png"), name: lot.product.name, cat: lot.product.catalogNumber, lot: lot.lotNumber, loc: lot.location, qty: lot.currentQuantity, unitStr: lot.unit, invId: lot.id });
                        });
                      })
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
                    <p className="text-sm font-bold text-red-800">우선 처리: 만료 lot {actionableExpiredLots.length}건 · 잔량 {actionableExpiredQuantity}개</p>
                    <p className="text-xs text-red-600/70">사용 금지 상태입니다. 재주문보다 폐기 처리를 먼저 진행하세요.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
                    onClick={() => openDisposalDock(priorityExpiredLot)}
                  >
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
                  <Package className="h-4 w-4 mr-2" />
                  내 자산
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
                  <Input
                    placeholder="품목명, 제조사, CAS No. 또는 카탈로그 번호로 검색하세요"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
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
                      <p className="text-muted-foreground mb-4">
                        {inventoryView === "my" ? "등록된 재고가 없습니다." : "팀 인벤토리가 비어있습니다."}
                      </p>
                      {inventoryView === "my" && (
                        <Button onClick={() => setIsDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          첫 재고 추가하기
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
                          const matchesSearch = 
                            inv.product?.name?.toLowerCase().includes(query) ||
                            inv.product?.brand?.toLowerCase().includes(query) ||
                            inv.product?.catalogNumber?.toLowerCase().includes(query);
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
                            onEdit={() => {
                              setEditingInventory(inventory);
                              setIsDialogOpen(true);
                            }}
                            onRecordUsage={(quantity, notes) => {
                              recordUsageMutation.mutate({
                                inventoryId: inventory.id,
                                quantity,
                                unit: inventory.unit,
                                notes,
                              });
                            }}
                            onRestockRequest={() => {
                              restockRequestMutation.mutate(inventory.id);
                            }}
                            onPrintLabel={() => handleSingleLabelPrint(inventory)}
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
                        <Users className="h-4 w-4 mr-2" />
                        팀 설정으로 이동
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
                          const matchesSearch = 
                            inv.productName?.toLowerCase().includes(query) ||
                            inv.brand?.toLowerCase().includes(query) ||
                            inv.catalogNumber?.toLowerCase().includes(query) ||
                            inv.user?.name?.toLowerCase().includes(query) ||
                            inv.user?.email?.toLowerCase().includes(query);
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
                            setRestockForm({ addQty: "", lotNumber: "", expiryDate: "" });
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
                        {format(new Date(usageStats?.dateRange?.start || new Date()), "yyyy.MM.dd", { locale: ko })} ~{" "}
                        {format(new Date(usageStats?.dateRange?.end || new Date()), "yyyy.MM.dd", { locale: ko })}
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
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    재고 카드에서 "사용 기록" 버튼을 눌러 사용량을 기록하세요.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm md:text-base">사용 이력</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    최근 100건의 사용 기록을 표시합니다.
                  </CardDescription>
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
                            <TableCell className="text-xs md:text-sm">
                              {format(new Date(record.usageDate), "yyyy.MM.dd HH:mm", { locale: ko })}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm">
                              <div>
                                <div className="font-medium">{record.inventory.product.name}</div>
                                {record.inventory.product.brand && (
                                  <div className="text-[10px] md:text-xs text-muted-foreground">
                                    {record.inventory.product.brand}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs md:text-sm font-medium">
                              {record.quantity} {record.unit || "개"}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm">
                              {record.user.name || record.user.email}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm text-muted-foreground max-w-[200px] truncate">
                              {record.notes || "-"}
                            </TableCell>
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
                <CardDescription className="text-xs md:text-sm">
                  안전 재고 이하로 떨어질 때 알림을 받을 제품을 선택하세요.
                </CardDescription>
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
                        <div
                          key={inventory.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs md:text-sm">{inventory.product.name}</div>
                            <div className="text-[10px] md:text-xs text-muted-foreground mt-1">
                              현재: {inventory.currentQuantity} {inventory.unit}
                              {hasSafetyStock && inventory.safetyStock !== null && (
                                <> · 안전 재고: {inventory.safetyStock} {inventory.unit}</>
                              )}
                            </div>
                            {isLowStock && (
                              <Badge variant="outline" dot="amber" className="mt-1 bg-amber-950/30 text-amber-400 border-amber-800 text-[11px]">
                                재고 부족
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {!hasSafetyStock && (
                              <span className="text-[10px] md:text-xs text-muted-foreground">
                                안전 재고 설정 필요
                              </span>
                            )}
                            {hasSafetyStock && (
                              <Badge
                                variant="outline"
                                dot={isLowStock ? "red" : "emerald"}
                                dotPulse={isLowStock}
                                className={isLowStock ? "bg-red-950/30 text-red-400 border-red-800 text-[11px]" : "bg-emerald-900/20 text-emerald-400 border-emerald-800 text-[11px]"}
                              >
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
                <CardDescription className="text-xs md:text-sm">
                  최근 재고 부족 알림 내역을 확인할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 md:h-12 md:w-12 mx-auto text-muted-foreground mb-3 md:mb-4" />
                  <p className="text-xs md:text-sm text-muted-foreground">
                    알림 이력 기능은 곧 제공될 예정입니다.
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-2">
                    재고가 안전 재고 이하로 떨어지면 자동으로 알림이 기록됩니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        )}

      {/* 모바일 하단 고정 액션 — 재고 등록 & 차감 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-sh/95 backdrop-blur-sm border-t border-bd/50 px-4 py-2.5 safe-area-bottom">
        <div className="flex items-center gap-2 max-w-7xl mx-auto">
          <Button variant="outline" size="sm" className="flex-1 h-11 text-xs gap-1.5 border-blue-800 text-blue-400  text-blue-400 hover:bg-blue-950/20" onClick={() => setIsDialogOpen(true)}>
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
          <motion.div
            key="inventory-toast"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 shadow-2xl"
            style={{ backgroundColor: "#1a1f2e" }}
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium text-slate-900">재고가 등록되었습니다.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 재고 운영 AI 보조 패널 */}
      <InventoryAiAssistantPanel
        open={aiPanel.isOpen}
        onOpenChange={aiPanel.setIsOpen}
        state={aiPanel.panelState}
        data={aiPanel.panelData}
        onRetry={aiPanel.retry}
        onReviewReorder={(r) => {
          toast({
            title: "재발주안 검토",
            description: `${r.productName} ${r.recommendedQty}ea 재발주를 검토합니다.`,
          });
        }}
        onViewVendors={(productName) => {
          router.push(`/compare?search=${encodeURIComponent(productName)}`);
          aiPanel.setIsOpen(false);
        }}
        onViewLotDetail={(lotNumber) => {
          toast({
            title: "Lot 상세",
            description: `Lot #${lotNumber} 상세 정보를 확인합니다.`,
          });
        }}
        onReviewDisposal={(lotNumber) => {
          toast({
            title: "폐기/우선사용 검토",
            description: `Lot #${lotNumber}에 대한 조치를 검토합니다.`,
          });
        }}
        onViewActions={() => {
          router.push("/dashboard/inventory?filter=low");
          aiPanel.setIsOpen(false);
        }}
        isAnalyzing={aiPanel.isAnalyzing}
      />

      {/* ── LOT Disposal Panel (object-scoped disposal dock) ── */}
      <LotDisposalPanel
        open={disposalPanelOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDisposalTarget(null);
            setDisposalInventoryId(null);
          }
        }}
        target={disposalTarget}
        isSubmitting={disposeLotMutation.isPending}
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
          const matchingItem = displayInventories.find(
            (inv) => inv.product.name === productName
          );
          if (matchingItem) {
            openReorderReview(matchingItem);
          }
        }}
      />
    </div>
  );
}

function InventoryCard({
  inventory,
  onEdit,
  onRecordUsage,
  onRestockRequest,
  onPrintLabel,
  isRestockRequested = false,
  isRequestingRestock = false,
  isRecommended = false,
}: {
  inventory: ProductInventory;
  onEdit: () => void;
  onRecordUsage: (quantity: number, notes?: string) => void;
  onRestockRequest?: () => void;
  onPrintLabel?: () => void;
  isRestockRequested?: boolean;
  isRequestingRestock?: boolean;
  isRecommended?: boolean;
}) {
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [usageQuantity, setUsageQuantity] = useState("");
  const [usageNotes, setUsageNotes] = useState("");

  const isLowStock =
    inventory.safetyStock !== null && inventory.currentQuantity <= inventory.safetyStock;
  const isOutOfStock = inventory.currentQuantity <= 0;
  const hasRestockRequest = isRestockRequested;

  const handleRecordUsage = () => {
    const qty = parseFloat(usageQuantity);
    if (qty > 0 && qty <= inventory.currentQuantity) {
      onRecordUsage(qty, usageNotes || undefined);
      setShowUsageDialog(false);
      setUsageQuantity("");
      setUsageNotes("");
    }
  };

  return (
    <motion.div
      whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.03)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-xl"
    >
    <Card className={
      hasRestockRequest
        ? "border-red-500 bg-red-950/10 ring-2 ring-red-200"
        : isRecommended
        ? "border-blue-300 bg-blue-950/20 ring-1 ring-blue-200"
        : isOutOfStock
        ? "border-red-300 bg-red-950/30"
        : isLowStock
        ? "border-orange-300 bg-orange-50"
        : ""
    }>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{inventory.product.name}</CardTitle>
              {isRecommended && (
                <Badge variant="outline" dot="blue" className="bg-blue-950/20 text-blue-400 border-blue-800 text-[11px]">
                  재구매 추천
                </Badge>
              )}
            </div>
            {inventory.product.brand && (
              <CardDescription>{inventory.product.brand}</CardDescription>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {hasRestockRequest && (
              <Badge variant="outline" dot="red" dotPulse className="bg-red-950/30 text-red-400 border-red-800 text-[11px]">
                <Check className="h-3 w-3 mr-1" />
                요청됨
              </Badge>
            )}
            {isOutOfStock && !hasRestockRequest && (
              <Badge variant="outline" dot="red" dotPulse className="bg-red-950/30 text-red-400 border-red-800">
                품절
              </Badge>
            )}
            {isLowStock && !isOutOfStock && !hasRestockRequest && (
              <Badge variant="outline" dot="amber" className="bg-amber-950/30 text-amber-400 border-amber-800">
                재고 부족
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 재입고 요청 버튼 - 가장 눈에 띄게 */}
        {onRestockRequest && (
          <Button
            size="lg"
            variant={hasRestockRequest ? "secondary" : "default"}
            onClick={onRestockRequest}
            disabled={hasRestockRequest || isRequestingRestock}
            className={`w-full ${
              hasRestockRequest
                ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
            }`}
          >
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
        )}

        {/* 재고 수명 게이지 */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">재고 수명</div>
          <StockLifespanGauge
            inventoryId={inventory.id}
            currentQuantity={inventory.currentQuantity}
            safetyStock={inventory.safetyStock}
            unit={inventory.unit}
            onReorder={onRestockRequest}
          />
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
            <span className="text-muted-foreground">유통기한:</span>{" "}
            {new Date(inventory.expiryDate).toLocaleDateString()}
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
                <DialogDescription>
                  제품 사용량을 기록하면 재고가 자동으로 감소합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>사용량 ({inventory.unit})</Label>
                  <Input
                    type="number"
                    min="0"
                    max={inventory.currentQuantity}
                    value={usageQuantity}
                    onChange={(e) => setUsageQuantity(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>비고 (선택)</Label>
                  <Textarea
                    value={usageNotes}
                    onChange={(e) => setUsageNotes(e.target.value)}
                    placeholder="예: 실험 A에 사용"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowUsageDialog(false)}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleRecordUsage}
                    disabled={!usageQuantity || parseFloat(usageQuantity) <= 0}
                    className="flex-1"
                  >
                    기록
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-400 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="gap-2 text-xs" onClick={onEdit}>
                <Edit className="h-3.5 w-3.5 text-slate-500" />
                정보 수정
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => {
                setShowUsageDialog(false);
              }}>
                <Eye className="h-3.5 w-3.5 text-blue-500" />
                상세 보기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
}

function InventoryForm({
  inventory,
  onSubmit,
  onCancel,
}: {
  inventory?: ProductInventory | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState(inventory?.productId || "");
  const [currentQuantity, setCurrentQuantity] = useState(
    inventory?.currentQuantity.toString() || "0"
  );
  const [unit, setUnit] = useState(inventory?.unit || "개");
  const [safetyStock, setSafetyStock] = useState(
    inventory?.safetyStock?.toString() || ""
  );
  const [minOrderQty, setMinOrderQty] = useState(
    inventory?.minOrderQty?.toString() || ""
  );
  const [location, setLocation] = useState(inventory?.location || "");
  const [expiryDate, setExpiryDate] = useState(
    inventory?.expiryDate ? new Date(inventory.expiryDate).toISOString().split("T")[0] : ""
  );
  const [autoReorderEnabled, setAutoReorderEnabled] = useState(
    inventory?.autoReorderEnabled || false
  );
  const [autoReorderThreshold, setAutoReorderThreshold] = useState(
    inventory?.autoReorderThreshold?.toString() || inventory?.safetyStock?.toString() || ""
  );
  const [notes, setNotes] = useState(inventory?.notes || "");

  // 제품 검색 (간단한 구현, 실제로는 제품 검색 API 필요)
  const { data: productsData } = useQuery({
    queryKey: ["products", "search"],
    queryFn: async () => {
      const response = await fetch("/api/products?limit=100");
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
          <Input
            id="currentQuantity"
            type="number"
            min="0"
            value={currentQuantity}
            onChange={(e) => setCurrentQuantity(e.target.value)}
            required
          />
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
          <Input
            id="safetyStock"
            type="number"
            min="0"
            value={safetyStock}
            onChange={(e) => setSafetyStock(e.target.value)}
            placeholder="이 수량 이하로 떨어지면 재주문 추천"
          />
        </div>
        <div>
          <Label htmlFor="minOrderQty">최소 주문 수량 (선택)</Label>
          <Input
            id="minOrderQty"
            type="number"
            min="0"
            value={minOrderQty}
            onChange={(e) => setMinOrderQty(e.target.value)}
            placeholder="최소 주문 수량"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="location">보관 위치 (선택)</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="예: 냉장고 A-1, 선반 3층"
        />
      </div>

      <div>
        <Label htmlFor="expiryDate">유통기한 (선택)</Label>
        <Input
          id="expiryDate"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
        />
      </div>

      <div className="space-y-3 p-4 border rounded-lg bg-pg">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="autoReorderEnabled">자동 재주문</Label>
            <p className="text-xs text-muted-foreground mt-1">
              재고가 임계값 이하로 떨어지면 자동으로 재주문 리스트를 생성합니다.
            </p>
          </div>
          <input
            id="autoReorderEnabled"
            type="checkbox"
            checked={autoReorderEnabled}
            onChange={(e) => setAutoReorderEnabled(e.target.checked)}
            className="h-4 w-4"
          />
        </div>
        {autoReorderEnabled && (
          <div>
            <Label htmlFor="autoReorderThreshold">자동 재주문 임계값 (선택)</Label>
            <Input
              id="autoReorderThreshold"
              type="number"
              min="0"
              value={autoReorderThreshold}
              onChange={(e) => setAutoReorderThreshold(e.target.value)}
              placeholder={safetyStock || "안전 재고와 동일"}
            />
            <p className="text-xs text-muted-foreground mt-1">
              이 수량 이하로 떨어지면 자동 재주문이 실행됩니다. 비워두면 안전 재고를 사용합니다.
            </p>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="notes">비고 (선택)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="추가 메모"
          rows={3}
        />
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
function TeamInventoryCard({
  inventory,
  onLocationClick,
  onQuantityUpdate,
  onReorder,
  isReordering = false,
  isAddedToCart = false,
}: {
  inventory: any;
  onLocationClick: (inventory: any) => void;
  onQuantityUpdate: (quantity: number) => void;
  onReorder: (inventory: any) => void;
  isReordering?: boolean;
  isAddedToCart?: boolean;
}) {
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
    <Card
      className={`transition-all duration-200 hover:shadow-md ${
        isOutOfStock
          ? "border-red-300 bg-red-950/10 opacity-75"
          : isLocationMissing
          ? "border-amber-300 bg-amber-950/10 ring-2 ring-amber-200"
          : isLowStock
          ? "border-orange-800 bg-orange-50/30"
          : "border-bd bg-pn"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold line-clamp-2">
              {inventory.productName}
            </CardTitle>
            {(inventory.brand || inventory.catalogNumber) && (
              <CardDescription className="text-xs mt-1">
                {inventory.brand && <span>{inventory.brand}</span>}
                {inventory.brand && inventory.catalogNumber && <span> · </span>}
                {inventory.catalogNumber && (
                  <span className="font-mono">{inventory.catalogNumber}</span>
                )}
              </CardDescription>
            )}
            {/* 소유자 정보 */}
            {inventory.user && (
              <div className="flex items-center gap-2 mt-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={inventory.user.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {inventory.user.name?.[0] || inventory.user.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">
                  {inventory.user.name || inventory.user.email}
                </span>
              </div>
            )}
          </div>
          {isOutOfStock && (
            <Badge variant="outline" dot="red" dotPulse className="flex-shrink-0 bg-red-950/30 text-red-400 border-red-800">
              품절
            </Badge>
          )}
          {isLowStock && !isOutOfStock && (
            <Badge variant="outline" dot="amber" className="flex-shrink-0 bg-amber-950/30 text-amber-400 border-amber-800">
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
              <span className="text-lg font-bold">
                {inventory.quantity || 0}
              </span>
              <span className="text-sm text-muted-foreground">
                {inventory.unit || "ea"}
              </span>
            </div>
          </div>
        </div>

        {/* 위치 정보 */}
        <div
          className={`flex items-center gap-2 text-sm p-2 rounded transition-colors -mx-2 ${
            isLocationMissing
              ? "bg-amber-100 border border-amber-300"
              : "hover:bg-el"
          }`}
        >
          <MapPin
            className={`h-4 w-4 flex-shrink-0 ${
              isLocationMissing ? "text-amber-600" : "text-muted-foreground"
            }`}
          />
          <span
            className={`flex-1 ${
              isLocationMissing
                ? "text-amber-400 font-semibold"
                : "text-slate-600"
            }`}
          >
            {inventory.location || "미지정"}
          </span>
          {isLocationMissing && (
            <Badge variant="outline" dot="amber" className="bg-amber-950/30 text-amber-400 border-amber-800 text-[11px]">
              설정 필요
            </Badge>
          )}
        </div>

        {/* 입고일 */}
        {inventory.receivedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>입고: {format(new Date(inventory.receivedAt), "yyyy.MM.dd", { locale: ko })}</span>
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
