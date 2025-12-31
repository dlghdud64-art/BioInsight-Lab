"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  ShoppingCart,
  Heart,
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
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Zap,
  Info,
  Calendar,
  Clock,
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
import { ReviewSection } from "@/components/products/review-section";
import { PersonalizedRecommendations } from "@/components/products/personalized-recommendations";
import { Disclaimer } from "@/components/legal/disclaimer";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const { data: fetchedProduct, isLoading, error } = useProduct(id);
  const { addProduct, removeProduct, hasProduct } = useCompareStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [generatedUsage, setGeneratedUsage] = useState<string | null>(null);
  const [isGeneratingUsage, setIsGeneratingUsage] = useState(false);
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

  // 즐겨찾기 확인
  useEffect(() => {
    if (id && session) {
      fetch(`/api/favorites?productId=${id}`)
        .then((res) => res.json())
        .then((data) => setIsFavorite(data.isFavorite || false))
        .catch(() => {});
    }
  }, [id, session]);

  // 제품 조회 기록
  useEffect(() => {
    if (id && session) {
      fetch(`/api/products/${id}/view`, { method: "POST" }).catch(() => {});
    }
  }, [id, session]);

  const toggleFavorite = async () => {
    if (!session) {
      toast({
        title: "로그인 필요",
        description: "즐겨찾기를 사용하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsTogglingFavorite(true);
    try {
      const response = await fetch(`/api/favorites`, {
        method: isFavorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      });

      if (response.ok) {
        setIsFavorite(!isFavorite);
        toast({
          title: isFavorite ? "즐겨찾기 제거됨" : "즐겨찾기 추가됨",
        });
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "즐겨찾기 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleTranslate = async () => {
    if (!product.descriptionEn) return;
    setIsTranslating(true);
    try {
      const response = await fetch("/api/translate", {
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
    <div className="min-h-screen bg-gray-50/50 pb-20 lg:pb-32 relative">
      {/* 배경 그라데이션 데코레이션 */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/50 via-transparent to-transparent -z-10 pointer-events-none" />
      
      <div className="container mx-auto px-4 md:px-4 lg:px-8 pt-16 md:pt-6 md:py-8 relative z-0">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-center text-sm text-gray-500 overflow-x-auto whitespace-nowrap">
              <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
              <ChevronRight className="w-4 h-4 mx-2 text-gray-300" />
              <Link href="/search" className="hover:text-blue-600 transition-colors">검색 결과</Link>
              <ChevronRight className="w-4 h-4 mx-2 text-gray-300" />
              <span className="font-semibold text-gray-800 truncate">{product.name}</span>
            </div>
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-8 lg:gap-10">
            {/* 제품 정보 (8칸) */}
            <div className="lg:col-span-8 space-y-6 md:space-y-8">
              {/* 상단: 제품명, 벤더, 카테고리, Grade/규격 배지 */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-sm rounded-3xl p-6 md:p-8 border border-gray-100/50 relative overflow-hidden group">
                {/* 배경 효과 */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/30 rounded-full blur-3xl opacity-50 -mr-16 -mt-16 transition-all group-hover:opacity-70 -z-0" />
                <CardHeader className="px-0 pt-0 pb-4 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-4">
                        {product.grade && (
                          <Badge className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wide rounded-full">
                            {product.grade}
                          </Badge>
                        )}
                        {/* 재고 상태는 표시하지 않음 (확실하지 않은 정보) */}
                      </div>
                      <CardTitle className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight mb-3 break-words">{product.name}</CardTitle>
                      {product.nameEn && (
                        <CardDescription className="text-sm md:text-base break-words">{product.nameEn}</CardDescription>
                      )}
                      {product.vendors?.[0]?.vendor?.name && (
                        <p className="text-xs md:text-sm text-slate-600 mt-1">
                          {product.vendors[0].vendor.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:gap-2 mt-3 md:mt-4">
                    {product.category && (
                      <Badge variant="outline" className="text-[10px] md:text-sm">
                        {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                      </Badge>
                    )}
                    {product.grade && (
                      <Badge variant="secondary" className="text-[10px] md:text-sm">
                        {product.grade}
                      </Badge>
                    )}
                    {product.brand && (
                      <Badge variant="outline" className="text-[10px] md:text-sm">
                        {product.brand}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* 실험/제품 정보 블록 */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-sm rounded-3xl p-6 md:p-8 border border-gray-100/50 relative overflow-hidden group">
                {/* 배경 효과 */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/20 rounded-full blur-3xl opacity-30 -mr-12 -mt-12 transition-all group-hover:opacity-50 -z-0" />
                <CardHeader className="px-0 pt-0 pb-3">
                  <CardTitle className="text-sm md:text-lg">실험/제품 정보</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0 space-y-4 md:space-y-6 relative z-10">
                  {product.imageUrl ? (
                    <div className="w-full aspect-square max-w-md mx-auto">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-contain rounded-lg border border-gray-200"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-square max-w-md mx-auto bg-gray-100 rounded-xl flex items-center justify-center">
                      <Package className="h-16 w-16 text-gray-300" strokeWidth={1.5} />
                    </div>
                  )}

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
                        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
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

                  {product.catalogNumber && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm">Cat.No (카탈로그 번호)</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(product.catalogNumber);
                              toast({
                                title: "복사 완료",
                                description: "카탈로그 번호가 클립보드에 복사되었습니다.",
                              });
                            } catch (error) {
                              toast({
                                title: "복사 실패",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="h-7 text-xs"
                        >
                          <ClipboardCopy className="h-3 w-3 mr-1" />
                          복사
                        </Button>
                      </div>
                      <p className="text-sm text-slate-700 font-mono">{product.catalogNumber}</p>
                    </div>
                  )}

                  {/* 주요 스펙 요약 카드 - Data Grid 스타일 (Glassmorphism) */}
                  <div className="mb-6 md:mb-8">
                    <div className="px-6 md:px-8 py-4 border-b border-gray-100/50 flex items-center gap-3 bg-gray-50/30 rounded-t-3xl">
                      <Check className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-900">상세 스펙 (Specifications)</h3>
                    </div>
                    <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 bg-white/50 rounded-b-3xl">
                      {(product.grade || product.specification || product.catalogNumber || product.regulatoryCompliance || product.brand || product.category) ? (
                        <>
                          {product.grade && (
                            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-gray-50/80 hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100/50">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</span>
                              <span className="text-base md:text-lg font-bold text-gray-900 break-words">{product.grade}</span>
                            </div>
                          )}
                          {product.specification && (
                            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-gray-50/80 hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100/50">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">규격/용량</span>
                              <span className="text-base md:text-lg font-bold text-gray-900 break-words line-clamp-2">{product.specification}</span>
                            </div>
                          )}
                          {product.catalogNumber && (
                            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-gray-50/80 hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100/50">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">카탈로그 번호</span>
                              <span className="text-base md:text-lg font-mono font-bold text-gray-900 break-words">{product.catalogNumber}</span>
                            </div>
                          )}
                          {product.regulatoryCompliance && (
                            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-gray-50/80 hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100/50">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">규제 규격</span>
                              <span className="text-base md:text-lg font-bold text-gray-900 break-words">{product.regulatoryCompliance}</span>
                            </div>
                          )}
                          {product.brand && (
                            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-gray-50/80 hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100/50">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">브랜드</span>
                              <span className="text-base md:text-lg font-bold text-gray-900 break-words">{product.brand}</span>
                            </div>
                          )}
                          {product.category && (
                            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-gray-50/80 hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100/50">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">카테고리</span>
                              <span className="text-base md:text-lg font-bold text-gray-900 break-words">
                                {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="col-span-full text-center text-gray-400 py-8">등록된 상세 스펙이 없습니다.</div>
                      )}
                    </div>
                  </div>

                  {/* 상세 스펙 정보 - Data Grid 스타일 (추가 스펙) */}
                  {product.specifications && typeof product.specifications === "object" && Object.keys(product.specifications).length > 0 && (
                    <div className="mb-6 md:mb-8">
                      <div className="px-6 md:px-8 py-4 border-b border-gray-100/50 flex items-center gap-3 bg-gray-50/30 rounded-t-3xl">
                        <Check className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-900">추가 스펙 정보</h3>
                      </div>
                      <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 bg-white/50 rounded-b-3xl">
                        {Object.entries(product.specifications as Record<string, any>).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1 p-4 rounded-2xl bg-gray-50/80 hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100/50">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{key}</span>
                            <span className="text-base md:text-lg font-bold text-gray-900 break-words">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 사용 용도 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm md:text-base">사용 용도</h3>
                      {!generatedUsage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setIsGeneratingUsage(true);
                            try {
                              const response = await fetch(`/api/products/${id}/usage`, { method: "POST" });
                              if (response.ok) {
                                const data = await response.json();
                                setGeneratedUsage(data.usageDescription);
                                toast({
                                  title: "사용 용도 생성 완료",
                                  description: "GPT 기반 사용 용도 설명이 생성되었습니다.",
                                });
                              }
                            } catch (error) {
                              toast({
                                title: "생성 실패",
                                variant: "destructive",
                              });
                            } finally {
                              setIsGeneratingUsage(false);
                            }
                          }}
                          disabled={isGeneratingUsage}
                        >
                          {isGeneratingUsage ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              생성 중...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 mr-2" />
                              AI로 생성
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {(product.usageDescription || generatedUsage) ? (
                      <p className="text-xs md:text-sm text-slate-700 whitespace-pre-wrap">
                        {generatedUsage || product.usageDescription}
                      </p>
                    ) : (
                      <p className="text-xs md:text-sm text-slate-400 italic">
                        사용 용도 정보가 없습니다. "AI로 생성" 버튼을 클릭하여 생성할 수 있습니다.
                      </p>
                    )}
                  </div>

                  {/* 안전 · 규제 정보 - 항상 표시 */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-600" />
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
                              위험도: {safetyLevel.label}
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
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-amber-900 mb-1">안전 취급 요약</p>
                                <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">
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
                            <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded border border-slate-200">
                              MSDS/SDS 문서 정보가 없습니다.
                            </div>
                          )}
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
                                      className="flex items-start gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors group"
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
                        <div className="space-y-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-3">
                            <Shield className="h-4 w-4 text-blue-600" />
                            <div className="text-xs font-semibold text-slate-900">국내 규제기관 포털</div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {getRegulationLinksForProduct(
                              product.name,
                              product.catalogNumber || undefined,
                              product.category
                            ).map((link) => (
                              <Button
                                key={link.id}
                                variant="outline"
                                size="sm"
                                className="text-xs border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700"
                                onClick={() => {
                                  window.open(link.url, "_blank");
                                }}
                                title={link.description}
                              >
                                <ExternalLink className="h-3 w-3 mr-1.5" />
                                <span className="truncate">{link.name}</span>
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
              <div className="sticky top-24 space-y-6">
                <Card className="bg-white/90 backdrop-blur-sm shadow-xl shadow-blue-900/5 rounded-3xl p-6 md:p-8 border border-gray-100/50 relative overflow-hidden">
                  {/* 상단 강조 선 */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                  <CardHeader className="px-0 pt-2 pb-6">
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        공급가 (VAT 별도)
                      </p>
                    </div>
                    <CardTitle className="text-base font-semibold text-gray-900 mb-2">가격 정보</CardTitle>
                    {product.vendors?.[0]?.vendor?.name && (
                      <p className="text-sm text-gray-600 mt-1">{product.vendors[0].vendor.name}</p>
                    )}
                    {product.catalogNumber && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">Cat.No: {product.catalogNumber}</p>
                    )}
                  </CardHeader>
                  <CardContent className="px-0 space-y-4">
                    {vendors.length > 0 ? (
                      <div className="space-y-3 mb-6">
                        {vendors.map((pv: any) => (
                          <div
                            key={pv.id}
                            className="border border-gray-200/50 rounded-xl p-4 space-y-2 bg-gray-50/50 backdrop-blur-sm"
                          >
                            {pv.vendor?.name && (
                              <div className="text-sm font-medium text-gray-700">{pv.vendor.name}</div>
                            )}
                            {pv.priceInKRW && pv.priceInKRW > 0 ? (
                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                                  ₩{pv.priceInKRW.toLocaleString()}
                                </span>
                                <span className="text-lg font-medium text-gray-400">KRW</span>
                              </div>
                            ) : (
                              <div className="text-base font-semibold text-gray-500">가격 문의</div>
                            )}
                            {/* 재고/납기 정보는 표시하지 않음 (확실하지 않은 정보) */}
                            <div className="space-y-2 pt-2">
                              <div className="flex items-center justify-between p-2 bg-white/50 rounded-lg">
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
                      <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl md:text-4xl font-extrabold text-gray-400 tracking-tight">가격 문의</span>
                        </div>
                      </div>
                    )}

                    {/* CTA 버튼 */}
                    <div className="space-y-3 pt-6 border-t border-gray-200/50">
                      <Button
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-blue-500/25 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/products/${id}`);
                            if (response.ok) {
                              toast({
                                title: "견적 담기 완료",
                                description: "제품이 견적 요청 리스트에 추가되었습니다.",
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "추가 실패",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        견적 담기
                      </Button>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className="py-3 bg-white/80 border border-gray-200/50 hover:border-blue-400 text-gray-700 hover:text-blue-600 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
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
                          바로 비교
                        </Button>
                        <Button
                          variant="outline"
                          className="py-3 bg-white/80 border border-gray-200/50 hover:border-red-400 text-gray-700 hover:text-red-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                          onClick={toggleFavorite}
                          disabled={isTogglingFavorite}
                        >
                          <Heart
                            className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
                          />
                          찜하기
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 추가 배너 */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white text-center shadow-lg">
                  <p className="text-sm text-gray-300 mb-2">대량 구매 또는 특수 요구사항이 있으신가요?</p>
                  <h4 className="font-bold text-lg mb-4">맞춤 견적 문의</h4>
                  <button className="text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors border border-white/10">
                    영업 담당자 연결 →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 리뷰 섹션 */}
          <div className="mt-8">
            <ReviewSection productId={id} />
            
            {/* 대체품 추천 */}
            <AlternativeProductsSection productId={id} currentProduct={product} />
            
            {/* 개인화 추천 제품 */}
            <PersonalizedRecommendations productId={id} currentProduct={product} />
          </div>
        </div>
      </div>

      {/* 모바일 전용 하단 고정 바 */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-50 lg:hidden shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0 mr-4">
            {vendors.length > 0 && vendors[0].priceInKRW && vendors[0].priceInKRW > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-gray-900">
                  ₩{vendors[0].priceInKRW.toLocaleString()}
                </span>
                <span className="text-sm font-medium text-gray-400">KRW</span>
              </div>
            ) : (
              <div className="text-base font-semibold text-gray-500">가격 문의</div>
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
            className="flex-shrink-0 py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-base shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
            onClick={async () => {
              try {
                const response = await fetch(`/api/products/${id}`);
                if (response.ok) {
                  toast({
                    title: "견적 담기 완료",
                    description: "제품이 견적 요청 리스트에 추가되었습니다.",
                  });
                }
              } catch (error) {
                toast({
                  title: "추가 실패",
                  variant: "destructive",
                });
              }
            }}
          >
            <ShoppingCart className="w-5 h-5" />
            견적 담기
          </Button>
        </div>
      </div>

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
      <Card className="bg-white/80 backdrop-blur-sm shadow-sm rounded-3xl p-6 md:p-8 border border-gray-100/50 mt-6">
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
    <Card className="bg-white/80 backdrop-blur-sm shadow-sm rounded-3xl p-6 md:p-8 border border-gray-100/50 mt-6">
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
              <Card key={alt.id} className="hover:-translate-y-1 hover:shadow-md rounded-xl transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    {alt.imageUrl ? (
                      <Image
                        src={alt.imageUrl}
                        alt={alt.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-300" />
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
                  {minPrice !== undefined && (
                    <div className="text-sm font-semibold">
                      ₩{minPrice.toLocaleString("ko-KR")}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
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
                    {isInCompare ? "비교 제거" : "비교 추가"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
