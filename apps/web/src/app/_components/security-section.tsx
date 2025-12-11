import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Server } from "lucide-react";

export function SecuritySection() {
  return (
    <section id="security" className="mt-12 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        보안 & 프라이버시
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Shield className="h-5 w-5 text-slate-900" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">Paste-only 모드</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                프로토콜/데이터시트는 파일로만 업로드하여 시스템에만 전송합니다.
                민감한 문서를 안전하게 처리합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Lock className="h-5 w-5 text-slate-900" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">공유 링크 보안</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                암호화 기반 공유 링크로 안전하게 품목 리스트를 공유합니다.
                검색엔진에 노출되지 않으며 만료/비활성화 기능을 제공합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Server className="h-5 w-5 text-slate-900" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">프라이빗 배포</h3>
              <p className="text-xs leading-relaxed text-slate-500">
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
