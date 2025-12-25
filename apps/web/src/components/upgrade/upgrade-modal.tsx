"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Users, CreditCard, ArrowRight, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { OrganizationRole } from "@prisma/client";
import Link from "next/link";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
  limitType?: "members" | "quotes" | "sharedLinks";
  currentCount?: number;
  limit?: number;
}

export function UpgradeModal({
  open,
  onOpenChange,
  organizationId,
  limitType = "members",
  currentCount,
  limit,
}: UpgradeModalProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 조직 정보 조회
  const { data: organizationData } = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const response = await fetch(`/api/organizations/${organizationId}/subscription`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!organizationId && status === "authenticated",
  });

  const organization = organizationData?.organization;
  const currentMembership = organization?.members?.find(
    (m: any) => m.userId === session?.user?.id
  );
  const userRole = currentMembership?.role || null;
  const isAdmin = userRole === OrganizationRole.ADMIN;
  const isMember = userRole !== null && !isAdmin;
  const isGuest = !session || status === "unauthenticated";

  const limitMessages = {
    members: {
      title: "멤버 수 제한",
      description: `현재 플랜에서는 최대 ${limit}명의 멤버만 초대할 수 있습니다.`,
    },
    quotes: {
      title: "견적 수 제한",
      description: `현재 플랜에서는 월 ${limit}개의 견적만 생성할 수 있습니다.`,
    },
    sharedLinks: {
      title: "공유 링크 제한",
      description: `현재 플랜에서는 최대 ${limit}개의 공유 링크만 생성할 수 있습니다.`,
    },
  };

  const message = limitMessages[limitType];

  const handleUpgrade = () => {
    if (isAdmin) {
      router.push(`/dashboard/settings/plans?org=${organizationId}`);
    } else if (isMember) {
      // 멤버는 관리자에게 요청 안내만 표시
      onOpenChange(false);
    } else {
      // 게스트는 로그인/팀 만들기 유도
      router.push("/auth/signin?callbackUrl=/dashboard/organizations");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-full bg-yellow-100 p-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              {message.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-600">
            {message.description}
            {currentCount !== undefined && (
              <span className="block mt-2 font-medium text-slate-900">
                현재 사용량: {currentCount} / {limit}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isAdmin ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Team 플랜으로 업그레이드
                    </p>
                    <p className="text-xs text-blue-700">
                      더 많은 멤버와 기능을 사용할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleUpgrade}
                className="w-full"
                size="lg"
              >
                Team 시작하기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : isMember ? (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      관리자에게 업그레이드 요청
                    </p>
                    <p className="text-xs text-slate-600">
                      플랜 업그레이드는 워크스페이스 관리자만 가능합니다.
                      관리자에게 업그레이드를 요청해주세요.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="w-full"
                size="lg"
              >
                확인
              </Button>
            </>
          ) : (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <LogIn className="h-5 w-5 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      로그인 또는 팀 만들기
                    </p>
                    <p className="text-xs text-slate-600">
                      이 기능을 사용하려면 로그인하고 워크스페이스를 만들어야 합니다.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/auth/signin" className="flex-1">
                  <Button className="w-full" size="lg">
                    로그인
                  </Button>
                </Link>
                <Link href="/dashboard/organizations" className="flex-1">
                  <Button variant="outline" className="w-full" size="lg">
                    팀 만들기
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



