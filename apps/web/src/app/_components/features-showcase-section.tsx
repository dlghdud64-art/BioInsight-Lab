import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, GitCompare, ShoppingCart, FlaskConical, FileText, BarChart3, ClipboardCopy } from "lucide-react";

export function FeaturesShowcaseSection() {
  const features = [
    {
      title: "검색/AI 분석",
      description: "GPT 기반 검색어 분석으로 관련 제품을 자동으로 찾아줍니다.",
      href: "/test/search",
      icon: Search,
      color: "bg-blue-600",
    },
    {
      title: "제품 비교",
      description: "여러 제품을 한 번에 비교하고 최적의 선택을 도와줍니다.",
      href: "/compare",
      icon: GitCompare,
      color: "bg-green-600",
    },
    {
      title: "품목 리스트",
      description: "선택한 제품들을 구매 요청용 리스트로 자동 정리합니다.",
      href: "/test/quote",
      icon: ShoppingCart,
      color: "bg-purple-600",
    },
    {
      title: "그룹웨어에 바로 붙여넣기",
      description: "결재 양식에 맞는 표/텍스트 형식으로 품목 리스트를 만들어 줍니다. 복사 한 번으로 회사 전자결재/구매 시스템에 연결할 수 있습니다.",
      href: "/test/quote/request",
      icon: ClipboardCopy,
      color: "bg-amber-600",
    },
    {
      title: "프로토콜 분석",
      description: "실험 프로토콜 텍스트에서 필요한 시약을 자동으로 추출합니다.",
      href: "/protocol/bom",
      icon: FlaskConical,
      color: "bg-orange-600",
    },
    {
      title: "일반 검색",
      description: "간단한 제품 검색으로 빠르게 원하는 제품을 찾습니다.",
      href: "/search",
      icon: FileText,
      color: "bg-indigo-600",
    },
    {
      title: "대시보드",
      description: "구매 내역, 예산, 인벤토리를 한눈에 관리합니다.",
      href: "/dashboard",
      icon: BarChart3,
      color: "bg-pink-600",
    },
  ];

  return (
    <section id="features-showcase" className="mt-12 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">모든 기능 체험하기</h2>
        <p className="text-sm text-slate-600">
          각 기능을 클릭하여 바로 체험해보세요
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.href} href={feature.href}>
              <Card className="border border-slate-200 bg-white shadow-sm rounded-xl hover:shadow-md transition-all hover:border-blue-300 cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`${feature.color} p-2 rounded-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {feature.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-slate-600">
                    {feature.description}
                  </CardDescription>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4 w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    체험하기 →
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

