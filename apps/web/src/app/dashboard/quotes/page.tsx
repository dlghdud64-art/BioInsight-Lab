"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileText, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

interface Quote {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  totalAmount: number;
  user: {
    name: string | null;
    email: string | null;
  } | null;
}

export default function QuotesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/quotes");

      if (!response.ok) {
        throw new Error("Failed to load quotes");
      }

      const data = await response.json();
      setQuotes(data.quotes || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error loading quotes:", error);
      toast({
        title: "오류",
        description: "견적 목록을 불러오는 데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      PENDING: { label: "대기중", variant: "secondary" },
      SENT: { label: "발송완료", variant: "default" },
      RESPONDED: { label: "답변받음", variant: "outline" },
      COMPLETED: { label: "완료", variant: "default" },
      CANCELLED: { label: "취소", variant: "destructive" },
    };

    const config = statusMap[status] || { label: status, variant: "outline" };
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredQuotes = quotes.filter((quote) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "draft") return quote.status === "DRAFT";
    if (statusFilter === "requested") return quote.status === "SENT" || quote.status === "PENDING";
    return true;
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* 타이틀 섹션 */}
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">견적 요청 관리</h2>
        <div className="flex items-center space-x-2">
          <Link href="/test/quote">
            <Button className="whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              새 견적 요청
            </Button>
          </Link>
        </div>
      </div>
      <Separator />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>견적요청서 목록</CardTitle>
              <CardDescription>
                최근 작성한 견적요청서를 확인하고 관리하세요.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="text-xs whitespace-nowrap"
              >
                전체
              </Button>
              <Button
                variant={statusFilter === "draft" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("draft")}
                className="text-xs whitespace-nowrap"
              >
                작성중
              </Button>
              <Button
                variant={statusFilter === "requested" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("requested")}
                className="text-xs whitespace-nowrap"
              >
                요청완료
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {quotes.length === 0 
                  ? "작성된 견적요청서가 없습니다."
                  : "선택한 필터에 해당하는 견적요청서가 없습니다."}
              </p>
              {quotes.length === 0 && (
                <Link href="/test/quote">
                  <Button variant="outline" className="whitespace-nowrap">
                    <Plus className="h-4 w-4 mr-2" />
                    첫 견적 작성하기
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">제목</TableHead>
                    <TableHead className="whitespace-nowrap">상태</TableHead>
                    <TableHead className="text-right whitespace-nowrap">품목 수</TableHead>
                    <TableHead className="text-right whitespace-nowrap">총액</TableHead>
                    <TableHead className="whitespace-nowrap">업데이트 날짜</TableHead>
                    <TableHead className="text-right whitespace-nowrap">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/test/quote?quoteId=${quote.id}`)}
                    >
                      <TableCell className="font-medium">
                        {quote.title}
                      </TableCell>
                      <TableCell>{getStatusBadge(quote.status)}</TableCell>
                      <TableCell className="text-right">
                        {quote.itemCount}개
                      </TableCell>
                      <TableCell className="text-right">
                        ₩{quote.totalAmount.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(quote.updatedAt).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/test/quote?quoteId=${quote.id}`);
                          }}
                          className="whitespace-nowrap"
                        >
                          열기
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




