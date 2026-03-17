"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  RefreshCw,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useToast } from "@/hooks/use-toast";
import { OrganizationRole } from "@prisma/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

function SafetyAdminPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    searchParams.get("org") || ""
  );
  const [selectedSdsId, setSelectedSdsId] = useState<string | null>(null);
  const [applyDialog, setApplyDialog] = useState<{
    open: boolean;
    mode: "merge" | "overwrite" | null;
  }>({ open: false, mode: null });

  // 사용자의 조직 목록 조회
  const { data: organizationsData, isLoading: orgsLoading } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) return { organizations: [] };
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const organizations = organizationsData?.organizations || [];
  const currentOrg = organizations.find((org: any) => 
    org.id === selectedOrgId || (!selectedOrgId && org.id)
  ) || organizations[0];

  // 현재 사용자의 역할 확인
  const currentMembership = currentOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id
  );
  const isSafetyAdmin = currentMembership?.role === OrganizationRole.VIEWER || 
                       currentMembership?.role === OrganizationRole.ADMIN ||
                       session?.user?.role === "ADMIN";

  // SDS 문서 목록 조회
  const { data: sdsData, isLoading: sdsLoading } = useQuery({
    queryKey: ["sds-documents", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { documents: [] };
      // 모든 조직의 SDS 문서 조회 (또는 현재 조직만)
      const response = await fetch(`/api/safety/sds?organizationId=${currentOrg.id}`);
      if (!response.ok) return { documents: [] };
      return response.json();
    },
    enabled: !!currentOrg?.id && isSafetyAdmin && status === "authenticated",
    refetchInterval: (query) => {
      // 처리 중인 작업이 있으면 3초마다 갱신
      const data = query.state.data as any;
      const hasProcessing = data?.documents?.some(
        (doc: any) => doc.extractionStatus === "processing" || doc.extractionStatus === "queued"
      );
      return hasProcessing ? 3000 : false;
    },
  });

  const sdsDocuments = sdsData?.documents || [];

  // AI 추출 시작
  const startExtractionMutation = useMutation({
    mutationFn: async (sdsId: string) => {
      const response = await fetch(`/api/sds/${sdsId}/extract`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start extraction");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sds-documents", currentOrg?.id] });
      toast({
        title: "AI 추출 시작",
        description: "추출 작업이 시작되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "추출 시작 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 추출 취소
  const cancelExtractionMutation = useMutation({
    mutationFn: async (sdsId: string) => {
      const response = await fetch(`/api/sds/${sdsId}/extract`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel extraction");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sds-documents", currentOrg?.id] });
      toast({
        title: "추출 취소됨",
        description: "추출 작업이 취소되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "취소 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 추출 결과 적용
  const applyExtractionMutation = useMutation({
    mutationFn: async ({ sdsId, mode }: { sdsId: string; mode: "merge" | "overwrite" }) => {
      const response = await fetch(`/api/sds/${sdsId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to apply extraction");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sds-documents", currentOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setApplyDialog({ open: false, mode: null });
      setSelectedSdsId(null);
      toast({
        title: "적용 완료",
        description: "추출 결과가 제품에 적용되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "적용 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartExtraction = (sdsId: string) => {
    startExtractionMutation.mutate(sdsId);
  };

  const handleCancelExtraction = (sdsId: string) => {
    cancelExtractionMutation.mutate(sdsId);
  };

  const handleApplyExtraction = (mode: "merge" | "overwrite") => {
    if (!selectedSdsId) return;
    setApplyDialog({ open: true, mode });
  };

  const confirmApply = () => {
    if (!selectedSdsId || !applyDialog.mode) return;
    applyExtractionMutation.mutate({
      sdsId: selectedSdsId,
      mode: applyDialog.mode,
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "queued":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">대기 중</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">처리 중</Badge>;
      case "done":
        return <Badge variant="outline" className="bg-green-50 text-green-700">완료</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700">실패</Badge>;
      default:
        return <Badge variant="outline">미추출</Badge>;
    }
  };

  if (status === "loading" || orgsLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">워크스페이스가 없습니다.</p>
                  <Button onClick={() => router.push("/dashboard/organizations")}>
                    워크스페이스 생성하기
                  </Button>
                </CardContent>
              </Card>
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
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-7xl mx-auto space-y-6">
              <PageHeader
                title="안전 관리"
                description="SDS 문서의 AI 추출 결과를 검토하고 제품에 적용합니다."
                icon={FileText}
                iconColor="text-red-600"
              />

              {/* 워크스페이스 선택 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">워크스페이스 선택</CardTitle>
                </CardHeader>
                <CardContent>
                  <WorkspaceSwitcher
                    currentOrganizationId={selectedOrgId}
                    onOrganizationChange={setSelectedOrgId}
                    showActions={false}
                  />
                </CardContent>
              </Card>

              {currentOrg && (
                <>
                  {!isSafetyAdmin ? (
                    <Card className="border-yellow-200 bg-yellow-50">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-yellow-900 font-medium">
                              안전관리자 권한이 필요합니다
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              이 페이지는 안전관리자(safety_admin) 또는 관리자만 접근할 수 있습니다.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">SDS 문서 목록</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          총 {sdsDocuments.length}개의 SDS 문서
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {sdsLoading ? (
                          <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                              <Skeleton key={i} className="h-12 w-full" />
                            ))}
                          </div>
                        ) : sdsDocuments.length === 0 ? (
                          <div className="text-center py-12">
                            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                            <p className="text-sm text-muted-foreground">
                              SDS 문서가 없습니다.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>제품명</TableHead>
                                  <TableHead>파일명</TableHead>
                                  <TableHead>소스</TableHead>
                                  <TableHead>상태</TableHead>
                                  <TableHead>작업</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sdsDocuments.map((doc: any) => (
                                  <TableRow key={doc.id}>
                                    <TableCell className="font-medium">
                                      {doc.product?.name || "알 수 없음"}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {doc.fileName}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">
                                        {doc.source === "vendor" ? "벤더" : "업로드"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {getStatusBadge(doc.extractionStatus)}
                                        {(doc.extractionStatus === "processing" || doc.extractionStatus === "queued") && (
                                          <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {!doc.extractionStatus || doc.extractionStatus === "failed" ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleStartExtraction(doc.id)}
                                            disabled={startExtractionMutation.isPending}
                                          >
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            AI 추출
                                          </Button>
                                        ) : doc.extractionStatus === "queued" || doc.extractionStatus === "processing" ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCancelExtraction(doc.id)}
                                            disabled={cancelExtractionMutation.isPending}
                                          >
                                            <X className="h-3 w-3 mr-1" />
                                            취소
                                          </Button>
                                        ) : doc.extractionStatus === "done" ? (
                                          <Sheet>
                                            <SheetTrigger asChild>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setSelectedSdsId(doc.id)}
                                              >
                                                <FileText className="h-3 w-3 mr-1" />
                                                결과 보기
                                              </Button>
                                            </SheetTrigger>
                                            <ExtractionResultSheet
                                              sdsDocument={doc}
                                              onApply={handleApplyExtraction}
                                            />
                                          </Sheet>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 적용 확인 다이얼로그 */}
      <ConfirmDialog
        open={applyDialog.open}
        onOpenChange={(open) => setApplyDialog({ ...applyDialog, open })}
        title={
          applyDialog.mode === "merge"
            ? "결과 병합 적용"
            : applyDialog.mode === "overwrite"
            ? "결과 덮어쓰기 적용"
            : ""
        }
        description={
          applyDialog.mode === "merge"
            ? "기존 안전 정보와 추출 결과를 병합합니다. 기존 값이 있으면 유지됩니다."
            : applyDialog.mode === "overwrite"
            ? "기존 안전 정보를 추출 결과로 완전히 교체합니다. 이 작업은 되돌릴 수 없습니다."
            : ""
        }
        confirmText="적용"
        variant="default"
        onConfirm={confirmApply}
      />
    </div>
  );
}

// 추출 결과 슬라이드오버 컴포넌트
function ExtractionResultSheet({
  sdsDocument,
  onApply,
}: {
  sdsDocument: any;
  onApply: (mode: "merge" | "overwrite") => void;
}) {
  const extractionResult = sdsDocument.extractionResult as any;

  if (!extractionResult) {
    return (
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>추출 결과</SheetTitle>
          <SheetDescription>추출 결과가 없습니다.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    );
  }

  return (
    <SheetContent className="sm:max-w-2xl overflow-y-auto">
      <SheetHeader>
        <SheetTitle>AI 추출 결과</SheetTitle>
        <SheetDescription>
          {sdsDocument.product?.name} - {sdsDocument.fileName}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* 위험 코드 */}
        {extractionResult.hazardCodes && extractionResult.hazardCodes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">위험 코드</h3>
            <div className="flex flex-wrap gap-2">
              {extractionResult.hazardCodes.map((code: string) => (
                <Badge key={code} variant="destructive">
                  {code}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 피크토그램 */}
        {extractionResult.pictograms && extractionResult.pictograms.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">GHS 피크토그램</h3>
            <div className="flex flex-wrap gap-2">
              {extractionResult.pictograms.map((picto: string) => (
                <Badge key={picto} variant="outline" className="bg-orange-50">
                  {picto}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 보관 조건 */}
        {extractionResult.storageCondition && (
          <div>
            <h3 className="text-sm font-semibold mb-2">보관 조건</h3>
            <p className="text-sm text-muted-foreground">
              {extractionResult.storageCondition}
            </p>
          </div>
        )}

        {/* 개인보호장비 */}
        {extractionResult.ppe && extractionResult.ppe.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">개인보호장비 (PPE)</h3>
            <div className="flex flex-wrap gap-2">
              {extractionResult.ppe.map((item: string) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 요약 */}
        {extractionResult.summary && (
          <div>
            <h3 className="text-sm font-semibold mb-2">안전 취급 요약</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {extractionResult.summary}
            </p>
          </div>
        )}

        {/* 적용 버튼 */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={() => onApply("merge")}
            className="flex-1"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            제품에 적용 (병합)
          </Button>
          <Button
            onClick={() => onApply("overwrite")}
            className="flex-1"
            variant="default"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            덮어쓰기 적용
          </Button>
        </div>
      </div>
    </SheetContent>
  );
}

export default function SafetyAdminPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SafetyAdminPageContent />
    </Suspense>
  );
}

