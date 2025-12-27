import { Search, FileSpreadsheet, Copy, ArrowRight } from "lucide-react";

export function ComparisonSection() {
  return (
    <section className="py-10 md:py-14 border-b border-slate-200">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="text-center space-y-1 md:space-y-2 mb-6 md:mb-8">
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900">
            작업 방식 비교
          </h2>
          <p className="text-xs md:text-sm text-slate-500">
            수동 작업 → 자동 정리
          </p>
        </div>

        {/* 비교 테이블 형태 */}
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          {/* 헤더 */}
          <div className="grid grid-cols-[1fr_auto_1fr] bg-slate-50 border-b border-slate-200">
            <div className="px-4 py-2 text-xs font-semibold text-slate-500 text-center">
              기존 방식
            </div>
            <div className="px-2 py-2 flex items-center justify-center">
              <ArrowRight className="h-3 w-3 text-slate-400" strokeWidth={1.5} />
            </div>
            <div className="px-4 py-2 text-xs font-semibold text-indigo-600 text-center">
              BioInsight Lab
            </div>
          </div>

          {/* 검색 단계 */}
          <div className="grid grid-cols-[1fr_auto_1fr] border-b border-slate-100">
            <div className="px-4 py-3 flex items-start gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-medium text-slate-700">벤더 사이트 개별 검색</p>
                <p className="text-[10px] text-slate-500 mt-0.5">각 사이트 방문 → 수동 복사</p>
              </div>
            </div>
            <div className="flex items-center justify-center px-2">
              <ArrowRight className="h-3 w-3 text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="px-4 py-3 flex items-start gap-2">
              <Search className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-medium text-slate-700">통합 검색</p>
                <p className="text-[10px] text-slate-500 mt-0.5">한 번에 여러 벤더 검색</p>
              </div>
            </div>
          </div>

          {/* 비교 단계 */}
          <div className="grid grid-cols-[1fr_auto_1fr] border-b border-slate-100">
            <div className="px-4 py-3 flex items-start gap-2">
              <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-medium text-slate-700">엑셀/노션 비교표</p>
                <p className="text-[10px] text-slate-500 mt-0.5">수동 정리 필요</p>
              </div>
            </div>
            <div className="flex items-center justify-center px-2">
              <ArrowRight className="h-3 w-3 text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="px-4 py-3 flex items-start gap-2">
              <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-medium text-slate-700">자동 비교표</p>
                <p className="text-[10px] text-slate-500 mt-0.5">스펙·가격 자동 정렬</p>
              </div>
            </div>
          </div>

          {/* 견적 단계 */}
          <div className="grid grid-cols-[1fr_auto_1fr]">
            <div className="px-4 py-3 flex items-start gap-2">
              <Copy className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-medium text-slate-700">메일 첨부 문서 작성</p>
                <p className="text-[10px] text-slate-500 mt-0.5">형식 변환 필요</p>
              </div>
            </div>
            <div className="flex items-center justify-center px-2">
              <ArrowRight className="h-3 w-3 text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="px-4 py-3 flex items-start gap-2">
              <Copy className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-medium text-slate-700">견적 요청 리스트 생성</p>
                <p className="text-[10px] text-slate-500 mt-0.5">공유링크/TSV/엑셀 내보내기</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

