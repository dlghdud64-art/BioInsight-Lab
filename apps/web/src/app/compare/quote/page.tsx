"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompareStore } from "@/lib/store/compare-store";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Languages, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function QuotePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { productIds } = useCompareStore();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [englishText, setEnglishText] = useState<string | null>(null);
  const [englishSubject, setEnglishSubject] = useState<string | null>(null);
  const [isGeneratingEnglish, setIsGeneratingEnglish] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["compare", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return { products: [] };
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: productIds.length > 0,
  });

  const products = data?.products || [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  // 로그인 확인
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/compare/quote")}`);
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title || `제품 견적 요청 (${products.length}개)`,
          message,
          deliveryDate: deliveryDate || undefined,
          deliveryLocation,
          specialNotes,
          productIds: productIds,
          quantities,
          notes: itemNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청에 실패했습니다.");
      }

      const data = await response.json();
      // 성공 시 대시보드로 이동
      window.location.href = `/dashboard/quotes/${data.quote.id}`;
    } catch (error: any) {
      alert(error.message || "견적 요청 중 오류가 발생했습니다.");
      console.error("Error submitting quote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateEnglish = async () => {
    if (products.length === 0) {
      toast({
        title: "제품이 없습니다",
        description: "견적을 요청할 제품을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingEnglish(true);
    try {
      const items = products.map((product: any) => ({
        productId: product.id,
        quantity: quantities[product.id] || 1,
        notes: itemNotes[product.id] || "",
      }));

      const response = await fetch("/api/quotes/generate-english", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          deliveryDate,
          deliveryLocation,
          specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "영문 텍스트 생성에 실패했습니다.");
      }

      const data = await response.json();
      setEnglishText(data.englishText);
      setEnglishSubject(data.subject);
      toast({
        title: "생성 완료",
        description: "영문 견적 요청 텍스트가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error.message || "영문 텍스트 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEnglish(false);
    }
  };

  const handleCopyEnglish = async () => {
    if (!englishText) return;

    const fullText = englishSubject
      ? `Subject: ${englishSubject}\n\n${englishText}`
      : englishText;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "영문 텍스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "텍스트 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // useEffect에서 리다이렉트 처리
  }

  if (productIds.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              비교할 제품이 없습니다
            </p>
            <div className="text-center">
              <Link href="/search">
                <Button>제품 검색하기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">견적 요청</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>요청 정보</CardTitle>
              <CardDescription>
                견적을 요청할 제품 정보를 확인하고 요청 내용을 작성해주세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">견적 제목</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: PCR 시약 견적 요청"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">요청 내용</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="기본 요청 사항을 작성해주세요"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">납기 희망일</label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">납품 장소</label>
                <Input
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  placeholder="예: 서울대학교 생명과학관 101호"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">특이사항</label>
                <Textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="특별한 요구사항이나 주의사항을 작성해주세요"
                  rows={3}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateEnglish}
                  disabled={isGeneratingEnglish || products.length === 0}
                  className="w-full"
                >
                  <Languages className="h-4 w-4 mr-2" />
                  {isGeneratingEnglish ? "생성 중..." : "영문 견적 요청 텍스트 생성"}
                </Button>
              </div>

              {englishText && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">생성된 영문 텍스트</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyEnglish}
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
                  {englishSubject && (
                    <div className="text-xs text-muted-foreground">
                      <strong>Subject:</strong> {englishSubject}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap border rounded p-3 bg-white max-h-96 overflow-y-auto">
                    {englishText}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>요청 제품 ({products.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">로딩 중...</p>
              ) : (
                <div className="space-y-3">
                  {products.map((product: any) => (
                    <div key={product.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          {product.brand && (
                            <div className="text-sm text-muted-foreground">
                              브랜드: {product.brand}
                            </div>
                          )}
                          {product.catalogNumber && (
                            <div className="text-sm text-muted-foreground">
                              카탈로그 번호: {product.catalogNumber}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <label className="text-sm font-medium">수량:</label>
                        <Input
                          type="number"
                          min="1"
                          value={quantities[product.id] || 1}
                          onChange={(e) =>
                            setQuantities({
                              ...quantities,
                              [product.id]: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-20"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1">비고:</label>
                        <Textarea
                          value={itemNotes[product.id] || ""}
                          onChange={(e) =>
                            setItemNotes({
                              ...itemNotes,
                              [product.id]: e.target.value,
                            })
                          }
                          placeholder="제품별 특별 요구사항 (선택사항)"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Link href="/compare" className="flex-1">
              <Button variant="outline" className="w-full">취소</Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isSubmitting ? "처리 중..." : "견적 요청하기"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompareStore } from "@/lib/store/compare-store";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Languages, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function QuotePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { productIds } = useCompareStore();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [englishText, setEnglishText] = useState<string | null>(null);
  const [englishSubject, setEnglishSubject] = useState<string | null>(null);
  const [isGeneratingEnglish, setIsGeneratingEnglish] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["compare", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return { products: [] };
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: productIds.length > 0,
  });

  const products = data?.products || [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  // 로그인 확인
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/compare/quote")}`);
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title || `제품 견적 요청 (${products.length}개)`,
          message,
          deliveryDate: deliveryDate || undefined,
          deliveryLocation,
          specialNotes,
          productIds: productIds,
          quantities,
          notes: itemNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청에 실패했습니다.");
      }

      const data = await response.json();
      // 성공 시 대시보드로 이동
      window.location.href = `/dashboard/quotes/${data.quote.id}`;
    } catch (error: any) {
      alert(error.message || "견적 요청 중 오류가 발생했습니다.");
      console.error("Error submitting quote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateEnglish = async () => {
    if (products.length === 0) {
      toast({
        title: "제품이 없습니다",
        description: "견적을 요청할 제품을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingEnglish(true);
    try {
      const items = products.map((product: any) => ({
        productId: product.id,
        quantity: quantities[product.id] || 1,
        notes: itemNotes[product.id] || "",
      }));

      const response = await fetch("/api/quotes/generate-english", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          deliveryDate,
          deliveryLocation,
          specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "영문 텍스트 생성에 실패했습니다.");
      }

      const data = await response.json();
      setEnglishText(data.englishText);
      setEnglishSubject(data.subject);
      toast({
        title: "생성 완료",
        description: "영문 견적 요청 텍스트가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error.message || "영문 텍스트 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEnglish(false);
    }
  };

  const handleCopyEnglish = async () => {
    if (!englishText) return;

    const fullText = englishSubject
      ? `Subject: ${englishSubject}\n\n${englishText}`
      : englishText;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "영문 텍스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "텍스트 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // useEffect에서 리다이렉트 처리
  }

  if (productIds.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              비교할 제품이 없습니다
            </p>
            <div className="text-center">
              <Link href="/search">
                <Button>제품 검색하기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">견적 요청</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>요청 정보</CardTitle>
              <CardDescription>
                견적을 요청할 제품 정보를 확인하고 요청 내용을 작성해주세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">견적 제목</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: PCR 시약 견적 요청"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">요청 내용</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="기본 요청 사항을 작성해주세요"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">납기 희망일</label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">납품 장소</label>
                <Input
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  placeholder="예: 서울대학교 생명과학관 101호"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">특이사항</label>
                <Textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="특별한 요구사항이나 주의사항을 작성해주세요"
                  rows={3}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateEnglish}
                  disabled={isGeneratingEnglish || products.length === 0}
                  className="w-full"
                >
                  <Languages className="h-4 w-4 mr-2" />
                  {isGeneratingEnglish ? "생성 중..." : "영문 견적 요청 텍스트 생성"}
                </Button>
              </div>

              {englishText && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">생성된 영문 텍스트</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyEnglish}
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
                  {englishSubject && (
                    <div className="text-xs text-muted-foreground">
                      <strong>Subject:</strong> {englishSubject}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap border rounded p-3 bg-white max-h-96 overflow-y-auto">
                    {englishText}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>요청 제품 ({products.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">로딩 중...</p>
              ) : (
                <div className="space-y-3">
                  {products.map((product: any) => (
                    <div key={product.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          {product.brand && (
                            <div className="text-sm text-muted-foreground">
                              브랜드: {product.brand}
                            </div>
                          )}
                          {product.catalogNumber && (
                            <div className="text-sm text-muted-foreground">
                              카탈로그 번호: {product.catalogNumber}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <label className="text-sm font-medium">수량:</label>
                        <Input
                          type="number"
                          min="1"
                          value={quantities[product.id] || 1}
                          onChange={(e) =>
                            setQuantities({
                              ...quantities,
                              [product.id]: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-20"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1">비고:</label>
                        <Textarea
                          value={itemNotes[product.id] || ""}
                          onChange={(e) =>
                            setItemNotes({
                              ...itemNotes,
                              [product.id]: e.target.value,
                            })
                          }
                          placeholder="제품별 특별 요구사항 (선택사항)"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Link href="/compare" className="flex-1">
              <Button variant="outline" className="w-full">취소</Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isSubmitting ? "처리 중..." : "견적 요청하기"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompareStore } from "@/lib/store/compare-store";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Languages, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function QuotePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { productIds } = useCompareStore();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [englishText, setEnglishText] = useState<string | null>(null);
  const [englishSubject, setEnglishSubject] = useState<string | null>(null);
  const [isGeneratingEnglish, setIsGeneratingEnglish] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["compare", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return { products: [] };
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: productIds.length > 0,
  });

  const products = data?.products || [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  // 로그인 확인
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/compare/quote")}`);
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title || `제품 견적 요청 (${products.length}개)`,
          message,
          deliveryDate: deliveryDate || undefined,
          deliveryLocation,
          specialNotes,
          productIds: productIds,
          quantities,
          notes: itemNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청에 실패했습니다.");
      }

      const data = await response.json();
      // 성공 시 대시보드로 이동
      window.location.href = `/dashboard/quotes/${data.quote.id}`;
    } catch (error: any) {
      alert(error.message || "견적 요청 중 오류가 발생했습니다.");
      console.error("Error submitting quote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateEnglish = async () => {
    if (products.length === 0) {
      toast({
        title: "제품이 없습니다",
        description: "견적을 요청할 제품을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingEnglish(true);
    try {
      const items = products.map((product: any) => ({
        productId: product.id,
        quantity: quantities[product.id] || 1,
        notes: itemNotes[product.id] || "",
      }));

      const response = await fetch("/api/quotes/generate-english", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          deliveryDate,
          deliveryLocation,
          specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "영문 텍스트 생성에 실패했습니다.");
      }

      const data = await response.json();
      setEnglishText(data.englishText);
      setEnglishSubject(data.subject);
      toast({
        title: "생성 완료",
        description: "영문 견적 요청 텍스트가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error.message || "영문 텍스트 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEnglish(false);
    }
  };

  const handleCopyEnglish = async () => {
    if (!englishText) return;

    const fullText = englishSubject
      ? `Subject: ${englishSubject}\n\n${englishText}`
      : englishText;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "영문 텍스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "텍스트 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // useEffect에서 리다이렉트 처리
  }

  if (productIds.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              비교할 제품이 없습니다
            </p>
            <div className="text-center">
              <Link href="/search">
                <Button>제품 검색하기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">견적 요청</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>요청 정보</CardTitle>
              <CardDescription>
                견적을 요청할 제품 정보를 확인하고 요청 내용을 작성해주세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">견적 제목</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: PCR 시약 견적 요청"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">요청 내용</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="기본 요청 사항을 작성해주세요"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">납기 희망일</label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">납품 장소</label>
                <Input
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  placeholder="예: 서울대학교 생명과학관 101호"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">특이사항</label>
                <Textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="특별한 요구사항이나 주의사항을 작성해주세요"
                  rows={3}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateEnglish}
                  disabled={isGeneratingEnglish || products.length === 0}
                  className="w-full"
                >
                  <Languages className="h-4 w-4 mr-2" />
                  {isGeneratingEnglish ? "생성 중..." : "영문 견적 요청 텍스트 생성"}
                </Button>
              </div>

              {englishText && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">생성된 영문 텍스트</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyEnglish}
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
                  {englishSubject && (
                    <div className="text-xs text-muted-foreground">
                      <strong>Subject:</strong> {englishSubject}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap border rounded p-3 bg-white max-h-96 overflow-y-auto">
                    {englishText}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>요청 제품 ({products.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">로딩 중...</p>
              ) : (
                <div className="space-y-3">
                  {products.map((product: any) => (
                    <div key={product.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          {product.brand && (
                            <div className="text-sm text-muted-foreground">
                              브랜드: {product.brand}
                            </div>
                          )}
                          {product.catalogNumber && (
                            <div className="text-sm text-muted-foreground">
                              카탈로그 번호: {product.catalogNumber}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <label className="text-sm font-medium">수량:</label>
                        <Input
                          type="number"
                          min="1"
                          value={quantities[product.id] || 1}
                          onChange={(e) =>
                            setQuantities({
                              ...quantities,
                              [product.id]: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-20"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1">비고:</label>
                        <Textarea
                          value={itemNotes[product.id] || ""}
                          onChange={(e) =>
                            setItemNotes({
                              ...itemNotes,
                              [product.id]: e.target.value,
                            })
                          }
                          placeholder="제품별 특별 요구사항 (선택사항)"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Link href="/compare" className="flex-1">
              <Button variant="outline" className="w-full">취소</Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isSubmitting ? "처리 중..." : "견적 요청하기"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

