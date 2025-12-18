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
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    지금은 Beta – 무료로 모든 기능을 체험해 보세요
                  </h3>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                    Beta
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">
                  검색/비교/견적 요청 리스트/복사·다운로드 기능은 현재 Beta 기간 동안 무료로 제공됩니다.
                  <br />
                  이후에는 Team/Organization 플랜으로 확장 예정입니다.
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
    <section className="mt-6 md:mt-8">
      <div className="flex items-center gap-2 md:gap-3 rounded-lg border border-blue-200 bg-blue-50/50 px-3 md:px-5 py-2.5 md:py-3">
        <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-blue-600 flex-shrink-0" />
        <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
          <span className="text-xs md:text-sm font-semibold text-slate-900">
            <span className="hidden sm:inline">지금은 Beta – 무료로 모든 기능을 체험해 보세요</span>
            <span className="sm:hidden">Beta – 무료로 체험</span>
          </span>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 flex-shrink-0">
            Beta
          </Badge>
        </div>
      </div>
    </section>
  );
}

