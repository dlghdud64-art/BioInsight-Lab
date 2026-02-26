"use client";

import { X, CheckCircle2, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ComparisonSection() {
  const [isBioInsight, setIsBioInsight] = useState(false);
  const beforeItems = [
    { 
      title: "벤더 사이트 개별 검색", 
      detail: "~20분 · 10+개 사이트 방문",
      icon: X
    },
    { 
      title: "엑셀/노션에 수동 정리", 
      detail: "~15분 · 복붙 반복",
      icon: X
    },
    { 
      title: "견적 요청 문서 작성", 
      detail: "~10분 · 형식 맞추기",
      icon: X
    },
    { 
      title: "버전 관리 어려움", 
      detail: "파일 분산 · 이메일 체인",
      icon: X
    },
  ];

  const afterItems = [
    { 
      title: "통합 검색으로 한 번에 여러 벤더 검색", 
      detail: "~2분 · 자동 크롤링",
      icon: CheckCircle2
    },
    { 
      title: "스펙·가격 자동 정렬 비교표", 
      detail: "즉시 · AI 분석",
      icon: CheckCircle2
    },
    { 
      title: "견적 요청 리스트 자동 생성", 
      detail: "1분 · 클릭 한 번",
      icon: CheckCircle2
    },
    { 
      title: "공유링크/TSV/엑셀 즉시 내보내기", 
      detail: "실시간 협업 · 버전 관리",
      icon: CheckCircle2
    },
  ];

  const currentItems = isBioInsight ? afterItems : beforeItems;
  const totalTime = isBioInsight ? "~5분" : "~45분";
  const timeColor = isBioInsight ? "text-emerald-700" : "text-slate-900";
  const borderColor = isBioInsight ? "border-emerald-300" : "border-slate-200";
  const bgColor = isBioInsight ? "bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50" : "bg-white";

  return (
    <section className="py-6 md:py-10 border-b border-slate-200 bg-gradient-to-b from-white via-slate-50/50 to-white">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        {/* 헤더 */}
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-2">
            작업 방식 비교
          </h2>
          <p className="text-xs md:text-sm text-slate-600 max-w-2xl mx-auto">
            수동 작업에서 자동화로 전환하여 시간을 절약하고 효율성을 극대화하세요
          </p>
        </div>

        {/* Toggle Switch - 모바일 전용 */}
        <div className="flex items-center justify-center mb-6 md:mb-8 md:hidden">
          <div className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-full p-1 shadow-lg w-full max-w-sm">
            <button
              onClick={() => setIsBioInsight(false)}
              className={`flex-1 px-4 py-2.5 rounded-full font-semibold text-sm transition-all ${
                !isBioInsight
                  ? "bg-slate-100 text-slate-900 shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="text-red-500">🔴</span>
                <span>기존 방식</span>
              </span>
            </button>
            <button
              onClick={() => setIsBioInsight(true)}
              className={`flex-1 px-4 py-2.5 rounded-full font-semibold text-sm transition-all ${
                isBioInsight
                  ? "bg-emerald-100 text-emerald-900 shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="text-emerald-500">🟢</span>
                <span>자동화</span>
              </span>
            </button>
          </div>
        </div>

        {/* 데스크탑: 인터랙티브 비교 테이블 (md 이상) */}
        <div className="hidden md:block mb-6 md:mb-8">
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xl max-w-4xl mx-auto bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                  <TableHead className="p-6 text-sm font-semibold text-slate-500 uppercase tracking-wider">기능</TableHead>
                  <TableHead className="p-6 text-sm font-semibold text-slate-500 uppercase tracking-wider text-center">전통적 방식</TableHead>
                  <TableHead className="p-6 text-sm font-semibold text-blue-600 uppercase tracking-wider text-center">BioInsight 솔루션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                <TableRow className="hover:bg-blue-50/30 transition-colors">
                  <TableCell className="p-6 font-medium text-slate-900">벤더 사이트 개별 검색</TableCell>
                  <TableCell className="p-6 text-center text-slate-400 font-mono text-sm">~20분 (10+개 사이트)</TableCell>
                  <TableCell className="p-6 text-center text-blue-600 font-bold text-lg">~2분 (자동 크롤링)</TableCell>
                </TableRow>
                <TableRow className="hover:bg-blue-50/30 transition-colors">
                  <TableCell className="p-6 font-medium text-slate-900">엑셀/노션에 수동 정리</TableCell>
                  <TableCell className="p-6 text-center text-slate-400 font-mono text-sm">~15분 (복붙 반복)</TableCell>
                  <TableCell className="p-6 text-center text-blue-600 font-bold text-lg">즉시 (AI 분석)</TableCell>
                </TableRow>
                <TableRow className="hover:bg-blue-50/30 transition-colors">
                  <TableCell className="p-6 font-medium text-slate-900">견적 요청 문서 작성</TableCell>
                  <TableCell className="p-6 text-center text-slate-400 font-mono text-sm">~10분 (형식 맞추기)</TableCell>
                  <TableCell className="p-6 text-center text-blue-600 font-bold text-lg">1분 (클릭 한 번)</TableCell>
                </TableRow>
                <TableRow className="border-t-2 border-slate-200 hover:bg-blue-50/30">
                  <TableCell className="p-6 font-semibold text-slate-900 uppercase tracking-wide">총 소요시간</TableCell>
                  <TableCell className="p-6 text-center">
                    <span className="text-slate-400 font-mono text-lg line-through">~45분</span>
                  </TableCell>
                  <TableCell className="p-6 text-center bg-blue-50/50">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-blue-600 font-bold text-2xl">~5분</span>
                      <span className="text-blue-600 font-bold text-sm flex items-center gap-1">
                        <TrendingDown className="h-4 w-4" />
                        90% 시간 절약
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 모바일: 메인 비교 카드 (토글에 따라 내용 변경) */}
        <div className="mb-4 md:mb-6 md:hidden">
          <div className="relative min-h-[400px]">
            <div className={`border-2 ${borderColor} ${bgColor} rounded-xl p-4 md:p-6 lg:p-8 shadow-lg transition-all duration-300`}>
              <div className="space-y-2 md:space-y-4">
                {currentItems.map((item, idx) => (
                  <div key={idx} className={`flex items-start gap-2 md:gap-4 p-2 md:p-4 rounded-lg md:rounded-xl ${
                    isBioInsight 
                      ? "bg-white/70 backdrop-blur-sm border border-emerald-300/60 shadow-sm"
                      : "bg-slate-50/50 border border-slate-200"
                  }`}>
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`w-4 h-4 md:w-6 md:h-6 rounded-full flex items-center justify-center ${
                        isBioInsight ? "bg-emerald-600 shadow-md" : "bg-slate-300"
                      }`}>
                        <item.icon className={`h-2.5 w-2.5 md:h-4 md:w-4 ${
                          isBioInsight ? "text-white" : "text-slate-600"
                        }`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-base font-semibold text-slate-900 mb-0.5 md:mb-1.5 leading-tight">{item.title}</p>
                      <p className={`text-[10px] md:text-sm leading-tight ${
                        isBioInsight ? "text-emerald-700 font-medium" : "text-slate-600"
                      }`}>{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 총 시간 */}
              <div className={`mt-4 md:mt-6 pt-3 md:pt-4 border-t-2 ${
                isBioInsight ? "border-emerald-300/60" : "border-slate-300"
              }`}>
                <div className="flex items-baseline justify-between">
                  <span className={`text-[10px] md:text-sm font-semibold uppercase tracking-wide ${
                    isBioInsight ? "text-emerald-800" : "text-slate-600"
                  }`}>총 소요시간</span>
                  <div className="text-right">
                    <span className={`text-lg md:text-3xl font-bold ${timeColor}`}>{totalTime}</span>
                    <span className={`text-[10px] md:text-base ml-1 ${
                      isBioInsight ? "text-emerald-600" : "text-slate-600"
                    }`}>/건</span>
                  </div>
                </div>
                {isBioInsight && (
                  <div className="flex items-center gap-2 pt-2 md:pt-3 border-t border-emerald-300/40 mt-2">
                    <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                    <span className="text-xs md:text-base font-bold text-emerald-700">90% 시간 절약</span>
                    <span className="text-[10px] md:text-sm text-emerald-600 ml-auto font-medium">40분 절감</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 핵심 메트릭 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 max-w-3xl mx-auto mt-4">
          {[
            { label: "시간 절약", value: "90%", color: "emerald" },
            { label: "작업 단축", value: "40분", color: "emerald" },
            { label: "사이트 방문", value: "10+ → 1", color: "blue" },
            { label: "수동 작업", value: "0회", color: "purple" },
          ].map((metric, idx) => (
            <div key={idx} className="text-center p-2 md:p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm">
              <div className={`text-lg md:text-2xl font-bold mb-1 ${
                metric.color === "emerald" ? "text-emerald-600" :
                metric.color === "blue" ? "text-blue-600" :
                "text-purple-600"
              }`}>
                {metric.value}
              </div>
              <div className="text-[10px] md:text-xs text-slate-700 font-semibold">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

