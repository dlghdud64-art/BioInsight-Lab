"use client";

import {
  ListChecks, LayoutDashboard, BarChart3, Wrench,
  UserCheck, AlertTriangle, ArrowRightLeft, Timer,
} from "lucide-react";

// 카드별 시맨틱 컬러: 역할을 색으로 구분
const CONSOLE_LAYERS = [
  {
    icon: ListChecks,
    title: "작업 큐 정리",
    purpose: "검색 결과와 요청 준비 대상을 빠르게 정리하고, 먼저 검토할 후보를 앞에 둡니다.",
    support: "AI는 반영할 항목과 다음 검토 대상을 제안합니다.",
    items: "회신 지연 · 입고 지연 · 재주문 필요",
    // Blue — primary ops queue
    color: "#6FA2FF",
    bgTint: "rgba(111,162,255,0.07)",
    borderColor: "rgba(111,162,255,0.18)",
    borderHover: "rgba(111,162,255,0.35)",
  },
  {
    icon: LayoutDashboard,
    title: "일일 검토와 판단",
    purpose: "비교가 필요한 후보와 판단 포인트를 먼저 정리해 운영자가 더 빠르게 선택지를 검토할 수 있게 합니다.",
    support: "비용, 납기, 규격 적합성 같은 검토 포인트를 읽기 쉽게 연결합니다.",
    items: "이월 항목 · 장기 차단 · 체류 시간",
    // Sky — analysis & review
    color: "#67C5E0",
    bgTint: "rgba(103,197,224,0.07)",
    borderColor: "rgba(103,197,224,0.16)",
    borderHover: "rgba(103,197,224,0.32)",
  },
  {
    icon: BarChart3,
    title: "운영 통제와 누락 점검",
    purpose: "공급사 요청서에 포함할 메시지와 문의 항목을 준비하고, 누락된 항목을 점검합니다.",
    support: "운영자는 검토 후 적용하거나 수정할 수 있습니다.",
    items: "SLA 준수율 · 케이던스 · 팀 워크로드",
    // Amber — control & warning signals
    color: "#F0A832",
    bgTint: "rgba(240,168,50,0.07)",
    borderColor: "rgba(240,168,50,0.16)",
    borderHover: "rgba(240,168,50,0.32)",
  },
  {
    icon: Wrench,
    title: "반복 흐름 개선",
    purpose: "반복되는 요청 준비와 검토 흐름을 더 일관된 운영 방식으로 정리할 수 있습니다.",
    support: "조직 기준에 맞는 워크플로를 점진적으로 다듬어 갈 수 있습니다.",
    items: "병목 식별 · 개선 조치 · 추적 대시보드",
    // Emerald — continuous improvement
    color: "#4ECDA4",
    bgTint: "rgba(78,205,164,0.07)",
    borderColor: "rgba(78,205,164,0.16)",
    borderHover: "rgba(78,205,164,0.32)",
  },
];

// 시스템 증거: 각 항목에 시맨틱 색 배정
const SYSTEM_PROOFS = [
  { icon: UserCheck,      color: "#6FA2FF", text: "배정 → 승인 → 수주·입고까지 상태 추적" },
  { icon: ArrowRightLeft, color: "#67C5E0", text: "비교·견적·발주가 하나의 작업 흐름으로 연결" },
  { icon: AlertTriangle,  color: "#F0A832", text: "SLA·예외·병목이 같은 화면에서 드러남" },
  { icon: Timer,          color: "#4ECDA4", text: "정리된 후보와 요청 준비 항목은 운영자가 바로 검토하고 다음 단계로 이어갈 수 있습니다" },
];

export function OpsConsolePreviewSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: "#1A2230", borderBottom: "1px solid #2E3B50" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-6">
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "#6FA2FF" }}>
            Operations Console
          </p>
          <h2 className="text-xl md:text-[26px] font-bold text-white tracking-tight mb-2.5">
            검색부터 요청 준비까지, 검토와 운영이 이어지는 구조
          </h2>
          <p className="text-sm max-w-lg leading-relaxed" style={{ color: "#C8D4E5" }}>
            LabAxis는 검색 결과를 정리하는 수준에서 끝나지 않고, 비교 검토와 공급사 요청 준비, 누락 점검과 다음 운영 판단까지 이어지는 작업 흐름으로 정리합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-8">
          {CONSOLE_LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.title}
                className="rounded-lg px-5 py-5 transition-all"
                style={{
                  backgroundColor: layer.bgTint,
                  border: `1px solid ${layer.borderColor}`,
                  background: `linear-gradient(135deg, ${layer.bgTint} 0%, rgba(27,35,48,0.95) 100%)`,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = layer.borderHover; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = layer.borderColor; }}
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color: layer.color }} strokeWidth={1.8} />
                  <span className="text-sm font-bold text-white">{layer.title}</span>
                </div>
                <p className="text-[12px] leading-relaxed mb-1.5" style={{ color: "#C8D4E5" }}>{layer.purpose}</p>
                {layer.support && (
                  <p className="text-[11px] leading-relaxed mb-2" style={{ color: "#9DADC0" }}>{layer.support}</p>
                )}
                <p className="text-[11px] font-semibold" style={{ color: layer.color }}>{layer.items}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg px-5 py-5" style={{ backgroundColor: "#1E2838", border: "1px solid #2E3B50" }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3.5" style={{ color: "#6FA2FF" }}>
            System Evidence
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SYSTEM_PROOFS.map((proof) => {
              const Icon = proof.icon;
              return (
                <div key={proof.text} className="flex items-start gap-2.5 py-1.5">
                  <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: proof.color }} strokeWidth={1.8} />
                  <span className="text-[13px] leading-relaxed" style={{ color: "#D0DAE8" }}>{proof.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
