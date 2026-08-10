"use client";

export const dynamic = 'force-dynamic';

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { VendorSidebar } from "../../_components/vendor-sidebar";

interface QuoteRequestItem {
  id: string;
  productName: string;
  catalogNumber?: string;
  quantity: number;
  unit: string;
  specification?: string;
}

interface VendorRequestDetail {
  id: string;
  quoteTitle: string;
  status: string;
  expiresAt: Date;
  requesterName: string;
  organizationName: string;
  items: QuoteRequestItem[];
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
  }>;
  canEdit: boolean;
}

export default function VendorRequestDetailPage() {
  const params = useParams();
  const requestId = params.id as string;

  // Fetch request detail
  const { data: requestData, isLoading } = useQuery({
    queryKey: ["vendor-request", requestId],
    queryFn: async () => {
      const response = await fetch(`/api/vendor/requests/${requestId}`);
      if (!response.ok) throw new Error("Failed to fetch request");
      return response.json();
    },
  });

  const request: VendorRequestDetail | undefined = requestData?.request;

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-pg">
        <VendorSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex min-h-screen bg-pg">
        <VendorSidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-600">요청을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-pg">
      <VendorSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-pn border-b border-bd px-6 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendor/dashboard">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">{request.quoteTitle}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="secondary">{request.status}</Badge>
              <span className="text-sm text-slate-600">
                요청자: {request.organizationName} · {request.requesterName}
              </span>
              <span className="text-sm text-slate-600">
                만료일: {format(new Date(request.expiresAt), "PPP", { locale: ko })}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {/*
          §placeholder-success-audit — 이 포털 경로의 견적 회신은 아직 구현되지 않았다.
          입력 폼을 disabled 로 두지 않고 **아예 만들지 않는다**: 눌러서 성공(또는 실패)을
          보는 경로가 존재하면 안 된다. 실제 회신은 요청 메일의 토큰 링크로 처리된다.
        */}
        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-bd bg-pn p-4">
            <h2 className="text-sm font-semibold text-slate-100">요청 품목 {request.items.length}건</h2>
            <ul className="mt-3 divide-y divide-bd">
              {request.items.map((item) => (
                <li key={item.id} className="py-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">{item.productName}</span>
                  {item.catalogNumber ? <span className="ml-2 text-slate-500">{item.catalogNumber}</span> : null}
                  <span className="ml-2 text-slate-400">
                    {item.quantity} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-bd bg-pn p-4">
            <p className="text-sm text-slate-200">
              이 화면에서는 아직 견적을 회신할 수 없습니다.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              받으신 견적 요청 메일의 회신 링크로 단가와 납기를 입력해 주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

