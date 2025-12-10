import { Card, CardContent } from "@/components/ui/card";
import { Shield, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SafetyRegulationTeaserSection() {
  return (
    <section className="mt-20 space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          안전 · 규제 정보도 함께
        </h2>
        <p className="text-sm text-slate-600">
          제품 사용 전 필수 확인 사항을 한눈에
        </p>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <Shield className="h-6 w-6 text-slate-700" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">
                    MSDS/SDS 및 국내 규제 정보 제공
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    제품 상세에서 MSDS/SDS 링크와 국내 규제/참고 페이지로 바로 이동할 수 있도록 준비하고 있습니다.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="text-xs" disabled>
                    <FileText className="h-3 w-3 mr-1.5" />
                    MSDS / SDS 보기
                    <span className="ml-1.5 text-[10px] text-slate-400">(준비 중)</span>
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" disabled>
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    국내 규제 정보 페이지
                    <span className="ml-1.5 text-[10px] text-slate-400">(준비 중)</span>
                  </Button>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs leading-relaxed text-slate-500">
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

