import { Card, CardContent } from "@/components/ui/card";
import { Shield, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SafetyRegulationTeaserSection() {
  return (
    <section className="mt-12 space-y-3 md:space-y-4">
      <div className="text-center space-y-1.5 md:space-y-2 px-2">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
          안전 · 규제 정보도 함께
        </h2>
        <p className="text-xs md:text-sm text-slate-600">
          제품 사용 전 필수 확인 사항을 한눈에
        </p>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 md:p-6">
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex-shrink-0 mt-1">
                <Shield className="h-5 w-5 md:h-6 md:w-6 text-slate-700" />
              </div>
              <div className="flex-1 space-y-2.5 md:space-y-3 min-w-0">
                <div>
                  <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-1.5 md:mb-2">
                    MSDS/SDS 및 국내 규제 정보 제공
                  </h3>
                  <p className="text-xs md:text-sm leading-relaxed text-slate-600">
                    제품 상세에서 MSDS/SDS 링크와 국내 규제/참고 페이지로 바로 이동할 수 있도록 준비하고 있습니다.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="text-[10px] md:text-xs h-8 md:h-9 px-2 md:px-3" disabled>
                    <FileText className="h-3 w-3 mr-1 md:mr-1.5" />
                    <span className="hidden sm:inline">MSDS / SDS 보기</span>
                    <span className="sm:hidden">MSDS</span>
                    <span className="ml-1 md:ml-1.5 text-[9px] md:text-[10px] text-slate-400">(준비 중)</span>
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] md:text-xs h-8 md:h-9 px-2 md:px-3" disabled>
                    <ExternalLink className="h-3 w-3 mr-1 md:mr-1.5" />
                    <span className="hidden sm:inline">국내 규제 정보 페이지</span>
                    <span className="sm:hidden">규제 정보</span>
                    <span className="ml-1 md:ml-1.5 text-[9px] md:text-[10px] text-slate-400">(준비 중)</span>
                  </Button>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                    <strong className="text-slate-700">향후 계획:</strong> H/P 문구, 보관·취급 조건 등을 구조화하여
                    안전관리/QA에서도 활용 가능한 정보를 제공할 예정입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

