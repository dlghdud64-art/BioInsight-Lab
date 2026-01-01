"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminSidebar } from "../_components/admin-sidebar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";

interface Quote {
  id: string;
  title: string;
  status: string;
  totalAmount: number | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
  } | null;
  _count: {
    listItems: number;
    items: number;
  };
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "대기 중", variant: "secondary" },
  PARSED: { label: "파싱 완료", variant: "outline" },
  SENT: { label: "발송됨", variant: "default" },
  RESPONDED: { label: "응답 완료", variant: "default" },
  COMPLETED: { label: "완료", variant: "default" },
  PURCHASED: { label: "구매 완료", variant: "default" },
  CANCELLED: { label: "취소됨", variant: "destructive" },
};

export default function AdminQuotesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-quotes", search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/admin/quotes?${params}`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
  });

  const quotes: Quote[] = data?.quotes || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />

      <div className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">견적 관리</h1>
          <p className="text-sm text-slate-600 mt-1">
            고객 견적 요청을 검토하고 가격을 확정하세요
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-slate-200 px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="제목, 고객명 검색..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="PENDING">대기 중</SelectItem>
                <SelectItem value="PARSED">파싱 완료</SelectItem>
                <SelectItem value="SENT">발송됨</SelectItem>
                <SelectItem value="RESPONDED">응답 완료</SelectItem>
                <SelectItem value="COMPLETED">완료</SelectItem>
                <SelectItem value="CANCELLED">취소됨</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : quotes.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                견적 요청이 없습니다.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>고객</TableHead>
                      <TableHead className="text-center">품목 수</TableHead>
                      <TableHead className="text-right">예상 금액</TableHead>
                      <TableHead className="text-center">상태</TableHead>
                      <TableHead>요청일</TableHead>
                      <TableHead className="w-[100px]">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote) => {
                      const statusInfo = STATUS_LABELS[quote.status] || {
                        label: quote.status,
                        variant: "secondary" as const,
                      };
                      const itemCount = (quote._count?.listItems || 0) + (quote._count?.items || 0);

                      return (
                        <TableRow key={quote.id}>
                          <TableCell className="font-mono text-xs text-slate-500">
                            #{quote.id.slice(-6).toUpperCase()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {quote.title}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {quote.user?.name || "-"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {quote.user?.email || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {itemCount}개
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {quote.totalAmount
                              ? `₩${quote.totalAmount.toLocaleString()}`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={statusInfo.variant}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {format(new Date(quote.createdAt), "PP", {
                              locale: ko,
                            })}
                          </TableCell>
                          <TableCell>
                            <Link href={`/admin/quotes/${quote.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                검토
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                  <div className="text-sm text-slate-600">
                    총 {total}건 중 {(page - 1) * limit + 1}-
                    {Math.min(page * limit, total)}건
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-slate-600">
                      {page} / {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
