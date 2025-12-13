"use client";

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
import { Plus, Package, AlertTriangle, Edit, Trash2, TrendingDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<ProductInventory | null>(null);

  const { data, isLoading } = useQuery<{ inventories: ProductInventory[] }>({
    queryKey: ["inventories"],
    queryFn: async () => {
      const response = await fetch("/api/inventory");
      if (!response.ok) throw new Error("Failed to fetch inventories");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const inventories = data?.inventories || [];
  const lowStockItems = inventories.filter(
    (inv) => inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock
  );

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: {
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
    },
  });

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard/inventory");
  //   return null;
  // }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">재고 관리</h1>
            <p className="text-muted-foreground mt-1">
              제품 재고를 관리하고 재주문 시점을 추적합니다.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                재고 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingInventory ? "재고 수정" : "재고 추가"}
                </DialogTitle>
                <DialogDescription>
                  제품의 현재 재고량과 안전 재고를 설정합니다.
                </DialogDescription>
              </DialogHeader>
              <InventoryForm
                inventory={editingInventory}
                onSubmit={(data) => {
                  createOrUpdateMutation.mutate({
                    ...data,
                    id: editingInventory?.id,
                  });
                }}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingInventory(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {lowStockItems.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>재고 부족 알림</AlertTitle>
            <AlertDescription>
              안전 재고 이하인 제품이 {lowStockItems.length}개 있습니다.{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-semibold"
                onClick={() => router.push("/dashboard")}
              >
                재주문 추천 보기
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">재고 목록을 불러오는 중...</p>
            </CardContent>
          </Card>
        ) : inventories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">등록된 재고가 없습니다.</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                첫 재고 추가하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inventories.map((inventory) => (
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
              />
            ))}
          </div>
        )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryCard({
  inventory,
  onEdit,
  onRecordUsage,
}: {
  inventory: ProductInventory;
  onEdit: () => void;
  onRecordUsage: (quantity: number, notes?: string) => void;
}) {
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [usageQuantity, setUsageQuantity] = useState("");
  const [usageNotes, setUsageNotes] = useState("");

  const isLowStock =
    inventory.safetyStock !== null && inventory.currentQuantity <= inventory.safetyStock;
  const isOutOfStock = inventory.currentQuantity <= 0;

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
    <Card className={isOutOfStock ? "border-red-300 bg-red-50" : isLowStock ? "border-orange-300 bg-orange-50" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{inventory.product.name}</CardTitle>
            {inventory.product.brand && (
              <CardDescription>{inventory.product.brand}</CardDescription>
            )}
          </div>
          {isOutOfStock && (
            <Badge variant="destructive">품절</Badge>
          )}
          {isLowStock && !isOutOfStock && (
            <Badge variant="outline" className="bg-orange-100 text-orange-800">
              재고 부족
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">현재 재고:</span>
            <div className="font-semibold text-lg">
              {inventory.currentQuantity} {inventory.unit}
            </div>
          </div>
          {inventory.safetyStock !== null && (
            <div>
              <span className="text-muted-foreground">안전 재고:</span>
              <div className="font-medium">
                {inventory.safetyStock} {inventory.unit}
              </div>
            </div>
          )}
        </div>

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