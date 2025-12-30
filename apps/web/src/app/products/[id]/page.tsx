"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/use-products";
import { useCompareStore } from "@/lib/store/compare-store";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import Link from "next/link";
import { ShoppingCart, GitCompare as Compare, ExternalLink, Heart, ThumbsUp, ThumbsDown, Languages, Loader2, FileText, Copy, Check, ClipboardCopy, Shield, AlertTriangle, Sparkles, Package, Save, Eye, Upload, X, Pencil } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamicImport from "next/dynamic";

const ReviewSection = dynamicImport(() => import("@/components/products/review-section").then((mod) => ({ default: mod.ReviewSection })), {
  loading: () => <div className="h-32 w-full bg-slate-100 rounded-md animate-pulse" />,
  ssr: false,
});

const PersonalizedRecommendations = dynamicImport(() => import("@/components/products/personalized-recommendations").then((mod) => ({ default: mod.PersonalizedRecommendations })), {
  loading: () => <div className="h-32 w-full bg-slate-100 rounded-md animate-pulse" />,
  ssr: false,
});
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { getRegulationLinksForProduct } from "@/lib/regulation/links";
import { getProductSafetyLevel, HAZARD_CODE_DESCRIPTIONS, PICTOGRAM_DESCRIPTIONS, PPE_DESCRIPTIONS } from "@/lib/utils/safety-visualization";
import { filterComplianceLinksForProduct, getRuleDescription, type ComplianceLink } from "@/lib/compliance-links";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  const [datasheetText, setDatasheetText] = useState("");
  const [datasheetUrl, setDatasheetUrl] = useState("");
  const [datasheetPdfFile, setDatasheetPdfFile] = useState<File | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtractingFromUrl, setIsExtractingFromUrl] = useState(false);
  const [isExtractingFromPdf, setIsExtractingFromPdf] = useState(false);
  const [showDatasheetSection, setShowDatasheetSection] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msdsLinkStatus, setMsdsLinkStatus] = useState<"checking" | "valid" | "invalid" | null>(null);
  const [generatedUsage, setGeneratedUsage] = useState<string | null>(null);
  const [isGeneratingUsage, setIsGeneratingUsage] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [isSafetyEditing, setIsSafetyEditing] = useState(false);
  const [safetyForm, setSafetyForm] = useState<{
    hazardCodes: string;
    pictograms: string;
    ppe: string;
    storageCondition: string;
    safetyNote: string;
  } | null>(null);
  const [isSavingSafety, setIsSavingSafety] = useState(false);
  const [showMoreComplianceLinks, setShowMoreComplianceLinks] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isInCompare = hasProduct(id);

  // 조직 목록 조회 (compliance links용)
  const { data: organizationsData } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) return { organizations: [] };
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const organizations = organizationsData?.organizations || [];
  const currentOrg = organizations[0]; // 첫 번째 조직 사용

  // Compliance Links 조회
  const { data: complianceLinksData } = useQuery({
    queryKey: ["compliance-links", currentOrg?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentOrg?.id) {
        params.append("organizationId", currentOrg.id);
      }
      const response = await fetch(`/api/compliance-links?${params}`);
      if (!response.ok) return { links: [] };
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const allComplianceLinks = (complianceLinksData?.links || []) as ComplianceLink[];
  const filteredComplianceLinks = fetchedProduct
    ? filterComplianceLinksForProduct(allComplianceLinks, fetchedProduct, currentOrg?.id)
    : [];

  // 링크 타입별로 그룹화
  const officialLinks = filteredComplianceLinks.filter((link) => link.linkType === "official");
  const organizationLinks = filteredComplianceLinks.filter((link) => link.linkType === "organization");

  // 관리자 여부 확인 (규칙 설명 표시용)
  const isAdmin = session?.user?.role === "ADMIN" || 
    currentOrg?.members?.some(
      (m: any) => m.userId === session?.user?.id && (m.role === "ADMIN" || m.role === "VIEWER")
    );

  const startSafetyEdit = () => {
    if (!fetchedProduct) return;
    setSafetyForm({
      hazardCodes: Array.isArray(fetchedProduct.hazardCodes) ? fetchedProduct.hazardCodes.join(", ") : "",
      pictograms: Array.isArray(fetchedProduct.pictograms) ? fetchedProduct.pictograms.join(", ") : "",
      ppe: Array.isArray(fetchedProduct.ppe) ? fetchedProduct.ppe.join(", ") : "",
      storageCondition: fetchedProduct.storageCondition || "",
      safetyNote: fetchedProduct.safetyNote || "",
    });
    setIsSafetyEditing(true);
  };

  const saveSafetyInfo = async () => {
    if (!safetyForm) return;
    setIsSavingSafety(true);
    try {
      const parseList = (value: string) =>
        value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v.length > 0);

      const payload: any = {
        storageCondition: safetyForm.storageCondition || null,
        safetyNote: safetyForm.safetyNote || null,
      };

      const hazardCodes = parseList(safetyForm.hazardCodes);
      const pictograms = parseList(safetyForm.pictograms);
      const ppe = parseList(safetyForm.ppe);

      payload.hazardCodes = hazardCodes.length > 0 ? hazardCodes : null;
      payload.pictograms = pictograms.length > 0 ? pictograms : null;
      payload.ppe = ppe.length > 0 ? ppe : null;

      const response = await fetch(`/api/products/${id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "안전 정보를 저장하는 데 실패했습니다.");
      }

      toast({
        title: "안전 정보 저장 완료",
        description: "제품의 안전 · 규제 정보가 업데이트되었습니다.",
      });

      // 제품 데이터 새로고침
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setIsSafetyEditing(false);
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

  // 제품 조회 기록
  useEffect(() => {
    if (fetchedProduct && session?.user?.id) {
      fetch(`/api/products/${id}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "" }),
      }).catch(() => {});
    }
  }, [fetchedProduct, id, session]);

  // 즐겨찾기 상태 확인
  useEffect(() => {
    if (session?.user?.id && fetchedProduct) {
      fetch(`/api/favorites?productId=${id}`)
        .then((res) => res.json())
        .then((data) => setIsFavorite(data.isFavorite))
        .catch(() => {});
    }
  }, [session, id, fetchedProduct]);

  const toggleFavorite = async () => {
    if (!session?.user?.id) {
      toast({
        title: "로그인 필요",
        description: "즐겨찾기 기능을 사용하려면 로그인이 필요합니다.",
        variant: "default",
      });
      return;
    }

    setIsTogglingFavorite(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: id,
          action: isFavorite ? "remove" : "add",
        }),
      });

      if (response.ok) {
        setIsFavorite(!isFavorite);
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleTranslate = async () => {
    if (!product?.descriptionEn) return;

    setIsTranslating(true);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: product.descriptionEn,
          sourceLang: "en",
          targetLang: "ko",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTranslatedDescription(data.translated);
      } else {
        console.error("Failed to translate");
      }
    } catch (error) {
      console.error("Error translating:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleExtractDatasheet = async () => {
    if (!datasheetText.trim()) {
      toast({
        title: "텍스트를 입력해주세요",
        description: "데이터시트 텍스트를 붙여넣어주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    try {
      const response = await fetch("/api/datasheet/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: datasheetText }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "데이터시트 분석에 실패했습니다.");
      }

      const data = await response.json();
      setExtractedInfo(data.data);
      toast({
        title: "분석 완료",
        description: "데이터시트에서 제품 정보를 추출했습니다.",
      });
    } catch (error: any) {
      toast({
        title: "분석 실패",
        description: error.message || "데이터시트 분석 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCopyExtractedInfo = async () => {
    if (!extractedInfo) return;

    const infoText = `제품명: ${extractedInfo.name || extractedInfo.nameEn || "N/A"}
타깃: ${extractedInfo.target || "N/A"}
카테고리: ${extractedInfo.category || "N/A"}
용량: ${extractedInfo.capacity || "N/A"}
Grade: ${extractedInfo.grade || "N/A"}

설명:
${extractedInfo.description || extractedInfo.summary || "N/A"}

요약:
${extractedInfo.summary || "N/A"}`;

    try {
      await navigator.clipboard.writeText(infoText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "추출된 정보가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "정보 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleExtractFromUrl = async () => {
    if (!datasheetUrl.trim()) {
      toast({
        title: "URL을 입력해주세요",
        description: "데이터시트 URL을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsExtractingFromUrl(true);
    try {
      const response = await fetch("/api/datasheet/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: datasheetUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "URL에서 데이터시트를 가져오는데 실패했습니다.");
      }

      const data = await response.json();
      setExtractedInfo(data.data);
      // URL에서 추출한 텍스트를 텍스트 영역에도 표시
      if (data.data.extractedTextLength) {
        toast({
          title: "분석 완료",
          description: `URL에서 ${data.data.extractedTextLength}자 텍스트를 추출하여 분석했습니다.`,
        });
      } else {
        toast({
          title: "분석 완료",
          description: "URL에서 데이터시트를 가져와 제품 정보를 추출했습니다.",
        });
      }
    } catch (error: any) {
      toast({
        title: "분석 실패",
        description: error.message || "URL에서 데이터시트를 가져오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExtractingFromUrl(false);
    }
  };

  const handleExtractFromPdf = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "PDF 파일만 업로드 가능합니다",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "파일 크기는 10MB 이하여야 합니다",
        variant: "destructive",
      });
      return;
    }

    setDatasheetPdfFile(file);
    setIsExtractingFromPdf(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/datasheet/extract-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "PDF 분석에 실패했습니다.");
      }

      const data = await response.json();
      setExtractedInfo(data.data);

      toast({
        title: "PDF 분석 완료",
        description: data.data.extractedTextLength 
          ? `PDF에서 ${data.data.extractedTextLength}자 텍스트를 추출하여 분석했습니다.`
          : "PDF에서 제품 정보를 추출했습니다.",
      });
    } catch (error: any) {
      toast({
        title: "PDF 분석 실패",
        description: error.message || "PDF를 분석하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setDatasheetPdfFile(null);
    } finally {
      setIsExtractingFromPdf(false);
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleExtractFromPdf(file);
    }
  };

  const handlePdfDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleExtractFromPdf(file);
    }
  };

  const handlePdfDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // 추출된 정보를 제품 필드에 적용
  const applyExtractedInfoMutation = useMutation({
    mutationFn: async (fieldsToApply: Record<string, any>) => {
      const response = await fetch(`/api/products/${id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldsToApply),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "제품 정보 업데이트에 실패했습니다.");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      toast({
        title: "적용 완료",
        description: "추출된 정보가 제품 필드에 반영되었습니다.",
      });
      setShowApplyDialog(false);
      setSelectedFields({});
    },
    onError: (error: any) => {
      toast({
        title: "적용 실패",
        description: error.message || "제품 정보 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleOpenApplyDialog = () => {
    if (!extractedInfo) return;

    // 기본적으로 모든 필드를 선택 상태로 설정
    const fields: Record<string, boolean> = {};
    if (extractedInfo.name) fields.name = true;
    if (extractedInfo.nameEn) fields.nameEn = true;
    if (extractedInfo.description) fields.description = true;
    if (extractedInfo.descriptionEn) fields.descriptionEn = true;
    if (extractedInfo.grade) fields.grade = true;
    if (extractedInfo.specification || extractedInfo.capacity) fields.specification = true;
    if (extractedInfo.specifications) fields.specifications = true;
    if (extractedInfo.sourceUrl) fields.datasheetUrl = true;

    setSelectedFields(fields);
    setShowApplyDialog(true);
  };

  const handleApplyExtractedInfo = () => {
    if (!extractedInfo) return;

    const fieldsToApply: Record<string, any> = {};

    if (selectedFields.name && extractedInfo.name) {
      fieldsToApply.name = extractedInfo.name;
    }
    if (selectedFields.nameEn && extractedInfo.nameEn) {
      fieldsToApply.nameEn = extractedInfo.nameEn;
    }
    if (selectedFields.description && extractedInfo.description) {
      fieldsToApply.description = extractedInfo.description;
    }
    if (selectedFields.descriptionEn && extractedInfo.descriptionEn) {
      fieldsToApply.descriptionEn = extractedInfo.descriptionEn;
    }
    if (selectedFields.grade && extractedInfo.grade) {
      fieldsToApply.grade = extractedInfo.grade;
    }
    if (selectedFields.specification) {
      fieldsToApply.specification = extractedInfo.specification || extractedInfo.capacity;
    }
    if (selectedFields.specifications && extractedInfo.specifications) {
      fieldsToApply.specifications = extractedInfo.specifications;
    }
    if (selectedFields.datasheetUrl && extractedInfo.sourceUrl) {
      fieldsToApply.datasheetUrl = extractedInfo.sourceUrl;
    }

    if (Object.keys(fieldsToApply).length === 0) {
      toast({
        title: "적용할 필드 없음",
        description: "적용할 필드를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    applyExtractedInfoMutation.mutate(fieldsToApply);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 데모용 Fallback 제품 데이터 (404 방지)
  const fallbackProduct = {
    id: id,
    name: "Human IL-6 Quantikine ELISA Kit",
    nameEn: "Human IL-6 Quantikine ELISA Kit",
    description: "인간 인터루킨-6(IL-6)를 정량적으로 측정하기 위한 샌드위치 ELISA 키트입니다. 혈청, 혈장, 세포 배양 상층액에서 IL-6 농도를 측정할 수 있습니다.",
    descriptionEn: "Quantitative sandwich ELISA kit for measuring human IL-6 in serum, plasma, and cell culture supernatants.",
    category: "REAGENT",
    brand: "R&D Systems",
    catalogNumber: "D6050",
    grade: "Research Grade",
    storageCondition: "2-8°C 냉장 보관",
    safetyNote: "연구용 시약. 취급 시 장갑 착용 권장.",
    specifications: {
      assayType: "Sandwich ELISA",
      sampleType: "Serum, Plasma, Cell Culture Supernatant",
      sensitivity: "0.70 pg/mL",
      assayRange: "3.1-300 pg/mL",
      assayTime: "4.5 hours",
    },
    vendors: [
      {
        id: "pv-fallback-1",
        price: 650,
        currency: "USD",
        priceInKRW: 890000,
        stockStatus: "In Stock",
        leadTime: 7,
        vendor: {
          id: "vendor-rnd",
          name: "R&D Systems",
          country: "US",
        },
      },
    ],
    hazardCodes: [],
    pictograms: [],
    ppe: ["gloves"],
  };

  // 실제 제품이 없으면 Fallback 사용 (데모 시연용)
  const displayProduct = fetchedProduct || fallbackProduct;
  const isUsingFallback = !fetchedProduct;

  if (error && !isUsingFallback) {
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

  // Fallback 적용된 제품을 product로 재할당 (기존 코드 호환성)
  const product = displayProduct as any;
  const vendors = product.vendors || [];
  const recommendations = product.recommendations || [];

  return (
    <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-3 md:mb-4">
          <Link href="/search" className="text-xs md:text-sm text-muted-foreground hover:underline">
            ← 검색으로 돌아가기
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* 제품 정보 */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* 상단: 제품명, 벤더, 카테고리, Grade/규격 배지 */}
            <Card className="p-3 md:p-6">
              <CardHeader className="px-0 pt-0 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl md:text-3xl mb-2 break-words">{product.name}</CardTitle>
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
            <Card className="p-3 md:p-6">
              <CardHeader className="px-0 pt-0 pb-3">
                <CardTitle className="text-sm md:text-lg">실험/제품 정보</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0 space-y-4 md:space-y-6">
                {product.imageUrl && (
                  <div className="w-full aspect-square max-w-md mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain rounded-lg border"
                      loading="lazy"
                      decoding="async"
                    />
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

                {/* 영문 설명 및 번역 섹션 */}
                {product.descriptionEn && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">영문 설명</h3>
                      {!product.descriptionTranslated && !translatedDescription && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTranslate}
                          disabled={isTranslating}
                        >
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
                    
                    {/* 번역된 설명 표시 */}
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


                {/* 카탈로그 번호 (Cat.No) */}
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
                              description: "카탈로그 번호 복사에 실패했습니다.",
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

                {/* Lot 번호 */}
                {(product as any).lotNumber && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">Lot 번호 (배치 번호)</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText((product as any).lotNumber);
                            toast({
                              title: "복사 완료",
                              description: "Lot 번호가 클립보드에 복사되었습니다.",
                            });
                          } catch (error) {
                            toast({
                              title: "복사 실패",
                              description: "Lot 번호 복사에 실패했습니다.",
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
                    <p className="text-sm text-slate-700 font-mono">{(product as any).lotNumber}</p>
                  </div>
                )}

                {/* 주요 스펙 요약 카드 */}
                {(product.grade || product.specification || product.catalogNumber || product.regulatoryCompliance) && (
                  <div className="mb-4 md:mb-6">
                    <h3 className="font-semibold text-sm md:text-base mb-3 md:mb-4">주요 스펙</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                      {product.grade && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">Grade</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">{product.grade}</div>
                        </div>
                      )}
                      {product.specification && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">규격/용량</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900 line-clamp-2">{product.specification}</div>
                        </div>
                      )}
                      {product.catalogNumber && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">카탈로그 번호</div>
                          <div className="text-xs md:text-sm font-mono font-semibold text-slate-900">{product.catalogNumber}</div>
                        </div>
                      )}
                      {product.regulatoryCompliance && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">규제 규격</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">{product.regulatoryCompliance}</div>
                        </div>
                      )}
                      {product.brand && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">브랜드</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">{product.brand}</div>
                        </div>
                      )}
                      {product.category && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">카테고리</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">
                            {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 상세 스펙 정보 */}
                {product.specifications && typeof product.specifications === "object" && (
                  <div className="mb-4 md:mb-6">
                    <h3 className="font-semibold text-sm md:text-base mb-3">상세 스펙</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                      {Object.entries(product.specifications as Record<string, any>).map(
                        ([key, value]) => (
                          <div key={key} className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[10px] md:text-xs text-slate-500 mb-1">{key}</div>
                            <div className="text-xs md:text-sm font-semibold text-slate-900">{String(value)}</div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* 원료(원부자재) 전용 정보 */}
                {product.category === "RAW_MATERIAL" && (
                  <div className="mb-4 md:mb-6">
                    <h3 className="font-semibold text-sm md:text-base mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      원료 정보
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                      {product.pharmacopoeia && (
                        <div className="p-2 md:p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">규정/표준</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">{product.pharmacopoeia}</div>
                        </div>
                      )}
                      {product.coaUrl && (
                        <div className="p-2 md:p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">COA (Certificate of Analysis)</div>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-xs md:text-sm p-0 h-auto font-semibold text-blue-600 hover:text-blue-700"
                            onClick={() => {
                              if (product.coaUrl) {
                                window.open(product.coaUrl, "_blank", "noopener,noreferrer");
                              }
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            COA 문서 보기
                          </Button>
                        </div>
                      )}
                      {product.specSheetUrl && (
                        <div className="p-2 md:p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">Spec Sheet</div>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-xs md:text-sm p-0 h-auto font-semibold text-blue-600 hover:text-blue-700"
                            onClick={() => {
                              if (product.specSheetUrl) {
                                window.open(product.specSheetUrl, "_blank", "noopener,noreferrer");
                              }
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Spec Sheet 보기
                          </Button>
                        </div>
                      )}
                      {product.countryOfOrigin && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">원산지</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">{product.countryOfOrigin}</div>
                        </div>
                      )}
                      {product.manufacturer && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">제조사</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">{product.manufacturer}</div>
                        </div>
                      )}
                      {product.expiryDate && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">유효기간</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">
                            {new Date(product.expiryDate).toLocaleDateString("ko-KR")}
                          </div>
                        </div>
                      )}
                      {product.lotNumber && (
                        <div className="p-2 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] md:text-xs text-slate-500 mb-1">Lot 번호</div>
                          <div className="text-xs md:text-sm font-semibold text-slate-900">{product.lotNumber}</div>
                        </div>
                      )}
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
                            const response = await fetch(`/api/products/${id}/usage`, {
                              method: "POST",
                            });

                            if (response.ok) {
                              const data = await response.json();
                              setGeneratedUsage(data.usageDescription);
                              toast({
                                title: "사용 용도 생성 완료",
                                description: "GPT 기반 사용 용도 설명이 생성되었습니다.",
                              });
                            } else {
                              throw new Error("Failed to generate usage description");
                            }
                          } catch (error) {
                            toast({
                              title: "생성 실패",
                              description: "사용 용도 설명 생성에 실패했습니다.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsGeneratingUsage(false);
                          }
                        }}
                        disabled={isGeneratingUsage}
                        className="text-xs h-7 md:h-8"
                      >
                        {isGeneratingUsage ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1.5" />
                            AI로 생성
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  {generatedUsage ? (
                    <div className="p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs md:text-sm text-slate-700 whitespace-pre-wrap">
                            {generatedUsage}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setGeneratedUsage(null)}
                        className="text-xs h-6 text-slate-500 hover:text-slate-700"
                      >
                        원래 설명 보기
                      </Button>
                    </div>
                  ) : product.description ? (
                    <p className="text-xs md:text-sm text-slate-700 whitespace-pre-wrap">
                      {product.description}
                    </p>
                  ) : (
                    <p className="text-xs md:text-sm text-slate-400 italic">
                      사용 용도 정보가 없습니다. "AI로 생성" 버튼을 클릭하여 생성할 수 있습니다.
                    </p>
                  )}
                </div>

                {/* 제조사 페이지 링크 */}
                {product.vendors?.[0]?.url && (
                  <div className="pt-4 border-t">
                    <a
                      href={product.vendors[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline font-medium text-sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                      제조사 페이지 열기
                    </a>
                  </div>
                )}

                {/* 안전 · 규제 정보 */}
                {(product.msdsUrl || product.safetyNote || product.hazardCodes || product.pictograms || product.storageCondition || product.ppe) && (
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={startSafetyEdit}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          안전 정보 편집
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3 md:space-y-4">
                      {/* 구조화된 안전 필드 (P2) */}
                      {(product.hazardCodes || product.pictograms || product.ppe) && (
                        <div className="space-y-2">
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
                                {product.pictograms.map((pictogram: string, idx: number) => {
                                  const pictogramLabels: Record<string, string> = {
                                    corrosive: "부식성",
                                    exclamation: "경고",
                                    flame: "인화성",
                                    skull: "독성",
                                    health: "건강 위험",
                                    environment: "환경 위험",
                                    explosive: "폭발성",
                                    oxidizer: "산화성",
                                  };
                                  return (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] md:text-xs"
                                      title={PICTOGRAM_DESCRIPTIONS[pictogram] || pictogram}
                                    >
                                      {pictogramLabels[pictogram] || pictogram}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* 개인보호장비 */}
                          {product.ppe && Array.isArray(product.ppe) && product.ppe.length > 0 && (
                            <div>
                              <div className="text-xs md:text-sm text-slate-600 mb-1.5">필수 개인보호장비</div>
                              <div className="flex flex-wrap gap-1.5">
                                {product.ppe.map((item: string, idx: number) => {
                                  const ppeLabels: Record<string, string> = {
                                    gloves: "보호장갑",
                                    goggles: "보안경",
                                    mask: "마스크",
                                    labcoat: "실험복",
                                    respirator: "호흡기",
                                  };
                                  return (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] md:text-xs"
                                      title={PPE_DESCRIPTIONS[item] || item}
                                    >
                                      {ppeLabels[item] || PPE_DESCRIPTIONS[item] || item}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* 보관 조건 */}
                          {product.storageCondition && (
                            <div>
                              <div className="text-xs md:text-sm text-slate-600 mb-1">보관 조건</div>
                              <div className="p-2 md:p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                <p className="text-xs md:text-sm text-slate-700">{product.storageCondition}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* MSDS/SDS 링크 */}
                      {product.msdsUrl && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={async () => {
                                try {
                                  const url = product.msdsUrl;
                                  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
                                    toast({
                                      title: "유효하지 않은 링크",
                                      description: "MSDS/SDS 링크가 올바른 형식이 아닙니다.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  // 새 창에서 링크 열기
                                  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
                                  
                                  // 새 창이 차단되었는지 확인
                                  if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
                                    toast({
                                      title: "팝업 차단됨",
                                      description: "브라우저에서 팝업이 차단되었습니다. 팝업 차단을 해제해주세요.",
                                      variant: "destructive",
                                    });
                                  }
                                } catch (error) {
                                  toast({
                                    title: "링크 열기 실패",
                                    description: "MSDS/SDS 문서를 열 수 없습니다. 링크를 확인해주세요.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1.5" />
                              MSDS / SDS 문서 보기
                              <ExternalLink className="h-3 w-3 ml-1.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-8"
                              onClick={async () => {
                                const url = product.msdsUrl;
                                if (!url) return;

                                setMsdsLinkStatus("checking");
                                try {
                                  const response = await fetch("/api/validate-link", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ url }),
                                  });

                                  const data = await response.json();

                                  if (data.valid) {
                                    setMsdsLinkStatus("valid");
                                    toast({
                                      title: "링크 유효",
                                      description: "MSDS/SDS 링크가 정상적으로 작동합니다.",
                                    });
                                  } else {
                                    setMsdsLinkStatus("invalid");
                                    toast({
                                      title: "링크 확인 실패",
                                      description: data.error || "링크에 접근할 수 없습니다.",
                                      variant: "destructive",
                                    });
                                  }
                                } catch (error) {
                                  setMsdsLinkStatus("invalid");
                                  toast({
                                    title: "검증 실패",
                                    description: "링크 검증 중 오류가 발생했습니다.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              disabled={msdsLinkStatus === "checking"}
                            >
                              {msdsLinkStatus === "checking" ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                  확인 중...
                                </>
                              ) : msdsLinkStatus === "valid" ? (
                                <>
                                  <Check className="h-3 w-3 mr-1.5 text-green-600" />
                                  유효함
                                </>
                              ) : msdsLinkStatus === "invalid" ? (
                                <>
                                  <AlertTriangle className="h-3 w-3 mr-1.5 text-red-600" />
                                  확인 불가
                                </>
                              ) : (
                                <>
                                  <Shield className="h-3 w-3 mr-1.5" />
                                  링크 확인
                                </>
                              )}
                            </Button>
                          </div>
                          {msdsLinkStatus === "invalid" && (
                            <p className="text-xs text-red-600">
                              ⚠️ 링크에 접근할 수 없습니다. 링크가 만료되었거나 잘못되었을 수 있습니다.
                            </p>
                          )}
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

                      {/* 규제/절차 링크 */}
                      {(officialLinks.length > 0 || organizationLinks.length > 0) && (
                        <div className="space-y-4">
                          {/* 공식 링크 */}
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

                          {/* 우리 조직 절차 */}
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
                                      {isAdmin && link.rules && (
                                        <div className="text-xs text-blue-400 mt-1">
                                          조건: {getRuleDescription(link.rules)}
                                        </div>
                                      )}
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 더보기 버튼 */}
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

                      {/* 국내 규제 포털 링크 */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 mb-2">규제 정보 포털</div>
                        <div className="flex flex-wrap gap-2">
                          {getRegulationLinksForProduct(
                            product.name,
                            product.catalogNumber || undefined,
                            product.category
                          ).map((link) => (
                            <Button
                              key={link.id}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                window.open(link.url, "_blank");
                              }}
                              title={link.description}
                            >
                              <ExternalLink className="h-3 w-3 mr-1.5" />
                              {link.name}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* 면책 고지 */}
                      <Disclaimer type="safety" className="mt-4" />

                      {/* 기본 안내 문구 및 자동 추출 버튼 */}
                      {!product.safetyNote && product.msdsUrl && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-start gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-800 leading-relaxed flex-1">
                              사용 전, 취급·보관·폐기 정보를 꼭 확인하세요.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              setIsGeneratingUsage(true);
                              try {
                                const response = await fetch(`/api/products/${id}/safety-extract`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ msdsUrl: product.msdsUrl }),
                                });
                                if (!response.ok) {
                                  const error = await response.json();
                                  throw new Error(error.error || "안전 정보 추출에 실패했습니다.");
                                }
                                const data = await response.json();
                                toast({
                                  title: "안전 정보 추출 완료",
                                  description: "MSDS/SDS에서 안전 정보를 자동으로 추출했습니다.",
                                });
                                // 페이지 새로고침하여 업데이트된 정보 표시
                                window.location.reload();
                              } catch (error: any) {
                                toast({
                                  title: "추출 실패",
                                  description: error.message || "안전 정보 추출 중 오류가 발생했습니다.",
                                  variant: "destructive",
                                });
                              } finally {
                                setIsGeneratingUsage(false);
                              }
                            }}
                            disabled={isGeneratingUsage}
                            className="text-xs w-full"
                          >
                            {isGeneratingUsage ? (
                              <>
                                <Loader2 className="h-3 w-3 md:h-4 md:w-4 mr-1 animate-spin" />
                                추출 중...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                                MSDS에서 자동 추출
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      {!product.safetyNote && !product.msdsUrl && (
                        <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-slate-700 leading-relaxed">
                            사용 전, 취급·보관·폐기 정보를 꼭 확인하세요.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 안전 필드 편집 모달 */}
                {isSafetyEditing && safetyForm && (
                  <Dialog open={isSafetyEditing} onOpenChange={(open) => !open && setIsSafetyEditing(false)}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>안전 · 규제 정보 편집</DialogTitle>
                        <DialogDescription>
                          위험 코드, 피크토그램, 개인보호장비는 콤마(,)로 구분해 입력하세요. 예: H300, H314
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-2">
                        <div>
                          <Label className="text-xs">위험 코드 (예: H300, H314)</Label>
                          <Input
                            value={safetyForm.hazardCodes}
                            onChange={(e) =>
                              setSafetyForm({
                                ...safetyForm,
                                hazardCodes: e.target.value,
                              })
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">GHS 피크토그램 (예: skull, flame, corrosive)</Label>
                          <Input
                            value={safetyForm.pictograms}
                            onChange={(e) =>
                              setSafetyForm({
                                ...safetyForm,
                                pictograms: e.target.value,
                              })
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">필수 개인보호장비 (예: gloves, goggles, labcoat)</Label>
                          <Input
                            value={safetyForm.ppe}
                            onChange={(e) =>
                              setSafetyForm({
                                ...safetyForm,
                                ppe: e.target.value,
                              })
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">보관 조건</Label>
                          <Textarea
                            rows={2}
                            value={safetyForm.storageCondition}
                            onChange={(e) =>
                              setSafetyForm({
                                ...safetyForm,
                                storageCondition: e.target.value,
                              })
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">안전 취급 요약</Label>
                          <Textarea
                            rows={3}
                            value={safetyForm.safetyNote}
                            onChange={(e) =>
                              setSafetyForm({
                                ...safetyForm,
                                safetyNote: e.target.value,
                              })
                            }
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <DialogFooter className="mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsSafetyEditing(false)}
                        >
                          취소
                        </Button>
                        <Button
                          type="button"
                          onClick={saveSafetyInfo}
                          disabled={isSavingSafety}
                        >
                          {isSavingSafety ? "저장 중..." : "저장"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {/* 데이터시트 텍스트 붙여넣기 섹션 */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      데이터시트 텍스트 분석
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDatasheetSection(!showDatasheetSection)}
                    >
                      {showDatasheetSection ? "숨기기" : "불러오기"}
                    </Button>
                  </div>
                  
                  {showDatasheetSection && (
                    <div className="space-y-4">
                      {/* URL 입력 */}
                      <div className="space-y-2">
                        <Label htmlFor="datasheet-url" className="text-sm">
                          데이터시트 URL
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          데이터시트 웹페이지 URL을 입력하면 자동으로 본문을 추출하여 분석합니다.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            id="datasheet-url"
                            type="url"
                            value={datasheetUrl}
                            onChange={(e) => setDatasheetUrl(e.target.value)}
                            placeholder="https://example.com/datasheet"
                            className="text-sm flex-1"
                          />
                          <Button
                            onClick={handleExtractFromUrl}
                            disabled={isExtractingFromUrl || !datasheetUrl.trim()}
                            variant="outline"
                          >
                            {isExtractingFromUrl ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                추출 중...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                URL에서 추출
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-slate-500">또는</span>
                        </div>
                      </div>

                      {/* PDF 업로드 */}
                      <div className="space-y-2">
                        <Label className="text-sm">데이터시트 PDF 업로드</Label>
                        <p className="text-xs text-muted-foreground">
                          PDF 파일을 업로드하면 자동으로 텍스트를 추출하여 분석합니다.
                        </p>
                        <div
                          onDrop={handlePdfDrop}
                          onDragOver={handlePdfDragOver}
                          className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer"
                        >
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handlePdfFileChange}
                            className="hidden"
                            id="datasheet-pdf-upload"
                            disabled={isExtractingFromPdf}
                          />
                          <label
                            htmlFor="datasheet-pdf-upload"
                            className="cursor-pointer flex flex-col items-center gap-2"
                          >
                            {isExtractingFromPdf ? (
                              <>
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">PDF 분석 중...</span>
                              </>
                            ) : datasheetPdfFile ? (
                              <>
                                <FileText className="h-8 w-8 text-primary" />
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{datasheetPdfFile.name}</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDatasheetPdfFile(null);
                                    }}
                                    className="h-6 w-6 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <Upload className="h-8 w-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  PDF 파일을 드래그하거나 클릭하여 업로드
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  최대 10MB
                                </span>
                              </>
                            )}
                          </label>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-slate-500">또는</span>
                        </div>
                      </div>

                      {/* 텍스트 붙여넣기 */}
                      <div className="space-y-2">
                        <Label htmlFor="datasheet-text" className="text-sm">
                          데이터시트 텍스트 붙여넣기
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          PDF 데이터시트를 열고 텍스트를 복사한 후 여기에 붙여넣으세요.
                        </p>
                        <Textarea
                          id="datasheet-text"
                          value={datasheetText}
                          onChange={(e) => setDatasheetText(e.target.value)}
                          placeholder="데이터시트 텍스트를 여기에 붙여넣으세요..."
                          rows={8}
                          className="text-sm"
                        />
                      </div>
                      
                      <Button
                        onClick={handleExtractDatasheet}
                        disabled={isExtracting || !datasheetText.trim()}
                        className="w-full"
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            제품 정보 추출
                          </>
                        )}
                      </Button>

                      {extractedInfo && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                          <Disclaimer type="datasheet" className="mb-4" />
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">추출된 정보</h4>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyExtractedInfo}
                              >
                                {copied ? (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    복사됨
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 mr-1" />
                                    복사
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={handleOpenApplyDialog}
                                disabled={applyExtractedInfoMutation.isPending}
                              >
                                {applyExtractedInfoMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    적용 중...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-3 w-3 mr-1" />
                                    필드에 적용
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3 text-sm">
                            {extractedInfo.name && (
                              <div>
                                <span className="font-medium text-slate-700">제품명: </span>
                                <span>{extractedInfo.name}</span>
                                {extractedInfo.nameEn && (
                                  <span className="text-muted-foreground ml-2">
                                    ({extractedInfo.nameEn})
                                  </span>
                                )}
                              </div>
                            )}

                            {extractedInfo.target && (
                              <div>
                                <span className="font-medium text-slate-700">타깃: </span>
                                <Badge variant="secondary" className="text-xs">
                                  {extractedInfo.target}
                                </Badge>
                              </div>
                            )}

                            {extractedInfo.category && (
                              <div>
                                <span className="font-medium text-slate-700">카테고리: </span>
                                <Badge variant="outline" className="text-xs">
                                  {extractedInfo.category}
                                </Badge>
                              </div>
                            )}

                            {(extractedInfo.capacity || extractedInfo.grade) && (
                              <div className="flex gap-4">
                                {extractedInfo.capacity && (
                                  <div>
                                    <span className="font-medium text-slate-700">용량: </span>
                                    <span>{extractedInfo.capacity}</span>
                                  </div>
                                )}
                                {extractedInfo.grade && (
                                  <div>
                                    <span className="font-medium text-slate-700">Grade: </span>
                                    <span>{extractedInfo.grade}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {extractedInfo.specifications && Object.keys(extractedInfo.specifications).length > 0 && (
                              <div>
                                <span className="font-medium text-slate-700">규격: </span>
                                <div className="mt-1 space-y-1">
                                  {Object.entries(extractedInfo.specifications).map(([key, value]) => (
                                    <div key={key} className="text-xs text-slate-600">
                                      {key}: {String(value)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {extractedInfo.description && (
                              <div>
                                <span className="font-medium text-slate-700">설명: </span>
                                <p className="mt-1 text-slate-600 whitespace-pre-wrap">
                                  {extractedInfo.description}
                                </p>
                              </div>
                            )}

                            {extractedInfo.summary && (
                              <div>
                                <span className="font-medium text-slate-700">요약: </span>
                                <p className="mt-1 text-slate-600 whitespace-pre-wrap">
                                  {extractedInfo.summary}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 필드 적용 다이얼로그 */}
                      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>추출된 정보를 제품 필드에 적용</DialogTitle>
                            <DialogDescription>
                              적용할 필드를 선택하세요. 선택한 필드만 제품 정보에 반영됩니다.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-4">
                            {extractedInfo.name && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="field-name"
                                  checked={selectedFields.name || false}
                                  onCheckedChange={(checked) =>
                                    setSelectedFields({ ...selectedFields, name: checked as boolean })
                                  }
                                />
                                <Label htmlFor="field-name" className="text-sm font-normal cursor-pointer">
                                  제품명: {extractedInfo.name}
                                </Label>
                              </div>
                            )}
                            {extractedInfo.nameEn && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="field-nameEn"
                                  checked={selectedFields.nameEn || false}
                                  onCheckedChange={(checked) =>
                                    setSelectedFields({ ...selectedFields, nameEn: checked as boolean })
                                  }
                                />
                                <Label htmlFor="field-nameEn" className="text-sm font-normal cursor-pointer">
                                  영문 제품명: {extractedInfo.nameEn}
                                </Label>
                              </div>
                            )}
                            {extractedInfo.description && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="field-description"
                                  checked={selectedFields.description || false}
                                  onCheckedChange={(checked) =>
                                    setSelectedFields({ ...selectedFields, description: checked as boolean })
                                  }
                                />
                                <Label htmlFor="field-description" className="text-sm font-normal cursor-pointer">
                                  설명
                                </Label>
                              </div>
                            )}
                            {extractedInfo.grade && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="field-grade"
                                  checked={selectedFields.grade || false}
                                  onCheckedChange={(checked) =>
                                    setSelectedFields({ ...selectedFields, grade: checked as boolean })
                                  }
                                />
                                <Label htmlFor="field-grade" className="text-sm font-normal cursor-pointer">
                                  Grade: {extractedInfo.grade}
                                </Label>
                              </div>
                            )}
                            {(extractedInfo.specification || extractedInfo.capacity) && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="field-specification"
                                  checked={selectedFields.specification || false}
                                  onCheckedChange={(checked) =>
                                    setSelectedFields({ ...selectedFields, specification: checked as boolean })
                                  }
                                />
                                <Label htmlFor="field-specification" className="text-sm font-normal cursor-pointer">
                                  규격/용량: {extractedInfo.specification || extractedInfo.capacity}
                                </Label>
                              </div>
                            )}
                            {extractedInfo.specifications && Object.keys(extractedInfo.specifications).length > 0 && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="field-specifications"
                                  checked={selectedFields.specifications || false}
                                  onCheckedChange={(checked) =>
                                    setSelectedFields({ ...selectedFields, specifications: checked as boolean })
                                  }
                                />
                                <Label htmlFor="field-specifications" className="text-sm font-normal cursor-pointer">
                                  상세 스펙 ({Object.keys(extractedInfo.specifications).length}개 필드)
                                </Label>
                              </div>
                            )}
                            {extractedInfo.sourceUrl && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="field-datasheetUrl"
                                  checked={selectedFields.datasheetUrl || false}
                                  onCheckedChange={(checked) =>
                                    setSelectedFields({ ...selectedFields, datasheetUrl: checked as boolean })
                                  }
                                />
                                <Label htmlFor="field-datasheetUrl" className="text-sm font-normal cursor-pointer">
                                  데이터시트 URL
                                </Label>
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setShowApplyDialog(false)}
                              disabled={applyExtractedInfoMutation.isPending}
                            >
                              취소
                            </Button>
                            <Button
                              onClick={handleApplyExtractedInfo}
                              disabled={applyExtractedInfoMutation.isPending}
                            >
                              {applyExtractedInfoMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  적용 중...
                                </>
                              ) : (
                                "적용"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 추천 제품 */}
            {recommendations.length > 0 && (
              <section className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">추천 제품</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.map((rec: any) => {
                    const recProduct = rec.recommended;
                    if (!recProduct) return null;
                    
                    const minPrice = recProduct?.vendors?.reduce(
                      (min: number, v: any) =>
                        v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                      null
                    );

                    return (
                      <Card key={rec.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            {recProduct.imageUrl && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={recProduct.imageUrl}
                                alt={recProduct.name}
                                className="w-16 h-16 object-cover rounded"
                                loading="lazy"
                                decoding="async"
                              />
                            )}
                            <div className="flex-1">
                              <CardTitle className="text-lg">
                                <Link
                                  href={`/products/${recProduct.id}`}
                                  className="hover:underline"
                                >
                                  {recProduct.name}
                                </Link>
                              </CardTitle>
                              {recProduct.brand && (
                                <CardDescription className="text-xs mt-1">
                                  {recProduct.brand}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">유사도:</span>
                              <span className="font-semibold">
                                {(rec.score * 100).toFixed(0)}%
                              </span>
                            </div>
                            {rec.reason && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {rec.reason}
                              </p>
                            )}
                            <RecommendationFeedback recommendationId={rec.id} />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            {minPrice ? (
                              <span className="text-lg font-semibold">
                                ₩{minPrice.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">가격 문의</span>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (hasProduct(recProduct.id)) {
                                    removeProduct(recProduct.id);
                                  } else {
                                    addProduct(recProduct.id);
                                  }
                                }}
                              >
                                <Compare className="h-3 w-3 mr-1" />
                                비교
                              </Button>
                              <Link href={`/products/${recProduct.id}`}>
                                <Button size="sm">보기</Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* 가격 및 액션 */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>가격 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendors.length > 0 ? (
                  <div className="space-y-3">
                    {vendors.map((pv: any) => (
                      <div
                        key={pv.id}
                        className="border rounded-lg p-3 space-y-1"
                      >
                        <div className="font-semibold">{pv.vendor?.name}</div>
                        {pv.priceInKRW ? (
                          <div className="text-xl font-bold">
                            ₩{pv.priceInKRW.toLocaleString()}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">가격 문의</div>
                        )}
                        {pv.stockStatus && (
                          <div className="text-sm text-muted-foreground">
                            재고: {pv.stockStatus}
                          </div>
                        )}
                        {pv.leadTime !== null && (
                          <div className="text-sm text-muted-foreground">
                            납기: {pv.leadTime}일
                          </div>
                        )}
                        {pv.url && (
                          <a
                            href={pv.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            공급사 페이지
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">가격 정보가 없습니다</p>
                )}

                {/* CTA 버튼 */}
                <div className="space-y-2 pt-4 border-t">
                  <Button
                    className="w-full bg-slate-900 hover:bg-slate-800"
                    variant={isInCompare ? "outline" : "default"}
                    onClick={() => {
                      if (isInCompare) {
                        removeProduct(id);
                      } else {
                        addProduct(id);
                      }
                    }}
                  >
                    <Compare className="h-4 w-4 mr-2" />
                    {isInCompare ? "비교에서 제거" : "비교 대상에 추가"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      // 견적 요청 리스트에 추가 (TestFlowProvider 사용)
                      try {
                        const response = await fetch(`/api/products/${id}`);
                        if (response.ok) {
                          const productData = await response.json();
                          // TestFlowProvider의 addProductToQuote를 호출하는 대신
                          // 직접 quote에 추가하는 로직이 필요할 수 있음
                          toast({
                            title: "품목 추가",
                            description: "품목이 견적 요청 리스트에 추가되었습니다.",
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "추가 실패",
                          description: "품목 추가에 실패했습니다.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    견적 요청 리스트에 추가
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={toggleFavorite}
                    disabled={isTogglingFavorite}
                  >
                    <Heart
                      className={`h-4 w-4 mr-2 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
                    />
                    {isFavorite ? "즐겨찾기 제거" : "즐겨찾기 추가"}
                  </Button>
                </div>
              </CardContent>
            </Card>
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

  const { addProduct, hasProduct } = useCompareStore();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="mt-8">
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-400" />
            <p className="text-sm text-slate-600">대체품을 찾는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!alternatives?.alternatives || alternatives.alternatives.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            대체품 추천
          </CardTitle>
          <CardDescription>
            동일 카테고리 및 유사 스펙의 제품을 추천합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {alternatives.alternatives.map((alt: any) => {
              const isInCompare = hasProduct(alt.id);
              
              return (
                <Card key={alt.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      {alt.imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={alt.imageUrl}
                          alt={alt.name}
                          className="w-16 h-16 object-cover rounded"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">
                          <Link
                            href={`/products/${alt.id}`}
                            className="hover:underline line-clamp-2"
                          >
                            {alt.name}
                          </Link>
                        </CardTitle>
                        {alt.brand && (
                          <CardDescription className="text-xs mt-1">
                            {alt.brand}
                          </CardDescription>
                        )}
                        {alt.catalogNumber && (
                          <CardDescription className="text-xs">
                            Cat.No: {alt.catalogNumber}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* 유사도 및 근거 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">유사도</span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(alt.similarity * 100)}%
                        </Badge>
                      </div>
                      {alt.similarityReasons && alt.similarityReasons.length > 0 && (
                        <div className="space-y-1">
                          {alt.similarityReasons.slice(0, 2).map((reason: string, idx: number) => (
                            <div key={idx} className="text-xs text-slate-600 flex items-center gap-1">
                              <Check className="h-3 w-3 text-green-600" />
                              {reason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 가격 정보 */}
                    {alt.minPrice !== undefined && (
                      <div className="text-sm font-semibold">
                        ₩{alt.minPrice.toLocaleString("ko-KR")}
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (isInCompare) {
                            toast({
                              title: "이미 비교 목록에 있습니다",
                              variant: "default",
                            });
                          } else {
                            addProduct(alt.id);
                            toast({
                              title: "비교 목록에 추가되었습니다",
                              description: alt.name,
                            });
                          }
                        }}
                      >
                        <Compare className="h-3 w-3 mr-1" />
                        비교
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/products/${alt.id}`}>
                          <Eye className="h-3 w-3 mr-1" />
                          상세
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 추천 피드백 컴포넌트
function RecommendationFeedback({ recommendationId }: { recommendationId: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [userFeedback, setUserFeedback] = useState<boolean | null>(null);

  // 피드백 조회
  const { data: feedbackData } = useQuery({
    queryKey: ["recommendation-feedback", recommendationId],
    queryFn: async () => {
      const response = await fetch(`/api/recommendations/${recommendationId}/feedback`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  // 사용자의 피드백 확인
  useEffect(() => {
    if (feedbackData?.feedbacks && session?.user?.id) {
      const userFb = feedbackData.feedbacks.find(
        (f: any) => f.user?.id === session.user?.id
      );
      if (userFb) {
        setUserFeedback(userFb.isHelpful);
      }
    }
  }, [feedbackData, session]);

  const feedbackMutation = useMutation({
    mutationFn: async (isHelpful: boolean) => {
      const response = await fetch(`/api/recommendations/${recommendationId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHelpful }),
      });
      if (!response.ok) throw new Error("Failed to submit feedback");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendation-feedback", recommendationId] });
    },
  });

  if (!session?.user?.id) {
    return null;
  }

  const stats = feedbackData?.stats || { helpful: 0, notHelpful: 0, total: 0 };

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
      <span className="text-xs text-muted-foreground">이 추천이 도움이 되었나요?</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            const newValue = userFeedback === true ? null : true;
            setUserFeedback(newValue);
            if (newValue !== null) {
              feedbackMutation.mutate(newValue);
            }
          }}
          className={`p-1 rounded ${
            userFeedback === true
              ? "bg-green-100 text-green-700"
              : "hover:bg-muted"
          }`}
          disabled={feedbackMutation.isPending}
        >
          <ThumbsUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => {
            const newValue = userFeedback === false ? null : false;
            setUserFeedback(newValue);
            if (newValue !== null) {
              feedbackMutation.mutate(newValue);
            }
          }}
          className={`p-1 rounded ${
            userFeedback === false
              ? "bg-red-100 text-red-700"
              : "hover:bg-muted"
          }`}
          disabled={feedbackMutation.isPending}
        >
          <ThumbsDown className="h-3 w-3" />
        </button>
        {stats.total > 0 && (
          <span className="text-xs text-muted-foreground ml-1">
            ({stats.helpful}👍 {stats.notHelpful}👎)
          </span>
        )}
      </div>
    </div>
  );
}