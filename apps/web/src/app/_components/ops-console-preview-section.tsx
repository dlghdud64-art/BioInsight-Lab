"use client";

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
    <section className="py-20 md:py-28" style={{ backgroundColor: "#0B1625", borderBottom: "1px solid #1A2840" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6A9CFF] mb-2">
            Operations Console
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-[#F3F7FF] tracking-tight mb-2">
            4개 운영 계층으로 구매 운영을 통제합니다
          </h2>
          <p className="text-xs md:text-sm text-[#B8C5DA] max-w-lg">
            작업 큐 → 일일 검토 → 거버넌스 → 개선. 각 계층이 운영 단계에 맞는 통제를 제공합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {CONSOLE_LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.title}
                className="rounded-lg px-5 py-4 transition-colors"
                style={{ backgroundColor: "#131E2D", border: "1px solid #22344D" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#172436"; e.currentTarget.style.borderColor = "#2D496A"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#131E2D"; e.currentTarget.style.borderColor = "#22344D"; }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-[#7FB2FF]" strokeWidth={1.8} />
                  <span className="text-sm font-bold text-[#F3F7FF]">{layer.title}</span>
                </div>
                <p className="text-[11px] text-[#B8C5DA] leading-relaxed mb-1.5">{layer.purpose}</p>
                <p className="text-[10px] text-[#6A9CFF] font-medium">{layer.items}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg px-5 py-4" style={{ backgroundColor: "#0E1926", border: "1px solid #1A2840" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6A9CFF] mb-3">
            System Evidence
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SYSTEM_PROOFS.map((proof) => {
              const Icon = proof.icon;
              return (
                <div key={proof.text} className="flex items-center gap-2.5 py-1">
                  <Icon className="h-3.5 w-3.5 text-[#5A94FF] flex-shrink-0" strokeWidth={1.8} />
                  <span className="text-xs text-[#B8C5DA]">{proof.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
