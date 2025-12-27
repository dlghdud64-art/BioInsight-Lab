import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, GitCompare, ShoppingCart, FlaskConical, BarChart3, Languages } from "lucide-react";

export function FeaturesShowcaseSection() {
  const features = [
    {
      title: "검색/AI 분석",
      description: "GPT 기반 검색어 분석으로 관련 제품을 자동으로 찾아줍니다.",
      href: "/test/search",
      icon: Search,
      color: "bg-indigo-600",
      hoverBorder: "hover:border-indigo-400",
      hoverBg: "hover:bg-indigo-50/50",
    },
    {
      title: "제품 비교",
      description: "여러 제품을 한 번에 비교하고 최적의 선택을 도와줍니다.",
      href: "/compare",
      icon: GitCompare,
      color: "bg-emerald-600",
      hoverBorder: "hover:border-emerald-400",
      hoverBg: "hover:bg-emerald-50/50",
    },
    {
      title: "견적 요청 리스트 & 내보내기",
      description: "선택한 제품을 견적 요청 리스트로 정리하고, TSV/엑셀·공유 링크로 전달합니다.",
      href: "/test/quote",
      icon: ShoppingCart,
      color: "bg-blue-600",
      hoverBorder: "hover:border-blue-400",
      hoverBg: "hover:bg-blue-50/50",
    },
    {
      title: "프로토콜 분석",
      description: "실험 프로토콜 텍스트에서 필요한 시약을 자동으로 추출합니다.",
      href: "/protocol/bom",
      icon: FlaskConical,
      color: "bg-purple-600",
      hoverBorder: "hover:border-purple-400",
      hoverBg: "hover:bg-purple-50/50",
    },
    {
      title: "자동 번역 & 요약",
      description: "영문 데이터시트와 제품 설명을 한글로 번역하고 핵심 정보를 요약해 해외 벤더 제품 비교를 쉽게 합니다.",
      href: "/products/1",
      icon: Languages,
      color: "bg-amber-600",
      hoverBorder: "hover:border-amber-400",
      hoverBg: "hover:bg-amber-50/50",
    },
    {
      title: "대시보드",
      description: "구매 내역, 예산, 인벤토리를 한눈에 관리합니다.",
      href: "/dashboard",
      icon: BarChart3,
      color: "bg-slate-700",
      hoverBorder: "hover:border-slate-400",
      hoverBg: "hover:bg-slate-50",
    },
  ];

  return (
    <section id="features-showcase" className="py-8 md:py-10 border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="text-center space-y-1 mb-4">
          <h2 className="text-base md:text-lg font-semibold text-slate-900">주요 기능</h2>
          <p className="text-sm text-slate-600">
            각 기능을 클릭하여 바로 시작하세요
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.href} href={feature.href}>
                <Card className={`border border-slate-200 bg-white rounded-lg ${feature.hoverBorder} ${feature.hoverBg} transition-all cursor-pointer h-full`}>
                  <CardHeader className="pb-1.5 p-3">
                    <div className="flex items-center gap-2">
                      <div className={`${feature.color} p-1.5 rounded-md flex-shrink-0`}>
                        <Icon className="h-3.5 w-3.5 text-white" strokeWidth={1.5} />
                      </div>
                      <CardTitle className="text-sm font-semibold text-slate-900 min-w-0">
                        {feature.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <CardDescription className="text-xs leading-snug text-slate-600">
                      {feature.description}
                    </CardDescription>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 text-xs h-7"
                    >
                      바로 시작 →
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

