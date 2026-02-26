"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Users, Loader2, ArrowRight } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function OrganizationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [navigatingToOrgId, setNavigatingToOrgId] = useState<string | number | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // 조직 목록 불러오기
  useEffect(() => {
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
            memberCount: Array.isArray(org.members) ? org.members.length : 0,
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
  }, [toast]);

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
        memberCount: Array.isArray(org.members) ? org.members.length : 0,
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

      // 로컬 목록 즉시 반영 (API 응답을 카드 형식에 맞게 매핑)
      if (createdOrg) {
        const mapped = {
          id: createdOrg.id,
          name: createdOrg.name ?? formData.name.trim(),
          description: createdOrg.description ?? formData.description.trim() ?? "",
          memberCount: Array.isArray(createdOrg.members) ? createdOrg.members.length : 1,
          role: createdOrg.role ?? "최고 관리자",
        };
        setOrganizations((prev) => [mapped, ...prev]);
      }

      toast({
        title: "조직 생성 완료",
        description: "새로운 조직이 성공적으로 생성되었습니다.",
      });

      setIsOpen(false);
      setFormData({ name: "", description: "" });

      await refetchOrganizations();
      router.refresh();
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
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-6xl mx-auto w-full">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Building2 className="h-5 w-5" />
            <span className="font-semibold tracking-tight">조직 관리</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">조직 관리</h2>
          <p className="text-muted-foreground">
            조직을 생성하고 팀원들을 초대하여 함께 견적을 관리합니다.
          </p>
        </div>

        {organizations.length > 0 && (
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" /> 새 조직 만들기
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
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card
              key={idx}
              className="shadow-sm border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 animate-pulse"
            >
              <CardHeader className="pb-3">
                <div className="mb-2 flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
                  <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800 mb-2" />
                <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
              </CardHeader>
              <CardContent>
                <div className="h-8 rounded-md bg-slate-100 dark:bg-slate-800" />
              </CardContent>
              <CardFooter className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="h-8 w-full rounded-md bg-slate-100 dark:bg-slate-800" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-24 shadow-sm border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700 dark:text-slate-300">
            소속된 조직이 없습니다
          </h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
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
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Card
              key={org.id}
              className="cursor-pointer border-slate-200 shadow-sm transition-shadow hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:hover:border-blue-800"
            >
              <CardHeader className="pb-3">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 font-bold text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                    {org.name.substring(0, 1)}
                  </div>
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {org.role}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{org.name}</CardTitle>
                <CardDescription className="line-clamp-1">
                  {org.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center rounded-md bg-slate-50 p-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Users className="mr-2 h-4 w-4 text-slate-400" />
                  팀원 {org.memberCount}명
                </div>
              </CardContent>
              <CardFooter className="mt-4 border-t border-slate-100 pt-0 dark:border-slate-800">
                <Button
                  variant="ghost"
                  className="mt-2 w-full text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
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
          ))}
        </div>
      )}
    </div>
  );
}
