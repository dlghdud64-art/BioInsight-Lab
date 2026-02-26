"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
}

interface AddInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    productId: string;
    currentQuantity: number;
    unit: string;
    safetyStock?: number;
    minOrderQty?: number;
    location?: string;
    expiryDate?: string;
    notes?: string;
    lotNumber?: string;
    storageCondition?: string;
    testPurpose?: string;
  }) => void;
  inventory?: any;
  /** 저장 중일 때 true. 버튼 비활성화 및 스피너 표시용 */
  isLoading?: boolean;
}

export function AddInventoryModal({ open, onOpenChange, onSubmit, inventory, isLoading = false }: AddInventoryModalProps) {
  const [step, setStep] = useState<"search" | "details">(inventory ? "details" : "search");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    inventory ? { id: inventory.productId, name: inventory.product.name, brand: inventory.product.brand, catalogNumber: inventory.product.catalogNumber } : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualProductName, setManualProductName] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualCatalogNumber, setManualCatalogNumber] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(inventory?.currentQuantity?.toString() || "0");
  const [unit, setUnit] = useState(inventory?.unit || "개");
  const [safetyStock, setSafetyStock] = useState(inventory?.safetyStock?.toString() || "");
  const [minOrderQty, setMinOrderQty] = useState(inventory?.minOrderQty?.toString() || "");
  const [location, setLocation] = useState(inventory?.location || "");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    inventory?.expiryDate ? new Date(inventory.expiryDate) : undefined
  );
  const [notes, setNotes] = useState(inventory?.notes || "");
  const [lotNumber, setLotNumber] = useState(inventory?.lotNumber ?? "");
  const [storageCondition, setStorageCondition] = useState(inventory?.storageCondition ?? "");
  const [testPurpose, setTestPurpose] = useState(inventory?.testPurpose ?? "");

  // 수정 모드: 모달 열릴 때 검색 단계 건너뛰고 폼 데이터 프리필
  useEffect(() => {
    if (open && inventory) {
      setStep("details");
      setSelectedProduct({
        id: inventory.productId,
        name: inventory.product?.name ?? "",
        brand: inventory.product?.brand ?? null,
        catalogNumber: inventory.product?.catalogNumber ?? null,
      });
      setCurrentQuantity(String(inventory.currentQuantity ?? 0));
      setUnit(inventory.unit || "개");
      setSafetyStock(inventory.safetyStock != null ? String(inventory.safetyStock) : "");
      setMinOrderQty(inventory.minOrderQty != null ? String(inventory.minOrderQty) : "");
      setLocation(inventory.location ?? "");
      setExpiryDate(inventory.expiryDate ? new Date(inventory.expiryDate) : undefined);
      setNotes(inventory.notes ?? "");
      setLotNumber(inventory.lotNumber ?? "");
      setStorageCondition(inventory.storageCondition ?? "");
      setTestPurpose(inventory.testPurpose ?? "");
    }
  }, [open, inventory]);

  // 제품 검색
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products", "search"],
    queryFn: async () => {
      const response = await fetch("/api/products?limit=100");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: open && step === "search",
  });

  const products = productsData?.products || [];
  
  const filteredProducts = products.filter((product: Product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.brand?.toLowerCase().includes(query) ||
      product.catalogNumber?.toLowerCase().includes(query)
    );
  });

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery("");
    setStep("details");
  };

  // 식별 정보 폼 값 (수정 시 inventory, 추가 시 선택된 제품 또는 수동 입력)
  const formProductName = inventory?.product?.name ?? selectedProduct?.name ?? "";
  const formBrand = inventory?.product?.brand ?? selectedProduct?.brand ?? "";
  const formCatNo = inventory?.product?.catalogNumber ?? selectedProduct?.catalogNumber ?? "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productId = inventory?.productId ?? selectedProduct?.id;
    if (!productId) return;

    const data = {
      productId,
      currentQuantity: parseFloat(currentQuantity) || 0,
      unit,
      safetyStock: safetyStock ? parseFloat(safetyStock) : undefined,
      minOrderQty: minOrderQty ? parseFloat(minOrderQty) : undefined,
      location: location || undefined,
      expiryDate: expiryDate ? expiryDate.toISOString().split("T")[0] : undefined,
      notes: notes || undefined,
      lotNumber: lotNumber.trim() || undefined,
      storageCondition: storageCondition || undefined,
      testPurpose: testPurpose.trim() || undefined,
    };
    console.log("저장 시도:", data);
    onSubmit(data);
  };

  const handleClose = () => {
    setStep(inventory ? "details" : "search");
    setSelectedProduct(inventory ? selectedProduct : null);
    setIsManualEntry(false);
    setManualProductName("");
    setManualBrand("");
    setManualCatalogNumber("");
    onOpenChange(false);
  };

  const handleManualEntryNext = () => {
    const name = manualProductName.trim();
    if (!name) return;
    setSelectedProduct({
      id: `manual-${Date.now()}`,
      name,
      brand: manualBrand.trim() || null,
      catalogNumber: manualCatalogNumber.trim() || null,
    });
    setStep("details");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {inventory ? "재고 수정" : "새 재고 등록"}
          </DialogTitle>
          <DialogDescription>
            {inventory
              ? "재고 정보를 수정해 주세요."
              : step === "search"
                ? "추가할 제품을 검색하고 선택하세요."
                : "새로운 시약이나 장비의 상세 정보를 입력해 주세요."}
          </DialogDescription>
        </DialogHeader>

        {/* 수정 모드: 검색 단계 건너뛰고 바로 상세 폼 표시 */}
        {(inventory || (step === "details" && selectedProduct)) ? (
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            {/* 1. 기본 식별 정보 */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b border-slate-200 dark:border-slate-700 pb-2">
                기본 식별 정보
              </h4>

              <div className="grid gap-2">
                <Label htmlFor="productName" className="font-semibold text-slate-700 dark:text-slate-300">
                  품목명 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="productName"
                  value={formProductName}
                  readOnly
                  className="border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50"
                  placeholder="예: Gibco FBS, 50ml Conical Tube"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="manufacturer">제조사 / 브랜드</Label>
                  <Input
                    id="manufacturer"
                    value={formBrand}
                    readOnly
                    className="bg-slate-50 dark:bg-slate-900/50"
                    placeholder="예: Thermo Fisher"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="catNo">Cat.No (카탈로그 번호)</Label>
                  <Input
                    id="catNo"
                    value={formCatNo}
                    readOnly
                    className="bg-slate-50 dark:bg-slate-900/50 font-mono"
                    placeholder="예: 16000-044"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="lotNo" className="font-semibold text-slate-700 dark:text-slate-300">
                    Lot 번호
                  </Label>
                  <Input
                    id="lotNo"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="배치 식별 번호 입력"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="storageCondition">보관 조건</Label>
                  <Select value={storageCondition} onValueChange={setStorageCondition}>
                    <SelectTrigger id="storageCondition">
                      <SelectValue placeholder="조건 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room_temp_broad">실온 (1~30°C)</SelectItem>
                      <SelectItem value="room_temp_std">상온 (15~25°C)</SelectItem>
                      <SelectItem value="fridge">냉장 (2~8°C)</SelectItem>
                      <SelectItem value="freezer_20">냉동 (-20°C)</SelectItem>
                      <SelectItem value="deep_freezer_80">초저온 냉동 (-80°C)</SelectItem>
                      <SelectItem value="ln2">액체질소 (-196°C)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!inventory && selectedProduct && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-slate-500 hover:text-slate-700"
                  onClick={() => {
                    setSelectedProduct(null);
                    setIsManualEntry(false);
                    setStep("search");
                  }}
                >
                  ← 품목 변경하기
                </Button>
              )}
            </div>

            {/* 2. 수량 및 관리 정보 */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b border-slate-200 dark:border-slate-700 pb-2 mt-2">
                수량 및 관리 정보
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentQuantity" className="font-semibold text-slate-700 dark:text-slate-300">
                    현재 재고량 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="currentQuantity"
                    type="number"
                    min="0"
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unit">단위</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger id="unit">
                      <SelectValue placeholder="단위 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="개">개 (ea)</SelectItem>
                      <SelectItem value="box">박스 (box)</SelectItem>
                      <SelectItem value="mL">mL</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="vial">바이알 (vial)</SelectItem>
                      <SelectItem value="bottle">병 (bottle)</SelectItem>
                      <SelectItem value="mg">mg</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="test">test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="location">보관 위치</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="예: 시약장 A-1, 냉동고 3칸"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expiryDate">유효 기한</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="expiryDate"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !expiryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expiryDate ? (
                          format(expiryDate, "yyyy년 M월 d일", { locale: ko })
                        ) : (
                          <span>날짜를 선택하세요</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expiryDate}
                        onSelect={setExpiryDate}
                        initialFocus
                        locale={ko}
                        captionLayout="dropdown"
                        fromYear={2015}
                        toYear={2030}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="safetyStock">안전 재고 (선택)</Label>
                  <Input
                    id="safetyStock"
                    type="number"
                    min="0"
                    value={safetyStock}
                    onChange={(e) => setSafetyStock(e.target.value)}
                    placeholder="이 수량 이하로 재주문 추천"
                  />
                </div>
                <div className="grid gap-2">
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

              <div className="grid gap-2">
                <Label htmlFor="testPurpose" className="font-semibold text-slate-700 dark:text-slate-300">
                  시험항목 (용도)
                </Label>
                <Input
                  id="testPurpose"
                  value={testPurpose}
                  onChange={(e) => setTestPurpose(e.target.value)}
                  placeholder="예: MTT assay, 외래성 바이러스 시험 등"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">특이사항 (비고)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="기타 참고할 사항을 적어주세요."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={isLoading}>
                취소
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : inventory ? (
                  "저장"
                ) : (
                  "재고 등록하기"
                )}
              </Button>
            </div>
          </form>
        ) : isManualEntry ? (
          <div className="space-y-4 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsManualEntry(false)}
              className="-ml-2 text-slate-500 hover:text-slate-700"
            >
              ← 다시 검색하기
            </Button>
            <div className="space-y-2">
              <Label htmlFor="manual-name" className="text-sm font-medium">
                제품명 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="manual-name"
                placeholder="예: Fetal Bovine Serum"
                value={manualProductName}
                onChange={(e) => setManualProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-brand" className="text-sm font-medium">
                제조사
              </Label>
              <Input
                id="manual-brand"
                placeholder="예: Gibco"
                value={manualBrand}
                onChange={(e) => setManualBrand(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-catalog" className="text-sm font-medium">
                카탈로그 번호
              </Label>
              <Input
                id="manual-catalog"
                placeholder="예: 16000-044"
                value={manualCatalogNumber}
                onChange={(e) => setManualCatalogNumber(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                취소
              </Button>
              <Button
                onClick={handleManualEntryNext}
                disabled={!manualProductName.trim()}
                className="flex-1"
              >
                다음
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold mb-2 block">상품명 또는 카탈로그 번호 검색</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="상품명 또는 카탈로그 번호 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-12 text-base"
                />
              </div>
            </div>
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              {isLoadingProducts ? (
                <div className="p-8 text-center text-muted-foreground">검색 중...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center">
                  {searchQuery ? (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-slate-500">검색된 제품이 없습니다.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsManualEntry(true)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        + 직접 제품 정보 입력하기
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">검색어를 입력하세요.</p>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredProducts.slice(0, 20).map((product: Product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleProductSelect(product)}
                      className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-lg border">
                          <AvatarImage src={`/api/products/${product.id}/image`} alt={product.name} />
                          <AvatarFallback className="bg-slate-100 text-slate-600">
                            {product.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          {product.brand && (
                            <div className="text-sm text-muted-foreground">{product.brand}</div>
                          )}
                          {product.catalogNumber && (
                            <div className="text-sm text-muted-foreground font-mono">
                              {product.catalogNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                취소
              </Button>
              <Button
                onClick={() => setStep("details")}
                disabled={!selectedProduct}
                className="flex-1"
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

