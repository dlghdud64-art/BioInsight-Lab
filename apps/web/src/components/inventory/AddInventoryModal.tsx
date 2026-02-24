"use client";

import { useState } from "react";
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const data = {
      productId: selectedProduct.id,
      currentQuantity: parseFloat(currentQuantity) || 0,
      unit,
      safetyStock: safetyStock ? parseFloat(safetyStock) : undefined,
      minOrderQty: minOrderQty ? parseFloat(minOrderQty) : undefined,
      location: location || undefined,
      expiryDate: expiryDate ? expiryDate.toISOString().split("T")[0] : undefined,
      notes: notes || undefined,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inventory ? "재고 수정" : "재고 추가"}</DialogTitle>
          <DialogDescription>
            {step === "search" 
              ? "추가할 제품을 검색하고 선택하세요."
              : "재고 정보를 입력하세요."}
          </DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          isManualEntry ? (
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
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 선택된 제품 정보 */}
            {selectedProduct && (
              <div className="p-4 border rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 rounded-lg border">
                    <AvatarImage src={`/api/products/${selectedProduct.id}/image`} alt={selectedProduct.name} />
                    <AvatarFallback className="bg-slate-100 text-slate-600">
                      {selectedProduct.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{selectedProduct.name}</div>
                    {selectedProduct.brand && (
                      <div className="text-sm text-muted-foreground">{selectedProduct.brand}</div>
                    )}
                    {selectedProduct.catalogNumber && (
                      <div className="text-sm text-muted-foreground font-mono">
                        {selectedProduct.catalogNumber}
                      </div>
                    )}
                  </div>
                  {!inventory && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(null);
                        setIsManualEntry(false);
                        setStep("search");
                      }}
                    >
                      변경
                    </Button>
                  )}
                </div>
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
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={isLoading}>
                취소
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  "저장"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

