"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TestCard } from "./test-card";
import { Button } from "@/components/ui/button";
import { Copy, Download, Share2, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

interface ShareActionsCardProps {
  productIds: string[];
}

export function ShareActionsCard({ productIds }: ShareActionsCardProps) {
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareTitle, setShareTitle] = useState("");
  const { toast } = useToast();

  // 선택된 제품 정보 가져오기
  const { data: productsData } = useQuery({
    queryKey: ["products-for-share", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return { products: [] };
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: productIds.length > 0,
  });

  const products = productsData?.products || [];

  // 표 데이터 복사 (TSV 형식)
  const handleCopyTable = async () => {
    if (products.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "복사할 품목을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "카탈로그 번호",
      "규격/용량",
      "Grade",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = products.map((product: any, index: number) => {
      const vendor = product.vendors?.[0];
      const unitPrice = vendor?.priceInKRW || 0;
      const quantity = 1;
      const lineTotal = unitPrice * quantity;

      return [
        (index + 1).toString(),
        product.name || "",
        vendor?.vendor?.name || product.brand || "",
        product.catalogNumber || "",
        product.specification || "",
        product.grade || "",
        unitPrice.toLocaleString(),
        vendor?.currency || "KRW",
        quantity.toString(),
        lineTotal.toLocaleString(),
        "",
      ];
    });

    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "품목 리스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "복사 실패",
        description: "클립보드 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // CSV 다운로드
  const handleDownloadCSV = () => {
    if (products.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "다운로드할 품목을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "카탈로그 번호",
      "규격/용량",
      "Grade",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = products.map((product: any, index: number) => {
      const vendor = product.vendors?.[0];
      const unitPrice = vendor?.priceInKRW || 0;
      const quantity = 1;
      const lineTotal = unitPrice * quantity;

      return [
        (index + 1).toString(),
        `"${product.name || ""}"`,
        `"${vendor?.vendor?.name || product.brand || ""}"`,
        `"${product.catalogNumber || ""}"`,
        `"${product.specification || ""}"`,
        `"${product.grade || ""}"`,
        unitPrice.toLocaleString(),
        vendor?.currency || "KRW",
        quantity.toString(),
        lineTotal.toLocaleString(),
        `""`,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "다운로드 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  // 공유 링크 생성
  const createShareLinkMutation = useMutation({
    mutationFn: async (title: string) => {
      // 먼저 QuoteList 생성
      const quoteResponse = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "품목 리스트",
          productIds: productIds,
          quantities: productIds.reduce((acc, id) => {
            acc[id] = 1;
            return acc;
          }, {} as Record<string, number>),
        }),
      });

      if (!quoteResponse.ok) {
        const error = await quoteResponse.json();
        throw new Error(error.error || "Failed to create quote list");
      }
      const quote = await quoteResponse.json();

      // 공유 링크 생성
      const shareResponse = await fetch("/api/shared-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          title: title || quote.title,
        }),
      });

      if (!shareResponse.ok) throw new Error("Failed to create share link");
      return shareResponse.json();
    },
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/share/${data.publicId}`;
      setShareLink(shareUrl);
      setIsShareDialogOpen(false);
      toast({
        title: "공유 링크 생성 완료",
        description: "구매담당자에게 공유할 수 있는 링크가 생성되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "공유 링크 생성 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateShareLink = () => {
    if (products.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "공유할 품목을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsShareDialogOpen(true);
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink);
        toast({
          title: "링크 복사 완료",
          description: "공유 링크가 클립보드에 복사되었습니다.",
        });
      } catch (error) {
        toast({
          title: "복사 실패",
          description: "링크 복사에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  const hasProducts = products.length > 0;

  return (
    <TestCard
      title="공유 / 내보내기"
      subtitle="표 복사, 엑셀 다운로드, 구매담당자용 링크 생성을 체험합니다."
    >
      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleCopyTable}
          disabled={!hasProducts}
        >
          <Copy className="h-4 w-4 mr-2" />
          {copied ? "복사됨!" : "표 데이터 복사 (TSV)"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleDownloadCSV}
          disabled={!hasProducts}
        >
          <Download className="h-4 w-4 mr-2" />
          엑셀/CSV 다운로드
        </Button>

        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleGenerateShareLink}
              disabled={!hasProducts}
            >
              <Share2 className="h-4 w-4 mr-2" />
              공유 링크 생성
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>공유 링크 생성</DialogTitle>
              <DialogDescription>
                구매담당자에게 공유할 수 있는 링크를 생성합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="share-title">리스트 제목</Label>
                <Input
                  id="share-title"
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                  placeholder="예: 2024년 1분기 구매 신청"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createShareLinkMutation.mutate(shareTitle)}
                disabled={createShareLinkMutation.isPending}
              >
                {createShareLinkMutation.isPending ? "생성 중..." : "링크 생성"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {shareLink && (
          <div className="mt-4 p-3 bg-slate-50 rounded-md space-y-2">
            <p className="text-xs font-medium">생성된 공유 링크:</p>
            <div className="flex items-center gap-2">
              <Input value={shareLink} readOnly className="flex-1 text-xs" />
              <Button size="sm" onClick={handleCopyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Link
              href={shareLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              링크 미리보기
            </Link>
          </div>
        )}
      </div>
      {!hasProducts && (
        <p className="text-xs text-muted-foreground">
          품목 리스트가 생성되면 사용 가능합니다.
        </p>
      )}
    </TestCard>
  );
}