"use client";

import { csrfFetch } from "@/lib/api-client";
// §11.348-B-1 B1-2 — SDS 문서 섹션(업로드/열람).
import { SdsDocumentsSection } from "@/components/safety/sds-documents-section";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  ShoppingCart,
  GitCompare,
  ExternalLink,
  ClipboardCopy,
  Languages,
  Loader2,
  Pencil,
  Shield,
  AlertTriangle,
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Zap,
  Info,
  Calendar,
  Clock,
  Home,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProduct } from "@/hooks/use-products";
import { useCompareStore } from "@/lib/store/compare-store";
import { useToast } from "@/hooks/use-toast";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { getProductSafetyLevel, HAZARD_CODE_DESCRIPTIONS } from "@/lib/utils/safety-visualization";
import { getRegulationLinksForProduct } from "@/lib/regulation/links";
import { filterComplianceLinksForProduct, getRuleDescription } from "@/lib/compliance-links";
import { PersonalizedRecommendations } from "@/components/products/personalized-recommendations";
// §product-detail PD-B(§04·§05) — 완성도(8필드 고정) + 미등록 1줄 축약.
import { ProductCompleteness } from "@/components/products/product-completeness";
// §product-detail PD-D(§09) — 견적함 정직 트레이바(데스크탑).
import { QuoteTrayBar } from "@/components/products/quote-tray-bar";
// §product-detail PD-F(§03/§01) — 추가 스펙 raw key 한글화 + null/빈값 숨김.
import { getDisplaySpecs } from "@/lib/product-detail/spec-fields";
import { Disclaimer } from "@/components/legal/disclaimer";
// #quote-cta-truth — 견적함 저장 계층 단일 출처 (fake success 제거, 호영님 2026-06-11)
import { addToQuoteCart, readQuoteCart } from "@/lib/quote/quote-cart-storage";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const { data: fetchedProduct, isLoading, error } = useProduct(id);
  const { addProduct, removeProduct, hasProduct } = useCompareStore();
  // #quote-cta-truth — 견적함 truth 합류 (provider 와 동일 키·동일 순수함수, ⓐ 결정)
  const [inQuoteCart, setInQuoteCart] = useState(false);
  useEffect(() => {
    if (!id) return;
    setInQuoteCart(readQuoteCart().some((q: any) => q.productId === id));
  }, [id]);
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSafetyEditing, setIsSafetyEditing] = useState(false);
  const [safetyForm, setSafetyForm] = useState<{
    hazardCodes: string;
    pictograms: string;
    ppe: string;
    storageCondition: string;
    safetyNote: string;
  }>({
    hazardCodes: "",
    pictograms: "",
    ppe: "",
    storageCondition: "",
    safetyNote: "",
  });
  const [isSavingSafety, setIsSavingSafety] = useState(false);
  const [showMoreComplianceLinks, setShowMoreComplianceLinks] = useState(false);
  const [msdsLinkStatus, setMsdsLinkStatus] = useState<"checking" | "valid" | "invalid" | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isInCompare = hasProduct(id);

  // Fallback 제품 (DB 연결 실패 시 사용)
  const FALLBACK_PRODUCT = {
    id,
    name: "Human IL-6 ELISA Kit (Alternative)",
    brand: "Thermo Fisher Scientific",
    catalogNumber: "BMS213HS",
    description: "인간 IL-6 정량 분석을 위한 고감도 ELISA 키트입니다. 연구용(Research Grade)으로 최적화되어 있으며, 96-well plate 구성입니다.",
    vendors: [],
    specifications: {
      Grade: "Research Grade",
      Format: "96-well plate",
      Sensitivity: "< 0.7 pg/mL",
      Target: "Human IL-6",
      "Sample Type": "Serum, Plasma, Cell Culture"
    },
    grade: "Research Grade",
    specification: "96-well plate",
  };

  const displayProduct = fetchedProduct || FALLBACK_PRODUCT;
  const product = displayProduct as any;
  const vendors = product.vendors || [];

  // Compliance Links 조회
  const { data: complianceLinksData } = useQuery({
    queryKey: ["compliance-links", id],
    queryFn: async () => {
      const response = await fetch(`/api/compliance-links?productId=${id}`);
      if (!response.ok) return { links: [] };
      return response.json();
    },
    enabled: !!id,
  });

  const allComplianceLinks = (complianceLinksData?.links || []) as any[];
  const filteredComplianceLinks = fetchedProduct
    ? filterComplianceLinksForProduct(allComplianceLinks, fetchedProduct, (session?.user as any)?.organizationId || null)
    : [];

  const officialLinks = filteredComplianceLinks.filter((link) => link.linkType === "official");
  const organizationLinks = filteredComplianceLinks.filter((link) => link.linkType === "organization");
  const isAdmin = session?.user?.role === "ADMIN";

  // 제품 조회 기록
  useEffect(() => {
    if (id && session) {
      fetch(`/api/products/${id}/view`, { method: "POST" }).catch(() => {});
    }
  }, [id, session]);

  const handleTranslate = async () => {
    if (!product.descriptionEn) return;
    setIsTranslating(true);
    try {
      const response = await csrfFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: product.descriptionEn, targetLang: "ko" }),
      });
      if (response.ok) {
        const data = await response.json();
        setTranslatedDescription(data.translatedText);
      }
    } catch (error) {
      toast({
        title: "번역 실패",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const startSafetyEdit = () => {
    if (!fetchedProduct) return;
    setSafetyForm({
      hazardCodes: (fetchedProduct.hazardCodes || []).join(", "),
      pictograms: (fetchedProduct.pictograms || []).join(", "),
      ppe: (fetchedProduct.ppe || []).join(", "),
      storageCondition: fetchedProduct.storageCondition || "",
      safetyNote: fetchedProduct.safetyNote || "",
    });
    setIsSafetyEditing(true);
  };

  // #catalog-spec-backfill ② — 규격 편집 (ADMIN·SUPPLIER, 서버측 검증 동반)
  const role = session?.user?.role as string | undefined;
  const canEditSpec = role === "ADMIN" || role === "SUPPLIER";
  const [isSpecEditing, setIsSpecEditing] = useState(false);
  const [specForm, setSpecForm] = useState("");
  const [isSavingSpec, setIsSavingSpec] = useState(false);
  const saveSpecification = async () => {
    if (!fetchedProduct) return;
    setIsSavingSpec(true);
    try {
      const response = await fetch(`/api/products/${id}/specification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specification: specForm.trim() || null }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "규격을 저장하는 데 실패했습니다.");
      }
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setIsSpecEditing(false);
      toast({
        title: "규격 저장 완료",
        description: "제품의 규격/용량 정보가 업데이트되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "저장 실패",
        description: error?.message || "규격을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSpec(false);
    }
  };

  const saveSafetyInfo = async () => {
    if (!fetchedProduct) return;
    setIsSavingSafety(true);
    try {
      const payload = {
        hazardCodes: safetyForm.hazardCodes.split(",").map((s) => s.trim()).filter(Boolean),
        pictograms: safetyForm.pictograms.split(",").map((s) => s.trim()).filter(Boolean),
        ppe: safetyForm.ppe.split(",").map((s) => s.trim()).filter(Boolean),
        storageCondition: safetyForm.storageCondition,
        safetyNote: safetyForm.safetyNote,
      };

      const response = await fetch(`/api/products/${id}/safety`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "안전 정보를 저장하는 데 실패했습니다.");
      }

      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setIsSafetyEditing(false);
      toast({
        title: "안전 정보 저장 완료",
        description: "제품의 안전 · 규제 정보가 업데이트되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "저장 실패",
        description: error?.message || "안전 정보를 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSafety(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error && !fetchedProduct) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              제품을 찾을 수 없습니다.
            </p>
            <div className="mt-4 text-center">
              <Link href="/search">
                <Button variant="outline">검색으로 돌아가기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pg/50 pb-24 lg:pb-32 relative">
      {/* 배경 그라데이션 데코레이션 */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/50 via-transparent to-transparent -z-10 pointer-events-none" />
      
      {/* §1-2② — floating 원형 back 제거(breadcrumb과 중복·겹침). breadcrumb이 회귀 경로 담당.
          전역 헤더 없음 + viewportFit:cover → breadcrumb이 모바일 최상단이라 safe-area 인식 pt. */}
      <div className="container mx-auto px-4 md:px-4 lg:px-8 pt-[calc(env(safe-area-inset-top)+1rem)] md:py-8 relative z-0">
        {/* §product-detail PD-flat — 콘텐츠 영역만 시안 플랫(.q-embed 스코프). 전역 셸 불변(호영님 2026-06-20). */}
        <div className="max-w-7xl mx-auto q-embed">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-1 md:space-x-2 text-sm text-slate-500 mb-6 md:mb-8 px-1 overflow-x-auto whitespace-nowrap" aria-label="Breadcrumb">
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-blue-600 transition-colors font-medium text-slate-600"
            >
              <Home className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">홈</span>
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            <Link
              href="/search"
              className="hover:text-blue-600 transition-colors font-medium text-slate-600 whitespace-nowrap"
            >
              검색 결과
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            <span className="text-slate-900 font-semibold truncate max-w-[200px] md:max-w-[400px]">
              {product.name || "제품"}
            </span>
          </nav>

          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-8 lg:gap-10">
            {/* 제품 정보 (8칸) */}
            <div className="lg:col-span-8 space-y-6 md:space-y-8">
              {/* 상단: 제품명, 벤더, 카테고리, Grade/규격 배지 */}
              {/* §product-detail PD-flat(시안 §05) — 히어로: 플랫 흰 카드(글래스/blur orb 폐기, radius 18px, hairline). */}
              <Card className="bg-white shadow-sm rounded-[18px] p-6 md:p-7 border border-gray-200 relative overflow-hidden">
                <CardHeader className="px-0 pt-0 pb-4 relative z-10">
                  {/* 데스크톱 뒤로가기 링크 */}
                  <div className="hidden md:block mb-4">
                    <button
                      onClick={() => router.back()}
                      className="text-sm text-gray-500 hover:text-blue-600 mb-4 inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      검색 결과 목록
                    </button>
                  </div>
                  <div className="flex items-start gap-4">
                    {/* §product-detail PD-K/PD-flat(시안 §05) — 히어로 썸네일 96px(시안 정합) + accent 그라데이션. 빈 이미지는 아이콘. */}
                    <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <Package className="h-9 w-9 text-blue-300" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-4">
                        {/* 재고 상태는 표시하지 않음 (확실하지 않은 정보) */}
                      </div>
                      <CardTitle className="text-2xl md:text-[27px] font-bold text-slate-900 leading-tight mb-3 break-words">{product.name}</CardTitle>
                      {product.nameEn && (
                        <CardDescription className="text-sm md:text-base break-words">{product.nameEn}</CardDescription>
                      )}
                      {product.vendors?.[0]?.vendor?.name && (
                        <p className="text-xs md:text-sm text-slate-600 mt-1">
                          {product.vendors[0].vendor.name}
                        </p>
                      )}
                      {/* §PD-flat(시안 pd-catno) — Cat.No 를 제품명 바로 아래로(+복사 버튼). */}
                      {product.catalogNumber && (
                        <div className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
                          <span className="text-[11px] text-slate-500">Cat.No</span>
                          <span className="text-[13px] font-mono font-semibold text-slate-900">{product.catalogNumber}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(product.catalogNumber);
                                toast({ title: "복사 완료", description: "카탈로그 번호가 클립보드에 복사되었습니다." });
                              } catch {
                                toast({ title: "복사 실패", variant: "destructive" });
                              }
                            }}
                            className="text-gray-400 hover:text-[#2456bd] border-l border-gray-200 pl-2"
                            aria-label="카탈로그 번호 복사"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:gap-2 mt-3 md:mt-4">
                    {product.category && (
                      <Badge variant="outline" className="text-[10px] md:text-sm">
                        {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                      </Badge>
                    )}
                    {product.brand && (
                      <Badge variant="outline" className="text-[10px] md:text-sm">
                        {product.brand}
                      </Badge>
                    )}
                  </div>
                  {/* §product-detail PD-H(§05 레이아웃) — 시안 히어로 키 팩트 행(분류·출처·제조사·안전 위험도, 아는 값만).
                      ★ product.grade(자사 A~E) + 내부 등급(specifications.INTERNALGRADE)은 §11.344/§sourcing-product-surface
                        grade 미노출 정책으로 제외(호영님 결정 대기). 출처(SOURCE)는 §03 매핑값. */}
                  {(() => {
                    const heroSpecs = getDisplaySpecs(product.specifications);
                    const source = heroSpecs.find((s) => s.label === "출처")?.value;
                    const internalGrade = heroSpecs.find((s) => s.label === "내부 등급")?.value;
                    const safety = getProductSafetyLevel(product);
                    const facts: Array<{ label: string; value: string }> = [];
                    if (product.category) facts.push({ label: "분류", value: PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES] });
                    if (source) facts.push({ label: "출처", value: source });
                    if (internalGrade) facts.push({ label: "내부 등급", value: internalGrade }); // 호영님 재결정: 시안대로 노출
                    if (product.manufacturer) facts.push({ label: "제조사", value: product.manufacturer });
                    if (safety?.label) facts.push({ label: "안전 위험도", value: safety.label });
                    if (facts.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-y-2 mt-4 pt-4 border-t border-gray-100">
                        {facts.map((f, i) => (
                          <div key={f.label} className={`flex flex-col gap-0.5 px-5 ${i === 0 ? "pl-0" : "border-l border-gray-100"}`}>
                            <span className="text-[11px] font-bold text-slate-400">{f.label}</span>
                            <span className="text-sm md:text-[15px] font-bold text-slate-900">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {/* §product-detail PD-M(§05) — Cat.No 는 제품명 아래로 이동(위). 여기선 완성도만. */}
                  <div className="mt-4">
                    <ProductCompleteness product={product} />
                  </div>
                </CardHeader>
              </Card>

              {/* §product-detail PD-N(§05) — 래퍼 박스 투명화 → 하위 섹션(제품 사양·안전·규제)을 각각 독립 카드로(시안 정합). */}
              <Card className="bg-transparent border-0 shadow-none p-0 relative space-y-6 md:space-y-8">
                {/* §PD-flat — 글래스 blur orb 제거(콘텐츠 플랫). */}
                {/* §product-detail PD-M(§05) — 시안엔 "실험/제품 정보" 제목 없음 → 제거(클린 흐름). */}
                <CardContent className="px-0 pb-0 space-y-4 md:space-y-6 relative z-10">
                  {/* §product-detail PD-K(§05) — 큰 이미지 박스 제거 → 히어로 소형 썸네일로 이전(시안, bloat 0). */}

                  {product.description && (
                    <div>
                      <h3 className="font-semibold mb-2 text-xs md:text-sm">설명</h3>
                      <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {product.description}
                      </p>
                      {product.descriptionTranslated && (
                        <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap mt-2 italic break-words">
                          {product.descriptionTranslated}
                        </p>
                      )}
                    </div>
                  )}

                  {product.descriptionEn && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">영문 설명</h3>
                        {!product.descriptionTranslated && !translatedDescription && (
                          <Button variant="outline" size="sm" onClick={handleTranslate} disabled={isTranslating}>
                            {isTranslating ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                번역 중...
                              </>
                            ) : (
                              <>
                                <Languages className="h-3 w-3 mr-2" />
                                한글로 번역
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap text-sm mb-3">
                        {product.descriptionEn}
                      </p>
                      {(product.descriptionTranslated || translatedDescription) && (
                        <div className="mt-4 p-3 bg-pg rounded-lg border border-bd">
                          <div className="flex items-center gap-2 mb-2">
                            <Languages className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold text-sm">번역된 설명</h4>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap text-sm">
                            {translatedDescription || product.descriptionTranslated}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* §product-detail PD-J(§05) — 독립 Cat.No 블록 제거 → 아래 "제품 사양" 카드로 통합. */}

                  {/* §product-detail PD-M(§05) — 완성도는 히어로로 이동(시안 한 카드). 여기선 제거. */}

                  {/* 주요 스펙 요약 카드 - Data Grid 스타일 (Glassmorphism) */}
                  {/* §product-detail PD-L(§05) — 빈 상세 스펙 카드는 buyer 에게 숨김(시안: 빈 카드가 화면 지배 방지).
                      canEditSpec(공급사/관리자)일 때만 빈 상태 노출(첫 스펙 등록 affordance 보존). 미등록 안내는 완성도(ProductCompleteness)가 담당. */}
                  {(product.specification || product.regulatoryCompliance || canEditSpec) && (
                  <div className="mb-6 md:mb-8 rounded-[18px] border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 md:px-8 py-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/60">
                      <Check className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-bold text-slate-900">상세 스펙 (Specifications)</h3>
                      {/* #catalog-spec-backfill ② — 공급사/관리자 규격 직접 충전 */}
                      {canEditSpec && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs ml-auto"
                          onClick={() => {
                            setSpecForm(product?.specification || "");
                            setIsSpecEditing(true);
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          스펙 편집
                        </Button>
                      )}
                    </div>
                    <div className="p-4 md:p-5 bg-white">
                      {/* §PD-flat(시안 spec-grid) — hairline 정의그리드(gap-px+bg-line, 셀 흰배경). 박스 폐기. */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                      {/* §1-2⑤ ① — spec tautology 제거: identity 필드(브랜드·카테고리·
                          카탈로그번호)는 헤더가 표시 — spec 그리드는 실 spec 만 (라벨 정직화).
                          실 spec 부재 시 정직한 empty 노출 (catalog spec backfill 별도 트랙). */}
                      {(product.specification || product.regulatoryCompliance) ? (
                        <>
                          {product.specification && (
                            <div className="flex flex-col gap-0.5 px-4 py-3 bg-white">
                              <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider">규격/용량</span>
                              <span className="text-sm font-semibold text-slate-900 break-words line-clamp-2">{product.specification}</span>
                            </div>
                          )}
                          {product.regulatoryCompliance && (
                            <div className="flex flex-col gap-0.5 px-4 py-3 bg-white">
                              <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider">규제 규격</span>
                              <span className="text-sm font-semibold text-slate-900 break-words">{product.regulatoryCompliance}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="col-span-full text-center text-gray-400 py-4 text-xs bg-white">등록된 상세 스펙이 없습니다.</div>
                      )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* §product-detail PD-J(§05 레이아웃) — "제품 사양" 통합 카드(시안): 카탈로그 번호 + 분류 + 추가 스펙(출처 등).
                      독립 Cat.No 블록·추가스펙 카드 통합. §03 매핑·grade 숨김(getDisplaySpecs) 유지. §125 "상세 스펙(규격/규제)" 그리드는 별도 보존.
                      PD-N: 독립 카드 스타일(테두리·그림자) — 시안 정합. */}
                  <div className="mb-6 md:mb-8 rounded-[18px] border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 md:px-8 py-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/60">
                      <Check className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-bold text-slate-900">제품 사양</h3>
                      {/* §PD-flat(시안 §05) — "N개 항목 확인" 배지(확인된 사양 수, 정직). */}
                      {(() => {
                        const specCount = (product.catalogNumber ? 1 : 0) + (product.category ? 1 : 0) + getDisplaySpecs(product.specifications).length;
                        return specCount > 0 ? (
                          <span className="ml-auto inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">{specCount}개 항목 확인</span>
                        ) : null;
                      })()}
                    </div>
                    <div className="p-4 md:p-5 bg-white">
                      {/* §PD-flat(시안 spec-grid) — hairline 정의그리드(gap-px+bg-line, 셀 흰배경). */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                      {product.catalogNumber && (
                        <div className="flex flex-col gap-0.5 px-4 py-3 bg-white">
                          <span className="text-[10px] md:text-xs font-semibold text-gray-500 tracking-wider flex items-center gap-1">
                            Cat.No (카탈로그 번호)
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(product.catalogNumber);
                                  toast({ title: "복사 완료", description: "카탈로그 번호가 클립보드에 복사되었습니다." });
                                } catch {
                                  toast({ title: "복사 실패", variant: "destructive" });
                                }
                              }}
                              className="text-gray-400 hover:text-blue-600"
                              aria-label="카탈로그 번호 복사"
                            >
                              <ClipboardCopy className="h-3 w-3" />
                            </button>
                          </span>
                          <span className="text-sm font-semibold text-slate-900 font-mono break-words">{product.catalogNumber}</span>
                        </div>
                      )}
                      {product.category && (
                        <div className="flex flex-col gap-0.5 px-4 py-3 bg-white">
                          <span className="text-[10px] md:text-xs font-semibold text-gray-500 tracking-wider">분류</span>
                          <span className="text-sm font-semibold text-slate-900 break-words">{PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}</span>
                        </div>
                      )}
                      {getDisplaySpecs(product.specifications).map((spec, i) => (
                        <div key={`${spec.label}-${i}`} className="flex flex-col gap-0.5 px-4 py-3 bg-white">
                          <span className="text-[10px] md:text-xs font-semibold text-gray-500 tracking-wider">{spec.label}</span>
                          <span className="text-sm font-semibold text-slate-900 break-words">{spec.value}</span>
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>

                  {/* 사용 용도 — §1-2⑤ AI 생성 버튼 제거(관통원칙: 별도 AI UI 금지 + non-persist).
                      product.usageDescription(DB 캐노니컬)만 노출. */}
                  {/* PD-N: 사용 용도 — 값 있을 때만 독립 카드(빈 섹션은 완성도가 안내, 시안 정합). */}
                  {product.usageDescription && (
                    <div className="rounded-[18px] border border-gray-200 bg-white shadow-sm p-6 md:p-8">
                      <h3 className="font-semibold text-sm md:text-base mb-2">사용 용도</h3>
                      <p className="text-xs md:text-sm text-slate-700 whitespace-pre-wrap">
                        {product.usageDescription}
                      </p>
                    </div>
                  )}

                  {/* 안전 · 규제 정보 - 항상 표시. PD-N: 독립 카드 스타일(시안 정합). */}
                  <div className="rounded-[18px] border border-gray-200 bg-white shadow-sm p-6 md:p-8">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#c47d10]" />
                        <h3 className="font-semibold text-sm md:text-base">안전 · 규제 정보</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const safetyLevel = getProductSafetyLevel(product);
                          return (
                            <Badge
                              variant="outline"
                              className={`${safetyLevel.bgColor} ${safetyLevel.color} ${safetyLevel.borderColor} border-2 font-semibold text-xs`}
                            >
                              {/* §product-detail PD-C(§07) — 시안: 위험도 + MSDS 유무 병기 배지. */}
                              위험도: {safetyLevel.label} · MSDS {product.msdsUrl ? "등록" : "없음"}
                            </Badge>
                          );
                        })()}
                        {isAdmin && (
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={startSafetyEdit}>
                            <Pencil className="h-3 w-3 mr-1" />
                            안전 정보 편집
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3 md:space-y-4">
                        {/* 위험 코드 */}
                        {product.hazardCodes && Array.isArray(product.hazardCodes) && product.hazardCodes.length > 0 && (
                          <div>
                            <div className="text-xs md:text-sm text-slate-600 mb-1.5">위험 코드</div>
                            <div className="flex flex-wrap gap-1.5">
                              {product.hazardCodes.map((code: string, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200 text-[10px] md:text-xs"
                                  title={HAZARD_CODE_DESCRIPTIONS[code] || code}
                                >
                                  {code}
                                  {HAZARD_CODE_DESCRIPTIONS[code] && (
                                    <span className="ml-1 text-[9px] opacity-70">
                                      ({HAZARD_CODE_DESCRIPTIONS[code]})
                                    </span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* GHS 피크토그램 */}
                        {product.pictograms && Array.isArray(product.pictograms) && product.pictograms.length > 0 && (
                          <div>
                            <div className="text-xs md:text-sm text-slate-600 mb-1.5">GHS 피크토그램</div>
                            <div className="flex flex-wrap gap-1.5">
                              {product.pictograms.map((pictogram: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] md:text-xs">
                                  {pictogram}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* PPE */}
                        {product.ppe && Array.isArray(product.ppe) && product.ppe.length > 0 && (
                          <div>
                            <div className="text-xs md:text-sm text-slate-600 mb-1.5">필수 개인보호장비</div>
                            <div className="flex flex-wrap gap-1.5">
                              {product.ppe.map((item: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-[10px] md:text-xs">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 보관 조건 */}
                        {product.storageCondition && (
                          <div>
                            <div className="text-xs md:text-sm text-slate-600 mb-1.5">보관 조건</div>
                            <p className="text-xs md:text-sm text-slate-900">{product.storageCondition}</p>
                          </div>
                        )}

                        {/* 안전 취급 요약 */}
                        {product.safetyNote && (
                          <div className="p-3 bg-[#fbf0db] border border-[#f0dcae] rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-[#c47d10] mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-[#7a4f0a] mb-1">안전 취급 요약</p>
                                <p className="text-xs text-[#92610c] leading-relaxed whitespace-pre-wrap">
                                  {product.safetyNote}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* MSDS/SDS 링크 - 강조 */}
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-slate-700 mb-2">안전 자료</div>
                          {product.msdsUrl ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                              onClick={async () => {
                                try {
                                  const url = product.msdsUrl;
                                  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
                                    toast({
                                      title: "유효하지 않은 링크",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
                                  if (!newWindow || newWindow.closed) {
                                    toast({
                                      title: "팝업 차단됨",
                                      variant: "destructive",
                                    });
                                  }
                                } catch (error) {
                                  toast({
                                    title: "링크 열기 실패",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1.5" />
                              MSDS / SDS 문서 보기
                              <ExternalLink className="h-3 w-3 ml-1.5" />
                            </Button>
                          ) : (
                            /* §product-detail PD-C(§07) — 시안: MSDS 없음 = 회색텍스트 대신 경고 배너 + SDS 요청(실 이동 /support). */
                            <div className="flex items-start gap-2 p-2.5 bg-[#fbf0db] border border-[#f0dcae] rounded-lg">
                              <AlertTriangle className="h-4 w-4 text-[#c47d10] mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[#7a4f0a]">MSDS/SDS 미등록</p>
                                <p className="text-[11px] text-[#92610c]/80 mt-0.5">안전 자료가 아직 없습니다. 취급 전 공급사·관리자에 요청하세요.</p>
                                <Link href="/support" className="inline-flex items-center mt-1.5 text-[11px] font-semibold text-[#7a4f0a] underline underline-offset-2">
                                  SDS 요청
                                </Link>
                              </div>
                            </div>
                          )}
                          {/* §11.348-B-1 B1-2 — 업로드된 SDS 문서 목록/업로드/열람 (서명URL).
                              SDS 는 제품(product) 단위 canonical 이므로 catalog 에 유지. */}
                          {product?.id && <SdsDocumentsSection productId={product.id} docType="sds" />}
                          {/* §detail-page P1-1 — COA(시험성적서)는 lot-scoped(P2 CHECK: coa → inventoryId NOT NULL).
                              catalog(제품)은 lot 단위가 아니므로 COA 업로드 affordance 제거.
                              COA surface 는 inventory item(입고 lot)으로 이전 — P3. 데이터/route/model 불변. */}
                        </div>

                        {/* 규제/절차 링크 */}
                        {(officialLinks.length > 0 || organizationLinks.length > 0) && (
                          <div className="space-y-4">
                            {officialLinks.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-700 mb-2">공식 링크</div>
                                <div className="space-y-2">
                                  {(showMoreComplianceLinks ? officialLinks : officialLinks.slice(0, 3)).map((link) => (
                                    <a
                                      key={link.id}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-start gap-2 p-2 border border-bd rounded-lg hover:bg-pg transition-colors group"
                                    >
                                      <ExternalLink className="h-3 w-3 mt-0.5 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-slate-900">{link.title}</div>
                                        {link.description && (
                                          <div className="text-xs text-slate-600 mt-0.5">{link.description}</div>
                                        )}
                                        {isAdmin && link.rules && (
                                          <div className="text-xs text-slate-400 mt-1">
                                            조건: {getRuleDescription(link.rules)}
                                          </div>
                                        )}
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {organizationLinks.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-700 mb-2">우리 조직 절차</div>
                                <div className="space-y-2">
                                  {(showMoreComplianceLinks ? organizationLinks : organizationLinks.slice(0, 3)).map((link) => (
                                    <a
                                      key={link.id}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-start gap-2 p-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors group"
                                    >
                                      <ExternalLink className="h-3 w-3 mt-0.5 text-blue-400 group-hover:text-blue-600 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-blue-900">{link.title}</div>
                                        {link.description && (
                                          <div className="text-xs text-blue-700 mt-0.5">{link.description}</div>
                                        )}
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(officialLinks.length > 3 || organizationLinks.length > 3) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs w-full"
                                onClick={() => setShowMoreComplianceLinks(!showMoreComplianceLinks)}
                              >
                                {showMoreComplianceLinks ? (
                                  <>
                                    <ChevronUp className="h-3 w-3 mr-1" />
                                    접기
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                    더보기 ({officialLinks.length + organizationLinks.length - 3}개)
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}

                        {/* 국내 규제 포털 링크 - 강조 */}
                        <div className="space-y-2 pt-2 border-t border-bd">
                          <div className="flex items-center gap-2 mb-3">
                            <Shield className="h-4 w-4 text-blue-600" />
                            <div className="text-xs font-semibold text-slate-900">국내 규제기관 포털</div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {getRegulationLinksForProduct(
                              product.name,
                              product.catalogNumber || undefined,
                              product.category
                            ).map((link) => (
                              <Button
                                key={link.id}
                                variant="outline"
                                size="sm"
                                className="text-[10px] md:text-xs border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700 h-8 md:h-9 lg:h-9 px-2 md:px-3"
                                onClick={() => {
                                  window.open(link.url, "_blank");
                                }}
                                title={link.description}
                              >
                                <ExternalLink className="h-3 w-3 mr-1 md:mr-1.5 flex-shrink-0" />
                                <span className="truncate text-[10px] md:text-xs">{link.name}</span>
                              </Button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2">
                            제품명 또는 카탈로그 번호로 각 규제기관 포털에서 검색할 수 있습니다.
                          </p>
                        </div>

                        <Disclaimer type="safety" className="mt-4" />
                      </div>
                    </div>
                </CardContent>
              </Card>
            </div>

            {/* 가격 및 액션 - Sticky Right Panel (4칸) - 데스크톱 전용 */}
            <div className="hidden lg:block lg:col-span-4">
              <div className="sticky top-24 h-fit space-y-6">
                {/* §PD-flat P4(시안 §06) — 견적 카드: 글래스→플랫 흰 카드 + qc-accent(상단 4px 그라데이션 유지). */}
                <Card className="bg-white shadow-sm rounded-[18px] p-6 md:p-8 border border-gray-200 relative overflow-hidden">
                  {/* 상단 강조 선(qc-accent) */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                  {/* §PD-flat(시안 qc) — "가격 정보" 제목 제거, qc-pricelabel 만(시안 정합). */}
                  <CardHeader className="px-0 pt-2 pb-4">
                    <p className="text-xs font-medium text-gray-500">공급가 (VAT 별도)</p>
                  </CardHeader>
                  <CardContent className="px-0 space-y-4">
                    {vendors.length > 0 ? (
                      <div className="space-y-3 mb-6">
                        {vendors.map((pv: any) => (
                          <div
                            key={pv.id}
                            className="border border-gray-200 rounded-xl p-4 space-y-2 bg-gray-50/60"
                          >
                            {pv.vendor?.name && (
                              <div className="text-sm font-medium text-gray-700">{pv.vendor.name}</div>
                            )}
                            {pv.priceInKRW && pv.priceInKRW > 0 ? (
                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                                  ₩{pv.priceInKRW.toLocaleString()}
                                </span>
                                <span className="text-lg font-medium text-gray-400">KRW</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-sm font-bold text-blue-700">견적가 안내 품목</div>
                            )}
                            {/* 재고/납기 정보는 표시하지 않음 (확실하지 않은 정보) */}
                            <div className="space-y-2 pt-2">
                              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <Calendar className="w-3 h-3" /> 납기
                                </span>
                                <span className="text-xs font-medium text-gray-700 text-right">견적 시 안내</span>
                              </div>
                            </div>
                            {pv.url && (
                              <a
                                href={pv.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 mt-2"
                              >
                                <ExternalLink className="h-3 w-3" />
                                공급사 페이지
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mb-4">
                        {/* §PD-flat PD-A(시안 qc-state) — 견적가 안내 상태 박스(아이콘+사유) + qc-meta 행. */}
                        <div className="flex items-center gap-3 p-3.5 bg-[#eaf1fd] border border-[#cdddf9] rounded-xl">
                          <span className="w-9 h-9 rounded-lg bg-[#2f6be0] text-white flex items-center justify-center flex-shrink-0">
                            <Mail className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#2456bd] leading-tight">견적가 안내 품목</p>
                            <p className="text-[11px] text-slate-600 mt-0.5">가격이 공개되지 않아 견적으로 안내됩니다</p>
                          </div>
                        </div>
                        {/* qc-meta — Cat.No / 납기 / 최소 주문 */}
                        <div className="mt-3 text-xs">
                          {product.catalogNumber && (
                            <div className="flex items-center justify-between py-1">
                              <span className="text-slate-400">Cat.No</span>
                              <span className="font-mono font-medium text-slate-900">{product.catalogNumber}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-slate-400">납기</span>
                            <span className="font-medium text-slate-900">견적 시 안내</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-slate-400">최소 주문</span>
                            <span className="font-medium text-slate-900">견적 시 안내</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CTA 버튼 */}
                    <div className="space-y-3 pt-6 border-t border-bd/50">
                      {/* §1-2⑤ ③ — 소싱 상태 승계: 비교·견적함 포함 배지 (rail 라벨 동형) */}
                      {(hasProduct(id) || inQuoteCart) && (
                        <div className="flex items-center gap-1.5">
                          {hasProduct(id) && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              <GitCompare className="h-3 w-3" />비교에 포함됨
                            </span>
                          )}
                          {inQuoteCart && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShoppingCart className="h-3 w-3" />견적함에 포함됨
                            </span>
                          )}
                        </div>
                      )}
                      <Button
                        className="w-full py-3.5 bg-[#2f6be0] hover:bg-[#2456bd] text-white rounded-xl font-bold text-base shadow-sm transition-colors flex items-center justify-center gap-2 group"
                        onClick={() => {
                          // #quote-cta-truth — 구 GET-only fake success 제거: 실 견적함
                          //   (provider 동일 truth) 에 추가하고 결과로만 toast (조건부).
                          if (inQuoteCart) {
                            toast({
                              title: "이미 견적함에 있습니다",
                              description: "견적 요청 화면에서 수량·벤더를 조정할 수 있습니다.",
                            });
                            return;
                          }
                          const result = addToQuoteCart(product);
                          if (result.ok) {
                            setInQuoteCart(true);
                window.dispatchEvent(new Event("quote-cart-changed")); // §PD-D 트레이 갱신
                            toast({
                              title: "견적 담기 완료",
                              description: "제품이 견적함에 추가되었습니다.",
                            });
                          } else {
                            toast({
                              title: "견적 담기 실패",
                              description: "제품 정보를 확인할 수 없습니다.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        {inQuoteCart ? "견적함에 담김" : "견적 담기"}
                      </Button>
                      {/* §product-detail PD-A(§06) — 견적 신뢰 문구. */}
                      <p className="text-[11px] text-slate-500 text-center">견적 요청은 무료이며 구매 의무가 없습니다.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className="py-3 bg-white border border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-600 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        onClick={() => {
                          if (isInCompare) {
                            removeProduct(id);
                            toast({
                              title: "비교에서 제거됨",
                              description: "비교 대상에서 제거되었습니다.",
                            });
                          } else {
                            addProduct(id);
                            toast({
                              title: "비교에 추가됨",
                              description: "비교 대상에 추가되었습니다.",
                            });
                          }
                        }}
                      >
                          <GitCompare className="w-4 h-4" />
                          비교 추가
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* §PD-flat P4(시안) — stock-mini: 재고 동선 실연결(/dashboard/inventory). dead button 0. */}
                <Link
                  href="/dashboard/inventory"
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-[13px] px-4 py-3 shadow-sm hover:border-blue-300 transition-colors"
                >
                  <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 text-xs text-slate-600">재고 현황을 <b className="font-semibold text-slate-900">재고 조회</b>로 확인하세요</span>
                  <span className="text-xs font-bold text-blue-700">조회</span>
                </Link>

                {/* 맞춤 견적 배너(다크) — 영업 동선 실연결(/support). no-op 제거. */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white text-center shadow-lg">
                  <p className="text-sm text-gray-300 mb-2">대량 구매 또는 특수 요구사항이 있으신가요?</p>
                  <h4 className="font-bold text-lg mb-4">맞춤 견적 문의</h4>
                  <Link href="/support" className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors border border-white/10">
                    영업 담당자 연결 <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* §1-2⑥ 리뷰 섹션 제거(리뷰 liquidity 0). 추천 섹션은 유지. */}
          <div className="mt-8">
            {/* 대체품 추천 */}
            <AlternativeProductsSection productId={id} currentProduct={product} />
            
            {/* 개인화 추천 제품 */}
            {/* §1-2⑤ — category 고정: 상세 맥락 cross-category 추천 noise 차단 */}
            <PersonalizedRecommendations productId={id} currentProduct={product} category={product?.category} />
          </div>
        </div>
      </div>

      {/* 모바일 전용 하단 고정 바 */}
      <div className="fixed bottom-0 left-0 w-full bg-pn/95 backdrop-blur border-t border-bd p-4 z-50 lg:hidden shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0 mr-4">
            {vendors.length > 0 && vendors[0].priceInKRW && vendors[0].priceInKRW > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">
                  ₩{vendors[0].priceInKRW.toLocaleString()}
                </span>
                <span className="text-sm font-medium text-gray-400">KRW</span>
              </div>
            ) : (
              <div className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-sm font-bold text-blue-700">견적가 안내 품목</div>
            )}
          </div>
        </div>
        {/* 납기 정보 - 아이콘 없이 텍스트만 */}
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <Calendar className="w-3 h-3" /> 납기
          </span>
          <span className="text-xs font-medium text-gray-700 text-right">견적 시 안내</span>
        </div>
        <div className="flex items-center justify-end">
          <Button
            className="flex-shrink-0 py-3 px-6 bg-[#2f6be0] hover:bg-[#2456bd] text-white rounded-xl font-bold text-base shadow-sm transition-colors flex items-center justify-center gap-2"
            onClick={() => {
              // #quote-cta-truth — 모바일 하단 바도 동일 truth 결선 (fake success 0)
              if (inQuoteCart) {
                toast({
                  title: "이미 견적함에 있습니다",
                  description: "견적 요청 화면에서 수량·벤더를 조정할 수 있습니다.",
                });
                return;
              }
              const result = addToQuoteCart(product);
              if (result.ok) {
                setInQuoteCart(true);
                window.dispatchEvent(new Event("quote-cart-changed")); // §PD-D 트레이 갱신
                toast({
                  title: "견적 담기 완료",
                  description: "제품이 견적함에 추가되었습니다.",
                });
              } else {
                toast({
                  title: "견적 담기 실패",
                  description: "제품 정보를 확인할 수 없습니다.",
                  variant: "destructive",
                });
              }
            }}
          >
            <ShoppingCart className="w-5 h-5" />
            {inQuoteCart ? "견적함에 담김" : "견적 담기"}
          </Button>
        </div>
        {/* §product-detail PD-A(§06) — 견적 신뢰 문구(모바일). */}
        <p className="text-[10px] text-slate-500 text-center mt-1">견적 요청은 무료이며 구매 의무가 없습니다.</p>
      </div>

      {/* §product-detail PD-D(§09) — 견적함 정직 트레이바(데스크탑). 비교 destination 없어 견적함만(dead button 0). */}
      <QuoteTrayBar />

      {/* #catalog-spec-backfill ② — 규격 편집 모달 (safety 모달 동형) */}
      {isSpecEditing && (
        <Dialog open={isSpecEditing} onOpenChange={(open) => !open && setIsSpecEditing(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>규격/용량 편집</DialogTitle>
              <DialogDescription>
                카탈로그 규격 정보를 입력합니다. 저장 시 상세 스펙과 소싱 비교에 즉시 반영됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="spec-input">규격/용량</Label>
              <Input
                id="spec-input"
                value={specForm}
                onChange={(e) => setSpecForm(e.target.value)}
                placeholder="예: 500mL, 1L, 100g, 0.22μm"
                maxLength={200}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsSpecEditing(false)} disabled={isSavingSpec}>
                취소
              </Button>
              <Button onClick={saveSpecification} disabled={isSavingSpec} className="flex-1">
                {isSavingSpec ? "저장 중..." : "저장"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 안전 필드 편집 모달 */}
      {isSafetyEditing && (
        <Dialog open={isSafetyEditing} onOpenChange={(open) => !open && setIsSafetyEditing(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>안전 · 규제 정보 편집</DialogTitle>
              <DialogDescription>
                위험 코드, 피크토그램, 개인보호장비는 콤마(,)로 구분해 입력하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs">위험 코드</Label>
                <Input
                  value={safetyForm.hazardCodes}
                  onChange={(e) => setSafetyForm({ ...safetyForm, hazardCodes: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">GHS 피크토그램</Label>
                <Input
                  value={safetyForm.pictograms}
                  onChange={(e) => setSafetyForm({ ...safetyForm, pictograms: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">필수 개인보호장비</Label>
                <Input
                  value={safetyForm.ppe}
                  onChange={(e) => setSafetyForm({ ...safetyForm, ppe: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">보관 조건</Label>
                <Textarea
                  rows={2}
                  value={safetyForm.storageCondition}
                  onChange={(e) => setSafetyForm({ ...safetyForm, storageCondition: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">안전 취급 요약</Label>
                <Textarea
                  rows={3}
                  value={safetyForm.safetyNote}
                  onChange={(e) => setSafetyForm({ ...safetyForm, safetyNote: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsSafetyEditing(false)} className="flex-1">
                  취소
                </Button>
                <Button onClick={saveSafetyInfo} disabled={isSavingSafety} className="flex-1">
                  {isSavingSafety ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    "저장"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// 대체품 추천 섹션
function AlternativeProductsSection({ 
  productId, 
  currentProduct 
}: { 
  productId: string; 
  currentProduct: any;
}) {
  const { data: alternatives, isLoading } = useQuery({
    queryKey: ["product-alternatives", productId],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/alternatives?limit=3`);
      if (!response.ok) return { alternatives: [] };
      return response.json();
    },
    enabled: !!productId,
  });

  const { addProduct, removeProduct, hasProduct } = useCompareStore();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm rounded-[18px] p-6 md:p-8 border border-gray-200 mt-6">
        <CardContent>
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!alternatives?.alternatives || alternatives.alternatives.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white shadow-sm rounded-[18px] p-6 md:p-8 border border-gray-200 mt-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">대체품 추천</CardTitle>
        <CardDescription>유사 스펙의 대체 제품을 찾았습니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {alternatives.alternatives.map((alt: any) => {
            const minPrice = alt.vendors?.[0]?.priceInKRW;
            const isInCompare = hasProduct(alt.id);

            return (
              <Card key={alt.id} className="border-gray-200 hover:border-blue-300 hover:shadow-sm rounded-xl transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2.5">
                    {alt.imageUrl ? (
                      <Image
                        src={alt.imageUrl}
                        alt={alt.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm line-clamp-2">
                        <Link href={`/products/${alt.id}`} className="hover:underline">
                          {alt.name}
                        </Link>
                      </CardTitle>
                      {alt.brand && (
                        <CardDescription className="text-xs mt-0.5">{alt.brand}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {/* §product-detail PD-G(§08) — 분류·Cat.No (시안 카드 = 제품명·분류·Cat.No). */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {alt.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {PRODUCT_CATEGORIES[alt.category as keyof typeof PRODUCT_CATEGORIES] ?? alt.category}
                      </span>
                    )}
                    {alt.catalogNumber && (
                      <span className="text-[10px] text-slate-500 font-mono">Cat.No {alt.catalogNumber}</span>
                    )}
                  </div>
                  {/* §product-detail PD-G(§08) — "왜 대체 가능한지" 유사 근거 태그. grade 누출 방지: "Grade" 근거 제외(§sourcing-product-surface 정합). */}
                  {Array.isArray(alt.similarityReasons) &&
                    alt.similarityReasons.filter((r: string) => !/grade/i.test(r)).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {alt.similarityReasons
                          .filter((r: string) => !/grade/i.test(r))
                          .slice(0, 3)
                          .map((r: string, i: number) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                              {r}
                            </span>
                          ))}
                      </div>
                    )}
                  {minPrice !== undefined && (
                    <div className="text-sm font-semibold">
                      ₩{minPrice.toLocaleString("ko-KR")}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        if (isInCompare) {
                          removeProduct(alt.id);
                        } else {
                          addProduct(alt.id);
                        }
                        toast({
                          title: isInCompare ? "비교에서 제거됨" : "비교에 추가됨",
                        });
                      }}
                    >
                      <GitCompare className="h-3 w-3 mr-1" />
                      {isInCompare ? "비교 제거" : "비교"}
                    </Button>
                    {/* §product-detail PD-G(§08) — 상세(제품 간 이동, §09 연결). */}
                    <Link
                      href={`/products/${alt.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-0.5 text-xs border border-gray-200 rounded-md px-2 py-1.5 hover:bg-slate-50 text-slate-700"
                    >
                      상세 <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
