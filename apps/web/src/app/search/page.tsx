"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchProducts, useBrands } from "@/hooks/use-products";
import { useSearchIntent } from "@/hooks/use-search-intent";
import { useCompareStore } from "@/lib/store/compare-store";
import { PRODUCT_CATEGORIES, SORT_OPTIONS } from "@/lib/constants";
import type { ProductCategory } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuoteListTable } from "@/components/products/quote-list-table";
import { PriceDisplay } from "@/components/products/price-display";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState<ProductCategory | undefined>(
    (searchParams.get("category") as ProductCategory) || undefined
  );
  const [brand, setBrand] = useState(searchParams.get("brand") || "");
  const [sortBy, setSortBy] = useState<"relevance" | "price_low" | "price_high" | "lead_time" | "review">(
    (searchParams.get("sortBy") as any) || "relevance"
  );
  const [quoteProductIds, setQuoteProductIds] = useState<string[]>([]);
  const [showQuoteListDialog, setShowQuoteListDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [quoteListItems, setQuoteListItems] = useState<Array<{
    id: string;
    productId: string;
    product: any;
    quantity: number;
    unitPrice?: number;
    currency?: string;
    lineTotal?: number;
    notes?: string;
  }>>([]);

  const { productIds: compareProductIds, addProduct, removeProduct, hasProduct } = useCompareStore();
  const searchIntentMutation = useSearchIntent();

  // ê²€?‰ì–´ê°€ ë³€ê²½ë˜ë©??˜ë„ ë¶„ì„ (?”ë°”?´ì‹±)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchIntentMutation.mutate(searchQuery, {
          onSuccess: (data) => {
            if (data.intent?.category && !category) {
              setCategory(data.intent.category);
            }
            if (data.intent?.brandPreference && data.intent.brandPreference.length > 0 && !brand) {
              setBrand(data.intent.brandPreference[0]);
            }
          },
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const { data: searchData, isLoading } = useSearchProducts({
    query: searchQuery || undefined,
    category,
    brand: brand || undefined,
    sortBy,
    page: 1,
    limit: 20,
  });

  const { data: brands } = useBrands();

  const products = searchData?.products || [];
  const quoteProducts = products.filter((p: any) => quoteProductIds.includes(p.id));

  // ë²ˆì—­ ë¯¸ë¦¬ë³´ê¸° ?ì„±
  const translateMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: "en" }),
      });
      if (!response.ok) throw new Error("Failed to translate");
      return response.json();
    },
  });


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (category) params.set("category", category);
    if (brand) params.set("brand", brand);
    if (sortBy) params.set("sortBy", sortBy);
    router.push(`/search?${params.toString()}`);
  };

  const toggleCompare = (productId: string) => {
    if (hasProduct(productId)) {
      removeProduct(productId);
    } else {
      addProduct(productId);
    }
  };

  const toggleQuote = (productId: string) => {
    setQuoteProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  // ?ˆëª© ë¦¬ìŠ¤????ª© ?…ë°?´íŠ¸ (?œí’ˆ ?•ë³´ ?¬í•¨)
  useEffect(() => {
    const newItems = quoteProductIds.map((productId) => {
      const product = products.find((p: any) => p.id === productId);
      if (!product) return null;
      
      const vendor = product.vendors?.[0];
      const unitPrice = vendor?.priceInKRW || 0;
      
      return {
        id: productId,
        productId,
        product: {
          ...product,
          vendors: product.vendors || [],
        },
        quantity: 1,
        unitPrice,
        currency: vendor?.currency || "KRW",
        lineTotal: unitPrice,
        notes: "",
      };
    }).filter(Boolean) as Array<{
      id: string;
      productId: string;
      product: any;
      quantity: number;
      unitPrice?: number;
      currency?: string;
      lineTotal?: number;
      notes?: string;
    }>;
    
    // ê¸°ì¡´ ??ª©???˜ëŸ‰/ë¹„ê³ ??? ì??˜ê³ , ????ª©ë§?ì¶”ê?
    setQuoteListItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.id));
      const updated = prev.map((item) => {
        const newItem = newItems.find((n) => n.id === item.id);
        return newItem ? { ...newItem, quantity: item.quantity, notes: item.notes } : item;
      });
      const added = newItems.filter((item) => !existingIds.has(item.id));
      return [...updated, ...added];
    });
  }, [quoteProductIds, products]);

  const handleUpdateQuantity = (id: string, quantity: number) => {
    // ?íƒœ ?…ë°?´íŠ¸???¤ì œë¡œëŠ” API ?¸ì¶œë¡?ì²˜ë¦¬
    setQuoteListItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity, lineTotal: (item.unitPrice || 0) * quantity }
          : item
      )
    );
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    setQuoteListItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes } : item))
    );
  };

  const handleUpdateUnitPrice = (id: string, price: number) => {
    setQuoteListItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, unitPrice: price, lineTotal: price * item.quantity }
          : item
      )
    );
  };

  const handleRemoveFromList = (id: string) => {
    setQuoteProductIds((prev) => prev.filter((pid) => pid !== id));
  };

  const handleSaveQuoteList = async () => {
    if (quoteListItems.length === 0) {
      alert("?ˆëª© ë¦¬ìŠ¤?¸ì— ì¶”ê????œí’ˆ???†ìŠµ?ˆë‹¤.");
      return;
    }

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `?ˆëª© ë¦¬ìŠ¤??- ${new Date().toLocaleDateString()}`,
          message: "ê·¸ë£¹?¨ì–´???ˆëª© ë¦¬ìŠ¤??,
          productIds: quoteListItems.map((item) => item.productId),
          quantities: Object.fromEntries(
            quoteListItems.map((item) => [item.productId, item.quantity])
          ),
          notes: Object.fromEntries(
            quoteListItems.map((item) => [item.productId, item.notes || ""])
          ),
        }),
      });

      if (!response.ok) throw new Error("Failed to create quote list");

      alert("?ˆëª© ë¦¬ìŠ¤?¸ê? ?€?¥ë˜?ˆìŠµ?ˆë‹¤.");
      setShowQuoteListDialog(false);
    } catch (error: any) {
      alert(error.message || "?ˆëª© ë¦¬ìŠ¤???€?¥ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        {/* ê²€???¤ë” */}
        <section className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              ?œí’ˆ ê²€??ë°?ë¹„êµ
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              ?œí’ˆ??ê²€?‰í•˜ê³??´ë¦­?˜ë©´ ?ì„¸ ?˜ì´ì§€ë¡??´ë™?©ë‹ˆ??            </p>
          </div>

          {/* ê²€??ë°??„í„° */}
          <div className="space-y-4">
          {/* ê²€?‰ì°½ */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="search"
                placeholder="?? Human IL-6 ELISA kit"
                className="pl-12 h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit" className="gap-2">
              <Search className="h-4 w-4" />
              ê²€??            </Button>
          </form>

          {/* ê²€???˜ë„ ì¹?*/}
          {searchIntentMutation.data?.intent && (
            <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-xs font-medium text-muted-foreground">ê²€???˜ë„:</span>
              {searchIntentMutation.data.intent.category && (
                <Badge variant="outline" className="text-xs">
                  {PRODUCT_CATEGORIES[searchIntentMutation.data.intent.category]}
                </Badge>
              )}
              {searchIntentMutation.data.intent.purpose && (
                <Badge variant="outline" className="text-xs bg-blue-50">
                  ?©ë„: {searchIntentMutation.data.intent.purpose}
                </Badge>
              )}
              {searchIntentMutation.data.intent.targetExperiment && (
                <Badge variant="outline" className="text-xs bg-green-50">
                  ?¤í—˜: {searchIntentMutation.data.intent.targetExperiment}
                </Badge>
              )}
            </div>
          )}

          {/* ?„í„° ë°??•ë ¬ */}
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={category || ""}
              onChange={(e) => setCategory((e.target.value as ProductCategory) || undefined)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">?„ì²´ ì¹´í…Œê³ ë¦¬</option>
              {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            {brands && brands.length > 0 && (
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">?„ì²´ ë¸Œëœ??/option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* ê²€??ê²°ê³¼ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ê²€??ê²°ê³¼ ({products.length}ê°?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">ê²€??ì¤?..</p>
              ) : products.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">ê²€??ê²°ê³¼ê°€ ?†ìŠµ?ˆë‹¤</p>
              ) : (
                products.map((product: any) => {
                  const minPrice = product.vendors?.reduce(
                    (min: number, v: any) =>
                      v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                    null
                  );
                  const inCompare = hasProduct(product.id);
                  const inQuote = quoteProductIds.includes(product.id);

                  return (
                    <div
                      key={product.id}
                      className="w-full rounded-lg border bg-white p-3 text-left text-sm transition hover:border-slate-300 hover:bg-slate-50 border-slate-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <button
                            type="button"
                            onClick={() => router.push(`/products/${product.id}`)}
                            className="text-left w-full"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium hover:text-blue-600">{product.name}</span>
                              {product.brand && (
                                <span className="text-xs text-slate-400">{product.brand}</span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                              {product.category && (
                                <Badge variant="outline" className="text-[10px]">
                                  {PRODUCT_CATEGORIES[product.category]}
                                </Badge>
                              )}
                              {minPrice && <span>??minPrice.toLocaleString()}</span>}
                            </div>
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 text-[11px] items-end">
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1">
                              <Checkbox
                                checked={inCompare}
                                onCheckedChange={() => toggleCompare(product.id)}
                              />
                              <span>ë¹„êµ</span>
                            </label>
                            <label className="inline-flex items-center gap-1">
                              <Checkbox
                                checked={inQuote}
                                onCheckedChange={() => toggleQuote(product.id)}
                              />
                              <span>ê²¬ì </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* ë¹„êµ ë°?ê²¬ì  ?¡ì…˜ */}
          {(compareProductIds.length > 0 || quoteProductIds.length > 0) && (
            <div className="flex gap-2">
              {compareProductIds.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => router.push("/compare")}
                  className="gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  ë¹„êµ ?˜ì´ì§€ë¡??´ë™ ({compareProductIds.length}ê°?
                </Button>
              )}
              {quoteProductIds.length > 0 && (
                <Button
                  onClick={() => setShowQuoteListDialog(true)}
                  className="gap-2"
                >
                  ?ˆëª© ë¦¬ìŠ¤???ì„± ({quoteProductIds.length}ê°?
                </Button>
              )}
            </div>
          )}
          </div>
        </section>

        {/* ?ˆëª© ë¦¬ìŠ¤???ì„± ?¤ì´?¼ë¡œê·?*/}
        <Dialog open={showQuoteListDialog} onOpenChange={setShowQuoteListDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ê·¸ë£¹?¨ì–´???ˆëª© ë¦¬ìŠ¤???ì„±</DialogTitle>
              <DialogDescription>
                ? íƒ???œí’ˆ?¤ì„ ê·¸ë£¹?¨ì–´ êµ¬ë§¤? ì²­ ?‘ì‹???¬ìš©?????ˆëŠ” ?•íƒœë¡??•ë¦¬?©ë‹ˆ??
                ?´ë¦½ë³´ë“œ ë³µì‚¬ ?ëŠ” ?‘ì? ?¤ìš´ë¡œë“œë¡?ê·¸ë£¹?¨ì–´??ë¶™ì—¬?£ì„ ???ˆìŠµ?ˆë‹¤.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <QuoteListTable
                items={quoteListItems}
                onRemove={handleRemoveFromList}
                onUpdateQuantity={handleUpdateQuantity}
                onUpdateNotes={handleUpdateNotes}
                onUpdateUnitPrice={handleUpdateUnitPrice}
                selectedTemplateId={selectedTemplateId}
                onTemplateChange={setSelectedTemplateId}
                templateType="RND"
              />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowQuoteListDialog(false)}>
                  ?«ê¸°
                </Button>
                <Button onClick={handleSaveQuoteList} disabled={quoteListItems.length === 0}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  ë¦¬ìŠ¤???€??                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
