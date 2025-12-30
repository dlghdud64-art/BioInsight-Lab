import { Card, CardContent } from "@/components/ui/card";
import { Shield, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SafetyRegulationTeaserSection() {
  return (
    <section className="py-8 md:py-10 border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-3">
          안전 · 규제 정보
        </h2>

        <Card className="border border-slate-200 bg-white rounded-lg">
          <CardContent className="p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0">
                <div className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-100">
                  <Shield className="h-3.5 w-3.5 text-slate-600" strokeWidth={1.5} />
                </div>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">
                    MSDS/SDS 및 규제 정보 제공
                  </h3>
                  <p className="text-xs leading-snug text-slate-600">
                    제품 상세에서 MSDS/SDS 링크와 규제 정보 페이지로 바로 이동할 수 있도록 준비하고 있습니다.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3 border-slate-200 flex-shrink-0" disabled>
                    <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="whitespace-nowrap">MSDS/SDS</span>
                    <span className="ml-1 text-[9px] text-slate-400 hidden md:inline">(준비 중)</span>
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3 border-slate-200 flex-shrink-0" disabled>
                    <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="whitespace-nowrap">규제 정보</span>
                    <span className="ml-1 text-[9px] text-slate-400 hidden md:inline">(준비 중)</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

