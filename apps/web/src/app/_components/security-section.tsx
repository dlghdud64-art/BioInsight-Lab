import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Server } from "lucide-react";

export function SecuritySection() {
  return (
    <section id="security" className="mt-20 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        보안 & ?입 ?내
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
                ?로?콜/?이?시?는 ?일 ?로???이 ?스?만 ?송?니??
                민감??문서???전?게 처리?????습?다.
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
                ?수 ?큰 기반 공유 링크??전?게 ?목 리스?? 공유?니??
                검?엔진에 ?출?? ?으? 만료/비활?화 기능???공?니??
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
              <h3 className="text-sm font-semibold text-slate-900">?프?????션</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                Enterprise ?랜?서???프????배포 ?션???공?니??
                ?? ?이?? ?전??보호?면???용?????습?다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
