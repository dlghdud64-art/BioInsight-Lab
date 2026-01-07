"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Download, DollarSign, ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface PostUpgradeCardProps {
  organizationId?: string;
  organizationName?: string;
  onDismiss?: () => void;
}

export function PostUpgradeCard({
  organizationId,
  organizationName,
  onDismiss,
}: PostUpgradeCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (dismissed) return null;

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-blue-900 mb-1">
              🎉 TEAM 플랜으로 업그레이드 완료!
            </CardTitle>
            <CardDescription className="text-sm text-blue-700">
              {organizationName && (
                <span className="font-semibold">{organizationName}</span>
              )}{" "}
              워크스페이스가 활성화되었습니다. 다음 단계를 진행해보세요.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-blue-600 hover:text-blue-900"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3">
          {/* 팀원 초대 */}
          <Link href="/settings/workspace">
            <Button
              variant="outline"
              className="w-full justify-between bg-white hover:bg-blue-50 border-blue-200"
              size="lg"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium">팀원 초대하기</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          {/* 기존 임시 데이터 가져오기 */}
          <Link href="/dashboard/organizations">
            <Button
              variant="outline"
              className="w-full justify-between bg-white hover:bg-blue-50 border-blue-200"
              size="lg"
            >
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-600" />
                <span className="font-medium">기존 임시 데이터 가져오기</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          {/* 구매내역/예산 보기 */}
          <Link href="/dashboard/budget">
            <Button
              variant="outline"
              className="w-full justify-between bg-white hover:bg-blue-50 border-blue-200"
              size="lg"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="font-medium">구매내역/예산 보러가기</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="pt-2 border-t border-blue-200">
          <p className="text-xs text-blue-600 text-center">
            언제든지 설정에서 이 안내를 다시 볼 수 있습니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}









