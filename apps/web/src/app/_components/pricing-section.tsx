import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PricingSection() {
  return (
    <section id="pricing" className="py-8 md:py-10 border-b border-[#2a2a2e] bg-[#111114] scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-100 mb-3">
          요금 & 도입
        </h2>
        <div className="md:grid md:grid-cols-3 md:gap-4 md:items-start overflow-x-auto snap-x snap-mandatory scroll-pl-4 scroll-pr-4 flex md:block gap-3 pb-2 md:pb-4">

          {/* Starter (Free) — 시각적으로 약하게 */}
          <Card className="border border-[#2a2a2e] bg-[#111114] rounded-lg min-w-[85vw] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
            <CardHeader className="p-3">
              <div className="flex items-center justify-between mb-1">
                <CardTitle className="text-sm text-slate-500">Starter</CardTitle>
                <Badge variant="outline" className="text-xs text-slate-500 border-slate-700">무료</Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">
                체험용 · 로그인 없이 시작
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="text-xs font-semibold text-gray-400 bg-[#222226] rounded px-2 py-1 inline-block">
                등록 품목 최대 10개 (체험용)
              </div>
              <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                <li>검색, 비교, 견적 요청 리스트 생성</li>
                <li>표 복사/다운로드</li>
                <li>공유 링크 (일부 제한)</li>
                <li>로그인 없이 체험 가능</li>
              </ul>
              <Link href="/auth/signin?callbackUrl=/dashboard" className="block mt-3">
                <Button variant="outline" size="sm" className="w-full text-xs text-gray-500 border-gray-300 hover:bg-[#222226]">
                  무료로 찍어보기
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Team */}
          <Card className="border border-[#2a2a2e] bg-[#1a1a1e] rounded-lg hover:border-[#333338] hover:shadow-sm transition-all min-w-[85vw] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
            <CardHeader className="p-3">
              <div className="flex items-center justify-between mb-1">
                <CardTitle className="text-sm text-slate-100">Team 플랜</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-400">
                연구실/팀 단위
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="text-xs font-semibold text-slate-600 bg-[#222226] rounded px-2 py-1 inline-block">
                등록 품목 최대 30개
              </div>
              <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
                <li>팀 워크스페이스</li>
                <li>링크/리스트 제한 완화</li>
                <li>기본 리포트</li>
                <li>Seat 기반 과금</li>
              </ul>
              <Link href="/pricing" className="block mt-3">
                <Button variant="outline" size="sm" className="w-full text-xs border-slate-700 text-slate-400 hover:bg-slate-800 bg-transparent">
                  가볍게 시작하기
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Business/Organization */}
          <div className="relative min-w-[85vw] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink md:scale-105 md:z-10 pt-4 md:pt-0">
            <div className="absolute top-1 md:-top-3 left-1/2 -translate-x-1/2 z-10">
              <Badge className="bg-blue-600 text-white text-xs px-3 py-0.5 shadow-md whitespace-nowrap">
                추천
              </Badge>
            </div>
            <Card className="border-2 border-blue-600 bg-[#1a1a1e] rounded-lg shadow-xl ring-2 ring-blue-600 ring-offset-2 h-full">
              <CardHeader className="p-3 pt-5">
                <div className="flex items-center justify-between mb-1">
                  <CardTitle className="text-sm text-slate-100">Business / Enterprise</CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-400">
                  회사/병원 단위
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <div className="text-xs font-bold text-blue-400 bg-blue-500/10 rounded px-2 py-1 inline-flex items-center gap-1">
                  등록 품목 최대 100개 / 무제한
                </div>
                <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
                  <li>다수 팀/부서 관리</li>
                  <li>권한/SSO 연동</li>
                  <li>온프레미스 옵션</li>
                  <li>그룹웨어 연동</li>
                  <li>우선 지원</li>
                </ul>
                <Link href="/pricing" className="block mt-3">
                  <Button size="sm" className="w-full text-xs bg-blue-600 hover:bg-blue-500 text-white">
                    무제한으로 도입하기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-4 text-center px-2">
          <p className="text-xs text-slate-400">
            현재는 <strong className="text-blue-400">Beta 무료</strong>로 모든 기능을 체험할 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
