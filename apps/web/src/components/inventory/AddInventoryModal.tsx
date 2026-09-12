"use client";

import { useState, useEffect } from "react";
import { buildInventoryFormPayload } from "@/lib/inventory/inventory-form-payload";
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
  // §11.203 sweep — caller fallback 정합. imageUrl 부재 시 AvatarImage
  // render 안 함 → AvatarFallback (product.name.charAt(0)) 즉시 노출.
  // dead URL 호출 0 (route stub 신설 후에도 caller 자체에서 차단).
  imageUrl?: string | null;
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
    trackingMode?: string; // §inventory-phaseB P3-UI-b — 추적 모드(QUANTITY/LOT/GMP_STRICT).
    catalogNumber?: string | null; // §11.336 — 편집모드 Cat.No 수동 입력(Product 마스터 반영).
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
  // §inventory-phaseB P3-UI-b — 추적 모드(차감 게이팅 정책). 기본 QUANTITY(마찰 0).
  const [trackingMode, setTrackingMode] = useState<string>(inventory?.trackingMode ?? "QUANTITY");
  // §11.336 — 편집모드 Cat.No 수동 입력 state(Product 마스터 catalogNumber).
  const [editableCatNo, setEditableCatNo] = useState<string>(inventory?.product?.catalogNumber ?? "");
  const [expiryDatePopoverOpen, setExpiryDatePopoverOpen] = useState(false);

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
      setEditableCatNo(inventory.product?.catalogNumber ?? "");
      setExpiryDate(inventory.expiryDate ? new Date(inventory.expiryDate) : undefined);
      setNotes(inventory.notes ?? "");
      setLotNumber(inventory.lotNumber ?? "");
    }
  }, [open, inventory]);

  // 제품 검색
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products", "search"],
    queryFn: async () => {
      const response = await fetch("/api/products/search?limit=100");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: open && step === "search",
  });

  const products = productsData?.products || [];

  const filteredProducts = products.filter((product: Product) => {
    // 1글자부터 부분 일치 검색 (대소문자 무시)
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    const name = product.name?.toLowerCase() ?? "";
    const brand = product.brand?.toLowerCase() ?? "";
    const catalog = product.catalogNumber?.toLowerCase() ?? "";

    return (
      name.includes(query) ||
      brand.includes(query) ||
      catalog.includes(query)
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
    // selectedProduct가 없으면 제출 불가
    if (!productId && !selectedProduct) return;

    // 수기 입력 감지: "manual-" 접두사인 임시 ID는 DB에 존재하지 않음
    const isManual = typeof productId === "string" && productId.startsWith("manual-");

    // §inventory-notes-erase P1-b — 조립은 lib 한 곳에 둔다(요청 본문을 테스트가 직접 잰다).
    const data = buildInventoryFormPayload({
      productId, isManual, selectedProduct, currentQuantity, unit, safetyStock, minOrderQty,
      location, expiryDate, notes, lotNumber, trackingMode,
      isEdit: Boolean(inventory), editableCatNo,
    });
    console.log("저장 시도:", data);
    onSubmit(data as Parameters<typeof onSubmit>[0]);
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
              <h4 className="text-sm font-semibold text-blue-600 text-blue-400 border-b border-bd border-bs pb-2">
                기본 식별 정보
              </h4>

              <div className="grid gap-2">
                <Label htmlFor="productName" className="font-semibold text-slate-600">
                  품목명 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="productName"
                  value={formProductName}
                  readOnly
                  className="border-bs border-bs bg-pg bg-pn/50"
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
                    className="bg-pg bg-pn/50"
                    placeholder="예: Thermo Fisher"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="catNo">Cat.No (카탈로그 번호)</Label>
                  <Input
                    id="catNo"
                    value={inventory ? editableCatNo : formCatNo}
                    onChange={inventory ? (e) => setEditableCatNo(e.target.value) : undefined}
                    readOnly={!inventory}
                    data-testid="catno-edit-input"
                    className={inventory ? "font-mono" : "bg-pg bg-pn/50 font-mono"}
                    placeholder="예: 25200-056"
                  />
                </div>
              </div>

              {/* §inventory-phaseB P3-UI-b — 추적 모드(차감 게이팅 정책). 기본 QUANTITY = 마찰 0. */}
              <div className="grid gap-2">
                <Label htmlFor="trackingMode" className="font-semibold text-slate-600">추적 모드</Label>
                <Select value={trackingMode} onValueChange={setTrackingMode}>
                  <SelectTrigger id="trackingMode">
                    <SelectValue placeholder="추적 모드 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUANTITY">수량만 (기본)</SelectItem>
                    <SelectItem value="LOT">로트 추적 (로트번호 필수)</SelectItem>
                    <SelectItem value="GMP_STRICT">GMP 엄격 (로트·담당자·사용처 필수)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">차감 시 추적 강도. GMP는 차감 시 로트·담당자·사용처 입력을 강제합니다.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="lotNo" className="font-semibold text-slate-600">
                    Lot 번호
                  </Label>
                  <Input
                    id="lotNo"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="배치 식별 번호 입력"
                  />
                </div>
                {/* 🛑 §inventory-edit-blank-fields (호영님 2026-09-12) — 「보관 조건」 **편집 제거**.
                    호영님 판정: "읽기 전용. `2-8°C` 는 SDS 가 출처인 안전 정보다. 랩이 바꿀 건
                    location(이미 있다). 재고 화면에서 편집 가능하면 사용자가 SDS 값을 덮어쓴다."
                    실측(2026-09-12): ProductInventory 에 storageCondition 열이 **없고**, 저장 자리는
                    Product.storageCondition 이다. 게다가 값 체계도 다르다 —
                      이 Select   room_temp_broad · fridge · freezer_20 …  (코드값)
                      Product 열  "2~8°C 냉장 보관"                        (SDS 자유 텍스트)
                    이어진 적이 없는 입력이었다. 읽기 배선(제품 값 표시)은 별건. */}
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
              <h4 className="text-sm font-semibold text-blue-600 text-blue-400 border-b border-bd border-bs pb-2 mt-2">
                수량 및 관리 정보
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentQuantity" className="font-semibold text-slate-600">
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
                  <Popover open={expiryDatePopoverOpen} onOpenChange={setExpiryDatePopoverOpen}>
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
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={expiryDate}
                        onSelect={(date) => {
                          setExpiryDate(date);
                          setExpiryDatePopoverOpen(false);
                        }}
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

              {/* 🛑 §inventory-edit-blank-fields (호영님 2026-09-12) — 「시험항목(용도)」 입력 제거.
                  schema.prisma 와 prod DB **어디에도 testPurpose 컬럼이 없다**(2026-09-12 실측).
                  폼은 입력을 받아 PATCH 로 보냈고 서버는 무시했다 — 저장 자리가 없는 dead input.
                  호영님 판정: "설계 없이 UI 가 먼저 생긴 것. 컬럼을 추가하면 미검증 설계가 굳는다."
                  🔑 되살리려면 스키마 설계가 먼저다(DDL 금지 · 이 자리에 다시 넣지 말 것). */}

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
                <div className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">검색 중...</span>
                </div>
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
                      className="w-full p-4 text-left hover:bg-pg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-lg border">
                          {/* §11.203 sweep — dead URL `/api/products/{id}/image`
                              fallback 제거. imageUrl 있을 때만 render →
                              AvatarFallback (letter) 즉시 노출. */}
                          {product.imageUrl ? (
                            <AvatarImage src={product.imageUrl} alt={product.name} />
                          ) : null}
                          <AvatarFallback className="bg-el text-slate-600">
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

