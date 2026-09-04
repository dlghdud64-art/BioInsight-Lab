"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, Users, CreditCard, Info } from "lucide-react";
import { OrganizationRole } from "@prisma/client";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/use-active-organization";

interface WorkspaceSwitcherProps {
  currentOrganizationId?: string;
  onOrganizationChange?: (organizationId: string) => void;
  showActions?: boolean;
}

export function WorkspaceSwitcher({
  currentOrganizationId,
  onOrganizationChange,
  showActions = true,
}: WorkspaceSwitcherProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  /**
   * §invite-flow Phase 4 — 스위처가 활성 조직을 **서버에 영속**시킨다.
   *
   * 이전에는 이 컴포넌트가 (a) 자체 조직 쿼리 (b) 로컬 `selectedOrgId` (c) 값이 비면
   * `organizations[0]` 자기 승격 — 셋을 갖고 있었다. 그래서 표시가 서버 판정과
   * 무관하게 움직일 수 있었고, 전환은 어디에도 저장되지 않았다(새로고침하면 원복).
   *
   * 🛑 **로컬 선택 state 를 두지 않는다.** 그게 이 트랙의 위험 지점이다 —
   *    로컬 값이 남아 있으면 소비 화면의 `effectiveOrgId = selectedOrgId || 활성조직`
   *    에서 옛 값이 이겨 PATCH 가 무력화되고, 2-9 에서 잠근 짝(표시 = 데이터)이 깨진다.
   *    표시값은 **부모가 준 값 아니면 서버의 활성 조직** 둘 뿐이다.
   */
  const {
    organizations,
    organizationId: activeOrganizationId,
    isLoading,
    setActiveOrganization,
    isSwitching,
  } = useActiveOrganization();

  const displayedOrgId = currentOrganizationId || activeOrganizationId || "";

  // 현재 선택된 조직 정보
  const currentOrg = organizations.find((org: any) => org.id === displayedOrgId);
  
  // 현재 사용자의 역할 확인
  //   훅의 `ActiveOrganization` 은 인덱스 시그니처가 `unknown` 이라 `members` 가 `{}` 로
  //   좁혀진다. `/api/organizations` 응답에는 실재하므로 이 지점에서만 형태를 명시한다.
  const orgMembers = (currentOrg?.members ?? []) as Array<{
    userId?: string;
    role?: OrganizationRole;
  }>;
  const currentMembership = orgMembers.find(
    (m) => m.userId === session?.user?.id
  );
  const userRole = currentMembership?.role || null;
  // §team-org-role-model Phase 1 **누락분** (2026-08-12) — OWNER 추가. 동작 확대만.
  //   Phase 1 잔여 확인 grep 이 `WorkspaceMember`(별도 모델)를 걸러내려고 경로에
  //   "workspace" 가 든 파일을 제외했는데, 이 파일은 **OrganizationRole** 판정인데도
  //   경로 때문에 함께 걸러졌다. 제외 필터가 대상까지 지운 사례다.
  const isAdmin =
    userRole === OrganizationRole.OWNER || userRole === OrganizationRole.ADMIN;
  const isMember = userRole !== null && !isAdmin;

  /**
   * 조직 변경 — **서버가 먼저**, 화면은 그 뒤.
   *
   * 🛑 낙관적 갱신을 하지 않는다. 먼저 화면을 바꾸고 PATCH 가 403/500 으로 실패하면
   *    화면은 org-B 를 보여주는데 서버는 org-A 인 상태가 된다 — placeholder success 다.
   *    실패 시에는 표시값을 **건드리지 않고** 사유만 말한다(활성 조직은 서버 값 그대로).
   */
  const handleOrganizationChange = async (orgId: string) => {
    if (orgId === displayedOrgId) return;
    try {
      await setActiveOrganization(orgId);
      // 여기부터는 서버가 저장을 확인해 준 뒤다. 훅이 활성 조직·목록 캐시를 무효화하므로
      // 부모의 로컬 state 도 같은 값으로 맞춰 준다(짝 유지).
      if (onOrganizationChange) {
        onOrganizationChange(orgId);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast({
        title: "워크스페이스 전환 실패",
        description:
          error instanceof Error
            ? error.message
            : "활성 조직을 저장하지 못했습니다.",
        variant: "destructive",
      });
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-32 bg-slate-200 animate-pulse rounded" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/dashboard/organizations">
          <Button variant="outline" size="sm">
            <Building2 className="h-4 w-4 mr-2" />
            워크스페이스 생성
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={displayedOrgId}
        onValueChange={handleOrganizationChange}
        disabled={isSwitching}
      >
        <SelectTrigger className="w-[180px] md:w-[220px]">
          <Building2 className="h-4 w-4 mr-2 text-slate-500" />
          <SelectValue placeholder="워크스페이스 선택" />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org: any) => (
            <SelectItem key={org.id} value={org.id}>
              <div className="flex items-center gap-2">
                <span>{org.name}</span>
                {org.plan !== "FREE" && (
                  <span className="text-xs text-blue-600">({org.plan})</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showActions && (
        <>
          {isAdmin ? (
            <>
              <Link href="/settings/workspace">
                <Button variant="outline" size="sm" className="hidden md:flex">
                  <Users className="h-4 w-4 mr-1" />
                  멤버 초대
                </Button>
              </Link>
              <Link href="/dashboard/settings/plans">
                <Button variant="outline" size="sm" className="hidden md:flex">
                  <CreditCard className="h-4 w-4 mr-1" />
                  결제/업그레이드
                </Button>
              </Link>
            </>
          ) : isMember ? (
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="opacity-50 cursor-not-allowed"
              >
                <Info className="h-4 w-4 mr-1" />
                관리자만 가능
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}









