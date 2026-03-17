"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Check,
  Download,
  Plus,
  Trash2,
  Building2,
  Users,
  FileText,
  ArrowUpRight,
  Mail,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { PageHeader } from "@/app/_components/page-header";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// 플랜 타입
type PlanType = "FREE" | "TEAM" | "ORGANIZATION";

interface PlanInfo {
  name: string;
  nameKo: string;
  price: number | null;
  priceDisplay: string;
  maxSeats: number | null;
  maxQuotesPerMonth: number | null;
  features: string[];
}

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvc: "",
  });

  // 구독 정보 조회
  const { data: billingData, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await fetch("/api/billing");
      if (!res.ok) throw new Error("Failed to fetch billing");
      return res.json();
    },
  });

  // 플랜 업그레이드 뮤테이션
  const upgradeMutation = useMutation({
    mutationFn: async (plan: PlanType) => {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade", plan }),
      });
      if (!res.ok) throw new Error("Upgrade failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.action === "contact_sales") {
        toast({
          title: "Enterprise 플랜",
          description: data.message,
        });
        // 이메일 링크 열기
        window.location.href = `mailto:${data.contactEmail}?subject=Enterprise 플랜 문의`;
      } else {
        toast({
          title: "업그레이드 완료",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ["billing"] });
      }
    },
    onError: () => {
      toast({
        title: "업그레이드 실패",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  // 카드 등록 뮤테이션
  const addCardMutation = useMutation({
    mutationFn: async (cardData: typeof cardForm) => {
      const res = await fetch("/api/billing/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cardData, isDefault: true }),
      });
      if (!res.ok) throw new Error("Failed to add card");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "카드 등록 완료",
        description: "결제 수단이 등록되었습니다.",
      });
      setIsAddCardOpen(false);
      setCardForm({ cardNumber: "", expMonth: "", expYear: "", cvc: "" });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: () => {
      toast({
        title: "카드 등록 실패",
        description: "카드 정보를 확인해주세요.",
        variant: "destructive",
      });
    },
  });

  // 카드 삭제 뮤테이션
  const deleteCardMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/billing/payment-methods?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete card");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "카드 삭제 완료",
        description: "결제 수단이 삭제되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  const subscription = billingData?.subscription;
  const planInfo = billingData?.planInfo as Record<PlanType, PlanInfo> | undefined;
  const usage = billingData?.usage;
  const paymentMethods = billingData?.paymentMethods || [];
  const invoices = billingData?.invoices || [];

  const currentPlan = subscription?.plan as PlanType || "FREE";
  const currentPlanInfo = planInfo?.[currentPlan];

  // 카드 번호 포맷팅
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
          <div className="container mx-auto py-4 md:py-8 px-3 md:px-4">
            <div className="max-w-5xl mx-auto">
              <PageHeader
                title="청구 및 구독"
                description="구독 플랜, 결제 수단, 청구 내역을 관리합니다."
                icon={CreditCard}
                iconColor="text-green-600"
              />

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 h-10">
                  <TabsTrigger value="overview" className="text-sm">개요</TabsTrigger>
                  <TabsTrigger value="methods" className="text-sm">결제 수단</TabsTrigger>
                  <TabsTrigger value="invoices" className="text-sm">청구 내역</TabsTrigger>
                </TabsList>

                {/* 개요 탭 */}
                <TabsContent value="overview" className="space-y-6">
                  {/* 현재 플랜 카드 */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            현재 플랜
                            <Badge variant={currentPlan === "FREE" ? "secondary" : "default"}>
                              {currentPlanInfo?.nameKo || "무료"}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            {subscription?.currentPeriodEnd && (
                              <>다음 결제일: {new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR")}</>
                            )}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {currentPlanInfo?.priceDisplay || "무료"}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* 사용량 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-500" />
                              견적 리스트
                            </span>
                            <span>
                              {usage?.quotesUsed || 0} / {usage?.quotesLimit || "무제한"}
                            </span>
                          </div>
                          {usage?.quotesLimit && (
                            <Progress value={(usage.quotesUsed / usage.quotesLimit) * 100} />
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-500" />
                              시트 (사용자)
                            </span>
                            <span>
                              {usage?.seatsUsed || 1} / {usage?.seatsLimit || "무제한"}
                            </span>
                          </div>
                          {usage?.seatsLimit && (
                            <Progress value={(usage.seatsUsed / usage.seatsLimit) * 100} />
                          )}
                        </div>
                      </div>

                      {/* 포함 기능 */}
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-3">포함된 기능</h4>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {currentPlanInfo?.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                              <Check className="h-4 w-4 text-green-500" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 플랜 비교 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>플랜 업그레이드</CardTitle>
                      <CardDescription>더 많은 기능이 필요하신가요?</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {planInfo && Object.entries(planInfo).map(([key, plan]) => {
                          const planKey = key as PlanType;
                          const isCurrent = currentPlan === planKey;
                          const isEnterprise = planKey === "ORGANIZATION";

                          return (
                            <Card
                              key={key}
                              className={cn(
                                "relative",
                                isCurrent && "border-blue-500 border-2"
                              )}
                            >
                              {isCurrent && (
                                <Badge className="absolute -top-2 left-4 bg-blue-600">
                                  현재 플랜
                                </Badge>
                              )}
                              <CardHeader className="pb-2">
                                <CardTitle className="text-lg">{plan.nameKo}</CardTitle>
                                <div className="text-2xl font-bold">
                                  {plan.priceDisplay}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <ul className="space-y-2">
                                  {plan.features.slice(0, 4).map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                      <span>{feature}</span>
                                    </li>
                                  ))}
                                </ul>

                                {!isCurrent && (
                                  <Button
                                    className="w-full"
                                    variant={isEnterprise ? "outline" : "default"}
                                    onClick={() => upgradeMutation.mutate(planKey)}
                                    disabled={upgradeMutation.isPending}
                                  >
                                    {upgradeMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isEnterprise ? (
                                      <>
                                        <Mail className="h-4 w-4 mr-2" />
                                        영업팀 문의
                                      </>
                                    ) : (
                                      <>
                                        <ArrowUpRight className="h-4 w-4 mr-2" />
                                        업그레이드
                                      </>
                                    )}
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 결제 수단 탭 */}
                <TabsContent value="methods" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>등록된 결제 수단</CardTitle>
                          <CardDescription>구독 결제에 사용될 카드입니다.</CardDescription>
                        </div>
                        <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
                          <DialogTrigger asChild>
                            <Button>
                              <Plus className="h-4 w-4 mr-2" />
                              카드 추가
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>결제 카드 등록</DialogTitle>
                              <DialogDescription>
                                구독 결제에 사용할 카드 정보를 입력해주세요.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="cardNumber">카드 번호</Label>
                                <Input
                                  id="cardNumber"
                                  placeholder="1234 5678 9012 3456"
                                  value={cardForm.cardNumber}
                                  onChange={(e) =>
                                    setCardForm({
                                      ...cardForm,
                                      cardNumber: formatCardNumber(e.target.value),
                                    })
                                  }
                                  maxLength={19}
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="expMonth">월</Label>
                                  <Input
                                    id="expMonth"
                                    placeholder="MM"
                                    value={cardForm.expMonth}
                                    onChange={(e) =>
                                      setCardForm({ ...cardForm, expMonth: e.target.value })
                                    }
                                    maxLength={2}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="expYear">년</Label>
                                  <Input
                                    id="expYear"
                                    placeholder="YY"
                                    value={cardForm.expYear}
                                    onChange={(e) =>
                                      setCardForm({ ...cardForm, expYear: e.target.value })
                                    }
                                    maxLength={2}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="cvc">CVC</Label>
                                  <Input
                                    id="cvc"
                                    placeholder="123"
                                    type="password"
                                    value={cardForm.cvc}
                                    onChange={(e) =>
                                      setCardForm({ ...cardForm, cvc: e.target.value })
                                    }
                                    maxLength={4}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>데모 모드: 실제 결제가 발생하지 않습니다.</span>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setIsAddCardOpen(false)}
                              >
                                취소
                              </Button>
                              <Button
                                onClick={() => addCardMutation.mutate(cardForm)}
                                disabled={addCardMutation.isPending}
                              >
                                {addCardMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "등록하기"
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {paymentMethods.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p>등록된 결제 수단이 없습니다.</p>
                          <p className="text-sm mt-1">카드를 등록하면 자동 결제가 가능합니다.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {paymentMethods.map((method: any) => (
                            <div
                              key={method.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-16 bg-gradient-to-r from-slate-700 to-slate-900 rounded flex items-center justify-center text-white text-xs font-bold">
                                  {method.brand?.toUpperCase() || "CARD"}
                                </div>
                                <div>
                                  <div className="font-medium">
                                    **** **** **** {method.last4}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    만료: {method.expMonth}/{method.expYear}
                                  </div>
                                </div>
                                {method.isDefault && (
                                  <Badge variant="secondary">기본</Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteCardMutation.mutate(method.id)}
                                disabled={deleteCardMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 청구 내역 탭 */}
                <TabsContent value="invoices" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>청구 내역</CardTitle>
                      <CardDescription>과거 결제 내역과 영수증을 확인하세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {invoices.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p>청구 내역이 없습니다.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>청구서 번호</TableHead>
                              <TableHead>기간</TableHead>
                              <TableHead>금액</TableHead>
                              <TableHead>상태</TableHead>
                              <TableHead className="text-right">영수증</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoices.map((invoice: any) => (
                              <TableRow key={invoice.id}>
                                <TableCell className="font-medium">
                                  {invoice.number || invoice.id.slice(0, 12)}
                                </TableCell>
                                <TableCell>
                                  {new Date(invoice.periodStart).toLocaleDateString("ko-KR")} ~{" "}
                                  {new Date(invoice.periodEnd).toLocaleDateString("ko-KR")}
                                </TableCell>
                                <TableCell>
                                  {invoice.amountDue?.toLocaleString("ko-KR")}원
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={invoice.status === "PAID" ? "default" : "secondary"}
                                    className={cn(
                                      invoice.status === "PAID" && "bg-green-100 text-green-700"
                                    )}
                                  >
                                    {invoice.status === "PAID" ? "결제완료" : invoice.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!invoice.invoicePdfUrl}
                                    onClick={() => {
                                      if (invoice.invoicePdfUrl) {
                                        window.open(invoice.invoicePdfUrl, "_blank");
                                      } else {
                                        toast({
                                          title: "영수증 다운로드",
                                          description: "PDF 영수증은 Stripe 연동 후 이용 가능합니다.",
                                        });
                                      }
                                    }}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    다운로드
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
