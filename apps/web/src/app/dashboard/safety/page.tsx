"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, AlertTriangle, Download, FileWarning } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SafetyManagerPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"high_risk" | "no_msds" | "all">("high_risk");

  // 1. 크래시를 방지할 튼튼한 가상 데이터
  const safetyItems = [
    {
      id: 1,
      name: "Sulfuric Acid (황산)",
      cas: "7664-93-9",
      isHighRisk: true,
      hasMsds: true,
      loc: "시약장 A (산성)",
    },
    {
      id: 2,
      name: "Acetone (아세톤)",
      cas: "67-64-1",
      isHighRisk: false,
      hasMsds: false,
      loc: "방폭 캐비닛 1",
    },
    {
      id: 3,
      name: "Sodium Hydroxide (수산화나트륨)",
      cas: "1310-73-2",
      isHighRisk: true,
      hasMsds: false,
      loc: "시약장 B (염기성)",
    },
    {
      id: 4,
      name: "Ethanol 70%",
      cas: "64-17-5",
      isHighRisk: false,
      hasMsds: true,
      loc: "일반 캐비닛",
    },
  ];

  // 안전한 필터링 로직
  const filteredItems =
    (safetyItems || []).filter((item) => {
      if (filter === "high_risk") return item.isHighRisk;
      if (filter === "no_msds") return !item.hasMsds;
      return true; // "all" 일 경우 전부 반환
    }) || [];

  const total = filteredItems.length;

  const getRiskBadge = (isHighRisk: boolean) => {
    if (isHighRisk) {
      return (
        <Badge
          variant="outline"
          dot="red"
          dotPulse
          className="border-red-200 bg-red-50 text-red-700"
        >
          고위험 물질
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        dot="emerald"
        className="border-emerald-200 bg-emerald-50 text-emerald-700"
      >
        일반 물질
      </Badge>
    );
  };

  const getMsdsBadge = (hasMsds: boolean) => {
    if (!hasMsds) {
      return (
        <Badge
          variant="outline"
          dot="amber"
          className="border-amber-200 bg-amber-50 text-amber-700"
        >
          MSDS 누락
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        dot="blue"
        className="border-blue-200 bg-blue-50 text-blue-700"
      >
        MSDS 등록 완료
      </Badge>
    );
  };

  const handleExport = () => {
    if (!filteredItems || filteredItems.length === 0) {
      toast({
        title: "내보낼 데이터 없음",
        description: "내보낼 제품이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // CSV 형식으로 내보내기 (Mock 데이터 기준)
    const headers = ["제품명", "CAS", "위험도", "MSDS 상태", "보관 위치"];
    const rows = (filteredItems || []).map((item) => [
      item.name,
      item.cas,
      item.isHighRisk ? "고위험" : "일반",
      item.hasMsds ? "등록" : "누락",
      item.loc,
    ]);

    const csv = [headers, ...rows]
      .map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `안전_제품_리스트_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "내보내기 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  return (
    <div className="w-full px-4 md:px-6 py-6 pt-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
            {/* 헤더 */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Shield className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
                  </div>
                  <h1 className="text-xl md:text-3xl font-bold text-slate-900">
                    안전 관리
                  </h1>
                </div>
                <p className="text-xs md:text-sm text-slate-600">
                  고위험 물질, MSDS 없는 품목, 규제 코드 포함 물질을 확인하고 관리합니다.
                </p>
              </div>
              <Button onClick={handleExport} variant="outline" size="sm" className="text-xs md:text-sm">
                <Download className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                CSV 내보내기
              </Button>
            </div>

            {/* 필터: 탭으로 전환 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm md:text-base">필터</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs
                  value={filter}
                  onValueChange={(value) => setFilter(value as "high_risk" | "no_msds" | "all")}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                    <TabsTrigger
                      value="high_risk"
                      className="flex items-center justify-center gap-2 py-2.5 text-xs md:text-sm data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-sm"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                      <span className="truncate">고위험군</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="no_msds"
                      className="flex items-center justify-center gap-2 py-2.5 text-xs md:text-sm data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-sm"
                    >
                      <FileWarning className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="truncate">MSDS 누락</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="all"
                      className="flex items-center justify-center gap-2 py-2.5 text-xs md:text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-800 data-[state=active]:shadow-sm"
                    >
                      <Shield className="h-4 w-4 text-slate-600 shrink-0" />
                      <span className="truncate">전체</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>총 {total}개 제품이 검색되었습니다.</span>
                </div>
              </CardContent>
            </Card>

            {/* 데이터 리스트 (Mock + 프리미엄 뱃지) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm md:text-base">제품 리스트</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  고위험 물질 및 MSDS 등록 현황을 한눈에 확인하세요.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(!filteredItems || filteredItems.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-xs md:text-sm">
                    조건에 맞는 데이터가 없습니다.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredItems?.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-5 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base md:text-lg">
                              {item.name}
                            </h3>
                            <span className="text-[11px] md:text-xs text-slate-400">
                              CAS: {item.cas}
                            </span>
                          </div>
                          <p className="text-xs md:text-sm text-slate-500">
                            보관 위치: {item.loc}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 md:gap-4">
                          {getRiskBadge(item.isHighRisk)}
                          {getMsdsBadge(item.hasMsds)}
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

