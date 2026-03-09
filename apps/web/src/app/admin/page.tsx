"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminSidebar } from "./_components/admin-sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Flame,
  Clock,
  Package,
  DollarSign,
  Loader2,
  ChevronRight,
  Send,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface Quote {
  id: string;
  title: string;
  status: string;
  totalAmount: number | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
    organization?: string | null;
  } | null;
  _count: { listItems: number; items: number };
  items?: Array<{
    id: string;
    name: string | null;
    brand: string | null;
    catalogNumber: string | null;
    quantity: number;
    unitPrice: number | null;
    notes: string | null;
  }>;
}

// ─── 상태 뱃지 설정 ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  PENDING:    { label: "대기중",    className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  PARSED:     { label: "분석완료", className: "bg-blue-100 text-blue-800 border-blue-200" },
  SENT:       { label: "발송됨",    className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  RESPONDED:  { label: "응답완료", className: "bg-teal-100 text-teal-800 border-teal-200" },
  COMPLETED:  { label: "완료",      className: "bg-green-100 text-green-800 border-green-200" },
  PURCHASED:  { label: "구매완료", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  CANCELLED:  { label: "취소됨",   className: "bg-red-100 text-red-800 border-red-200" },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  icon: Icon,
  label,
  value,
  highlight,
  iconBg,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  highlight?: boolean;
  iconBg: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
      <div className={cn("p-2.5 rounded-lg shrink-0", iconBg)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <div className={cn("text-2xl font-bold", highlight ? "text-red-600" : "text-slate-900")}>
          {value}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 font-medium">{label}</div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 단가 입력 폼 상태
  const [vendorPrice, setVendorPrice] = useState("");
  const [supplyPrice, setSupplyPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── 견적 목록 조회 ─────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["admin-quotes-ops"],
    queryFn: async () => {
      const res = await fetch("/api/admin/quotes?limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const quotes: Quote[] = data?.quotes || [];

  // ─── KPI 계산 ──────────────────────────────────────────────────────────
  const kpi = {
    newRFQ: quotes.filter((q) => q.status === "PENDING").length,
    waitingReply: quotes.filter((q) => q.status === "PARSED" || q.status === "SENT").length,
    waitingOrder: quotes.filter((q) => q.status === "COMPLETED").length,
    monthlyTotal: quotes
      .filter((q) => {
        const d = new Date(q.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, q) => sum + (q.totalAmount ?? 0), 0),
  };

  // ─── 선택된 견적 ────────────────────────────────────────────────────────
  const { data: quoteDetail } = useQuery({
    queryKey: ["admin-quote-detail", selectedQuoteId],
    queryFn: async () => {
      if (!selectedQuoteId) return null;
      const res = await fetch(`/api/admin/quotes/${selectedQuoteId}`);
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      return d.quote || d;
    },
    enabled: !!selectedQuoteId,
  });

  const selectedQuote = quoteDetail || quotes.find((q) => q.id === selectedQuoteId);

  // ─── 행 클릭 핸들러 ─────────────────────────────────────────────────────
  const handleRowClick = (quote: Quote) => {
    setSelectedQuoteId(quote.id);
    setVendorPrice("");
    setSupplyPrice("");
    setDeliveryDate("");
    setSheetOpen(true);
  };

  // ─── 견적서 발송 (모의 로직) ─────────────────────────────────────────────
  const handleSendQuote = async () => {
    if (!supplyPrice || !deliveryDate) {
      toast({ title: "고객 공급가와 납기일을 입력해주세요.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast({ title: "견적서 발송 완료", description: "고객에게 견적서가 발송되었습니다." });
    setSubmitting(false);
    setSheetOpen(false);
    setSelectedQuoteId(null);
    queryClient.invalidateQueries({ queryKey: ["admin-quotes-ops"] });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* 헤더 */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">오퍼레이션 대시보드</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {format(new Date(), "yyyy년 M월 d일 (E) HH:mm 기준", { locale: ko })}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-quotes-ops"] })}
            >
              새로 고침
            </Button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 p-5 space-y-5">
          {/* ── KPI 카드 ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              icon={Flame}
              label="신규 견적 요청"
              value={kpi.newRFQ}
              highlight={kpi.newRFQ > 0}
              iconBg="bg-orange-500"
            />
            <KPICard
              icon={Clock}
              label="견적 회신 대기"
              value={kpi.waitingReply}
              highlight={kpi.waitingReply > 0}
              iconBg="bg-blue-600"
            />
            <KPICard
              icon={Package}
              label="발주 대기"
              value={kpi.waitingOrder}
              highlight={kpi.waitingOrder > 0}
              iconBg="bg-amber-500"
            />
            <KPICard
              icon={DollarSign}
              label="이번 달 누적 거래액"
              value={`₩${(kpi.monthlyTotal / 10000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}만`}
              iconBg="bg-emerald-600"
            />
          </div>

          {/* ── 견적 요청 테이블 ──────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                견적 요청 목록
                {!isLoading && (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({quotes.length}건)
                  </span>
                )}
              </h2>
            </div>

            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/80">
                    <TableHead className="text-xs font-semibold text-slate-500 w-[130px]">요청일시</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 min-w-[140px]">소속 (연구실)</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 min-w-[120px]">요청자</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 text-center w-[70px]">품목 수</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 text-right w-[110px]">견적 금액</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 w-[90px]">상태</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 w-[80px]">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : quotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center text-sm text-slate-400">
                        견적 요청이 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    quotes.map((quote) => {
                      const cfg = STATUS_CONFIG[quote.status] ?? { label: quote.status, className: "bg-slate-100 text-slate-700" };
                      const itemCount = quote._count?.items || quote._count?.listItems || 0;
                      const isNew = quote.status === "PENDING";

                      return (
                        <TableRow
                          key={quote.id}
                          className={cn(
                            "cursor-pointer hover:bg-blue-50/60 transition-colors text-sm even:bg-gray-50/40",
                            selectedQuoteId === quote.id && "bg-blue-50 border-l-2 border-l-blue-500"
                          )}
                          onClick={() => handleRowClick(quote)}
                        >
                          <TableCell className="py-2.5 text-xs text-slate-500 whitespace-nowrap">
                            {format(new Date(quote.createdAt), "MM/dd HH:mm")}
                            {isNew && (
                              <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                NEW
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs">
                            <span className="font-medium text-slate-700">
                              {quote.user?.organization || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div>
                              <div className="text-xs font-medium text-slate-800">
                                {quote.user?.name || "이름 없음"}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {quote.user?.email || "—"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-center text-xs font-semibold text-slate-700">
                            {itemCount}
                          </TableCell>
                          <TableCell className="py-2.5 text-right text-xs font-semibold text-slate-800">
                            {quote.totalAmount ? `₩${quote.totalAmount.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                cfg.className
                              )}
                            >
                              {cfg.label}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(quote);
                              }}
                            >
                              상세
                              <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* ── 우측 상세 패널 (Sheet) ──────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[420px] sm:w-[480px] flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-100">
            <SheetTitle className="text-base font-bold text-slate-900">
              견적 상세 / 단가 입력
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              고객 요청 내용을 확인하고 벤더 단가를 입력하세요
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* 요청 정보 */}
            {selectedQuote && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                    <div className="text-slate-400 font-medium">요청자</div>
                    <div className="font-semibold text-slate-800">
                      {selectedQuote.user?.name || "—"}
                    </div>
                    <div className="text-slate-500">{selectedQuote.user?.email}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                    <div className="text-slate-400 font-medium">소속 기관</div>
                    <div className="font-semibold text-slate-800">
                      {selectedQuote.user?.organization || "—"}
                    </div>
                    <div className="text-slate-500">
                      {format(new Date(selectedQuote.createdAt), "yyyy.MM.dd HH:mm")}
                    </div>
                  </div>
                </div>

                {/* 상태 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">현재 상태:</span>
                  {(() => {
                    const cfg = STATUS_CONFIG[selectedQuote.status] ?? { label: selectedQuote.status, className: "bg-slate-100 text-slate-700" };
                    return (
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", cfg.className)}>
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 품목 정보 테이블 */}
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">요청 품목</h3>
              {selectedQuote?.items && selectedQuote.items.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold text-slate-500 py-2">제품명</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500 py-2 text-center w-12">수량</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500 py-2 text-right w-20">단가</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuote.items.map((item) => (
                        <TableRow key={item.id} className="even:bg-slate-50/60">
                          <TableCell className="py-2">
                            <div className="text-xs font-medium text-slate-800 leading-tight">
                              {item.name || "—"}
                            </div>
                            {item.brand && (
                              <div className="text-[10px] text-slate-400">{item.brand}</div>
                            )}
                            {item.catalogNumber && (
                              <div className="text-[10px] text-slate-400">
                                Cat# {item.catalogNumber}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-center text-xs text-slate-700">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="py-2 text-right text-xs font-medium text-slate-700">
                            {item.unitPrice ? `₩${Number(item.unitPrice).toLocaleString()}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                  품목 정보 없음
                </div>
              )}
            </div>

            {/* 단가 입력 폼 */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
                관리자 단가 입력
              </h3>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 font-medium">
                    벤더 매입가 (원)
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="1,200,000"
                    value={vendorPrice ? Number(vendorPrice).toLocaleString("ko-KR") : ""}
                    onChange={(e) => setVendorPrice(e.target.value.replace(/\D/g, ""))}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 font-medium">
                    고객 공급가 (마진 포함) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="1,500,000"
                    value={supplyPrice ? Number(supplyPrice).toLocaleString("ko-KR") : ""}
                    onChange={(e) => setSupplyPrice(e.target.value.replace(/\D/g, ""))}
                    className="h-9 text-sm"
                  />
                  {vendorPrice && supplyPrice && Number(supplyPrice) > Number(vendorPrice) && (
                    <div className="text-[11px] text-emerald-600 font-medium">
                      마진율:{" "}
                      {(((Number(supplyPrice) - Number(vendorPrice)) / Number(vendorPrice)) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600 font-medium">
                    예상 납기일 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-2">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 h-10 text-sm font-semibold"
              onClick={handleSendQuote}
              disabled={submitting || !supplyPrice || !deliveryDate}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  발송 중...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  견적서 발송하기
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full h-9 text-sm"
              onClick={() => setSheetOpen(false)}
            >
              닫기
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
