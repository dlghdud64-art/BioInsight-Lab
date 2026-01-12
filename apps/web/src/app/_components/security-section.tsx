import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Server } from "lucide-react";

// SecuritySection 컴포넌트 - 연구/구매 워크벤치 스타일
export function SecuritySection() {
  return (
    <section id="security" className="py-8 md:py-10 border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-3">
          보안
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
            <CardContent className="flex items-start gap-2.5 p-6">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 flex-shrink-0">
                <Shield className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">Paste-only 모드</h3>
                <p className="text-xs leading-snug text-slate-600">
                  프로토콜/데이터시트는 파일로만 업로드하여 시스템에만 전송합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
            <CardContent className="flex items-start gap-2.5 p-6">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Lock className="h-3.5 w-3.5 text-slate-700" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">공유 링크 보안</h3>
                <p className="text-xs leading-snug text-slate-600">
                  암호화 기반 공유 링크. 검색엔진 노출 방지, 만료/비활성화 지원.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
            <CardContent className="flex items-start gap-2.5 p-6">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 flex-shrink-0">
                <Server className="h-3.5 w-3.5 text-indigo-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">프라이빗 배포</h3>
                <p className="text-xs leading-snug text-slate-600">
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
