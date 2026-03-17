"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, Plus, Users, Loader2, ArrowRight, ShieldCheck, Mail, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function OrganizationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [navigatingToOrgId, setNavigatingToOrgId] = useState<string | number | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: "", description: "", organizationType: "" });

  // 조직 목록 불러오기 (인증된 경우에만)
  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setIsFetching(false);
      return;
    }

    let cancelled = false;

    const fetchOrganizations = async () => {
      try {
        setIsFetching(true);
        const res = await fetch("/api/organizations");
        if (!res.ok) {
          throw new Error(`Failed to fetch organizations: ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) {
          const raw = Array.isArray(json.organizations) ? json.organizations : [];
          const mapped = raw.map((org: any) => ({
            id: org.id,
            name: org.name ?? "",
            description: org.description ?? "",
            memberCount: org.memberCount ?? (Array.isArray(org.members) ? org.members.length : 0),
            adminCount: org.adminCount ?? 0,
            pendingCount: org.pendingCount ?? 0,
            plan: org.plan ?? "FREE",
            role: org.role ?? "멤버",
          }));
          setOrganizations(mapped);
        }
      } catch (error) {
        console.error("[OrganizationsPage] Error fetching organizations:", error);
        if (!cancelled) {
          setOrganizations([]);
          toast({
            title: "조직 목록을 불러오지 못했습니다.",
            description: "잠시 후 다시 시도해주세요.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    fetchOrganizations();

    return () => {
      cancelled = true;
    };
  }, [status, toast]);

  const refetchOrganizations = async () => {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) return;
      const json = await res.json();
      const raw = Array.isArray(json.organizations) ? json.organizations : [];
      const mapped = raw.map((org: any) => ({
        id: org.id,
        name: org.name ?? "",
        description: org.description ?? "",
        memberCount: org.memberCount ?? (Array.isArray(org.members) ? org.members.length : 0),
        adminCount: org.adminCount ?? 0,
        pendingCount: org.pendingCount ?? 0,
        plan: org.plan ?? "FREE",
        role: org.role ?? "멤버",
      }));
      setOrganizations(mapped);
    } catch (e) {
      console.error("[OrganizationsPage] Refetch error:", e);
    }
  };

  const handleGoToOrgDashboard = (orgId: string | number) => {
    setNavigatingToOrgId(orgId);
    router.push(`/dashboard/organizations/${orgId}`);
  };

  // 조직 생성
  const handleCreateOrg = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "입력 필요",
        description: "조직 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);

      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          organizationType: formData.organizationType.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          (json as any)?.error ||
          (json as any)?.details ||
          "조직 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

        console.error("[OrganizationsPage] Failed to create organization:", json);
        toast({
          title: "조직 생성 실패",
          description: message,
          variant: "destructive",
        });
        return;
      }

      const createdOrg = (json as any).organization;
      const newOrgId: string | null = createdOrg?.id ?? null;

      // 로컬 목록 즉시 반영 — refetch 없이 로컬 state만 업데이트 (race condition 방지)
      const mapped = {
        id: newOrgId ?? String(Date.now()),
        name: createdOrg?.name ?? formData.name.trim(),
        description: createdOrg?.description ?? formData.description.trim() ?? "",
        memberCount: Array.isArray(createdOrg?.members) ? createdOrg.members.length : 1,
        role: "관리자",
      };
      setOrganizations((prev) => [mapped, ...prev]);

      toast({
        title: "조직 생성 완료",
        description: "새로운 조직이 성공적으로 생성되었습니다.",
      });

      setIsOpen(false);
      setFormData({ name: "", description: "", organizationType: "" });

      // 생성된 조직 상세 페이지로 이동 (예산 설정 등 다음 단계 유도)
      if (newOrgId) {
        router.push(`/dashboard/organizations/${newOrgId}`);
      }
    } catch (error) {
      console.error("[OrganizationsPage] Unexpected error creating organization:", error);
      toast({
        title: "조직 생성 실패",
        description: "통신이 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-8 pt-4 md:pt-6 max-w-6xl mx-auto w-full">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex flex-col space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-blue-400 mb-0.5 sm:mb-1">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-sm sm:text-base font-semibold tracking-tight">조직 관리</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-100">조직 관리</h2>
          <p className="text-muted-foreground text-sm hidden sm:block">
            조직을 생성하고 팀원들을 초대하여 함께 견적을 관리합니다.
          </p>
        </div>

        {organizations.length > 0 && (
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 shrink-0 text-sm h-9"
          >
            <Plus className="mr-1.5 h-4 w-4" /> 새 조직 만들기
          </Button>
        )}
      </div>

      {/* 조직 생성 모달 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>새 조직 만들기</DialogTitle>
            <DialogDescription>
              연구실이나 팀의 이름을 입력하여 새로운 워크스페이스를 만듭니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">
                조직 이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="org-name"
                placeholder="예: 생명공학연구소 1팀"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-type">조직 유형</Label>
              <Select
                value={formData.organizationType || undefined}
                onValueChange={(v) =>
                  setFormData({ ...formData, organizationType: v })
                }
              >
                <SelectTrigger id="org-type">
                  <SelectValue placeholder="조직 유형을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R&D 연구소">R&D 연구소</SelectItem>
                  <SelectItem value="QC/QA 품질관리">QC/QA 품질관리</SelectItem>
                  <SelectItem value="시험·검사 기관">시험·검사 기관</SelectItem>
                  <SelectItem value="대학 연구실">대학 연구실</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-desc">간단한 설명 (선택)</Label>
              <Input
                id="org-desc"
                placeholder="예: 단백질 구조 분석 프로젝트 팀"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isCreating}
            >
              취소
            </Button>
            <Button
              onClick={handleCreateOrg}
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 생성 중...
                </>
              ) : (
                "조직 생성"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 메인 화면 (로딩 / Empty State / Card Grid) */}
      {isFetching ? (
        <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card
              key={idx}
              className="shadow-none border-slate-800 bg-slate-900 animate-pulse"
            >
              <CardHeader className="pb-3">
                <div className="mb-2 flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-slate-800" />
                  <div className="h-5 w-16 rounded-full bg-slate-800" />
                </div>
                <div className="h-5 w-32 rounded bg-slate-800 mb-2" />
                <div className="h-4 w-48 rounded bg-slate-800" />
              </CardHeader>
              <CardContent>
                <div className="h-8 rounded-md bg-slate-800" />
              </CardContent>
              <CardFooter className="mt-4 border-t border-slate-800 pt-3">
                <div className="h-8 w-full rounded-md bg-slate-800" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-24 shadow-none border-slate-800 bg-slate-900">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-300">
            소속된 조직이 없습니다
          </h3>
          <p className="mb-4 text-sm text-slate-400">
            첫 조직을 생성하고 팀원들과 함께 워크스페이스를 시작해 보세요.
          </p>
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" /> 새 조직 만들기
          </Button>
        </Card>
      ) : (
        <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => {
            const planLabel = org.plan === "ORGANIZATION" ? "Pro" : org.plan === "TEAM" ? "Basic" : "Starter";
            const planColor = org.plan === "ORGANIZATION"
              ? "border-indigo-800 bg-indigo-900/20 text-indigo-700 border-indigo-800 bg-indigo-950/40 text-indigo-300"
              : org.plan === "TEAM"
                ? "border-blue-800 bg-blue-950/20 text-blue-700 border-blue-800 bg-blue-950/40 text-blue-300"
                : "border-slate-800 bg-slate-900 text-slate-400 border-slate-700 bg-slate-800 text-slate-400";
            const roleLabel = org.role === "OWNER" ? "소유자" : org.role === "ADMIN" ? "관리자" : org.role === "APPROVER" ? "승인자" : org.role === "REQUESTER" ? "요청자" : "조회자";
            return (
              <Card
                key={org.id}
                className="flex flex-col border-slate-800 shadow-none transition-shadow hover:border-blue-800 hover:shadow-none border-slate-800 hover:border-blue-800"
              >
                <CardHeader className="pb-2">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-950/20 font-bold text-blue-400 bg-blue-900/50 text-blue-400">
                      {org.name.substring(0, 1)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={planColor}>
                        {planLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-800 bg-slate-900 text-slate-500 border-slate-700 bg-slate-800 text-slate-400"
                      >
                        {roleLabel}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-base sm:text-lg leading-tight">{org.name}</CardTitle>
                  {org.description && (
                    <CardDescription className="line-clamp-1 text-xs">
                      {org.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center rounded-md bg-slate-900 px-2 py-2 bg-slate-800">
                      <Users className="mb-1 h-3.5 w-3.5 text-blue-500" />
                      <span className="text-sm font-bold text-slate-200">{org.memberCount}</span>
                      <span className="text-[10px] text-slate-400">멤버</span>
                    </div>
                    <div className="flex flex-col items-center rounded-md bg-slate-900 px-2 py-2 bg-slate-800">
                      <ShieldCheck className="mb-1 h-3.5 w-3.5 text-purple-500" />
                      <span className="text-sm font-bold text-slate-200">{org.adminCount}</span>
                      <span className="text-[10px] text-slate-400">관리자</span>
                    </div>
                    <div className="flex flex-col items-center rounded-md bg-slate-900 px-2 py-2 bg-slate-800">
                      <Mail className="mb-1 h-3.5 w-3.5 text-orange-500" />
                      <span className="text-sm font-bold text-slate-200">{org.pendingCount}</span>
                      <span className="text-[10px] text-slate-400">대기</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-800 pt-0 border-slate-800">
                  <Button
                    variant="ghost"
                    className="mt-2 w-full text-blue-400 hover:bg-blue-950/20 hover:text-blue-700 hover:bg-blue-950/30 hover:text-blue-400"
                    onClick={() => handleGoToOrgDashboard(org.id)}
                    disabled={navigatingToOrgId === org.id}
                  >
                    {navigatingToOrgId === org.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        이동 중...
                      </>
                    ) : (
                      <>
                        관리 페이지로 이동 <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
