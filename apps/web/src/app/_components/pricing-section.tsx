import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PricingSection() {
  return (
    <section id="pricing" className="mt-20 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        ?금 & ?입
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-base text-slate-900">Free / Beta</CardTitle>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700">?재</Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              ?스????일??목적
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>검?? 비교, ?목 리스???성</li>
              <li>??복사/?운로드</li>
              <li>공유 링크 (?? ?한)</li>
              <li>로그???이 체험 가??/li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Team ?랜</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              ?구??? ?위
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>? ?크?페?스</li>
              <li>링크/리스???한 ?화</li>
              <li>기본 리포??/li>
              <li>Seat 기반 과금</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Organization / Enterprise</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              ?사/병원 ?위
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>?수 ?/부??관?/li>
              <li>권한/SSO ?동</li>
              <li>?프?????션</li>
              <li>그룹?어 ?동</li>
              <li>?선 지??/li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600">
          ?재??<strong className="text-slate-900">Beta 무료</strong>?모든 기능??체험?????습?다.
        </p>
      </div>
    </section>
  );
}
