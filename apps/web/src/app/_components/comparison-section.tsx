"use client";

import { ArrowRight, CheckCircle2, CircleDot } from "lucide-react";
import { useState } from "react";

interface WorkflowStep {
  stage: string;
  before: string;
  after: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    stage: "벤더·제품 탐색",
    before: "벤더별 사이트를 개별 방문하여 제품을 검색하고 스펙을 수기로 기록",
    after: "통합 검색으로 여러 벤더의 제품을 한 화면에서 조회하고 비교 대상 선정",
  },
  {
    stage: "품목 정리 및 비교",
    before: "엑셀·노션에 제품 정보를 복사-붙여넣기로 정리하고 수동 비교",
    after: "선택한 제품이 자동으로 비교표에 정렬되어 스펙·가격 차이를 즉시 확인",
  },
  {
    stage: "견적 요청",
    before: "벤더마다 다른 양식에 맞춰 견적 요청서를 개별 작성·발송",
    after: "비교표에서 바로 견적 요청 리스트를 생성하고 공유 링크로 전달",
  },
  {
    stage: "비교 검토 및 의사결정",
    before: "이메일·파일이 분산되어 최신 버전 파악과 팀 내 공유가 어려움",
    after: "하나의 공유 문서에서 팀원과 실시간 검토하고 승인 이력을 관리",
  },
  {
    stage: "구매 이력·후속 운영",
    before: "구매 기록이 개인 파일에 남아 반복 구매나 예산 확인에 시간 소요",
    after: "구매 이력이 자동 축적되어 재구매·예산 현황·지출 추이를 즉시 조회",
  },
];

const VALUE_SUMMARIES = [
  {
    title: "검색 통합",
    desc: "여러 벤더 사이트를 하나로",
  },
  {
    title: "비교 준비 단축",
    desc: "수기 정리 없이 비교표 완성",
  },
  {
    title: "견적 요청 간소화",
    desc: "리스트 생성부터 공유까지",
  },
  {
    title: "운영 데이터 연결",
    desc: "구매 이력·예산·재고 통합 관리",
  },
];

export function ComparisonSection() {
  const [activeView, setActiveView] = useState<"before" | "after">("before");

  return (
    <section className="py-6 md:py-10 border-b border-slate-200 bg-gradient-to-b from-white via-slate-50/30 to-white">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        {/* 헤더 */}
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-2">
            도입 전후 업무 흐름 비교
          </h2>
          <p className="text-xs md:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            연구 구매의 주요 단계별로 기존 수작업 방식과 BioInsight 도입 후 달라지는 운영 흐름을 비교합니다
          </p>
        </div>

        {/* 모바일 토글 */}
        <div className="flex items-center justify-center mb-6 md:hidden">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm w-full max-w-sm">
            <button
              onClick={() => setActiveView("before")}
              className={`flex-1 px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                activeView === "before"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              기존 방식
            </button>
            <button
              onClick={() => setActiveView("after")}
              className={`flex-1 px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                activeView === "after"
                  ? "bg-blue-50 text-blue-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              BioInsight 도입 후
            </button>
          </div>
        </div>

        {/* 데스크탑: 단계별 비교 테이블 */}
        <div className="hidden md:block mb-6 md:mb-8">
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-[180px_1fr_auto_1fr] items-center bg-slate-50 border-b border-slate-200 px-5 py-3.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                업무 단계
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                기존 방식
              </span>
              <span className="w-8" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                BioInsight 도입 후
              </span>
            </div>

            {/* 테이블 본문 */}
            <div className="divide-y divide-slate-100">
              {WORKFLOW_STEPS.map((step, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[180px_1fr_auto_1fr] items-start px-5 py-4 hover:bg-slate-50/50 transition-colors"
                >
                  {/* 단계 라벨 */}
                  <div className="flex items-center gap-2 pr-4">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 leading-tight">
                      {step.stage}
                    </span>
                  </div>

                  {/* 기존 방식 */}
                  <div className="flex items-start gap-2 pr-4">
                    <CircleDot className="flex-shrink-0 w-4 h-4 text-slate-400 mt-0.5" />
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {step.before}
                    </p>
                  </div>

                  {/* 화살표 */}
                  <div className="flex items-center justify-center w-8 pt-0.5">
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>

                  {/* BioInsight 도입 후 */}
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="flex-shrink-0 w-4 h-4 text-blue-500 mt-0.5" />
                    <p className="text-sm text-slate-800 leading-relaxed font-medium">
                      {step.after}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 모바일: 단계별 카드 (토글에 따라 전환) */}
        <div className="md:hidden mb-4">
          <div className="space-y-2">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-3 transition-all ${
                  activeView === "after"
                    ? "border-blue-200 bg-blue-50/30"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      activeView === "after"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {step.stage}
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed pl-7 ${
                    activeView === "after"
                      ? "text-slate-800 font-medium"
                      : "text-slate-600"
                  }`}
                >
                  {activeView === "after" ? step.after : step.before}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 제품 가치 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 max-w-3xl mx-auto mt-4">
          {VALUE_SUMMARIES.map((item, idx) => (
            <div
              key={idx}
              className="text-center p-3 md:p-4 bg-white rounded-lg border border-slate-200 shadow-sm"
            >
              <div className="text-sm md:text-base font-semibold text-slate-900 mb-0.5">
                {item.title}
              </div>
              <div className="text-[10px] md:text-xs text-slate-500 leading-snug">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
