import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Server } from "lucide-react";

// SecuritySection 컴포넌트 - 연구/구매 워크벤치 스타일
export function SecuritySection() {
  return (
    <section id="security" className="py-10 md:py-14 border-b border-slate-200">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <h2 className="text-sm md:text-lg font-semibold tracking-tight text-slate-900 mb-4 md:mb-6">
          보안
        </h2>
        <div className="grid gap-3 md:gap-4 md:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Shield className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">Paste-only 모드</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                  프로토콜/데이터시트는 파일로만 업로드하여 시스템에만 전송합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Lock className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">공유 링크 보안</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                  암호화 기반 공유 링크. 검색엔진 노출 방지, 만료/비활성화 지원.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Server className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">프라이빗 배포</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                  Enterprise 플랜에서 자체 서버 배포 옵션을 제공합니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
