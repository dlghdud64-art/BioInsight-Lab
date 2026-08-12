"use client";

import { csrfFetch } from "@/lib/api-client";
// §11.348-B-1 B1-2 — SDS 문서 섹션(업로드/열람).
import { SdsDocumentsSection } from "@/components/safety/sds-documents-section";
import { CollapsedRow } from "@/components/products/collapsed-row";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  ShoppingCart,
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
// §product-detail-sourcing-v21 §1 — 완성도 게이지 은퇴(공급사 콘솔 이관) → 미등록 접힌 1줄.
//   구 ProductCompleteness(PD-B) import 폐기. 산정 lib(computeCompleteness)은 컴포넌트 내부에서 계속 사용.
import { PendingInfoRow } from "@/components/products/pending-info-row";
// §product-detail PD-D(§09) — 견적함 정직 트레이바(데스크탑).
import { QuoteTrayBar } from "@/components/products/quote-tray-bar";
// §product-detail-sourcing-v21 §2 — 추가 스펙(출처·내부 등급) 표면 삭제로 getDisplaySpecs import 폐기.
//   lib(@/lib/product-detail/spec-fields)은 소싱 비교 등 타 표면에서 계속 사용 — 파일 무손상.
// §product-detail-sourcing-v21 §5 — 이 표면의 safety Disclaimer(yellow Alert)는 회색 각주로 대체 → import 폐기.
// #quote-cta-truth — 견적함 저장 계층 단일 출처 (fake success 제거, 호영님 2026-06-11)
import { addToQuoteCart, readQuoteCart, removeFromQuoteCart } from "@/lib/quote/quote-cart-storage";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const { data: fetchedProduct, isLoading, error } = useProduct(id);
  // §product-detail-sourcing-v21 §7 — 레일 "비교 검토" 폐기로 addProduct 미사용. 담김 해제 시 비교함 정리 경로만 유지.
  const { removeProduct, hasProduct } = useCompareStore();
  // #quote-cta-truth — 견적함 truth 합류 (provider 와 동일 키·동일 순수함수, ⓐ 결정)
  const [inQuoteCart, setInQuoteCart] = useState(false);
  useEffect(() => {
    if (!id) return;
    // §product-detail-refinement 계약⑨-2 — quote-cart-changed 구독으로 재읽기(해제 후 담김 상태 소멸 = front-only 거울상 방지).
    const sync = () => setInQuoteCart(readQuoteCart().some((q: any) => q.productId === id));
    sync();
    window.addEventListener("quote-cart-changed", sync);
    return () => window.removeEventListener("quote-cart-changed", sync);
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
  // §product-detail-refinement 계약⑥ — 규제 포털 상시 2개 화이트리스트(mfds·kchem) + 전용 더보기(컴플라이언스 더보기와 별개).
  const [showMoreRegPortal, setShowMoreRegPortal] = useState(false);
  const REG_PORTAL_ALWAYS = ["mfds", "kchem"];
  const [msdsLinkStatus, setMsdsLinkStatus] = useState<"checking" | "valid" | "invalid" | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();


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

  /**
   * §phantom-model-call — 규제 링크 조회 **미생성** (2026-08-12).
   *
   * 기존 코드는 `/api/compliance-links` 를 호출하고 `if (!response.ok) return { links: [] }`
   * 로 **실패를 삼켰다**. 그런데 그 라우트는 존재하지 않는 `db.complianceLink` 를 부르고
   * 있어 **항상 실패**했다. 결과적으로 화면은 "규제 링크 없음" 으로 보였다 —
   * 조회가 실패한 것과 링크가 없는 것을 구분할 수 없는 상태였고, 안전·규제 축에서는
   * 특히 위험하다(§fabricated-data-surface 의 조용한 형태).
   *
   * `ComplianceLink` 모델이 스키마에 신설된 뒤 이 블록을 되살린다.
   * 그 전까지는 **만들지 않는다** — 빈 목록을 그리면 같은 거짓이 반복된다.
   */

  /**
   * §3-1 우리 조직 재고 (B1, 2026-08-09) — 제품 단위 재고 조회.
   *   소스: GET /api/inventory?productId= (B1 에서 필터 신설). 조직/사용자 스코프는
   *   서버 ownerCondition 이 적용하므로 남의 조직 재고는 애초에 오지 않는다.
   *   §3 계약: **데이터 없으면 블록 자체 숨김** — 0건일 때 "재고 없음" 을 그리지 않는다
   *   (가짜 정보량 0). 로그인 전에는 호출 자체를 하지 않는다.
   */
  const { data: orgInventoryData } = useQuery({
    queryKey: ["product-org-inventory", id],
    queryFn: async () => {
      const response = await fetch(`/api/inventory?productId=${encodeURIComponent(id)}`);
      if (!response.ok) return { inventories: [] };
      return response.json();
    },
    enabled: !!id && !!session?.user?.id,
  });
  const orgInventories = (orgInventoryData?.inventories ?? []) as Array<{
    id: string;
    currentQuantity: number;
    unit?: string | null;
    location?: string | null;
    safetyStock?: number | null;
  }>;

  /**
   * §4 재발주 배너 (B2, 2026-08-09) — **중복 견적 생성 방지를 동작으로 달성**.
   *   이 제품이 이미 담긴 "작성 중"(PENDING) 견적이 있으면 생성하지 않고 그 견적을 연다.
   *
   *   ⚠️ 라벨 규율:
   *     · "재발주안에 합류" 라고 쓰지 않는다 — 실제로 합류하는 동작이 없다.
   *       기존 경로(ReorderReviewSheet)는 누를 때마다 **새 초안을 생성**한다.
   *     · 열기 CTA 는 "작성 중인 견적 열기" — 그 견적의 출처를 모르므로 "재발주"를 붙이지 않는다.
   *       생성 CTA 는 "재발주 견적 만들기" — 우리가 목적을 아니까 붙일 수 있다(의도적 비대칭).
   *     · 출처(specialNotes "재고관리 재발주안에서 생성") 로 분기하지 않는다 — 텍스트 결속을
   *       늘리고(§text-coupling-debt), 중복 방지 관점에서 출처는 무관하며 오히려 놓친다.
   *
   *   상태 어휘: PENDING = 발송 전. prepare 패널은 같은 상태를 "발송 대기"로 부른다
   *   (§quote-status-vocabulary — QuoteStatus 에 DRAFT 부재가 근본 원인, 상태 모델과 함께 처리).
   */
  const { data: draftQuoteData } = useQuery({
    queryKey: ["product-draft-quote", id],
    queryFn: async () => {
      const response = await fetch(
        `/api/quotes?productId=${encodeURIComponent(id)}&status=PENDING`,
      );
      if (!response.ok) return { quotes: [] };
      return response.json();
    },
    enabled: !!id && !!session?.user?.id,
  });
  const openDraftQuote = ((draftQuoteData?.quotes ?? []) as Array<{ id: string }>)[0] ?? null;

  /**
   * §4 배너 트리거 — **FK 정확 신호만 사용**.
   *   B1 의 orgInventories(productId FK 조회)에서 안전재고 미달 여부를 직접 판정한다.
   *   `useReorderRecommendation(productName)` 텍스트 매칭은 쓰지 않는다 —
   *   오매칭된 근거로 발주를 유도할 위험이 있고, 여기서는 필요도 없다(§text-coupling-debt).
   *   부족분 = Σ(safetyStock - currentQuantity), 최소 1.
   */
  const reorderShortfall = orgInventories.reduce((sum, inv) => {
    if (inv.safetyStock == null) return sum;
    const gap = inv.safetyStock - inv.currentQuantity;
    return gap > 0 ? sum + gap : sum;
  }, 0);
  const needsReorder = reorderShortfall > 0;

  const [creatingReorderQuote, setCreatingReorderQuote] = useState(false);

  /** §4 생성 분기 — 작성 중 견적이 없을 때만 도달한다(있으면 열기 CTA). */
  const handleCreateReorderQuote = async () => {
    if (creatingReorderQuote || !product) return;
    setCreatingReorderQuote(true);
    try {
      const res = await csrfFetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${product.name} 재발주 견적`,
          items: [
            {
              productId: product.id,
              quantity: Math.max(1, reorderShortfall),
              notes: "안전재고 미달 — 제품 상세 재발주 배너",
            },
          ],
          specialNotes: "제품 상세 재발주 배너에서 생성 · 안전재고 미달",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        // 실패 시 이동 0 — 실패를 성공처럼 보이게 하지 않는다(placeholder success 금지).
        toast({
          title: "초안을 만들지 못했습니다",
          description: body?.message ?? body?.error ?? "잠시 후 다시 시도해주세요.",
          variant: "destructive",
        });
        return;
      }
      const body = await res.json();
      const quoteId: string | undefined = body?.quote?.id;
      if (!quoteId) {
        toast({
          title: "초안은 생성됐으나 이동 정보를 받지 못했습니다",
          description: "견적 관리에서 확인해주세요.",
          variant: "destructive",
        });
        return;
      }
      router.push(`/dashboard/quotes?prepare=${encodeURIComponent(quoteId)}`);
    } catch {
      toast({ title: "네트워크 오류로 초안을 만들지 못했습니다", variant: "destructive" });
    } finally {
      setCreatingReorderQuote(false);
    }
  };

  // §phantom-model-call — 모델 신설 전까지 규제 링크는 조회하지 않는다(위 주석).
  const officialLinks: any[] = [];
  const organizationLinks: any[] = [];
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
                  {/* §product-detail-sourcing-v21 §2 — 히어로 키 팩트 행 폐기.
                      · 내부 등급 · 출처(대장) = 내부 용어 메타 → buyer 화면에서 삭제(구매 판단 무관, PD-E 노출 결정 반전).
                      · 안전 위험도 = 안전·규제 카드로 단일화(이중 표기 제거).
                      · 분류는 위 Badge 칩 1개로 충분 → 별도 팩트 행 불필요(모바일 4열 flex 붕괴 원인 동반 제거). */}
                  {/* §product-detail-sourcing-v21 §1 — 완성도 게이지 → 미등록 접힌 1줄(탭 시 목록). 편집/요청 링크 0. */}
                  <div className="mt-4">
                    <PendingInfoRow product={product} />
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

                  {/* §product-detail-refinement 계약③ — PD-L 숨김 게이트 폐기: buyer 에게도 미등록 사실 노출(은폐 0).
                      데이터 有 = 상세 스펙 카드, 데이터 0건 = 접힘 한 줄(CollapsedRow). */}
                  {(product.specification || product.regulatoryCompliance) ? (
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
                  ) : (
                    /* §product-detail-sourcing-v21 §1 — 상세 스펙 0건 = 접힘 한 줄(계약③ 형태 승계).
                       액션은 canEditSpec(ADMIN·SUPPLIER) 에게만 생성 — buyer 정보 요청 링크 폐기(dead link 0). */
                    <div className="mb-6 md:mb-8">
                      <CollapsedRow
                        label="상세 스펙"
                        status="미등록"
                        action={
                          canEditSpec
                            ? {
                                label: "스펙 편집",
                                onClick: () => {
                                  setSpecForm(product?.specification || "");
                                  setIsSpecEditing(true);
                                },
                              }
                            : undefined
                        }
                      />
                    </div>
                  )}

                  {/* §product-detail-sourcing-v21 §2 — "제품 사양" 통합 카드(PD-J) 삭제.
                      Cat.No · 분류는 히어로가 이미 표시(중복), 추가 스펙(출처 · 내부 등급)은 내부 용어 메타로 §2 삭제 대상.
                      실 spec(규격/용량 · 규제 규격)은 위 "상세 스펙" 카드가 canonical 로 담당 — 정보 손실 0. */}

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
                    {/* §product-detail-sourcing-v21 §5 — 헤더 1행 고정: 아이콘 + 제목(nowrap) + 위험도 pill(nowrap, shrink-0).
                        구 3단 줄바꿈("안전 · 규제 / 정보") + 위험도 칩 이탈(320~430px) 해소. 아이콘은 §8 라인 15px 슬레이트. */}
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-[15px] w-[15px] shrink-0 text-slate-500" />
                      <h3 className="font-semibold text-sm md:text-base flex-1 min-w-0 whitespace-nowrap">안전·규제 정보</h3>
                      {(() => {
                        const safetyLevel = getProductSafetyLevel(product);
                        return (
                          <span className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-[3px] text-[10.5px] font-bold text-slate-400">
                            {/* §product-detail-refinement 계약⑤ 승계 — MSDS 병기 없음. 위험도 단일 표기(히어로 이중 표기 제거). */}
                            위험도 {safetyLevel.label}
                          </span>
                        );
                      })()}
                      {/* §1 권한 — 안전 정보 편집은 ADMIN·SUPPLIER 만 생성(buyer 미생성, disabled 아님). */}
                      {canEditSpec && (
                        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={startSafetyEdit}>
                          <Pencil className="h-3 w-3 mr-1" />
                          안전 정보 편집
                        </Button>
                      )}
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

                        {/* 안전 취급 요약 — §product-detail-refinement ⑦: 구 완성도 hex → §0-B amber(#fffbeb/#fde68a). */}
                        {product.safetyNote && (
                          <div className="p-3 rounded-lg" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
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
                            /* §product-detail-sourcing-v21 §1·§5 — SDS 는 공급사/관리자만 등록(개인 업로드 = 오매칭 위험,
                               canonical 소스 단일 관리). buyer 에겐 요청 링크 없이 정직 표기 1줄만. */
                            <p className="text-[11px] text-slate-400">등록 없음 · 공급사/관리자 등록 시 표시됩니다</p>
                          )}
                          {/* §11.348-B-1 B1-2 — 업로드된 SDS 문서 목록/업로드/열람 (서명URL). SDS 는 제품 단위 canonical.
                              §product-detail-sourcing-v21 §1·§5 — 접힘 한 줄 형태는 계약③ 승계.
                              · status: 미등록 시 정직 표기(등록 없음 · 공급사/관리자 등록 시 표시됩니다)
                              · action: canEditSpec(ADMIN·SUPPLIER) 에게만 "SDS 업로드" 생성 — buyer 미생성(dead link 0)
                              · 업로드 UI(SdsDocumentsSection)도 canEditSpec 안에서만 마운트 — 개인 업로드 경로 차단 */}
                          {product?.id && (
                            <div id="product-sds-docs">
                              <CollapsedRow
                                label="SDS/MSDS 문서"
                                status={product.msdsUrl ? "등록됨" : "등록 없음 · 공급사/관리자 등록 시 표시됩니다"}
                                action={
                                  canEditSpec
                                    ? {
                                        label: "SDS 업로드",
                                        onClick: () =>
                                          document
                                            .getElementById("product-sds-docs")
                                            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                                      }
                                    : undefined
                                }
                                defaultOpen={!!product.msdsUrl}
                              >
                                {canEditSpec ? (
                                  <SdsDocumentsSection productId={product.id} docType="sds" />
                                ) : (
                                  <p className="text-[11px] text-slate-400">
                                    제품 안전자료는 공급사/관리자가 등록합니다. 등록되면 이 자리에 표시됩니다.
                                  </p>
                                )}
                              </CollapsedRow>
                            </div>
                          )}
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

                        {/* §product-detail-sourcing-v21 §5 — 규제 포털: 접힘 행(CollapsedRow) 폐기 → 주요 2기관 버튼 + 더보기 텍스트.
                            상시 2개 화이트리스트(REG_PORTAL_ALWAYS = mfds·kchem)와 전용 더보기 상태(showMoreRegPortal)는 계약⑥ 승계 — 세로 6나열 회귀 차단.
                            시안 정합: 버튼 2개(외부링크 라인 아이콘) + `더보기 N개 기관 ›`, 섹션 제목 없음(카드 헤더가 맥락). */}
                        {(() => {
                          const regLinks = getRegulationLinksForProduct(
                            product.name,
                            product.catalogNumber || undefined,
                            product.category,
                          );
                          const always = regLinks.filter((l) => REG_PORTAL_ALWAYS.includes(l.id));
                          const rest = regLinks.filter((l) => !REG_PORTAL_ALWAYS.includes(l.id));
                          if (always.length === 0 && rest.length === 0) return null;
                          const shown = showMoreRegPortal ? [...always, ...rest] : always;
                          return (
                            <div className="pt-2 border-t border-bd">
                              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
                                {shown.map((link) => (
                                  <a
                                    key={link.id}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={link.description}
                                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-slate-200 px-3 py-2.5 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:text-blue-800"
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{link.name}</span>
                                  </a>
                                ))}
                                {rest.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowMoreRegPortal(!showMoreRegPortal)}
                                    className="col-span-2 inline-flex min-h-[44px] items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:text-slate-700 md:col-span-1 md:min-h-0"
                                  >
                                    {showMoreRegPortal ? "접기" : `더보기 ${rest.length}개 기관 ›`}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* §product-detail-sourcing-v21 §5 — yellow Alert 박스(과경고) → 회색 각주 1줄.
                            공용 Disclaimer 컴포넌트는 타 표면(datasheet·price·rfq)에서 계속 사용 — 컴포넌트 무손상, 이 표면만 각주화. */}
                        <p className="mt-4 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
                          참고용 정보입니다. 취급/보관/폐기 지침은 SDS/MSDS 원문을 우선 확인하세요.
                        </p>
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
                            {/* §product-detail-sourcing-v21 §7 — 벤더가 있어도 "납기 · 견적 시 안내" 상시 행은 삭제(정보량 0). */}
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
                            {/* §product-detail-sourcing-v21 §7 — 레일 1행 압축: 가격 안내 보조문 · Cat.No 요약행 삭제.
                                가격 사유는 상태 라벨(견적가 안내 품목)이 이미 전달, Cat.No 는 히어로가 canonical(중복 제거). */}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CTA 버튼 */}
                    <div className="space-y-3 pt-6 border-t border-bd/50">
                      {/* §product-detail-refinement 계약④ — 담김 칩 한 줄 + 해제(분리 배지 2개 폐기, 단일 칩으로 통합). */}
                      {(hasProduct(id) || inQuoteCart) && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 font-medium px-2 py-1 rounded bg-slate-100 text-slate-700">
                            <ShoppingCart className="h-3 w-3" />견적함·비교함에 담김
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              // 계약⑨-1 견적함·비교함 동시 정리(칩 문구 정합). ⑨-2 removeFromQuoteCart 가 quote-cart-changed 발행 → 구독 재읽기.
                              removeFromQuoteCart(product.id);
                              if (hasProduct(id)) removeProduct(id); // 비교함(compare) 정리
                            }}
                            className="ml-auto font-semibold text-slate-500 hover:text-slate-700 underline underline-offset-2"
                          >
                            해제
                          </button>
                        </div>
                      )}
                      {/* §product-detail-sourcing-v21 §7 — 담기 후 버튼 상태 전환 = `담김 ✓ · 견적함 보기`(라벨 반전, 계약④ 목적지 /dashboard/quotes 는 승계).
                          toast-only no-op 폐기는 계약④ 그대로 유지 — 담김이 버튼 상태로 드러난다. */}
                      {inQuoteCart ? (
                        <Button asChild className="w-full py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-base shadow-none transition-colors flex items-center justify-center gap-2">
                          <Link href="/dashboard/quotes">
                            <Check className="w-5 h-5" />담김 ✓ · 견적함 보기
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          className="w-full py-3.5 bg-[#2f6be0] hover:bg-[#2456bd] text-white rounded-xl font-bold text-base shadow-sm transition-colors flex items-center justify-center gap-2 group"
                          onClick={() => {
                            const result = addToQuoteCart(product);
                            if (result.ok) {
                              setInQuoteCart(true);
                              window.dispatchEvent(new Event("quote-cart-changed")); // §PD-D 트레이 갱신 + ⑨-2 구독 재읽기
                              toast({ title: "견적함에 담았습니다", description: "견적 요청은 무료이며 구매 의무가 없습니다." });
                            } else {
                              toast({ title: "견적 담기 실패", description: "제품 정보를 확인할 수 없습니다.", variant: "destructive" });
                            }
                          }}
                        >
                          <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />견적 담기
                        </Button>
                      )}
                      {/* §product-detail-sourcing-v21 §7 — 레일 1행 압축.
                          · "견적 요청은 무료이며 구매 의무가 없습니다" 상시 문구 삭제(PD-A 은퇴) → 첫 담기 시 1회 안내 toast 로 이전.
                          · 보조 2분할(비교 검토 · 재고 조회) 삭제 — 비교는 배선 없음(dead button), 재고 진입은 §3 거래 맥락 블록이 담당.
                          · "영업 문의" 푸터 링크는 **존치**. 1차 삭제 시도의 근거("전역 내비가 /support 보유")는 실측 반증 —
                            이 표면은 자체 layout 이 없고 root layout·page 모두 MainHeader 를 렌더하지 않아 이 링크가
                            유일한 /support 진입이다. §detail-contrast-slate100 이 다크 맞춤견적 카드의 후신(대체 경로)으로
                            지정한 승계 계약이므로 삭제 금지 — §product-detail-sourcing-v21 §7 이 양성으로 잠근다. */}
                      <p className="text-[11px] text-slate-500 text-center pt-1">
                        대량 구매·특수 요구는 <Link href="/support" className="font-semibold text-blue-600 hover:underline">영업 문의</Link>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* ── §4 재발주 배너 (B2, 2026-08-09) ──
                    중복 견적 생성을 **동작으로** 막는다: 이 제품이 담긴 작성 중(PENDING) 견적이
                    있으면 생성하지 않고 그 견적을 연다(쓰기 0). 없을 때만 생성 CTA.
                    · "재발주안에 합류" 라벨 금지 — 실제로 합류하는 동작이 없다(항상 새 초안 생성).
                    · 열기 CTA 에 "재발주" 를 붙이지 않는다 — 그 견적의 출처를 모른다(의도적 비대칭).
                    · 트리거는 B1 의 FK 정확 재고(안전재고 미달)뿐 — 텍스트 매칭 미사용.
                    · 생성 진입점은 이 배너에 **하나만**. */}
                {(openDraftQuote || needsReorder) && (
                  <Card className="mt-3 border-yellow-200 bg-yellow-50">
                    <CardContent className="p-4">
                      {openDraftQuote ? (
                        <>
                          <p className="text-xs font-bold text-yellow-800">
                            이 제품이 담긴 견적을 작성 중입니다
                          </p>
                          <p className="text-[11px] text-yellow-700 mt-0.5 leading-relaxed">
                            새로 만들지 않고 이어서 진행하세요.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-testid="reorder-open-draft-cta"
                            className="mt-2.5 h-8 w-full text-xs font-semibold border-yellow-300 bg-white hover:bg-yellow-100"
                            onClick={() =>
                              router.push(
                                `/dashboard/quotes?prepare=${encodeURIComponent(openDraftQuote.id)}`,
                              )
                            }
                          >
                            작성 중인 견적 열기
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-yellow-800">
                            안전재고 미달 · 재발주 권장
                          </p>
                          <p className="text-[11px] text-yellow-700 mt-0.5 leading-relaxed">
                            부족분 {reorderShortfall}
                            {orgInventories[0]?.unit || "개"} 기준으로 초안을 만듭니다.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            disabled={creatingReorderQuote}
                            data-testid="reorder-create-quote-cta"
                            className="mt-2.5 h-8 w-full text-xs font-semibold bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
                            onClick={handleCreateReorderQuote}
                          >
                            {creatingReorderQuote ? "만드는 중…" : "재발주 견적 만들기"}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── §3 거래 맥락 — ①우리 조직 재고 (B1, 2026-08-09) ──
                    §3 계약: **데이터 없으면 블록 자체 숨김**. 0건이면 "재고 없음" 을 그리지 않는다
                    (빈 껍데기 = 정보량 0). §3-② 최근 구매 · §3-③ 구매가 이력은 소스 결정
                    대기로 이번 배치에 없다 — 계약상 미표시가 위반이 아니므로 단계 출고 가능
                    (SCOPING_product-detail-s3-s4-wiring §4). */}
                {orgInventories.length > 0 && (
                  <Card className="mt-3 border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Package className="h-3.5 w-3.5 text-slate-400" />
                        <h3 className="text-xs font-bold text-slate-900">우리 조직 재고</h3>
                        <span className="text-[11px] text-slate-400">· {orgInventories.length}건</span>
                      </div>
                      <div className="space-y-1.5">
                        {orgInventories.slice(0, 3).map((inv) => {
                          const below =
                            inv.safetyStock != null && inv.currentQuantity < inv.safetyStock;
                          return (
                            <div key={inv.id} className="flex items-center justify-between gap-2 min-w-0">
                              <span className="text-[11px] text-slate-500 truncate">
                                {inv.location?.trim() || "위치 미지정"}
                              </span>
                              <span
                                className={`text-xs font-bold shrink-0 ${below ? "text-[#b91c1c]" : "text-slate-900"}`}
                              >
                                {inv.currentQuantity}
                                <span className="text-[10px] font-medium text-slate-400 ml-0.5">
                                  {inv.unit || "개"}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                        {orgInventories.length > 3 && (
                          <p className="text-[10px] text-slate-400 pt-0.5">
                            외 {orgInventories.length - 3}건
                          </p>
                        )}
                      </div>
                      <Link
                        href="/dashboard/inventory"
                        className="mt-2.5 block text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        재고 관리에서 보기 →
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>

          {/* §1-2⑥ 리뷰 섹션 제거(리뷰 liquidity 0). 추천 섹션은 유지. */}
          <div className="mt-8">
            {/* 대체품 추천 */}
            <AlternativeProductsSection productId={id} currentProduct={product} />
            
            {/* §sourcing-quote-flow v1.1 §4 — 개인화 추천 섹션 **제거**(호영님 2026-08-12).
                제품 상세는 "이 물건 사도 되나" 를 판단하는 자리이고, 개인화 추천은 검색/홈 맥락이다.
                · §1-2⑥ "추천 섹션은 유지" 는 이 지시로 대체된다(대체품 추천은 존치 — 판단 재료).
                · §1-2⑤ category 고정 근거도 함께 소멸(호출 자체가 없어짐).
                ⚠️ `personalized-recommendations.tsx` 는 **삭제하지 않는다** — 검색/홈 이관 대상이다.
                   현재 이 표면이 유일 사용처였으므로 이관 전까지 orphan 이다(§cart-model-orphan 과 별개). */}
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
        {/* §product-detail-sourcing-v21 §7 — 납기 상시 행 삭제(1행 압축). 납기는 견적 회신에서 확정 — 상시 노출 가치 0. */}
        <div className="flex items-center justify-end">
          {/* §product-detail-refinement 계약④ — 모바일도 담김 시 견적 요청서 만들기(→/dashboard/quotes). toast-only no-op 폐기. */}
          {inQuoteCart ? (
            <Button asChild className="flex-shrink-0 py-3 px-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-base shadow-none transition-colors flex items-center justify-center gap-2">
              <Link href="/dashboard/quotes">
                <Check className="w-5 h-5" />담김 ✓ · 견적함 보기
              </Link>
            </Button>
          ) : (
            <Button
              className="flex-shrink-0 py-3 px-6 bg-[#2f6be0] hover:bg-[#2456bd] text-white rounded-xl font-bold text-base shadow-sm transition-colors flex items-center justify-center gap-2"
              onClick={() => {
                const result = addToQuoteCart(product);
                if (result.ok) {
                  setInQuoteCart(true);
                  window.dispatchEvent(new Event("quote-cart-changed")); // §PD-D 트레이 갱신 + ⑨-2 구독 재읽기
                  toast({ title: "견적함에 담았습니다", description: "견적 요청은 무료이며 구매 의무가 없습니다." });
                } else {
                  toast({ title: "견적 담기 실패", description: "제품 정보를 확인할 수 없습니다.", variant: "destructive" });
                }
              }}
            >
              <ShoppingCart className="w-5 h-5" />견적 담기
            </Button>
          )}
        </div>
        {/* §product-detail-sourcing-v21 §7 — 모바일도 상시 신뢰 문구 삭제(첫 담기 1회 toast 안내로 이전). */}
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

// §product-detail-sourcing-v21 §6 — 매칭 근거 파생(단일 출처).
//   PD-G 의 grade 누출 필터(§sourcing-product-surface 정합)를 승계하고, 근거 0건 = 추천 미노출 계약의 판정 함수.
function matchReasons(alt: any): string[] {
  if (!Array.isArray(alt?.similarityReasons)) return [];
  return alt.similarityReasons.filter((r: string) => !/grade/i.test(r));
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

  // §product-detail-sourcing-v21 §6 — 비교 store 의존 제거(비교 버튼 폐기). toast 도 이 섹션에선 미사용.
  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm rounded-[18px] p-6 md:p-8 border border-gray-200 mt-5">
        <CardContent>
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  // §product-detail-sourcing-v21 §6 — 매칭 근거 칩 1개 필수. 근거 산출 불가 품목은 추천 자체를 노출하지 않는다
  //   ("왜 이게 대체품인지" 없는 추천 = 판단 불가 noise). grade 누출 필터는 PD-G 승계.
  const shown = ((alternatives?.alternatives ?? []) as any[]).filter(
    (alt) => matchReasons(alt).length > 0,
  );
  if (shown.length === 0) return null;

  return (
    <Card className="bg-white shadow-sm rounded-[18px] p-6 md:p-8 border border-gray-200 mt-5">
      <CardHeader>
        {/* §product-detail-sourcing-v21 §6 — 제목 옆 건수 인라인(설명문에 묻힌 "총 N건" 패턴 폐기). */}
        <CardTitle className="text-lg font-semibold">
          대체품 추천 <span className="ml-1 text-[11.5px] font-medium text-slate-400">유사 스펙 {shown.length}건</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* §sourcing-quote-flow v1.1 §4 — 대체품 카드 간 12px(gap-3). 섹션 간은 20px(mt-5). */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {shown.map((alt: any) => {
            const minPrice = alt.vendors?.[0]?.priceInKRW;

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
                  {/* §product-detail-sourcing-v21 §6 — 매칭 근거 칩 **1개**(중복 나열 폐기). 근거 0건 품목은 위에서 이미 제외됨. */}
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                      {matchReasons(alt)[0]}
                    </span>
                  </div>
                  {minPrice !== undefined && (
                    <div className="text-sm font-semibold">
                      ₩{minPrice.toLocaleString("ko-KR")}
                    </div>
                  )}
                  {/* §product-detail-sourcing-v21 §6 — 비교 버튼 삭제(비교 화면 배선 전까지 dead button 금지). 상세 링크만. */}
                  <div className="flex">
                    <Link
                      href={`/products/${alt.id}`}
                      className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
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
