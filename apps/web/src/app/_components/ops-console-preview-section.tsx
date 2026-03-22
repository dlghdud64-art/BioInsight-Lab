import {
  LayoutDashboard, ListChecks, BarChart3, Wrench,
  UserCheck, AlertTriangle, ArrowRightLeft, Timer,
} from "lucide-react";

const CONSOLE_MODES = [
  {
    icon: ListChecks,
    title: "작업 큐",
    desc: "우선순위별 정렬, 배정·인수인계 추적, 1-click 실행",
  },
  {
    icon: LayoutDashboard,
    title: "일일 검토",
    desc: "운영자/리드 뷰 분리, 이월 항목·장기 차단 하이라이트",
  },
  {
    icon: BarChart3,
    title: "거버넌스",
    desc: "SLA 준수율, 케이던스 이행률, 팀 워크로드 모니터링",
  },
  {
    icon: Wrench,
    title: "개선",
    desc: "반복 병목 식별, 개선 조치 기록, 추적 대시보드",
  },
];

const KEY_FEATURES = [
  { icon: UserCheck, text: "배정 → 인수인계 → 수락까지 상태 추적" },
  { icon: AlertTriangle, text: "SLA 초과 시 자동 에스컬레이션" },
  { icon: ArrowRightLeft, text: "비교·견적·발주·입고 전 과정 연결" },
  { icon: Timer, text: "경과 시간·정체 사유 실시간 표시" },
];

export function OpsConsolePreviewSection() {
  return (
    <section className="py-14 md:py-20 border-y border-slate-800/80" style={{ backgroundColor: "#0f172a" }}>
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="mb-8 md:mb-12">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Operations Console
          </p>
          <h2 className="text-lg md:text-2xl font-bold text-slate-100 tracking-tight mb-1">
            운영 콘솔: 4개 모드로 구매 운영을 통제합니다
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl">
            작업 큐 → 일일 검토 → 거버넌스 → 개선. 각 모드가 운영 단계에 맞는 뷰를 제공합니다.
          </p>
        </div>

        {/* 4 Console Modes */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
          {CONSOLE_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <div key={mode.title} className="border border-slate-700/60 rounded-lg bg-[#1e293b] px-5 py-4 shadow-lg hover:border-blue-500/50 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
                  <span className="text-sm font-semibold text-slate-200">{mode.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{mode.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Key Features */}
        <div className="border border-slate-700/60 rounded-lg bg-[#1e293b] px-5 py-4 shadow-lg hover:border-blue-500/50 transition-colors">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2.5">
            Key Capabilities
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {KEY_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.text} className="flex items-center gap-2.5 py-1">
                  <Icon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" strokeWidth={1.8} />
                  <span className="text-xs text-slate-400">{feat.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
