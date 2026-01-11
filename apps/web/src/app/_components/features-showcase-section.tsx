"use client";

import Link from "next/link";
import { Search, GitCompare, ShoppingCart, FlaskConical, BarChart3, Languages, ArrowRight, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const features = [
  {
    id: "search",
    title: "검색/AI 분석",
    description: "GPT 기반 검색어 분석으로 관련 제품을 자동으로 찾아줍니다.",
    href: "/test/search",
    icon: Search,
    gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    details: [
      "자연어 검색: '항체 실험용 시약' 같은 일상 표현으로도 검색 가능",
      "AI 추천: 검색 의도를 파악하여 관련 카테고리와 필터 제안",
      "스마트 필터: 가격, 브랜드, Grade 등 다양한 조건으로 빠른 검색",
    ],
  },
  {
    id: "compare",
    title: "제품 비교",
    description: "여러 제품을 한 번에 비교하고 최적의 선택을 도와줍니다.",
    href: "/compare",
    icon: GitCompare,
    gradient: "bg-gradient-to-br from-emerald-400 to-teal-600",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    details: [
      "스펙 비교: 가격, 순도, 크기, 납기 등 핵심 정보 한눈에 확인",
      "대체품 추천: 유사한 스펙의 다른 제품 자동 제안",
      "비용 최적화: 동일 효과를 내는 가장 경제적인 옵션 식별",
    ],
  },
  {
    id: "quote",
    title: "견적 요청 & 공유",
    description: "선택한 제품을 견적 요청 리스트로 정리하고 TSV/엑셀로 내보냅니다.",
    href: "/test/quote",
    icon: ShoppingCart,
    gradient: "bg-gradient-to-br from-violet-500 to-fuchsia-600",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    details: [
      "간편한 정리: 검색과 비교에서 선택한 제품을 자동으로 리스트화",
      "다양한 내보내기: TSV, Excel, 공유 링크로 팀원이나 구매 담당자에게 전달",
      "벤더 전송: 원클릭으로 여러 벤더에게 동시에 견적 요청",
    ],
  },
  {
    id: "protocol",
    title: "프로토콜 분석",
    description: "실험 프로토콜 텍스트에서 필요한 시약을 자동으로 추출합니다.",
    href: "/protocol/bom",
    icon: FlaskConical,
    gradient: "bg-gradient-to-br from-purple-500 to-pink-600",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    details: [
      "자동 추출: PDF/텍스트에서 시약 이름, 농도, 양 등 자동 파싱",
      "BOM 생성: 프로토콜 기반으로 구매 리스트 자동 작성",
      "재고 확인: 연구실 인벤토리와 대조하여 부족한 항목만 표시",
    ],
  },
  {
    id: "translation",
    title: "자동 번역 & 요약",
    description: "영문 데이터시트와 제품 설명을 한글로 번역하고 핵심 정보를 요약합니다.",
    href: "/search",
    icon: Languages,
    gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    details: [
      "실시간 번역: 해외 벤더 제품 설명을 즉시 한글로 확인",
      "요약 기능: 긴 데이터시트의 핵심만 추출하여 빠른 이해",
      "전문 용어 처리: 생명과학 분야 전문 용어를 정확하게 번역",
    ],
  },
  {
    id: "dashboard",
    title: "대시보드",
    description: "구매 내역, 예산, 인벤토리를 한눈에 관리합니다.",
    href: "/dashboard",
    icon: BarChart3,
    gradient: "bg-gradient-to-br from-slate-600 to-slate-800",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    details: [
      "지출 추적: 프로젝트/기간별 구매 내역과 예산 사용률 시각화",
      "재고 관리: 보유 시약의 수량, 위치, 유통기한 한눈에 파악",
      "리포트 생성: 관리자를 위한 구매 분석 보고서 자동 생성",
    ],
  },
];

export function FeaturesShowcaseSection() {
  return (
    <section id="features-showcase" className="py-6 md:py-8 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/50">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center space-y-1 mb-4 md:mb-6">
          <h2 className="text-lg md:text-2xl font-bold tracking-tight text-gray-900">주요 기능</h2>
          <p className="text-xs md:text-sm text-gray-500 max-w-2xl mx-auto">
            각 기능을 클릭하여 자세히 알아보세요
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <AccordionItem key={feature.id} value={feature.id} className="border border-slate-200 rounded-lg bg-white px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${feature.iconBg} flex-shrink-0`}>
                      <Icon className={`h-4 w-4 ${feature.iconColor}`} strokeWidth={2} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-slate-900">{feature.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{feature.description}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <ul className="space-y-2 ml-11">
                    {feature.details.map((detail, idx) => (
                      <li key={idx} className="text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                        <ChevronRight className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 ml-11">
                    <Link
                      href={feature.href}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <span>지금 사용해보기</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
