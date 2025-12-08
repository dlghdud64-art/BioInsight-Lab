"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReorderRecommendations } from "@/components/inventory/reorder-recommendations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, History, ExternalLink, Calendar, MapPin, Package } from "lucide-react";
import Link from "next/link";
import { QUOTE_STATUS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 견적 목록 조회
  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const response = await fetch("/api/quotes");
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 즐겨찾기 조회
  const { data: favoritesData, isLoading: favoritesLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const response = await fetch("/api/favorites");
      if (!response.ok) throw new Error("Failed to fetch favorites");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 최근 본 제품 조회
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ["recent-products"],
    queryFn: async () => {
      const response = await fetch("/api/recent-products");
      if (!response.ok) throw new Error("Failed to fetch recent products");
      return response.json();
    },
    enabled: status === "authenticated",
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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard");
    return null;
  }

  const quotes = quotesData?.quotes || [];
  const favorites = favoritesData?.favorites || [];
  const recentProducts = recentData?.products || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">대시보드</h1>

        {/* 재주문 추천 섹션 (상단에 표시) */}
        <div className="mb-6">
          <ReorderRecommendations
            onAddToQuoteList={(recommendations) => {
              // 추천 목록을 품목 리스트에 추가
              const productIds = recommendations.map((r) => r.product.id);
              router.push(`/search?bom=${encodeURIComponent(JSON.stringify(recommendations.map(r => ({
                name: r.product.name,
                quantity: r.recommendedQuantity,
                category: r.product.category,
              }))))}`);
            }}
          />
        </div>

        <Tabs defaultValue="quotes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="quotes">
              <ShoppingCart className="h-4 w-4 mr-2" />
              견적 요청 ({quotes.length})
            </TabsTrigger>
            <TabsTrigger value="favorites">
              <Heart className="h-4 w-4 mr-2" />
              즐겨찾기 ({favorites.length})
            </TabsTrigger>
            <TabsTrigger value="recent">
              <History className="h-4 w-4 mr-2" />
              최근 본 제품 ({recentProducts.length})
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-2" />
              재고 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>견적 요청 현황</CardTitle>
                <CardDescription>
                  내가 보낸 견적 요청과 응답 상태를 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quotesLoading ? (
                  <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                ) : quotes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">견적 요청 내역이 없습니다</p>
                    <Link href="/search">
                      <Button>제품 검색하기</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quotes.map((quote: any) => (
                      <Card key={quote.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{quote.title}</CardTitle>
                              <CardDescription className="mt-1">
                                {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
                              </CardDescription>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                quote.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : quote.status === "RESPONDED"
                                  ? "bg-blue-100 text-blue-800"
                                  : quote.status === "CANCELLED"
                                  ? "bg-gray-100 text-gray-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {QUOTE_STATUS[quote.status as keyof typeof QUOTE_STATUS]}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {quote.message && (
                            <p className="text-sm text-muted-foreground mb-3">{quote.message}</p>
                          )}
                          <div className="space-y-2 text-sm">
                            {quote.deliveryDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>납기 희망일: {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}</span>
                              </div>
                            )}
                            {quote.deliveryLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>납품 장소: {quote.deliveryLocation}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-4">
                            <p className="text-sm font-medium mb-2">
                              요청 제품 ({quote.items?.length || 0}개)
                            </p>
                            <div className="space-y-1">
                              {quote.items?.map((item: any) => (
                                <div key={item.id} className="text-sm text-muted-foreground">
                                  • {item.product?.name} (수량: {item.quantity})
                                </div>
                              ))}
                            </div>
                          </div>
                          {quote.responses && quote.responses.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-sm font-medium mb-2">
                                견적 응답 ({quote.responses.length}개)
                              </p>
                              {quote.responses.map((response: any) => (
                                <div key={response.id} className="text-sm">
                                  <span className="font-medium">{response.vendor?.name}:</span>{" "}
                                  {response.totalPrice
                                    ? `₩${response.totalPrice.toLocaleString()}`
                                    : "가격 문의"}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-4">
                            <Link href={`/dashboard/quotes/${quote.id}`}>
                              <Button variant="outline" size="sm">
                                상세 보기
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>즐겨찾기 제품</CardTitle>
                <CardDescription>
                  저장한 제품을 빠르게 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {favoritesLoading ? (
                  <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">즐겨찾기한 제품이 없습니다</p>
                    <Link href="/search">
                      <Button>제품 검색하기</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favorites.map((favorite: any) => {
                      const product = favorite.product;
                      const minPrice = product?.vendors?.reduce(
                        (min: number, v: any) =>
                          v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                        null
                      );

                      return (
                        <Card key={favorite.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <CardTitle className="text-base">
                              <Link
                                href={`/products/${product.id}`}
                                className="hover:underline"
                              >
                                {product.name}
                              </Link>
                            </CardTitle>
                            {product.brand && (
                              <CardDescription>{product.brand}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {product.category && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  {PRODUCT_CATEGORIES[product.category]}
                                </span>
                              )}
                              {minPrice ? (
                                <div className="text-lg font-semibold">
                                  ₩{minPrice.toLocaleString()}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">가격 문의</div>
                              )}
                              <Link href={`/products/${product.id}`}>
                                <Button size="sm" className="w-full mt-2">
                                  상세 보기
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>최근 본 제품</CardTitle>
                <CardDescription>
                  최근에 조회한 제품 목록입니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentLoading ? (
                  <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                ) : recentProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">최근 본 제품이 없습니다</p>
                    <Link href="/search">
                      <Button>제품 검색하기</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentProducts.map((product: any) => {
                      const minPrice = product?.vendors?.reduce(
                        (min: number, v: any) =>
                          v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                        null
                      );

                      return (
                        <Card key={product.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <CardTitle className="text-base">
                              <Link
                                href={`/products/${product.id}`}
                                className="hover:underline"
                              >
                                {product.name}
                              </Link>
                            </CardTitle>
                            {product.brand && (
                              <CardDescription>{product.brand}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {product.category && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  {PRODUCT_CATEGORIES[product.category]}
                                </span>
                              )}
                              {minPrice ? (
                                <div className="text-lg font-semibold">
                                  ₩{minPrice.toLocaleString()}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">가격 문의</div>
                              )}
                              <Link href={`/products/${product.id}`}>
                                <Button size="sm" className="w-full mt-2">
                                  상세 보기
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}