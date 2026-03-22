import {
  ListChecks, LayoutDashboard, BarChart3, Wrench,
  UserCheck, AlertTriangle, ArrowRightLeft, Timer,
} from "lucide-react";

const CONSOLE_LAYERS = [
  {
    icon: ListChecks,
    title: "작업 큐",
    purpose: "지금 당장 처리할 견적·입고·예외를 모아 처리",
    items: "회신 지연 · 입고 지연 · 재주문 필요",
  },
  {
    icon: LayoutDashboard,
    title: "일일 검토",
    purpose: "오늘 확인할 병목과 예외를 운영자 뷰로 정리",
    items: "이월 항목 · 장기 차단 · 체류 시간",
  },
  {
    icon: BarChart3,
    title: "거버넌스",
    purpose: "SLA·승인·예외·정책을 통제하는 관리 계층",
    items: "SLA 준수율 · 케이던스 · 팀 워크로드",
  },
  {
    icon: Wrench,
    title: "개선",
    purpose: "반복 패턴과 병목 원인을 추적하고 후속 최적화",
    items: "병목 식별 · 개선 조치 · 추적 대시보드",
  },
];

const SYSTEM_PROOFS = [
  { icon: UserCheck, text: "배정 → 승인 → 수주·입고까지 상태 추적" },
  { icon: ArrowRightLeft, text: "비교·견적·발주가 하나의 작업 흐름으로 연결" },
  { icon: AlertTriangle, text: "SLA·예외·병목이 같은 화면에서 드러남" },
  { icon: Timer, text: "결과가 재고·입고·재주문으로 이어짐" },
];

export function OpsConsolePreviewSection() {
  return (
    <section className="py-16 md:py-24" style={{ backgroundColor: "#060a14" }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
            Operations Console
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight mb-2">
            4개 운영 계층으로 구매 운영을 통제합니다
          </h2>
          <p className="text-xs md:text-sm text-slate-500 max-w-lg">
            작업 큐 → 일일 검토 → 거버넌스 → 개선. 각 계층이 운영 단계에 맞는 통제를 제공합니다.
          </p>
        </div>

        {/* 4 Operating Layers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {CONSOLE_LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <div key={layer.title} className="border border-slate-800/60 rounded-lg px-5 py-4 hover:border-slate-700 transition-colors" style={{ backgroundColor: "#0c1221" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-slate-500" strokeWidth={1.8} />
                  <span className="text-sm font-bold text-slate-200">{layer.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-1.5">{layer.purpose}</p>
                <p className="text-[10px] text-slate-600 font-medium">{layer.items}</p>
              </div>
            );
          })}
        </div>

        {/* System Proof Panel */}
        <div className="border border-slate-800/60 rounded-lg px-5 py-4" style={{ backgroundColor: "#080d19" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3">
            System Evidence
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SYSTEM_PROOFS.map((proof) => {
              const Icon = proof.icon;
              return (
                <div key={proof.text} className="flex items-center gap-2.5 py-1">
                  <Icon className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" strokeWidth={1.8} />
                  <span className="text-xs text-slate-500">{proof.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
