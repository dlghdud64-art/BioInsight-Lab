import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

type BetaBannerSectionProps = {
  variant?: "compact" | "full";
};

export function BetaBannerSection({ variant = "compact" }: BetaBannerSectionProps) {
  if (variant === "full") {
    return (
      <section className="mb-6">
        <Card className="border border-slate-200 bg-slate-50 shadow-sm rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <Sparkles className="h-5 w-5 text-indigo-600" strokeWidth={1.5} />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    Beta 기간 - 무료 체험
                  </h3>
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-indigo-200">
                    Beta
                  </Badge>
                </div>
                <p className="text-sm md:text-[15px] leading-snug text-slate-600">
                  검색/비교/견적 요청 리스트 기능은 Beta 기간 동안 무료로 제공됩니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  // Compact 버전 (홈페이지용)
  return (
    <section className="py-2 md:py-3">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-indigo-600 flex-shrink-0" strokeWidth={1.5} />
          <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
            <span className="text-xs md:text-sm font-medium text-slate-700">
              <span className="hidden sm:inline">Beta 기간 - 무료 체험</span>
              <span className="sm:hidden">Beta - 무료</span>
            </span>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[10px] md:text-xs px-1.5 py-0.5 flex-shrink-0">
              Beta
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}

