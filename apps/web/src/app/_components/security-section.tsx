import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Server } from "lucide-react";

export function SecuritySection() {
  return (
    <section id="security" className="mt-6 md:mt-12 space-y-2 md:space-y-4">
      <h2 className="text-sm md:text-lg font-semibold tracking-tight text-slate-900">
        보안 & 프라이버시
      </h2>
      <div className="grid gap-3 md:gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Shield className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">Paste-only 모드</h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                프로토콜/데이터시트는 파일로만 업로드하여 시스템에만 전송합니다.
                민감한 문서를 안전하게 처리합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Lock className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">공유 링크 보안</h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                암호화 기반 공유 링크로 안전하게 견적 요청 리스트를 공유합니다.
                검색엔진에 노출되지 않으며 만료/비활성화 기능을 제공합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Server className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">프라이빗 배포</h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                Enterprise 플랜에서는 프라이빗 배포 옵션을 제공합니다.
                자체 서버에 배포하여 데이터를 안전하게 보호할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
