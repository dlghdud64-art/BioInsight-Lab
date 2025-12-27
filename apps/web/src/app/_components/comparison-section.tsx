
export function ComparisonSection() {
  return (
    <section className="py-8 md:py-10 border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="text-center mb-4">
          <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-1">
            작업 방식 비교
          </h2>
        </div>

        {/* 2컬럼 비교 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* 좌: 기존 방식 */}
          <div className="border-2 border-red-200 bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-red-900">기존 방식</h3>
            </div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-600 text-sm mt-0.5 flex-shrink-0">✕</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-700 leading-snug font-medium break-words">벤더 사이트 개별 검색</span>
                  <span className="block text-[10px] text-red-600 mt-0.5">~20분 · 10+개 사이트 방문</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 text-sm mt-0.5 flex-shrink-0">✕</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-700 leading-snug font-medium break-words">엑셀/노션에 수동 정리</span>
                  <span className="block text-[10px] text-red-600 mt-0.5">~15분 · 복붙 반복</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 text-sm mt-0.5 flex-shrink-0">✕</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-700 leading-snug font-medium break-words">메일 첨부 문서 작성</span>
                  <span className="block text-[10px] text-red-600 mt-0.5">~10분 · 형식 맞추기</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 text-sm mt-0.5 flex-shrink-0">✕</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-700 leading-snug font-medium break-words">버전 관리 어려움</span>
                  <span className="block text-[10px] text-red-600 mt-0.5">파일 분산 · 이메일 체인</span>
                </div>
              </li>
            </ul>
            <div className="mt-3 pt-2 border-t border-red-200">
              <span className="text-xs font-semibold text-red-700">총 소요시간: ~45분/건</span>
            </div>
          </div>

          {/* 우: BioInsight Lab */}
          <div className="border-2 border-indigo-200 bg-indigo-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-indigo-900">BioInsight Lab</h3>
            </div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 text-sm mt-0.5 flex-shrink-0">✓</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-700 leading-snug font-medium break-words">통합 검색으로 한 번에 여러 벤더 검색</span>
                  <span className="block text-[10px] text-indigo-600 mt-0.5">~2분 · 자동 크롤링</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 text-sm mt-0.5 flex-shrink-0">✓</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-700 leading-snug font-medium break-words">스펙·가격 자동 정렬 비교표</span>
                  <span className="block text-[10px] text-indigo-600 mt-0.5">즉시 · AI 분석</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 text-sm mt-0.5 flex-shrink-0">✓</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-700 leading-snug font-medium break-words">견적 요청 리스트 자동 생성</span>
                  <span className="block text-[10px] text-indigo-600 mt-0.5">1분 · 클릭 한 번</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 text-sm mt-0.5 flex-shrink-0">✓</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-700 leading-snug font-medium break-words">공유링크/TSV/엑셀 즉시 내보내기</span>
                  <span className="block text-[10px] text-indigo-600 mt-0.5">실시간 협업 · 버전 관리</span>
                </div>
              </li>
            </ul>
            <div className="mt-3 pt-2 border-t border-indigo-200">
              <span className="text-xs font-semibold text-indigo-700">총 소요시간: ~5분/건 </span>
              <span className="text-xs text-emerald-600 font-bold">· 90% 단축</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

