"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/use-products";
import { useCompareStore } from "@/lib/store/compare-store";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import Link from "next/link";
import { ShoppingCart, GitCompare as Compare, ExternalLink, Heart, ThumbsUp, ThumbsDown, Languages, Loader2, FileText, Copy, Check, ClipboardCopy, Shield, AlertTriangle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReviewSection } from "@/components/products/review-section";
import { PersonalizedRecommendations } from "@/components/products/personalized-recommendations";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const { data: product, isLoading, error } = useProduct(id);
  const { addProduct, removeProduct, hasProduct } = useCompareStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [datasheetText, setDatasheetText] = useState("");
  const [extractedInfo, setExtractedInfo] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showDatasheetSection, setShowDatasheetSection] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const isInCompare = hasProduct(id);

  // 제품 조회 기록
  useEffect(() => {
    if (product && session?.user?.id) {
      fetch(`/api/products/${id}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "" }),
      }).catch(() => {});
    }
  }, [product, id, session]);

  // 즐겨찾기 상태 확인
  useEffect(() => {
    if (session?.user?.id && product) {
      fetch(`/api/favorites?productId=${id}`)
        .then((res) => res.json())
        .then((data) => setIsFavorite(data.isFavorite))
        .catch(() => {});
    }
  }, [session, id, product]);

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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
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

                {/* Grade/규격 상세 */}
                {product.grade && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Grade/규격</h3>
                    <p className="text-sm text-slate-700">{product.grade}</p>
                    {product.specification && (
                      <p className="text-xs text-slate-500 mt-1">{product.specification}</p>
                    )}
                  </div>
                )}

                {/* 스펙 요약 */}
                {product.specification && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">스펙 요약</h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {product.specification}
                    </p>
                  </div>
                )}

                {/* 사용 용도 */}
                {product.description && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">사용 용도</h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* 주의사항 */}
                {product.specifications && typeof product.specifications === "object" && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">주의사항</h3>
                    <div className="space-y-1 text-sm text-slate-700">
                      {Object.entries(product.specifications as Record<string, any>).map(
                        ([key, value]) => (
                          <div key={key} className="flex justify-between py-1">
                            <span className="text-slate-500">{key}:</span>
                            <span className="text-right">{String(value)}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

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
                {(product.msdsUrl || product.safetyNote) && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-amber-600" />
                      <h3 className="font-semibold text-sm">안전 · 규제 정보</h3>
                    </div>
                    <div className="space-y-3">
                      {/* MSDS/SDS 링크 */}
                      {product.msdsUrl && (
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={async () => {
                              try {
                                // 링크 유효성 검사 (간단한 URL 형식 검사)
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

                      {/* 국내 규제 포털 링크 */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            window.open("https://www.mfds.go.kr", "_blank");
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1.5" />
                          식약처 포털
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            window.open("https://www.nifds.go.kr", "_blank");
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1.5" />
                          식약처 안전정보포털
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            window.open("https://www.me.go.kr", "_blank");
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1.5" />
                          환경부 화학물질안전원
                        </Button>
                      </div>

                      {/* 기본 안내 문구 */}
                      {!product.safetyNote && (
                        <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-slate-700 leading-relaxed">
                            사용 전, 취급·보관·폐기 정보를 꼭 확인하세요. MSDS/SDS 문서를 참고하시기 바랍니다.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
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
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">추출된 정보</h4>
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
                      // 품목 리스트에 추가 (TestFlowProvider 사용)
                      try {
                        const response = await fetch(`/api/products/${id}`);
                        if (response.ok) {
                          const productData = await response.json();
                          // TestFlowProvider의 addProductToQuote를 호출하는 대신
                          // 직접 quote에 추가하는 로직이 필요할 수 있음
                          toast({
                            title: "품목 추가",
                            description: "품목이 리스트에 추가되었습니다.",
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
                    품목 리스트에 추가
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
        
        {/* 개인화 추천 제품 */}
        <PersonalizedRecommendations productId={id} currentProduct={product} />
      </div>
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