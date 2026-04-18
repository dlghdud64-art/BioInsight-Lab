import { AlertTriangle, Clock, Shuffle, CheckCircle2 } from "lucide-react";

const PROBLEMS = [
  {
    icon: Shuffle,
    problem: "벤더 10곳을 돌아다니며 시약 검색·가격 비교",
    solution: "통합 검색 + 비교표 자동 생성",
  },
  {
    icon: Clock,
    problem: "견적 수집·정리·비교에 건당 30분 이상",
    solution: "비교에서 클릭 한 번으로 견적 요청·추적",
  },
  {
    icon: AlertTriangle,
    problem: "엑셀로 Lot·유효기간 수기 관리, 만료 놓침",
    solution: "입고 시 자동 기록, 만료 임박 사전 알림",
  },
];

export function LandingProblemSolution() {
  return (
    <section className="py-14 md:py-20 bg-sh">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4b5563] mb-4">
            Why LabAxis
          </p>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight leading-[1.4] break-keep">
            반복되는 구매 업무의 병목,
            <br />LabAxis가 운영 체계로 연결합니다
          </h2>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
          {PROBLEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.problem} className="bg-pg border border-bd rounded-md p-4 md:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-md bg-pn border border-bd flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#4b5563]">기존 문제</p>
                </div>
                <p className="text-xs text-[#9ca3af] leading-relaxed mb-4 break-keep">{item.problem}</p>

                <div className="border-t border-bd pt-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-200 font-medium leading-relaxed break-keep">{item.solution}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
