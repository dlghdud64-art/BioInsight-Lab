import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function PricingSection() {
  return (
    <section id="pricing" className="py-8 md:py-10 border-b border-slate-200 bg-slate-50 scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-3">
          요금 & 도입
        </h2>
        {/* 모바일: 가로 스크롤, 데스크탑: 그리드 */}
        <div className="md:grid md:grid-cols-3 md:gap-3 overflow-x-auto snap-x snap-mandatory scroll-pl-4 scroll-pr-4 flex md:block gap-3 pb-2 md:pb-0">
          <Card className="border-2 border-indigo-200 bg-indigo-50 rounded-lg min-w-[85vw] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
            <CardHeader className="p-3">
              <div className="flex items-center justify-between mb-1">
                <CardTitle className="text-sm text-slate-900">Free / Beta</CardTitle>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-xs border-indigo-200">현재</Badge>
              </div>
              <CardDescription className="text-xs text-slate-600">
                초기 랩실용. Get Started로 바로 시작
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                <li>검색, 비교, 견적 요청 리스트 생성</li>
                <li>표 복사/다운로드</li>
                <li>공유 링크 (일부 제한)</li>
                <li>로그인 없이 체험 가능</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white rounded-lg hover:border-slate-300 hover:shadow-sm transition-all min-w-[85vw] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
            <CardHeader className="p-3">
              <CardTitle className="text-sm text-slate-900">Team 플랜</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                연구실/팀 단위
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                <li>팀 워크스페이스</li>
                <li>링크/리스트 제한 완화</li>
                <li>기본 리포트</li>
                <li>Seat 기반 과금</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white rounded-lg hover:border-slate-300 hover:shadow-sm transition-all min-w-[85vw] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
            <CardHeader className="p-3">
              <CardTitle className="text-sm text-slate-900">Organization / Enterprise</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                회사/병원 단위
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                <li>다수 팀/부서 관리</li>
                <li>권한/SSO 연동</li>
                <li>온프레미스 옵션</li>
                <li>그룹웨어 연동</li>
                <li>우선 지원</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mt-3 text-center px-2">
          <p className="text-xs text-slate-600">
            현재는 <strong className="text-indigo-700">Beta 무료</strong>로 모든 기능을 체험할 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
