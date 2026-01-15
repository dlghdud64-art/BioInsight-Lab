"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, AlertTriangle, Edit, Trash2, TrendingDown, History, Calendar as CalendarIcon, Users, MapPin, Loader2, CheckCircle2, ShoppingCart, ArrowRight, Zap, Check, Upload, Download, Filter, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ImportWizard } from "@/components/inventory/import-wizard";
import { StockLifespanGauge } from "@/components/inventory/stock-lifespan-gauge";
import { useToast } from "@/hooks/use-toast";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { AddInventoryModal } from "@/components/inventory/AddInventoryModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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
  autoReorderEnabled?: boolean; // 타입 에러 수정: 누락된 속성 추가
  autoReorderThreshold?: number; // 타입 에러 수정: 누락된 속성 추가
  product: {
    id: string;
    name: string;
    brand: string | null;
    catalogNumber: string | null;
  };
}

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<ProductInventory | null>(null);
  const [inventoryView, setInventoryView] = useState<"my" | "team">("my");
  const [restockRequestedIds, setRestockRequestedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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
  const { data, isLoading } = useQuery<{ inventories: ProductInventory[] }>({
    queryKey: ["inventories"],
    queryFn: async () => {
      const response = await fetch("/api/inventory");
      if (!response.ok) throw new Error("Failed to fetch inventories");
      return response.json();
    },
    enabled: status === "authenticated" && inventoryView === "my",
  });

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

  const myInventories = data?.inventories || [];
  const teamInventories = teamInventoryData?.inventories || [];
  const inventories = inventoryView === "my" ? myInventories : teamInventories;
  const lowStockItems = inventories.filter(
    (inv) => inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock
  );

  // Mock 데이터 (데이터가 없을 때 사용)
  const mockInventories: ProductInventory[] = [
    {
      id: "mock-1",
      productId: "mock-product-1",
      currentQuantity: 5,
      unit: "개",
      safetyStock: 10,
      minOrderQty: 20,
      location: "냉장고 1칸",
      expiryDate: null,
      notes: null,
      product: { id: "mock-product-1", name: "Gibco FBS (500ml)", brand: "Thermo Fisher", catalogNumber: "16000-044" },
    },
    {
      id: "mock-2",
      productId: "mock-product-2",
      currentQuantity: 15,
      unit: "개",
      safetyStock: 20,
      minOrderQty: 50,
      location: "선반 3층",
      expiryDate: null,
      notes: null,
      product: { id: "mock-product-2", name: "Falcon 50ml Conical Tube", brand: "Corning", catalogNumber: "352070" },
    },
    {
      id: "mock-3",
      productId: "mock-product-3",
      currentQuantity: 2,
      unit: "box",
      safetyStock: 5,
      minOrderQty: 10,
      location: "냉장고 2칸",
      expiryDate: null,
      notes: null,
      product: { id: "mock-product-3", name: "Pipette Tips (1000μL)", brand: "Eppendorf", catalogNumber: "0030078447" },
    },
    {
      id: "mock-4",
      productId: "mock-product-4",
      currentQuantity: 0,
      unit: "개",
      safetyStock: 3,
      minOrderQty: 5,
      location: "선반 1층",
      expiryDate: null,
      notes: null,
      product: { id: "mock-product-4", name: "DMEM Medium (500ml)", brand: "Sigma-Aldrich", catalogNumber: "D5671" },
    },
    {
      id: "mock-5",
      productId: "mock-product-5",
      currentQuantity: 25,
      unit: "개",
      safetyStock: 10,
      minOrderQty: 20,
      location: "냉장고 3칸",
      expiryDate: null,
      notes: null,
      product: { id: "mock-product-5", name: "Trypsin-EDTA Solution", brand: "Gibco", catalogNumber: "25200-056" },
    },
  ];

  // 데이터가 없으면 Mock 데이터 사용
  const displayInventories = inventories.length > 0 ? inventories : mockInventories;
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
              const data = await response.json();
              statuses[inv.id] = data.hasRequest || false;
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
    onSuccess: (data, inventoryId) => {
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

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      productId: string;
      currentQuantity: number;
      unit: string;
      date?: string;
      minOrderQty?: number;
      location?: string;
      expiryDate?: string;
      autoReorderEnabled?: boolean;
      autoReorderThreshold?: number;
      notes?: string;
    }) => {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save inventory");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      queryClient.invalidateQueries({ queryKey: ["reorder-recommendations"] });
      setIsDialogOpen(false);
      setEditingInventory(null);
    },
  });

  const recordUsageMutation = useMutation({
    mutationFn: async (data: { inventoryId: string; quantity: number; unit?: string; notes?: string }) => {
      const response = await fetch("/api/inventory/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

  // 필터링된 인벤토리
  const filteredInventories = displayInventories.filter((inv) => {
    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        inv.product?.name?.toLowerCase().includes(query) ||
        inv.product?.brand?.toLowerCase().includes(query) ||
        inv.product?.catalogNumber?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // 위치 필터
    if (locationFilter !== "all") {
      if (locationFilter === "none" && inv.location) return false;
      if (locationFilter !== "none" && inv.location !== locationFilter) return false;
    }

    // 상태 필터
    if (statusFilter !== "all") {
      const isLow = inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock;
      const isOut = inv.currentQuantity === 0;
      if (statusFilter === "low" && !isLow && !isOut) return false;
      if (statusFilter === "normal" && (isLow || isOut)) return false;
    }

    return true;
  });

  // 고유 위치 목록 추출
  const uniqueLocations = Array.from(
    new Set(displayInventories.map((inv) => inv.location).filter(Boolean))
  ) as string[];

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

  return (
    <div className="w-full max-w-full px-4 md:px-6 py-6 md:py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 상단 컨트롤 바 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">재고 관리</h1>
          </div>
          <div className="flex gap-2">
            <AddInventoryModal
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) setEditingInventory(null);
              }}
              onSubmit={(data) => {
                createOrUpdateMutation.mutate({
                  ...data,
                  id: editingInventory?.id,
                });
              }}
              inventory={editingInventory}
            />
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              재고 등록
            </Button>
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  엑셀 업로드
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>인벤토리 일괄 등록</DialogTitle>
                  <DialogDescription>
                    엑셀 파일을 업로드하여 여러 제품의 재고를 한 번에 등록합니다.
                  </DialogDescription>
                </DialogHeader>
                <ImportWizard
                  onSuccess={() => {
                    setIsImportDialogOpen(false);
                    queryClient.invalidateQueries({ queryKey: ["inventories"] });
                    queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
                  }}
                />
              </DialogContent>
            </Dialog>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              내보내기
            </Button>
          </div>
        </div>

        {/* 필터 영역 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="품목명, 제조사, CAS No. 또는 카탈로그 번호로 검색하세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[140px]">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="상태별" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="low">부족</SelectItem>
              <SelectItem value="normal">정상</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
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

        {/* 메인 테이블 */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">재고 목록을 불러오는 중...</p>
            </CardContent>
          </Card>
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
                  toast({
                    title: "주문하기",
                    description: `${inventory.product.name} 주문 기능은 곧 제공될 예정입니다.`,
                  });
                }}
                emptyMessage="아직 등록된 재고가 없습니다. 첫 재고를 등록해보세요."
                emptyAction={() => setIsDialogOpen(true)}
              />
            </CardContent>
          </Card>
        )}

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
                          onLocationClick={() => {}}
                          onQuantityUpdate={() => {}}
                          onReorder={() => {}}
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
                    <div className="text-lg md:text-2xl font-bold">{usageStats?.totalUsage.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">기록 수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg md:text-2xl font-bold">{usageStats?.recordCount}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">제품 수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg md:text-2xl font-bold">{usageStats?.uniqueProducts}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">기간</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {usageStats?.dateRange?.start && usageStats?.dateRange?.end ? (
                      <div className="text-xs md:text-sm">
                        {format(new Date(usageStats?.dateRange?.start || ""), "yyyy.MM.dd", { locale: ko })} ~{" "}
                        {format(new Date(usageStats?.dateRange?.end || ""), "yyyy.MM.dd", { locale: ko })}
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
                              <Badge variant="destructive" className="mt-1 text-[9px] md:text-xs">
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
                                variant={isLowStock ? "destructive" : "secondary"}
                                className="text-[9px] md:text-xs"
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
      </div>
    </div>
  );
}

function InventoryCard({
  inventory,
  onEdit,
  onRecordUsage,
  onRestockRequest,
  isRestockRequested = false,
  isRequestingRestock = false,
  isRecommended = false,
}: {
  inventory: ProductInventory;
  onEdit: () => void;
  onRecordUsage: (quantity: number, notes?: string) => void;
  onRestockRequest?: () => void;
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
    <Card className={
      hasRestockRequest
        ? "border-red-500 bg-red-50/50 ring-2 ring-red-200"
        : isRecommended
        ? "border-blue-300 bg-blue-50/30 ring-1 ring-blue-200"
        : isOutOfStock
        ? "border-red-300 bg-red-50"
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
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
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
              <Badge variant="destructive" className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                요청됨
              </Badge>
            )}
            {isOutOfStock && !hasRestockRequest && (
              <Badge variant="destructive">품절</Badge>
            )}
            {isLowStock && !isOutOfStock && !hasRestockRequest && (
              <Badge variant="outline" className="bg-orange-100 text-orange-800">
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
          <Button size="sm" variant="outline" onClick={onEdit} className="flex-1">
            <Edit className="h-4 w-4 mr-1" />
            수정
          </Button>
          <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1">
                <TrendingDown className="h-4 w-4 mr-1" />
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
        </div>
      </CardContent>
    </Card>
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
  const [recordDate, setRecordDate] = useState<Date | undefined>(undefined);
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
    inventory?.autoReorderThreshold?.toString() || ""
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
      date: recordDate ? format(recordDate, "yyyy-MM-dd") : undefined,
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
          <Label htmlFor="recordDate">입고일 (선택)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="recordDate"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {recordDate ? format(recordDate, "yyyy-MM-dd", { locale: ko }) : "날짜 선택"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={recordDate}
                onSelect={setRecordDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
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

      <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
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
              placeholder="자동 재주문 임계값"
            />
            <p className="text-xs text-muted-foreground mt-1">
              이 수량 이하로 떨어지면 자동 재주문이 실행됩니다.
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
        <Button type="submit" onClick={handleSubmit} className="flex-1">
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
          ? "border-red-300 bg-red-50/50 opacity-75"
          : isLocationMissing
          ? "border-amber-300 bg-amber-50/50 ring-2 ring-amber-200"
          : isLowStock
          ? "border-orange-200 bg-orange-50/30"
          : "border-gray-200 bg-white"
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
            <Badge variant="destructive" className="flex-shrink-0">
              품절
            </Badge>
          )}
          {isLowStock && !isOutOfStock && (
            <Badge variant="outline" className="flex-shrink-0 bg-orange-100 text-orange-800 border-orange-300">
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
              : "hover:bg-gray-50"
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
                ? "text-amber-700 font-semibold"
                : "text-gray-700"
            }`}
          >
            {inventory.location || "미지정"}
          </span>
          {isLocationMissing && (
            <Badge variant="outline" className="bg-amber-200 border-amber-400 text-amber-900 text-xs">
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