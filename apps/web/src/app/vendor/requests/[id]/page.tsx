"use client";

export const dynamic = 'force-dynamic';

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Upload, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { VendorSidebar } from "../../_components/vendor-sidebar";
import { QuoteForm } from "@/components/vendor/quote-form";

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
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const handleQuoteSubmit = async (responses: any[]) => {
    try {
      const response = await fetch(`/api/vendor/requests/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });

      if (!response.ok) throw new Error("Failed to submit response");

      toast({
        title: "회신 완료",
        description: "견적 회신이 제출되었습니다.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["vendor-request", requestId] });
      router.push("/vendor/dashboard");
    } catch (error) {
      throw error; // Let QuoteForm handle the error
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <VendorSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <VendorSidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-600">요청을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const isReadOnly = !request.canEdit;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <VendorSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendor/dashboard">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{request.quoteTitle}</h1>
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
        <div className="p-6">
          <QuoteForm
            requestId={requestId}
            items={request.items}
            onSubmit={handleQuoteSubmit}
            readOnly={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
}

