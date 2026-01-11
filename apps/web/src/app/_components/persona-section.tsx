"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FlaskConical, CheckCircle2, Factory, ShoppingCart } from "lucide-react";

const personas = [
  {
    id: "rnd",
    title: "R&D 연구자",
    icon: FlaskConical,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    items: [
      "실험 프로토콜에서 필요한 시약을 자동으로 추출",
      "스펙 중심으로 제품 비교 및 대체품 검토",
      "영문 데이터시트를 한글로 요약/번역",
      "연구실 예산 내에서 최적의 제품 선택",
    ],
  },
  {
    id: "qc",
    title: "QC/QA 실무자",
    icon: CheckCircle2,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    items: [
      "동일 Grade/규격 유지가 중요한 대체품 검토",
      "GMP, 분석용 등급 정보 중심 비교",
      "규격 준수 여부 빠른 확인",
      "품질 기준에 맞는 제품만 필터링",
    ],
  },
  {
    id: "production",
    title: "생산 엔지니어",
    icon: Factory,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    items: [
      "대량 구매 시 가격·납기 중심 비교",
      "재고 관리 및 자동 재주문 추천",
      "프로젝트별 구매 내역 리포트",
      "예산 대비 사용률 추적",
    ],
  },
  {
    id: "buyer",
    title: "구매 담당자",
    icon: ShoppingCart,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    items: [
      "팀에서 요청한 견적 요청 리스트를 한 번에 확인",
      "벤더별 가격·납기 비교 및 견적 요청",
      "기간별/프로젝트별 구매 리포트 생성",
      "예산 책정 및 사용률 관리",
    ],
  },
];

export function PersonaSection() {
  return (
    <section id="personas" className="py-6 md:py-8 border-b border-slate-200 bg-white scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-3">
          누가 쓰나요?
        </h2>
        <Accordion type="single" collapsible defaultValue="rnd" className="w-full space-y-2">
          {personas.map((persona) => {
            const Icon = persona.icon;
            return (
              <AccordionItem key={persona.id} value={persona.id} className="border border-slate-200 rounded-lg bg-white px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md ${persona.iconBg} flex-shrink-0`}>
                      <Icon className={`h-3 w-3 ${persona.iconColor} flex-shrink-0`} strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium text-slate-900">{persona.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-600 leading-relaxed">
                    {persona.items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
