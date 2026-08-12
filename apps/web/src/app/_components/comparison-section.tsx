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
    stage: "제품 탐색",
    before: "벤더 사이트를 개별 방문, 스펙 수기 기록",
    after: "통합 검색으로 한 화면에서 조회·비교",
  },
  {
    stage: "품목 비교",
    before: "엑셀에 복붙해서 수동 정리·비교",
    after: "자동 비교표로 스펙·가격 즉시 확인",
  },
  {
    stage: "견적 요청",
    before: "벤더별 양식에 맞춰 개별 작성·발송",
    after: "비교표에서 바로 견적 생성·공유",
  },
  {
    stage: "검토·의사결정",
    before: "이메일·파일 분산, 버전 파악 어려움",
    after: "공유 문서에서 팀원과 실시간 검토",
  },
  {
    stage: "구매 이력 관리",
    before: "개인 파일에 기록, 재구매 시 재확인",
    after: "이력 자동 축적, 예산·지출 즉시 조회",
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
    <section className="py-6 md:py-10 border-b border-bd">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        {/* 헤더 */}
        <div className="text-center mb-4 md:mb-8">
          <h2 className="text-base md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 mb-1 md:mb-2">
            업무 흐름 비교
          </h2>
          <p className="text-[11px] md:text-sm text-slate-500 max-w-2xl mx-auto">
            단계별로 달라지는 운영 흐름을 비교합니다
          </p>
        </div>

        {/* 모바일 토글 */}
        <div className="flex items-center justify-center mb-4 md:hidden">
          <div className="flex items-center bg-el rounded-full p-1 w-full max-w-sm">
            <button
              onClick={() => setActiveView("before")}
              className={`flex-1 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                activeView === "before"
                  ? "bg-pn text-slate-100 shadow-sm"
                  : "text-slate-400"
              }`}
            >
              기존 방식
            </button>
            <button
              onClick={() => setActiveView("after")}
              className={`flex-1 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                activeView === "after"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-blue-400 bg-blue-600/10 border border-blue-600/30"
              }`}
            >
              LabAxis
            </button>
          </div>
        </div>

        {/* 데스크탑: 단계별 비교 테이블 */}
        <div className="hidden md:block mb-6 md:mb-8">
          <div className="border border-bd rounded-xl overflow-hidden bg-pn shadow-sm">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-[180px_1fr_auto_1fr] items-center bg-pg border-b border-bd px-5 py-3.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                업무 단계
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                기존 방식
              </span>
              <span className="w-8" />
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                LabAxis 도입 후
              </span>
            </div>

            {/* 테이블 본문 */}
            <div className="divide-y divide-[#2a2a2e]">
              {WORKFLOW_STEPS.map((step, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[180px_1fr_auto_1fr] items-start px-5 py-4 hover:bg-pg/50 transition-colors"
                >
                  {/* 단계 라벨 */}
                  <div className="flex items-center gap-2 pr-4">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-el flex items-center justify-center text-[11px] font-bold text-slate-400">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-200 leading-tight">
                      {step.stage}
                    </span>
                  </div>

                  {/* 기존 방식 */}
                  <div className="flex items-start gap-2 pr-4">
                    <CircleDot className="flex-shrink-0 w-4 h-4 text-slate-400 mt-0.5" />
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {step.before}
                    </p>
                  </div>

                  {/* 화살표 */}
                  <div className="flex items-center justify-center w-8 pt-0.5">
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>

                  {/* BioInsight 도입 후 */}
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="flex-shrink-0 w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
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
                    ? "border-blue-600/30 bg-blue-600/5"
                    : "border-bd bg-pn"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      activeView === "after"
                        ? "bg-blue-600/20 text-blue-300"
                        : "bg-el text-slate-400"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-200">
                    {step.stage}
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed pl-7 ${
                    activeView === "after"
                      ? "text-slate-200 font-medium"
                      : "text-slate-400"
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
              className="text-center p-3 md:p-4 bg-pn rounded-lg border border-bd shadow-sm"
            >
              <div className="text-sm md:text-base font-semibold text-slate-100 mb-0.5">
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
