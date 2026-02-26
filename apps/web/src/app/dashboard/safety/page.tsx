"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  AlertTriangle,
  Download,
  FileWarning,
  AlertOctagon,
  FileSearch,
  Flame,
  Skull,
  Droplets,
  Glasses,
  Shirt,
  Hand,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// GHS 픽토그램 렌더링
function GHSPictogram({ type }: { type: string }) {
  const base = "w-6 h-6 p-1 rounded flex-shrink-0";
  if (type === "corrosive")
    return <Droplets className={`${base} text-red-600 bg-red-50`} aria-label="부식성" />;
  if (type === "toxic")
    return <Skull className={`${base} text-red-600 bg-red-50`} aria-label="독성" />;
  if (type === "flammable")
    return <Flame className={`${base} text-orange-500 bg-orange-50`} aria-label="인화성" />;
  if (type === "oxidizer")
    return <Flame className={`${base} text-yellow-600 bg-yellow-50`} aria-label="산화성" />;
  return <AlertTriangle className={`${base} text-amber-500 bg-amber-50`} aria-label="경고" />;
}

// PPE 아이콘 렌더링 (필수: 브랜드 컬러, 선택: 회색)
function PPEIcon({
  type,
  required,
}: {
  type: string;
  required?: boolean;
}) {
  const base = "w-5 h-5 p-1 rounded flex-shrink-0";
  const active = required ? "text-blue-600 bg-blue-50" : "text-slate-300 bg-slate-50";
  const label =
    type === "gloves"
      ? "보호장갑"
      : type === "goggles"
        ? "보안경"
        : type === "coat"
          ? "실험복"
          : type === "mask"
            ? "마스크"
            : "PPE";

  if (type === "gloves") return <Hand className={`${base} ${active}`} aria-label={label} />;
  if (type === "goggles") return <Glasses className={`${base} ${active}`} aria-label={label} />;
  if (type === "coat") return <Shirt className={`${base} ${active}`} aria-label={label} />;
  if (type === "mask") return <ShieldCheck className={`${base} ${active}`} aria-label={label} />;
  return null;
}

const safetyItems = [
  {
    id: 1,
    name: "Sulfuric Acid (황산)",
    cas: "7664-93-9",
    isHighRisk: true,
    level: "HIGH" as const,
    hasMsds: true,
    msdsUpdatedAt: "2025-01-15",
    loc: "시약장 A (산성)",
    icons: ["corrosive", "toxic"] as const,
    ppe: [
      { type: "gloves", required: true },
      { type: "goggles", required: true },
      { type: "coat", required: true },
      { type: "mask", required: false },
    ],
  },
  {
    id: 2,
    name: "Acetone (아세톤)",
    cas: "67-64-1",
    isHighRisk: false,
    level: "MEDIUM" as const,
    hasMsds: false,
    msdsUpdatedAt: null,
    loc: "방폭 캐비닛 1",
    icons: ["flammable"] as const,
    ppe: [
      { type: "gloves", required: true },
      { type: "goggles", required: true },
      { type: "coat", required: false },
      { type: "mask", required: false },
    ],
  },
  {
    id: 3,
    name: "Sodium Hydroxide (수산화나트륨)",
    cas: "1310-73-2",
    isHighRisk: true,
    level: "HIGH" as const,
    hasMsds: false,
    msdsUpdatedAt: null,
    loc: "시약장 B (염기성)",
    icons: ["corrosive"] as const,
    ppe: [
      { type: "gloves", required: true },
      { type: "goggles", required: true },
      { type: "coat", required: true },
      { type: "mask", required: false },
    ],
  },
  {
    id: 4,
    name: "Ethanol 70%",
    cas: "64-17-5",
    isHighRisk: false,
    level: "LOW" as const,
    hasMsds: true,
    msdsUpdatedAt: "2025-02-01",
    loc: "일반 캐비닛",
    icons: ["flammable"] as const,
    ppe: [
      { type: "gloves", required: true },
      { type: "goggles", required: false },
      { type: "coat", required: false },
      { type: "mask", required: false },
    ],
  },
];

export default function SafetyManagerPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"high_risk" | "no_msds" | "all">("high_risk");

  const filteredItems = (safetyItems || []).filter((item) => {
    if (filter === "high_risk") return item.isHighRisk;
    if (filter === "no_msds") return !item.hasMsds;
    return true;
  });

  const totalCount = safetyItems.length;
  const highRiskCount = safetyItems.filter((i) => i.isHighRisk).length;
  const msdsMissingCount = safetyItems.filter((i) => !i.hasMsds).length;

  const getBorderColor = (level: string) => {
    if (level === "HIGH") return "border-l-red-500";
    if (level === "MEDIUM") return "border-l-orange-500";
    return "border-l-slate-300";
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

    const headers = ["제품명", "CAS", "위험도", "MSDS 상태", "최종 업데이트", "보관 위치"];
    const rows = filteredItems.map((item) => [
      item.name,
      item.cas,
      item.level === "HIGH" ? "고위험" : item.level === "MEDIUM" ? "중위험" : "일반",
      item.hasMsds ? "등록" : "누락",
      item.msdsUpdatedAt || "-",
      item.loc,
    ]);

    const csv = [headers, ...rows]
      .map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
              </div>
              <h1 className="text-xl md:text-3xl font-bold text-slate-900">안전 관리</h1>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              GMP/KOSHA 규격 대응. 고위험 물질, MSDS, 필수 보호구를 한눈에 관리합니다.
            </p>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm" className="text-xs md:text-sm shrink-0">
            <Download className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
            CSV 내보내기
          </Button>
        </div>

        {/* 1. 상단 안전 요약 KPI */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-600">전체 관리 물질</p>
                <p className="text-3xl font-bold text-slate-900">
                  {totalCount} <span className="text-sm font-normal text-slate-500">종</span>
                </p>
              </div>
              <Shield className="text-slate-300 w-10 h-10 flex-shrink-0" />
            </CardContent>
          </Card>
          <Card className="border-red-100 bg-red-50/20 shadow-sm">
            <CardContent className="pt-6 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-600">고위험 물질</p>
                <p className="text-3xl font-bold text-red-700">
                  {highRiskCount} <span className="text-sm font-normal text-red-500">종</span>
                </p>
              </div>
              <AlertOctagon className="text-red-300 w-10 h-10 flex-shrink-0" />
            </CardContent>
          </Card>
          <Card className="border-amber-100 bg-amber-50/20 shadow-sm">
            <CardContent className="pt-6 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-600">MSDS 누락 항목</p>
                <p className="text-3xl font-bold text-amber-700">
                  {msdsMissingCount} <span className="text-sm font-normal text-amber-500">종</span>
                </p>
              </div>
              <FileWarning className="text-amber-300 w-10 h-10 flex-shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* 필터 탭 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base">필터</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as "high_risk" | "no_msds" | "all")}
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
              <p className="text-xs md:text-sm text-slate-600">
                총 {filteredItems.length}개 제품이 검색되었습니다.
              </p>
            </Tabs>
          </CardContent>
        </Card>

        {/* 2. 고도화된 제품 리스트 */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">관리 대상 물질 리스트</CardTitle>
            <CardDescription>
              위험 등급별 컬러 바, GHS 픽토그램, 필수 보호구(PPE)를 확인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                조건에 맞는 데이터가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors border-l-4 ${getBorderColor(item.level)}`}
                  >
                    {/* 좌측: GHS 픽토그램 + 제품 정보 */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex gap-1 flex-shrink-0">
                        {item.icons.map((icon) => (
                          <GHSPictogram key={icon} type={icon} />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 truncate">{item.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          CAS: {item.cas} | {item.loc}
                        </p>
                      </div>
                    </div>

                    {/* 우측: PPE 가이드 + MSDS */}
                    <div className="flex flex-wrap items-center gap-4 md:gap-6">
                      {/* PPE 아이콘 */}
                      <div className="flex gap-2">
                        {item.ppe.map((p) => (
                          <PPEIcon
                            key={p.type}
                            type={p.type}
                            required={p.required}
                          />
                        ))}
                      </div>

                      {/* MSDS 관리: 최종 업데이트 일자 */}
                      <div className="flex items-center gap-2">
                        {item.hasMsds && item.msdsUpdatedAt ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <FileSearch className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>최종 업데이트: {item.msdsUpdatedAt}</span>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-200 bg-amber-50 text-amber-700"
                          >
                            MSDS 미등록
                          </Badge>
                        )}
                        <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 shrink-0">
                          <FileSearch className="w-4 h-4 mr-1.5" />
                          MSDS 보기
                        </Button>
                      </div>
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
