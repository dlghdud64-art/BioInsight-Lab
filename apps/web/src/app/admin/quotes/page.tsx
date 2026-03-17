"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminSidebar } from "../_components/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
  ShoppingCart,
  Loader2,
  Search,
  Flame,
  Clock,
  CheckCircle2,
  Send,
  FileText,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  MoreHorizontal,
  RefreshCw,
  Filter,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
    lineTotal: number | null;
    notes: string | null;
  }>;
}

// ─── 상태 설정 ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string; order: number }> = {
  PENDING:    { label: "신규 요청",       className: "bg-blue-950/20 text-blue-700 border-0",     order: 0 },
  PARSED:     { label: "검토 중",         className: "bg-amber-950/30 text-amber-700 border-0",   order: 1 },
  SENT:       { label: "공급사 문의중",   className: "bg-indigo-900/20 text-indigo-700 border-0",  order: 2 },
  RESPONDED:  { label: "고객 회신 대기",  className: "bg-purple-900/20 text-purple-700 border-0",  order: 3 },
  COMPLETED:  { label: "견적 발송 완료",  className: "bg-emerald-900/20 text-emerald-700 border-0",order: 4 },
  PURCHASED:  { label: "주문 전환",       className: "bg-green-900/20 text-green-700 border-0",    order: 5 },
  CANCELLED:  { label: "종료",            className: "bg-slate-800 text-slate-500 border-0",   order: 6 },
};

// SLA 계산 (24h 기준)
function getSLAStatus(createdAt: string, status: string): { label: string; className: string } {
  if (status === "COMPLETED" || status === "PURCHASED" || status === "CANCELLED") {
    return { label: "—", className: "text-slate-400" };
  }
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  if (hours < 12) return { label: "정상", className: "text-slate-500" };
  if (hours < 24) return { label: "오늘 마감", className: "text-amber-400 font-medium" };
  return { label: "지연", className: "text-red-400 font-semibold" };
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function AdminQuotesPage() {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/quotes?limit=100`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
  });

  const { data: quoteDetail } = useQuery({
    queryKey: ["admin-quote-detail", selectedQuoteId],
    queryFn: async () => {
      if (!selectedQuoteId) return null;
      const response = await fetch(`/api/admin/quotes/${selectedQuoteId}`);
      if (!response.ok) throw new Error("Failed");
      const d = await response.json();
      return (d.quote || d) as Quote;
    },
    enabled: !!selectedQuoteId,
  });

  const convertToOrderMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      setShowConvertDialog(false);
      setSelectedQuoteId(null);
      toast({ title: "주문 생성 완료", description: "견적이 주문으로 전환되었습니다." });
      router.push(`/admin/orders/${data.order.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "주문 생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const allQuotes: Quote[] = data?.quotes || [];

  // 필터링
  const filteredQuotes = useMemo(() => {
    let result = allQuotes;
    if (statusFilter !== "all") {
      result = result.filter((q) => q.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((quote) =>
        (quote.title || "").toLowerCase().includes(q) ||
        (quote.user?.name || "").toLowerCase().includes(q) ||
        (quote.user?.email || "").toLowerCase().includes(q) ||
        (quote.user?.organization || "").toLowerCase().includes(q) ||
        quote.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allQuotes, statusFilter, searchQuery]);

  // KPI
  const kpi = {
    newReq: allQuotes.filter((q) => q.status === "PENDING").length,
    reviewing: allQuotes.filter((q) => q.status === "PARSED" || q.status === "SENT").length,
    delayed: allQuotes.filter((q) => {
      if (q.status === "COMPLETED" || q.status === "PURCHASED" || q.status === "CANCELLED") return false;
      return (Date.now() - new Date(q.createdAt).getTime()) / 3600000 > 24;
    }).length,
    converted: allQuotes.filter((q) => q.status === "PURCHASED").length,
  };

  // 선택 관리
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === filteredQuotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuotes.map((q) => q.id)));
    }
  };

  const selectedQuote = quoteDetail || allQuotes.find((q) => q.id === selectedQuoteId);

  return (
    <div className="flex min-h-screen bg-slate-900">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* 헤더 */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-100">견적 관리</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                들어온 견적 요청을 검토하고 상태를 관리합니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-quotes"] })}
              >
                <RefreshCw className="h-3 w-3" />
                새로 고침
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-4">
          {/* ── KPI 카드 ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniKPI icon={FileText} label="신규 요청" count={kpi.newReq} color="blue" onClick={() => setStatusFilter("PENDING")} />
            <MiniKPI icon={Clock} label="검토 중" count={kpi.reviewing} color="amber" onClick={() => setStatusFilter("PARSED")} />
            <MiniKPI icon={AlertTriangle} label="응답 지연" count={kpi.delayed} color="red" onClick={() => setStatusFilter("all")} />
            <MiniKPI icon={CheckCircle2} label="주문 전환" count={kpi.converted} color="green" onClick={() => setStatusFilter("PURCHASED")} />
          </div>

          {/* ── 필터 바 ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <Input
                type="text"
                placeholder="견적번호, 요청자, 조직명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs border-0 focus-visible:ring-0 p-0"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <Filter className="h-3 w-3 mr-1 text-slate-400" />
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="PENDING">신규 요청</SelectItem>
                <SelectItem value="PARSED">검토 중</SelectItem>
                <SelectItem value="SENT">공급사 문의중</SelectItem>
                <SelectItem value="RESPONDED">고객 회신 대기</SelectItem>
                <SelectItem value="COMPLETED">견적 발송 완료</SelectItem>
                <SelectItem value="PURCHASED">주문 전환</SelectItem>
                <SelectItem value="CANCELLED">종료</SelectItem>
              </SelectContent>
            </Select>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
                <span className="text-[11px] text-slate-500">{selectedIds.size}건 선택</span>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                  <UserPlus className="h-3 w-3" />담당자 지정
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                  상태 변경
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-slate-400" onClick={() => setSelectedIds(new Set())}>
                  선택 해제
                </Button>
              </div>
            )}
          </div>

          {/* ── 테이블 ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-900/80 hover:bg-transparent">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={filteredQuotes.length > 0 && selectedIds.size === filteredQuotes.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[100px]">견적번호</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 min-w-[100px]">조직명</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 min-w-[100px]">요청자</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 text-center w-[60px]">품목</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 text-right w-[100px]">총액</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[80px]">요청일</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[80px]">SLA</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[110px]">상태</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[140px] text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-40 text-center">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-40 text-center">
                        <div className="space-y-1">
                          <p className="text-sm text-slate-500">현재 조건에 맞는 견적 요청이 없습니다.</p>
                          <p className="text-xs text-slate-400">필터를 변경하거나 전체 견적을 확인하세요.</p>
                          {statusFilter !== "all" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 text-xs text-blue-400"
                              onClick={() => setStatusFilter("all")}
                            >
                              필터 초기화
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotes.map((quote) => {
                      const cfg = STATUS_CONFIG[quote.status] ?? { label: quote.status, className: "bg-slate-800 text-slate-400 border-0", order: 99 };
                      const sla = getSLAStatus(quote.createdAt, quote.status);
                      const itemCount = quote._count?.items || quote._count?.listItems || 0;
                      const canConvert = quote.status === "COMPLETED";

                      return (
                        <TableRow
                          key={quote.id}
                          className={cn(
                            "cursor-pointer hover:bg-blue-950/20/40 transition-colors text-xs",
                            selectedQuoteId === quote.id && "bg-blue-950/20"
                          )}
                          onClick={() => setSelectedQuoteId(quote.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(quote.id)}
                              onCheckedChange={() => toggleSelect(quote.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-slate-500">
                            #{quote.id.slice(-8).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-slate-300 font-medium">
                            {quote.user?.organization || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-slate-300">{quote.user?.name || "—"}</div>
                            <div className="text-[10px] text-slate-400">{quote.user?.email || ""}</div>
                          </TableCell>
                          <TableCell className="text-center text-slate-400 font-medium">{itemCount}</TableCell>
                          <TableCell className="text-right font-medium text-slate-200">
                            {quote.totalAmount ? `₩${quote.totalAmount.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-slate-500">{format(new Date(quote.createdAt), "MM.dd HH:mm")}</TableCell>
                          <TableCell>
                            <span className={cn("text-[11px]", sla.className)}>{sla.label}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px] font-medium", cfg.className)}>
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] text-slate-500"
                                onClick={() => setSelectedQuoteId(quote.id)}
                              >
                                <Eye className="h-3 w-3 mr-0.5" />상세
                              </Button>
                              {canConvert && (
                                <Button
                                  size="sm"
                                  className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => {
                                    setSelectedQuoteId(quote.id);
                                    setShowConvertDialog(true);
                                  }}
                                >
                                  <ShoppingCart className="h-3 w-3 mr-0.5" />전환
                                </Button>
                              )}
                            </div>
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

      {/* ── 상세 패널 ── */}
      <Sheet open={!!selectedQuoteId && !showConvertDialog} onOpenChange={(open) => !open && setSelectedQuoteId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-800">
            <SheetTitle className="text-sm font-bold text-slate-100">견적 상세</SheetTitle>
          </SheetHeader>

          {selectedQuote && (
            <div className="px-5 py-4 space-y-5">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-2">
                <InfoCell label="견적번호" value={`#${selectedQuote.id.slice(-8).toUpperCase()}`} mono />
                <InfoCell label="상태">
                  <Badge className={cn("text-[10px]", STATUS_CONFIG[selectedQuote.status]?.className || "bg-slate-800 text-slate-400")}>
                    {STATUS_CONFIG[selectedQuote.status]?.label || selectedQuote.status}
                  </Badge>
                </InfoCell>
                <InfoCell label="요청자" value={selectedQuote.user?.name || "—"} sub={selectedQuote.user?.email || ""} />
                <InfoCell label="조직" value={selectedQuote.user?.organization || "—"} />
                <InfoCell label="요청일" value={format(new Date(selectedQuote.createdAt), "yyyy.MM.dd HH:mm")} />
                <InfoCell label="총액" value={selectedQuote.totalAmount ? `₩${selectedQuote.totalAmount.toLocaleString()}` : "—"} bold />
              </div>

              {/* 품목 리스트 */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 mb-2">요청 품목 ({selectedQuote.items?.length || 0})</h3>
                {selectedQuote.items && selectedQuote.items.length > 0 ? (
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-900/80 hover:bg-transparent">
                          <TableHead className="text-[10px] font-semibold text-slate-500 py-2">품명</TableHead>
                          <TableHead className="text-[10px] font-semibold text-slate-500 py-2 text-center w-12">수량</TableHead>
                          <TableHead className="text-[10px] font-semibold text-slate-500 py-2 text-right w-20">단가</TableHead>
                          <TableHead className="text-[10px] font-semibold text-slate-500 py-2 text-right w-24">금액</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedQuote.items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="py-1.5">
                              <div className="text-xs font-medium text-slate-200">{item.name || "—"}</div>
                              {item.brand && <div className="text-[10px] text-slate-400">{item.brand}</div>}
                              {item.catalogNumber && <div className="text-[10px] text-slate-400">Cat# {item.catalogNumber}</div>}
                            </TableCell>
                            <TableCell className="py-1.5 text-center text-xs text-slate-300">{item.quantity}</TableCell>
                            <TableCell className="py-1.5 text-right text-xs text-slate-400">
                              {item.unitPrice ? `₩${Number(item.unitPrice).toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-xs font-medium text-slate-200">
                              {item.lineTotal ? `₩${Number(item.lineTotal).toLocaleString()}` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-800 rounded-lg">
                    품목 정보 없음
                  </div>
                )}
              </div>

              {/* 액션 */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs flex-1"
                  onClick={() => router.push(`/admin/quotes/${selectedQuote.id}`)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  전체 상세 보기
                </Button>
                {selectedQuote.status === "COMPLETED" && (
                  <Button
                    size="sm"
                    className="text-xs flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowConvertDialog(true)}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                    주문 전환
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── 주문 전환 확인 ── */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>주문으로 전환</DialogTitle>
            <DialogDescription>이 견적을 실제 주문 건으로 생성하시겠습니까?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)} disabled={convertToOrderMutation.isPending}>
              취소
            </Button>
            <Button
              onClick={() => { if (selectedQuoteId) convertToOrderMutation.mutate(selectedQuoteId); }}
              disabled={convertToOrderMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {convertToOrderMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />처리 중...</>
              ) : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 헬퍼 컴포넌트 ──────────────────────────────────────────────────────────

function MiniKPI({
  icon: Icon,
  label,
  count,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  color: "blue" | "amber" | "red" | "green";
  onClick: () => void;
}) {
  const colorMap = {
    blue:  { bg: "bg-blue-950/20",    text: "text-blue-500",    count: count > 0 ? "text-blue-400" : "text-slate-400" },
    amber: { bg: "bg-amber-950/30",   text: "text-amber-500",   count: count > 0 ? "text-amber-400" : "text-slate-400" },
    red:   { bg: "bg-red-950/30",     text: "text-red-500",     count: count > 0 ? "text-red-400" : "text-slate-400" },
    green: { bg: "bg-emerald-900/20", text: "text-emerald-500", count: count > 0 ? "text-emerald-400" : "text-slate-400" },
  };
  const c = colorMap[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3 hover:bg-slate-900/50 transition-colors text-left"
    >
      <div className={cn("p-1.5 rounded-md", c.bg)}>
        <Icon className={cn("h-3.5 w-3.5", c.text)} />
      </div>
      <div>
        <div className={cn("text-lg font-bold tabular-nums", c.count)}>{count}</div>
        <div className="text-[10px] text-slate-500">{label}</div>
      </div>
    </button>
  );
}

function InfoCell({
  label,
  value,
  sub,
  mono,
  bold,
  children,
}: {
  label: string;
  value?: string;
  sub?: string;
  mono?: boolean;
  bold?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 rounded-md p-2.5 space-y-0.5">
      <div className="text-[10px] text-slate-400 font-medium">{label}</div>
      {children || (
        <>
          <div className={cn("text-xs text-slate-200", mono && "font-mono", bold && "font-bold text-sm")}>{value}</div>
          {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
        </>
      )}
    </div>
  );
}
