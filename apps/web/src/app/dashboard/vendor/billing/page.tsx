"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, DollarSign, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function VendorBillingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-billing"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/billing");
      if (!response.ok) throw new Error("Failed to fetch billing records");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const { data: premiumData } = useQuery({
    queryKey: ["vendor-premium"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/premium");
      if (!response.ok) throw new Error("Failed to fetch premium status");
      return response.json();
    },
    enabled: status === "authenticated",
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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard/vendor/billing");
    return null;
  }

  const records = data?.records || [];
  const stats = data?.stats || {
    totalRevenue: 0,
    totalLeads: 0,
    thisMonthRevenue: 0,
    thisMonthLeads: 0,
  };
  const vendor = premiumData?.vendor;

  const handleDownloadInsights = async () => {
    try {
      const response = await fetch("/api/vendor/insights");
      if (!response.ok) throw new Error("Failed to generate insights");
      const { insights } = await response.json();

      // JSON을 CSV로 변환 (간단한 버전)
      const csv = [
        ["기간", `${insights.period.startDate} ~ ${insights.period.endDate}`],
        ["총 견적 요청", insights.summary.totalQuotes],
        ["총 응답", insights.summary.totalResponses],
        ["응답률", `${insights.summary.responseRate}%`],
        ["완료율", `${insights.summary.completionRate}%`],
        ["총 수익", insights.summary.totalRevenue],
        ["총 리드", insights.summary.totalLeads],
      ].map((row) => row.join(",")).join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `vendor-insights-${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download insights:", error);
      alert("리포트 다운로드에 실패했습니다.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">과금 및 수익 관리</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadInsights}>
              <Download className="h-4 w-4 mr-2" />
              인사이트 리포트 다운로드
            </Button>
            <Link href="/dashboard/supplier">
              <Button variant="outline">대시보드로 돌아가기</Button>
            </Link>
          </div>
        </div>

        {/* 프리미엄 상태 */}
        {vendor && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>프리미엄 플랜 상태</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    {vendor.isPremium ? "프리미엄 활성" : "프리미엄 비활성"}
                  </p>
                  {vendor.premiumExpiresAt && (
                    <p className="text-sm text-muted-foreground">
                      만료일: {new Date(vendor.premiumExpiresAt).toLocaleDateString("ko-KR")}
                    </p>
                  )}
                </div>
                <Button variant={vendor.isPremium ? "outline" : "default"}>
                  {vendor.isPremium ? "플랜 관리" : "프리미엄 업그레이드"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                총 수익
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₩{stats.totalRevenue.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">
                이번 달: ₩{stats.thisMonthRevenue.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                총 리드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalLeads}</div>
              <p className="text-sm text-muted-foreground mt-1">
                이번 달: {stats.thisMonthLeads}개
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">리드당 과금</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ₩{vendor?.leadPricePerQuote?.toLocaleString() || "0"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">견적 요청당</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                과금 기록
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{records.length}</div>
              <p className="text-sm text-muted-foreground mt-1">전체 기록</p>
            </CardContent>
          </Card>
        </div>

        {/* 과금 기록 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>과금 기록</CardTitle>
            <CardDescription>리드당 과금 및 프리미엄 플랜 과금 내역</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">과금 기록이 없습니다</p>
            ) : (
              <div className="space-y-4">
                {records.map((record: any) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {record.type === "LEAD" && "리드 과금"}
                        {record.type === "PREMIUM" && "프리미엄 플랜"}
                        {record.type === "REPORT" && "리포트 구매"}
                      </p>
                      <p className="text-sm text-muted-foreground">{record.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(record.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">₩{record.amount.toLocaleString()}</p>
                      {record.quantity && (
                        <p className="text-sm text-muted-foreground">
                          수량: {record.quantity}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

