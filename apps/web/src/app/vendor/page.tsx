"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type VendorRequestStatus = "PENDING" | "RESPONDED" | "EXPIRED" | "CANCELLED";

interface VendorRequest {
  id: string;
  quoteTitle: string;
  status: VendorRequestStatus;
  expiresAt: Date;
  itemCount: number;
  updatedAt: Date;
}

const STATUS_CONFIG: Record<VendorRequestStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDING: { label: "대기", variant: "secondary" },
  RESPONDED: { label: "회신", variant: "default" },
  EXPIRED: { label: "만료", variant: "outline" },
  CANCELLED: { label: "취소", variant: "destructive" },
};

export default function VendorDashboardPage() {
  const [statusFilter, setStatusFilter] = useState<VendorRequestStatus | "ALL">("ALL");

  const { data: requestsData, isLoading } = useQuery({
    queryKey: ["vendor-requests", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      const response = await fetch(`/api/vendor/requests?${params}`);
      if (!response.ok) throw new Error("Failed to fetch requests");
      return response.json();
    },
  });

  const requests: VendorRequest[] = requestsData?.requests || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">벤더 포털</h1>
              <p className="text-sm text-slate-600 mt-1">견적 요청 관리</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/vendor/logout">
                로그아웃
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Status Filters */}
        <div className="mb-4 flex gap-2">
          <Button
            variant={statusFilter === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("ALL")}
          >
            전체
          </Button>
          <Button
            variant={statusFilter === "PENDING" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("PENDING")}
          >
            대기
          </Button>
          <Button
            variant={statusFilter === "RESPONDED" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("RESPONDED")}
          >
            회신
          </Button>
          <Button
            variant={statusFilter === "EXPIRED" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("EXPIRED")}
          >
            만료
          </Button>
          <Button
            variant={statusFilter === "CANCELLED" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("CANCELLED")}
          >
            취소
          </Button>
        </div>

        {/* Requests Table */}
        <div className="bg-white border border-slate-200 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">요청이 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium">요청명</TableHead>
                  <TableHead className="font-medium">상태</TableHead>
                  <TableHead className="font-medium">만료일</TableHead>
                  <TableHead className="font-medium text-right">품목 수</TableHead>
                  <TableHead className="font-medium">마지막 업데이트</TableHead>
                  <TableHead className="font-medium text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium p-3">
                      {request.quoteTitle}
                    </TableCell>
                    <TableCell className="p-3">
                      <Badge variant={STATUS_CONFIG[request.status].variant}>
                        {STATUS_CONFIG[request.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-3 text-sm">
                      {format(new Date(request.expiresAt), "PPP", { locale: ko })}
                    </TableCell>
                    <TableCell className="p-3 text-right text-sm">
                      {request.itemCount}개
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-600">
                      {format(new Date(request.updatedAt), "PPp", { locale: ko })}
                    </TableCell>
                    <TableCell className="p-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/vendor/requests/${request.id}`}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          보기
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Summary */}
        {!isLoading && requests.length > 0 && (
          <div className="mt-4 text-sm text-slate-600">
            총 {requests.length}건의 요청
          </div>
        )}
      </div>
    </div>
  );
}

