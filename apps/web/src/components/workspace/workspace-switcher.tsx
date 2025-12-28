"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
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
import { useState, useEffect } from "react";
import { OrganizationRole } from "@prisma/client";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedOrgId, setSelectedOrgId] = useState<string>(currentOrganizationId || "");

  // 사용자의 조직 목록 조회
  const { data: organizationsData, isLoading } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const organizations = organizationsData?.organizations || [];

  // 현재 선택된 조직 정보
  const currentOrg = organizations.find((org: any) => org.id === selectedOrgId || org.id === currentOrganizationId);
  
  // 현재 사용자의 역할 확인
  const currentMembership = currentOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id
  );
  const userRole = currentMembership?.role || null;
  const isAdmin = userRole === OrganizationRole.ADMIN;
  const isMember = userRole !== null && !isAdmin;

  // 조직 변경 핸들러
  const handleOrganizationChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    if (onOrganizationChange) {
      onOrganizationChange(orgId);
    } else {
      // 기본 동작: URL 파라미터 업데이트 또는 상태 저장
      router.refresh();
    }
  };

  useEffect(() => {
    if (currentOrganizationId && currentOrganizationId !== selectedOrgId) {
      setSelectedOrgId(currentOrganizationId);
    } else if (!selectedOrgId && organizations.length > 0) {
      // 기본값 설정
      setSelectedOrgId(organizations[0].id);
    }
  }, [currentOrganizationId, organizations]);

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
        value={selectedOrgId || currentOrganizationId || organizations[0]?.id || ""}
        onValueChange={handleOrganizationChange}
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





