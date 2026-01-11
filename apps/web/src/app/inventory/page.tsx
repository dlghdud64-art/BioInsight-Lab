"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Package,
  MapPin,
  AlertCircle,
  ShoppingCart,
  CheckCircle2,
  ArrowRight,
  Box,
  Calendar,
  Loader2,
  Search,
} from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserInventory {
  id: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  location: string;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  notes: string | null;
  receivedAt: string;
  orderId: string | null;
  userId?: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<UserInventory | null>(null);
  const [newLocation, setNewLocation] = useState("");
  const [reorderingInventoryIds, setReorderingInventoryIds] = useState<Set<string>>(new Set());
  const [addedToCartIds, setAddedToCartIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"my" | "team">("my");

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

  // 팀 인벤토리 조회 (첫 번째 팀 기준)
  const selectedTeam = teamsData?.teams?.[0];
  const { data: teamInventoryData } = useQuery<{ inventories: UserInventory[] }>({
    queryKey: ["team-inventory", selectedTeam?.id],
    queryFn: async () => {
      if (!selectedTeam?.id) return { inventories: [] };
      
      const response = await fetch(`/api/team/${selectedTeam.id}/inventory`);
      if (!response.ok) throw new Error("Failed to fetch team inventory");
      return response.json();
    },
    enabled: status === "authenticated" && !!selectedTeam?.id && activeTab === "team",
  });

  const teamInventories = teamInventoryData?.inventories || [];

  // 전체 인벤토리 조회
  const { data: allData, isLoading: isLoadingAll } = useQuery<{ inventories: UserInventory[] }>({
    queryKey: ["user-inventories"],
    queryFn: async () => {
      const response = await fetch("/api/user-inventory");
      if (!response.ok) throw new Error("Failed to fetch inventories");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 위치 미지정 항목 조회
  const { data: missingLocationData, isLoading: isLoadingMissing } = useQuery<{
    inventories: UserInventory[];
  }>({
    queryKey: ["user-inventories", "missing-location"],
    queryFn: async () => {
      const response = await fetch("/api/user-inventory?locationMissing=true");
      if (!response.ok) throw new Error("Failed to fetch inventories");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const allInventories = allData?.inventories || [];
  const missingLocationItems = missingLocationData?.inventories || [];
  const assignedItems = allInventories.filter((item) => item.location !== "미지정");

  // 위치 업데이트 mutation
  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, location }: { id: string; location: string }) => {
      const response = await fetch("/api/user-inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, location }),
      });
      if (!response.ok) throw new Error("Failed to update location");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-inventories"] });
      setLocationDialogOpen(false);
      setSelectedInventory(null);
      setNewLocation("");
    },
  });

  // 수량 업데이트 mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const response = await fetch("/api/user-inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, quantity }),
      });
      if (!response.ok) throw new Error("Failed to update quantity");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-inventories"] });
    },
  });

  const handleLocationClick = (inventory: UserInventory) => {
    setSelectedInventory(inventory);
    setNewLocation(inventory.location === "미지정" ? "" : inventory.location);
    setLocationDialogOpen(true);
  };

  const handleLocationSave = () => {
    if (!selectedInventory || !newLocation.trim()) return;
    updateLocationMutation.mutate({
      id: selectedInventory.id,
      location: newLocation.trim(),
    });
  };

  // 재주문 mutation
  const reorderMutation = useMutation({
    mutationFn: async (inventory: UserInventory) => {
      // 1. 제품 검색
      const searchResponse = await fetch(
        `/api/products/search?q=${encodeURIComponent(inventory.productName)}&limit=1`
      );
      if (!searchResponse.ok) throw new Error("제품 검색 실패");
      const searchData = await searchResponse.json();
      
      if (!searchData.products || searchData.products.length === 0) {
        throw new Error("제품을 찾을 수 없습니다");
      }

      const product = searchData.products[0];
      const vendor = product.vendors?.[0];
      
      if (!vendor) {
        throw new Error("제품의 벤더 정보를 찾을 수 없습니다");
      }

      // 2. 견적에 추가
      const quoteResponse = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `재주문: ${inventory.productName}`,
          items: [
            {
              productId: product.id,
              vendorId: vendor.vendorId,
              quantity: 1,
              notes: `인벤토리에서 자동 재주문 (${inventory.catalogNumber || inventory.productName})`,
            },
          ],
        }),
      });

      if (!quoteResponse.ok) {
        const errorData = await quoteResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "견적 추가 실패");
      }

      const quoteData = await quoteResponse.json();
      return { quote: quoteData.quote || quoteData, product, inventory };
    },
    onMutate: (inventory) => {
      setReorderingInventoryIds((prev) => new Set(prev).add(inventory.id));
    },
    onSuccess: (data, inventory) => {
      setReorderingInventoryIds((prev) => {
        const next = new Set(prev);
        next.delete(inventory.id);
        return next;
      });
      setAddedToCartIds((prev) => new Set(prev).add(inventory.id));
      
      toast({
        title: "장바구니에 담겼습니다",
        description: `${inventory.productName}이(가) 견적 요청서에 추가되었습니다.`,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/quotes")}
            className="h-7 text-xs"
          >
            바로가기
          </Button>
        ),
      });
    },
    onError: (error: Error, inventory) => {
      setReorderingInventoryIds((prev) => {
        const next = new Set(prev);
        next.delete(inventory.id);
        return next;
      });
      
      toast({
        title: "재주문 실패",
        description: error.message || "재주문 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleReorder = (inventory: UserInventory) => {
    if (addedToCartIds.has(inventory.id)) {
      // 이미 장바구니에 담긴 경우 견적 페이지로 이동
      router.push("/quotes");
      return;
    }
    reorderMutation.mutate(inventory);
  };

  const handleSearchAlternative = (inventory: UserInventory) => {
    // 제품명을 쿼리 파라미터로 전달하여 검색 페이지로 이동
    const searchQuery = encodeURIComponent(inventory.productName);
    router.push(`/test/search?q=${searchQuery}&from=inventory&inventoryId=${inventory.id}`);
  };

  if (status === "loading" || isLoadingAll) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-4 py-8">
              <div className="text-center py-12">
                <p className="text-muted-foreground">로딩 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-4 py-6 md:py-8">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* 페이지 헤더 */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">자산 관리</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    배송받은 물건을 정리하고 재주문하세요
                  </p>
                </div>
              </div>

              {/* Hero Section: 위치 미지정 경고 카드 */}
              {missingLocationItems.length > 0 && (
                <Alert className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <AlertTitle className="text-base font-semibold text-amber-900">
                    위치 미지정 항목이 {missingLocationItems.length}개 있습니다
                  </AlertTitle>
                  <AlertDescription className="text-sm text-amber-800 mt-2">
                    <div className="space-y-2">
                      <p>배송받은 물건의 보관 위치를 설정해주세요. 클릭 한 번으로 빠르게 정리할 수 있습니다.</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {missingLocationItems.slice(0, 3).map((item) => (
                          <Badge
                            key={item.id}
                            variant="outline"
                            className="bg-white border-amber-300 text-amber-900 px-3 py-1"
                          >
                            {item.productName}
                          </Badge>
                        ))}
                        {missingLocationItems.length > 3 && (
                          <Badge
                            variant="outline"
                            className="bg-white border-amber-300 text-amber-900 px-3 py-1"
                          >
                            +{missingLocationItems.length - 3}개 더
                          </Badge>
                        )}
                      </div>
                      <Button
                        onClick={() => {
                          if (missingLocationItems[0]) {
                            handleLocationClick(missingLocationItems[0]);
                          }
                        }}
                        className="mt-3 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                        size="sm"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        정리하기
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* 탭: 내 자산 vs 팀 자산 */}
              {selectedTeam ? (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my" | "team")}>
                  <TabsList>
                    <TabsTrigger value="my">내 자산</TabsTrigger>
                    <TabsTrigger value="team">우리 랩 전체 자산</TabsTrigger>
                  </TabsList>

                  <TabsContent value="my" className="mt-4">
                    {/* 내 자산 목록 */}
                    {allInventories.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground mb-2">등록된 자산이 없습니다.</p>
                          <p className="text-sm text-muted-foreground">
                            주문이 배송 완료되면 자동으로 여기에 표시됩니다.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {allInventories.map((inventory) => (
                          <InventoryCard
                            key={inventory.id}
                            inventory={inventory}
                            onLocationClick={handleLocationClick}
                            onQuantityUpdate={(quantity) =>
                              updateQuantityMutation.mutate({ id: inventory.id, quantity })
                            }
                            onReorder={handleReorder}
                            onSearchAlternative={handleSearchAlternative}
                            isReordering={reorderingInventoryIds.has(inventory.id)}
                            isAddedToCart={addedToCartIds.has(inventory.id)}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="team" className="mt-4">
                    {/* 팀 인벤토리 뷰 */}
                    {teamInventories.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {teamInventories.map((inventory) => (
                          <TeamInventoryCard
                            key={inventory.id}
                            inventory={inventory}
                            onLocationClick={handleLocationClick}
                            onQuantityUpdate={(quantity) =>
                              updateQuantityMutation.mutate({ id: inventory.id, quantity })
                            }
                            onReorder={handleReorder}
                            onSearchAlternative={handleSearchAlternative}
                            isReordering={reorderingInventoryIds.has(inventory.id)}
                            isAddedToCart={addedToCartIds.has(inventory.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground mb-2">팀 자산이 없습니다.</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              ) : allInventories.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">등록된 자산이 없습니다.</p>
                    <p className="text-sm text-muted-foreground">
                      주문이 배송 완료되면 자동으로 여기에 표시됩니다.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allInventories.map((inventory) => (
                    <InventoryCard
                      key={inventory.id}
                      inventory={inventory}
                      onLocationClick={handleLocationClick}
                      onQuantityUpdate={(quantity) =>
                        updateQuantityMutation.mutate({ id: inventory.id, quantity })
                      }
                      onReorder={handleReorder}
                      onSearchAlternative={handleSearchAlternative}
                      isReordering={reorderingInventoryIds.has(inventory.id)}
                      isAddedToCart={addedToCartIds.has(inventory.id)}
                    />
                  ))}
                </div>
              )}

              {/* 위치 설정 모달 */}
              <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>보관 위치 설정</DialogTitle>
                    <DialogDescription>
                      {selectedInventory?.productName}의 보관 위치를 입력하세요.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">위치</Label>
                      <Input
                        id="location"
                        placeholder="예: 냉장고 A-1, 선반 3층, 실험실 B-2"
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newLocation.trim()) {
                            handleLocationSave();
                          }
                        }}
                        autoFocus
                      />
                      <p className="text-xs text-muted-foreground">
                        자주 사용하는 위치를 입력하면 다음에 빠르게 선택할 수 있습니다.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setLocationDialogOpen(false)}
                        className="flex-1"
                      >
                        취소
                      </Button>
                      <Button
                        onClick={handleLocationSave}
                        disabled={!newLocation.trim() || updateLocationMutation.isPending}
                        className="flex-1"
                      >
                        {updateLocationMutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 인벤토리 카드 컴포넌트
function InventoryCard({
  inventory,
  onLocationClick,
  onQuantityUpdate,
  onReorder,
  onSearchAlternative,
  isReordering = false,
  isAddedToCart = false,
}: {
  inventory: UserInventory;
  onLocationClick: (inventory: UserInventory) => void;
  onQuantityUpdate: (quantity: number) => void;
  onReorder: (inventory: UserInventory) => void;
  onSearchAlternative: (inventory: UserInventory) => void;
  isReordering?: boolean;
  isAddedToCart?: boolean;
}) {
  const [quantity, setQuantity] = useState(inventory.quantity.toString());
  const isOutOfStock = inventory.quantity === 0;
  const isLowStock = inventory.status === "LOW_STOCK";

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      onQuantityUpdate(numValue);
    }
  };

  const isLocationMissing = inventory.location === "미지정";

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
                {inventory.catalogNumber && <span className="font-mono">{inventory.catalogNumber}</span>}
              </CardDescription>
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
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className={`text-lg font-bold bg-transparent border-none p-0 w-16 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
                  isOutOfStock ? "text-red-600" : "text-gray-900"
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {inventory.unit || "ea"}
              </span>
            </div>
          </div>
        </div>

        {/* 위치 정보 */}
        <div
          className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded transition-colors -mx-2 ${
            isLocationMissing
              ? "bg-amber-100 hover:bg-amber-200 border border-amber-300"
              : "hover:bg-gray-50"
          }`}
          onClick={() => onLocationClick(inventory)}
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
            {inventory.location}
          </span>
          {isLocationMissing && (
            <Badge variant="outline" className="bg-amber-200 border-amber-400 text-amber-900 text-xs">
              설정 필요
            </Badge>
          )}
          <ArrowRight
            className={`h-4 w-4 flex-shrink-0 ${
              isLocationMissing ? "text-amber-600" : "text-muted-foreground"
            }`}
          />
        </div>

        {/* 입고일 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>입고: {format(new Date(inventory.receivedAt), "yyyy.MM.dd", { locale: ko })}</span>
        </div>

        {/* 액션 버튼 */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          {isOutOfStock ? (
            <>
              <Button
                onClick={() => onReorder(inventory)}
                disabled={isReordering || isAddedToCart}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold ring-2 ring-blue-400 ring-offset-2 disabled:opacity-75"
                size="sm"
              >
                {isReordering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    처리 중...
                  </>
                ) : isAddedToCart ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    장바구니 담김
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    재주문하기
                  </>
                )}
              </Button>
              <Button
                onClick={() => onSearchAlternative(inventory)}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Search className="h-4 w-4 mr-2" />
                대체 제품 검색
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button
                variant={isLocationMissing ? "default" : "outline"}
                onClick={() => onLocationClick(inventory)}
                className={`flex-1 ${
                  isLocationMissing
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : ""
                }`}
                size="sm"
              >
                <MapPin className="h-4 w-4 mr-1" />
                {isLocationMissing ? "위치 설정" : "위치"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onReorder(inventory)}
                disabled={isReordering || isAddedToCart}
                className="flex-1 disabled:opacity-75"
                size="sm"
              >
                {isReordering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    처리 중
                  </>
                ) : isAddedToCart ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    담김
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    주문
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 팀 인벤토리 카드 컴포넌트 (소유자 정보 표시)
function TeamInventoryCard({
  inventory,
  onLocationClick,
  onQuantityUpdate,
  onReorder,
  onSearchAlternative,
  isReordering = false,
  isAddedToCart = false,
}: {
  inventory: UserInventory;
  onLocationClick: (inventory: UserInventory) => void;
  onQuantityUpdate: (quantity: number) => void;
  onReorder: (inventory: UserInventory) => void;
  onSearchAlternative: (inventory: UserInventory) => void;
  isReordering?: boolean;
  isAddedToCart?: boolean;
}) {
  const [quantity, setQuantity] = useState(inventory.quantity.toString());
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
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className={`text-lg font-bold bg-transparent border-none p-0 w-16 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
                  isOutOfStock ? "text-red-600" : "text-gray-900"
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {inventory.unit || "ea"}
              </span>
            </div>
          </div>
        </div>

        {/* 위치 정보 */}
        <div
          className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded transition-colors -mx-2 ${
            isLocationMissing
              ? "bg-amber-100 hover:bg-amber-200 border border-amber-300"
              : "hover:bg-gray-50"
          }`}
          onClick={() => onLocationClick(inventory)}
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
            {inventory.location}
          </span>
          {isLocationMissing && (
            <Badge variant="outline" className="bg-amber-200 border-amber-400 text-amber-900 text-xs">
              설정 필요
            </Badge>
          )}
          <ArrowRight
            className={`h-4 w-4 flex-shrink-0 ${
              isLocationMissing ? "text-amber-600" : "text-muted-foreground"
            }`}
          />
        </div>

        {/* 입고일 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>입고: {format(new Date(inventory.receivedAt), "yyyy.MM.dd", { locale: ko })}</span>
        </div>

        {/* 액션 버튼 */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          {isOutOfStock ? (
            <>
              <Button
                onClick={() => onReorder(inventory)}
                disabled={isReordering || isAddedToCart}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold ring-2 ring-blue-400 ring-offset-2 disabled:opacity-75"
                size="sm"
              >
                {isReordering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    처리 중...
                  </>
                ) : isAddedToCart ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    장바구니 담김
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    재주문하기
                  </>
                )}
              </Button>
              <Button
                onClick={() => onSearchAlternative(inventory)}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Search className="h-4 w-4 mr-2" />
                대체 제품 검색
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button
                variant={isLocationMissing ? "default" : "outline"}
                onClick={() => onLocationClick(inventory)}
                className={`flex-1 ${
                  isLocationMissing
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : ""
                }`}
                size="sm"
              >
                <MapPin className="h-4 w-4 mr-1" />
                {isLocationMissing ? "위치 설정" : "위치"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onReorder(inventory)}
                disabled={isReordering || isAddedToCart}
                className="flex-1 disabled:opacity-75"
                size="sm"
              >
                {isReordering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    처리 중
                  </>
                ) : isAddedToCart ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    담김
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    주문
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

