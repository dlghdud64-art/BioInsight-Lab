"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crown, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function VendorPremiumPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expiresAt, setExpiresAt] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-premium"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/premium");
      if (!response.ok) throw new Error("Failed to fetch premium status");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const updatePremiumMutation = useMutation({
    mutationFn: async (data: { isPremium: boolean; premiumExpiresAt?: string }) => {
      const response = await fetch("/api/vendor/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update premium status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-premium"] });
      alert("프리미엄 상태가 업데이트되었습니다.");
    },
  });

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard/vendor/premium");
  //   return null;
  // }

  const vendor = data?.vendor;
  const isPremium = vendor?.isPremium || false;
  const isExpired = vendor?.premiumExpiresAt && new Date(vendor.premiumExpiresAt) < new Date();

  const handleActivate = () => {
    updatePremiumMutation.mutate({
      isPremium: true,
      premiumExpiresAt: expiresAt || undefined,
    });
  };

  const handleDeactivate = () => {
    if (confirm("프리미엄 플랜을 비활성화하시겠습니까?")) {
      updatePremiumMutation.mutate({
        isPremium: false,
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">프리미엄 플랜 관리</h1>
          <Link href="/dashboard/supplier">
            <Button variant="outline">대시보드로 돌아가기</Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              현재 상태
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {isPremium && !isExpired ? (
                    <span className="text-green-600 flex items-center gap-2">
                      <Check className="h-5 w-5" />
                      프리미엄 활성
                    </span>
                  ) : (
                    <span className="text-gray-600 flex items-center gap-2">
                      <X className="h-5 w-5" />
                      프리미엄 비활성
                    </span>
                  )}
                </p>
                {vendor?.premiumExpiresAt && (
                  <p className="text-sm text-muted-foreground mt-1">
                    만료일: {new Date(vendor.premiumExpiresAt).toLocaleDateString("ko-KR")}
                    {isExpired && <span className="text-red-500 ml-2">(만료됨)</span>}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>프리미엄 플랜 혜택</CardTitle>
            <CardDescription>
              프리미엄 플랜을 활성화하면 다음과 같은 혜택을 받을 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <span>검색 결과 상단 노출 우선순위</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <span>추천 영역에 제품 노출</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <span>상세 통계 및 인사이트 리포트</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <span>우선 고객 지원</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {!isPremium || isExpired ? (
          <Card>
            <CardHeader>
              <CardTitle>프리미엄 플랜 활성화</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="expiresAt">만료일 (선택사항)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  만료일을 설정하지 않으면 무기한으로 활성화됩니다
                </p>
              </div>
              <Button
                onClick={handleActivate}
                disabled={updatePremiumMutation.isPending}
                className="w-full"
              >
                {updatePremiumMutation.isPending ? "처리 중..." : "프리미엄 플랜 활성화"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>프리미엄 플랜 비활성화</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                프리미엄 플랜을 비활성화하면 모든 프리미엄 혜택이 즉시 중단됩니다.
              </p>
              <Button
                variant="destructive"
                onClick={handleDeactivate}
                disabled={updatePremiumMutation.isPending}
              >
                {updatePremiumMutation.isPending ? "처리 중..." : "프리미엄 플랜 비활성화"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

