import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PricingSection() {
  return (
    <section id="pricing" className="mt-20 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        요금 & 도입
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-base text-slate-900">Free / Beta</CardTitle>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700">현재</Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              테스트 및 파일럿 목적
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>검색, 비교, 품목 리스트 생성</li>
              <li>표 복사/다운로드</li>
              <li>공유 링크 (일부 제한)</li>
              <li>로그인 없이 체험 가능</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Team 플랜</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              연구실/팀 단위
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>팀 워크스페이스</li>
              <li>링크/리스트 제한 완화</li>
              <li>기본 리포트</li>
              <li>Seat 기반 과금</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Organization / Enterprise</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              회사/병원 단위
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>다수 팀/부서 관리</li>
              <li>권한/SSO 연동</li>
              <li>온프레미스 옵션</li>
              <li>그룹웨어 연동</li>
              <li>우선 지원</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600">
          현재는 <strong className="text-slate-900">Beta 무료</strong>로 모든 기능을 체험할 수 있습니다.
        </p>
      </div>
    </section>
  );
}



