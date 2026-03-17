"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  GitCompareArrows,
  FileText,
  ShoppingCart,
  Package,
  ArrowRight,
  Info,
  HelpCircle,
  MessageSquare,
} from "lucide-react";

const GUIDE_STEPS = [
  {
    step: 1,
    icon: Search,
    color: "blue",
    title: "시약 및 장비 검색",
    description:
      "500만 개 이상의 데이터베이스에서 필요한 품목을 검색합니다. 이름, CAS Number, 카탈로그 번호로 빠르게 찾을 수 있습니다.",
    cta: { label: "검색 시작하기", href: "/dashboard/search" },
  },
  {
    step: 2,
    icon: GitCompareArrows,
    color: "teal",
    title: "제품 비교",
    description:
      "검색 결과에서 여러 제품을 선택하여 가격, 규격, 제조사별로 비교합니다. 최적의 조건을 한눈에 확인하세요.",
    cta: { label: "비교 기능 보기", href: "/dashboard/search" },
  },
  {
    step: 3,
    icon: FileText,
    color: "emerald",
    title: "견적 요청",
    description:
      "비교 결과에서 선택한 품목을 장바구니에 담아 견적을 요청합니다. 엑셀 리스트를 업로드하여 한 번에 처리할 수도 있습니다.",
    cta: { label: "견적 관리로 이동", href: "/dashboard/quotes" },
  },
  {
    step: 4,
    icon: ShoppingCart,
    color: "purple",
    title: "구매 관리",
    description:
      "벤더 회신을 확인하고 발주를 진행합니다. 구매 이력, 증빙 자료, 지출 분석까지 하나의 화면에서 관리할 수 있습니다.",
    cta: { label: "구매 운영 보기", href: "/dashboard/purchases" },
  },
  {
    step: 5,
    icon: Package,
    color: "amber",
    title: "재고 반영",
    description:
      "입고된 제품을 재고에 반영합니다. Lot 번호, 유효기간, 보관 위치를 기록하고 안전 재고 알림을 설정하세요.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
];

const COLOR_MAP: Record<string, { bg: string; icon: string; stepBg: string; stepText: string }> = {
  blue: { bg: "bg-blue-600/10", icon: "text-blue-400", stepBg: "bg-blue-600", stepText: "text-white" },
  teal: { bg: "bg-teal-600/10", icon: "text-teal-400", stepBg: "bg-teal-600", stepText: "text-white" },
  emerald: { bg: "bg-emerald-600/10", icon: "text-emerald-400", stepBg: "bg-emerald-600", stepText: "text-white" },
  purple: { bg: "bg-purple-600/10", icon: "text-purple-400", stepBg: "bg-purple-600", stepText: "text-white" },
  amber: { bg: "bg-amber-600/10", icon: "text-amber-400", stepBg: "bg-amber-600", stepText: "text-white" },
};

export default function GuidePage() {
  return (
    <div className="flex-1 space-y-4 sm:space-y-6 pt-2 md:pt-4 max-w-4xl mx-auto w-full">
      {/* 페이지 헤더 */}
      <div className="space-y-1 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-100 tracking-tight">
          이용 가이드
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed hidden sm:block">
          검색부터 재고 반영까지, 전체 운영 흐름을 단계별로 안내합니다.
        </p>
      </div>

      {/* 업데이트 안내 (축소) */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-blue-600/10 border border-blue-800">
        <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
        <p className="text-xs text-blue-400">
          상세 비디오 튜토리얼과 매뉴얼 문서가 곧 업데이트될 예정입니다.
        </p>
      </div>

      {/* 5단계 가이드 */}
      <div className="space-y-3">
        {GUIDE_STEPS.map((item) => {
          const Icon = item.icon;
          const colors = COLOR_MAP[item.color];
          return (
            <Card key={item.step} className="border-slate-800 shadow-none overflow-hidden">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start gap-4">
                  {/* 스텝 번호 + 아이콘 */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <span className={`w-6 h-6 rounded-full ${colors.stepBg} ${colors.stepText} text-xs font-bold flex items-center justify-center`}>
                      {item.step}
                    </span>
                    <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${colors.icon}`} />
                    </div>
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 mb-1">
                      {item.title}
                    </p>
                    <p className="text-sm text-slate-500 leading-relaxed mb-3">
                      {item.description}
                    </p>
                    <Link href={item.cta.href}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                      >
                        {item.cta.label}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 하단 지원 연결 */}
      <div className="rounded-xl border border-slate-800 bg-slate-800 px-5 py-5 mt-8">
        <p className="text-sm font-semibold text-slate-100 mb-3">추가 도움이 필요하신가요?</p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link href="/dashboard/faq">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-700 text-slate-300 hover:bg-slate-800">
              <HelpCircle className="h-3.5 w-3.5" />
              도움말 센터
            </Button>
          </Link>
          <Link href="/dashboard/support">
            <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <MessageSquare className="h-3.5 w-3.5" />
              1:1 문의하기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
