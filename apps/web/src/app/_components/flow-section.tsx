import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export function FlowSection() {
  return (
    <section id="flow" className="mt-20 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        3단계로 끝나는 구매 준비
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* 숫자 배지 */}
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white flex-shrink-0">
              1
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">검색</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                제품명, 타깃, 카테고리로 검색하면 후보 제품을 한 번에 확인할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* 숫자 배지 */}
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white flex-shrink-0">
              2
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">비교</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                필요한 제품만 골라 비교하고, 실제 사용할 품목 리스트를 만들어 둡니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* 숫자 배지 */}
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white flex-shrink-0">
              3
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">그룹웨어에 붙여넣기</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                완성된 품목 리스트를 전자결재 양식에 복사해 붙여넣으면,
                기존 구매 프로세스를 그대로 유지하면서 준비 과정만 단축할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/test/search"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          실제 플로우 보기
          <span>→</span>
        </Link>
      </div>
    </section>
  );
}



