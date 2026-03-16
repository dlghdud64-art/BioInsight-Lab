"use client";

/**
 * Compare Analysis Drawer — V1-beta
 *
 * structured diff + AI insight + 공급사 문의 초안 + 견적 초안 생성.
 * 모든 CTA가 실제 API를 호출. Dead button 없음.
 * Inquiry draft는 DB에 영속화됨.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Loader2, AlertTriangle, CheckCircle, Info, Mail, Sparkles,
  Copy, Check, ShoppingCart, HelpCircle, FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CompareInsight } from "@/lib/compare-workspace/compare-insight-generator";

// ── Types ──

interface DiffItemDisplay {
  fieldKey: string;
  fieldLabel: string;
  diffType: string;
  sourceValue: unknown;
  targetValue: unknown;
  significance: string;
  actionability: string;
}

interface DiffResultDisplay {
  compareId: string;
  sourceEntityId: string;
  targetEntityId: string;
  totalFieldsCompared: number;
  totalDifferences: number;
  items: DiffItemDisplay[];
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    overallVerdict: string;
    verdictReason: string;
  };
}

interface CompareSessionData {
  id: string;
  productIds: string[];
  diffResult: DiffResultDisplay[];
  createdAt: string;
}

interface ProductInfo {
  id: string;
  name: string;
  brand?: string;
  catalogNumber?: string;
}

interface PersistedDraft {
  id: string;
  vendorName: string;
  productName: string;
  subject: string;
  body: string;
  inquiryFields: string[] | any;
  status: string;
  createdAt: string;
}

interface CompareAnalysisDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  organizationId?: string;
}

// ── Badges ──

function SignificanceBadge({ significance }: { significance: string }) {
  const config: Record<string, { label: string; className: string }> = {
    CRITICAL: { label: "치명적", className: "bg-red-100 text-red-800" },
    HIGH: { label: "높음", className: "bg-orange-100 text-orange-800" },
    MEDIUM: { label: "보통", className: "bg-yellow-100 text-yellow-800" },
    LOW: { label: "낮음", className: "bg-blue-100 text-blue-800" },
    INFO: { label: "참고", className: "bg-gray-100 text-gray-600" },
  };
  const c = config[significance] || config.INFO;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function ActionabilityHint({ actionability }: { actionability: string }) {
  const hints: Record<string, string> = {
    REQUIRES_DECISION: "사용자 판단 필요",
    REQUIRES_REVIEW: "전문가 검토 권장",
    REQUIRES_INQUIRY: "공급사 확인 필요",
    AUTO_RESOLVABLE: "자동 해석 가능",
    INFORMATIONAL: "",
  };
  const hint = hints[actionability];
  if (!hint) return null;
  return <span className="text-xs text-slate-400 italic">{hint}</span>;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
    EQUIVALENT: { label: "동일", className: "text-green-700 bg-green-50", icon: CheckCircle },
    MINOR_DIFFERENCES: { label: "경미한 차이", className: "text-blue-700 bg-blue-50", icon: Info },
    SIGNIFICANT_DIFFERENCES: { label: "중요한 차이", className: "text-orange-700 bg-orange-50", icon: AlertTriangle },
    INCOMPATIBLE: { label: "대체 불가", className: "text-red-700 bg-red-50", icon: AlertTriangle },
    REQUIRES_EXPERT: { label: "전문가 판단 필요", className: "text-purple-700 bg-purple-50", icon: AlertTriangle },
  };
  const c = config[verdict] || config.MINOR_DIFFERENCES;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`${c.className} gap-1`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

function DraftStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    GENERATED: { label: "생성됨", className: "bg-blue-50 text-blue-700" },
    COPIED: { label: "복사됨", className: "bg-green-50 text-green-700" },
    SENT: { label: "발송됨", className: "bg-purple-50 text-purple-700" },
  };
  const c = config[status] || config.GENERATED;
  return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
}

// ── Main Component ──

export function CompareAnalysisDrawer({
  open,
  onOpenChange,
  productIds,
  organizationId,
}: CompareAnalysisDrawerProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [sessionData, setSessionData] = useState<CompareSessionData | null>(null);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [insight, setInsight] = useState<CompareInsight | null>(null);
  const [persistedDraft, setPersistedDraft] = useState<PersistedDraft | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [copied, setCopied] = useState(false);

  // 비교 세션 생성 + diff 계산
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/compare-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, organizationId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "비교 세션 생성 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSessionData(data.session);
      setProducts(data.products);
      setInsight(null);
      setPersistedDraft(null);
    },
    onError: (err: Error) => {
      toast({ title: "비교 분석 실패", description: err.message, variant: "destructive" });
    },
  });

  // AI insight 생성
  const insightMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData) throw new Error("세션 없음");
      const res = await fetch(`/api/compare-sessions/${sessionData.id}/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceProductName: products[0]?.name || "기준 제품",
          targetProductName: products[1]?.name || "비교 대상",
          diffIndex: 0,
        }),
      });
      if (!res.ok) throw new Error("AI 분석 실패");
      return res.json();
    },
    onSuccess: (data) => {
      setInsight(data.insight);
      toast({ title: "AI 분석 완료", description: "핵심 변경 사항과 추천 액션을 확인하세요." });
    },
    onError: () => {
      toast({ title: "AI 분석 실패", variant: "destructive" });
    },
  });

  // 공급사 문의 초안 (영속화)
  const inquiryMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData) throw new Error("세션 없음");
      if (!vendorName.trim()) throw new Error("공급사 이름을 입력하세요");
      const res = await fetch(`/api/compare-sessions/${sessionData.id}/inquiry-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceProductName: products[0]?.name,
          targetProductName: products[1]?.name,
          vendorName: vendorName.trim(),
          diffIndex: 0,
        }),
      });
      if (!res.ok) throw new Error("초안 생성 실패");
      return res.json();
    },
    onSuccess: (data) => {
      setPersistedDraft(data.draft);
      toast({ title: "문의 초안 생성 및 저장 완료" });
    },
    onError: (err: Error) => {
      toast({ title: "초안 생성 실패", description: err.message, variant: "destructive" });
    },
  });

  // 견적 초안 생성 (compare → quote)
  const quoteDraftMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData) throw new Error("세션 없음");
      const res = await fetch(`/api/compare-sessions/${sessionData.id}/quote-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "견적 생성 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "견적 초안 생성 완료", description: "견적 상세 페이지로 이동합니다." });
      onOpenChange(false);
      router.push(`/quotes/${data.quote.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "견적 생성 실패", description: err.message, variant: "destructive" });
    },
  });

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !sessionData && productIds.length >= 2) {
      createSessionMutation.mutate();
    }
  };

  const handleCopyDraft = async () => {
    if (!persistedDraft) return;
    await navigator.clipboard.writeText(`제목: ${persistedDraft.subject}\n\n${persistedDraft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // 상태를 COPIED로 업데이트
    if (sessionData) {
      fetch(`/api/compare-sessions/${sessionData.id}/inquiry-draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: persistedDraft.id, status: "COPIED" }),
      }).then(() => {
        setPersistedDraft((prev) => prev ? { ...prev, status: "COPIED" } : null);
      }).catch(() => {});
    }

    toast({ title: "클립보드에 복사됨" });
  };

  const diffResult = sessionData?.diffResult?.[0];

  // 데이터 출처 부족 항목 카운트
  const missingDataItems = diffResult?.items.filter(
    (i) => i.diffType === "SOURCE_ONLY" || i.diffType === "TARGET_ONLY"
  ) ?? [];

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>구조적 비교 분석</SheetTitle>
          <SheetDescription>
            제품 간 차이를 구조적으로 분석하고 후속 조치를 실행합니다.
          </SheetDescription>
        </SheetHeader>

        {createSessionMutation.isPending && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">비교 분석 중...</span>
          </div>
        )}

        {sessionData && diffResult && (
          <div className="mt-4 space-y-4">
            {/* 종합 판정 */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">종합 판정</span>
                  <VerdictBadge verdict={diffResult.summary.overallVerdict} />
                </div>
                <p className="text-sm text-muted-foreground">{diffResult.summary.verdictReason}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {diffResult.summary.criticalCount > 0 && (
                    <Badge variant="destructive">치명적 {diffResult.summary.criticalCount}</Badge>
                  )}
                  {diffResult.summary.highCount > 0 && (
                    <Badge className="bg-orange-100 text-orange-800">높음 {diffResult.summary.highCount}</Badge>
                  )}
                  {diffResult.summary.mediumCount > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-800">보통 {diffResult.summary.mediumCount}</Badge>
                  )}
                </div>
                {/* 데이터 불완전성 경고 */}
                {missingDataItems.length > 0 && (
                  <div className="flex items-start gap-2 mt-3 p-2 bg-amber-50 rounded border border-amber-200">
                    <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                      {missingDataItems.length}건의 항목에 한쪽 데이터가 누락되어 있습니다.
                      공급사에 추가 정보를 요청하면 비교 정확도가 높아집니다.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="diff" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="diff">차이 항목</TabsTrigger>
                <TabsTrigger value="insight">AI 분석</TabsTrigger>
                <TabsTrigger value="action">후속 조치</TabsTrigger>
              </TabsList>

              {/* 차이 항목 탭 */}
              <TabsContent value="diff" className="space-y-2 mt-3">
                {diffResult.items
                  .filter((item) => item.diffType !== "IDENTICAL")
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 border rounded-lg ${
                        item.diffType === "SOURCE_ONLY" || item.diffType === "TARGET_ONLY"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium">{item.fieldLabel}</span>
                        <SignificanceBadge significance={item.significance} />
                        {(item.diffType === "SOURCE_ONLY" || item.diffType === "TARGET_ONLY") && (
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700">
                            불완전
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>
                          <span className="text-slate-400">A:</span>{" "}
                          {item.sourceValue != null ? formatDisplayValue(item.sourceValue) : (
                            <span className="text-amber-600 italic">(정보 없음)</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">B:</span>{" "}
                          {item.targetValue != null ? formatDisplayValue(item.targetValue) : (
                            <span className="text-amber-600 italic">(정보 없음)</span>
                          )}
                        </div>
                      </div>
                      <ActionabilityHint actionability={item.actionability} />
                    </div>
                  ))}
                {diffResult.items.filter((i) => i.diffType !== "IDENTICAL").length === 0 && (
                  <p className="text-sm text-center text-muted-foreground py-4">
                    차이가 없습니다. 두 제품이 동일합니다.
                  </p>
                )}
                {/* 출처 표시 */}
                <div className="text-xs text-slate-400 pt-2 border-t">
                  비교 기준: 제품 DB 등록 정보 (카탈로그, 공급사 데이터).
                  문서 파싱 기반 비교는 V2에서 지원됩니다.
                </div>
              </TabsContent>

              {/* AI 분석 탭 */}
              <TabsContent value="insight" className="space-y-3 mt-3">
                {!insight && (
                  <Button
                    onClick={() => insightMutation.mutate()}
                    disabled={insightMutation.isPending}
                    className="w-full"
                  >
                    {insightMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        AI 분석 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        AI 분석 실행
                      </>
                    )}
                  </Button>
                )}
                {insight && (
                  <>
                    {/* AI 신뢰도 고지 */}
                    <div className="flex items-start gap-2 p-2 bg-slate-100 rounded text-xs text-slate-600">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        AI 분석은 제품 DB 데이터 기반 참고 자료입니다.
                        최종 판단은 담당자가 직접 확인하세요.
                      </span>
                    </div>

                    {/* 핵심 변경 사항 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">핵심 변경 사항</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm space-y-1.5">
                          {insight.keyChanges.map((change, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-orange-500 mt-0.5">-</span>
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* 불확실 필드 */}
                    {insight.uncertainFields.length > 0 && (
                      <Card className="border-amber-200 bg-amber-50/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-1.5">
                            <HelpCircle className="h-4 w-4 text-amber-600" />
                            불확실/미확인 항목
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {insight.uncertainFields.map((field, i) => (
                              <div key={i} className="text-sm">
                                <span className="font-medium">{field.field}</span>
                                <p className="text-xs text-muted-foreground">{field.reason}</p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                  해결: {field.suggestedResolution}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 검토 포인트 */}
                    {insight.reviewPoints.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">검토 필요 항목</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {insight.reviewPoints.map((point, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                                  point.urgency === "HIGH" ? "text-red-500" : "text-yellow-500"
                                }`} />
                                <div>
                                  <span className="font-medium">{point.field}</span>
                                  <p className="text-muted-foreground text-xs">{point.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 추천 액션 */}
                    {insight.recommendedActions.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">추천 액션</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {insight.recommendedActions.map((action, i) => (
                              <div key={i} className="p-2 border rounded bg-white">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {actionTypeLabel(action.actionType)}
                                  </Badge>
                                  <span className="text-sm font-medium">{action.label}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 종합 평가 */}
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm">{insight.overallAssessment}</p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* 후속 조치 탭 */}
              <TabsContent value="action" className="space-y-3 mt-3">
                {/* 견적 초안 생성 CTA */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      비교 기반 견적 초안
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">
                      비교 대상 {products.length}개 제품으로 견적 초안을 생성합니다.
                      비교 판정 결과가 견적에 연결됩니다.
                    </p>
                    <Button
                      onClick={() => quoteDraftMutation.mutate()}
                      disabled={quoteDraftMutation.isPending}
                      className="w-full"
                      size="sm"
                    >
                      {quoteDraftMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          견적 생성 중...
                        </>
                      ) : (
                        <>
                          <FileText className="h-3.5 w-3.5 mr-2" />
                          견적 초안 생성
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* 공급사 문의 초안 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      공급사 문의 초안
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">공급사 이름</label>
                      <Input
                        placeholder="예: Sigma-Aldrich, ThermoFisher"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => inquiryMutation.mutate()}
                      disabled={inquiryMutation.isPending || !vendorName.trim()}
                      className="w-full"
                      size="sm"
                    >
                      {inquiryMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          초안 생성 중...
                        </>
                      ) : (
                        <>
                          <Mail className="h-3.5 w-3.5 mr-2" />
                          문의 초안 생성
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* 영속화된 초안 표시 */}
                {persistedDraft && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          생성된 초안
                          <DraftStatusBadge status={persistedDraft.status} />
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={handleCopyDraft}>
                          {copied ? (
                            <Check className="h-3.5 w-3.5 mr-1" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 mr-1" />
                          )}
                          {copied ? "복사됨" : "복사"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-muted-foreground">제목</span>
                          <p className="text-sm font-medium">{persistedDraft.subject}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">본문</span>
                          <pre className="text-xs whitespace-pre-wrap bg-slate-50 p-3 rounded border mt-1 max-h-60 overflow-y-auto">
                            {persistedDraft.body}
                          </pre>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(persistedDraft.inquiryFields)
                            ? persistedDraft.inquiryFields
                            : []
                          ).map((field: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">
                          이 초안은 비교 세션에 연결되어 저장되었습니다.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatDisplayValue(val: unknown): string {
  if (val == null) return "(없음)";
  if (typeof val === "number") return val.toLocaleString("ko-KR");
  return String(val);
}

function actionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    INQUIRE_VENDOR: "공급사 문의",
    REQUEST_EXPERT_REVIEW: "전문가 검토",
    PROCEED_WITH_ORDER: "주문 진행",
    HOLD_FOR_REVIEW: "검토 대기",
  };
  return labels[type] || type;
}
