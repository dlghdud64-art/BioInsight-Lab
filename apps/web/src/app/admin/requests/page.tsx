"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Package,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
// confetti는 선택적 - 없으면 제거
// import confetti from "canvas-confetti";

interface PurchaseRequest {
  id: string;
  title: string;
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  totalAmount: number | null;
  items: any;
  requester: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  approver: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
}

export default function AdminRequestsPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // 사용자 팀 목록 조회
  const { data: teamsData } = useQuery({
    queryKey: ["user-teams"],
    queryFn: async () => {
      const response = await fetch("/api/team");
      if (!response.ok) throw new Error("Failed to fetch teams");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 구매 요청 목록 조회 (모든 팀의 요청)
  const { data: requestsData, isLoading } = useQuery<{ purchaseRequests: PurchaseRequest[] }>({
    queryKey: ["purchase-requests", "admin"],
    queryFn: async () => {
      const teams = teamsData?.teams || [];
      const allRequests: PurchaseRequest[] = [];

      // 각 팀의 요청 조회
      for (const team of teams) {
        const response = await fetch(`/api/request?teamId=${team.id}`);
        if (response.ok) {
          const data = await response.json();
          allRequests.push(...(data.purchaseRequests || []));
        }
      }

      return { purchaseRequests: allRequests };
    },
    enabled: status === "authenticated" && !!teamsData,
  });

  // 승인 mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/request/${requestId}/approve`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve request");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      
      // 폭죽 효과 (선택적)
      // confetti({
      //   particleCount: 100,
      //   spread: 70,
      //   origin: { y: 0.6 },
      // });

      toast({
        title: "승인 완료! 🎉",
        description: "구매 요청이 승인되어 주문이 생성되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "승인 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 거절 mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const response = await fetch(`/api/request/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject request");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedRequest(null);
      toast({
        title: "거절 완료",
        description: "구매 요청이 거절되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "거절 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pendingRequests = requestsData?.purchaseRequests?.filter(
    (r) => r.status === "PENDING"
  ) || [];
  const approvedRequests = requestsData?.purchaseRequests?.filter(
    (r) => r.status === "APPROVED"
  ) || [];
  const rejectedRequests = requestsData?.purchaseRequests?.filter(
    (r) => r.status === "REJECTED"
  ) || [];

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-4 py-8">
              <div className="text-center py-12">
                <p className="text-muted-foreground">로딩 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-4 py-6 md:py-8">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* 페이지 헤더 */}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">구매 요청 승인</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  팀원들의 구매 요청을 검토하고 승인하세요
                </p>
              </div>

              {/* 통계 카드 */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">대기 중</CardTitle>
                    <Clock className="h-4 w-4 text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">{pendingRequests.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">승인됨</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{approvedRequests.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">거절됨</CardTitle>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{rejectedRequests.length}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 대기 중인 요청 (Inbox 스타일) */}
              {pendingRequests.length > 0 ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Inbox className="h-5 w-5 text-amber-600" />
                      <CardTitle>대기 중인 요청</CardTitle>
                      <Badge variant="outline" className="ml-auto">
                        {pendingRequests.length}건
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pendingRequests.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                          onApprove={() => approveMutation.mutate(request.id)}
                          onReject={() => {
                            setSelectedRequest(request);
                            setRejectDialogOpen(true);
                          }}
                          isProcessing={approveMutation.isPending || rejectMutation.isPending}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">대기 중인 구매 요청이 없습니다.</p>
                  </CardContent>
                </Card>
              )}

              {/* 거절 다이얼로그 */}
              <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>구매 요청 거절</DialogTitle>
                    <DialogDescription>
                      거절 사유를 입력해주세요. 요청자에게 전달됩니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="reason">거절 사유</Label>
                      <Textarea
                        id="reason"
                        placeholder="예: 예산 부족, 품목 재고 없음 등"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRejectDialogOpen(false);
                          setRejectReason("");
                        }}
                        className="flex-1"
                      >
                        취소
                      </Button>
                      <Button
                        onClick={() => {
                          if (!selectedRequest) return;
                          rejectMutation.mutate({
                            requestId: selectedRequest.id,
                            reason: rejectReason,
                          });
                        }}
                        disabled={rejectMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        {rejectMutation.isPending ? "처리 중..." : "거절하기"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 요청 카드 컴포넌트
function RequestCard({
  request,
  onApprove,
  onReject,
  isProcessing,
}: {
  request: PurchaseRequest;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}) {
  const items = Array.isArray(request.items) ? request.items : [];
  const totalAmount = request.totalAmount || items.reduce((sum: number, item: any) => {
    return sum + ((item.unitPrice || 0) * (item.quantity || 1));
  }, 0);

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* 요청자 정보 */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={request.requester.image || undefined} />
              <AvatarFallback>
                {request.requester.name?.[0] || request.requester.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {request.requester.name || request.requester.email}
                </span>
                {request.team && (
                  <Badge variant="outline" className="text-xs">
                    {request.team.name}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(request.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })}
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300">
              <Clock className="h-3 w-3 mr-1" />
              검토 중
            </Badge>
          </div>

          {/* 요청 내용 */}
          <div>
            <h3 className="font-semibold text-base mb-1">{request.title}</h3>
            {request.message && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>{request.message}</p>
              </div>
            )}
          </div>

          {/* 품목 정보 */}
          {items.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">품목</div>
              <div className="space-y-1">
                {items.slice(0, 3).map((item: any, idx: number) => (
                  <div key={idx} className="text-sm">
                    • {item.name || "제품명 없음"} × {item.quantity || 1}
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{items.length - 3}개 더
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 총 금액 */}
          {totalAmount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">총 금액: ₩{totalAmount.toLocaleString("ko-KR")}</span>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button
            onClick={onApprove}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            승인
          </Button>
          <Button
            onClick={onReject}
            disabled={isProcessing}
            variant="destructive"
            size="sm"
          >
            <XCircle className="h-4 w-4 mr-1" />
            거절
          </Button>
        </div>
      </div>
    </div>
  );
}

