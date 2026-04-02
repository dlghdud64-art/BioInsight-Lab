"use client";

import {
  ListChecks, LayoutDashboard, BarChart3, Wrench,
  UserCheck, ArrowRightLeft, AlertTriangle, Timer,
} from "lucide-react";

/*
 * ── Proof Surface: Workbench Teaser ─────────────────────────────────
 *  Role: 실제 운영면의 구조를 보여주는 surface preview
 *  Tone: dark content surface — marketing card가 아닌 workbench teaser
 *  Card structure: 작업 유형 → 주 판단 포인트 → 주요 객체 → 다음 액션
 * ────────────────────────────────────────────────────────────────────
 */

const WORKBENCH_LAYERS = [
  {
    icon: ListChecks,
    role: "검색·비교 담당자",
    title: "작업 큐 정리",
    judgment: "어떤 후보를 먼저 검토할 것인가",
    objects: "검색 결과 · 비교 대상 · 요청 준비 항목",
    action: "후보 정리 → 비교표 생성 → 견적 요청 전환",
    accent: true,
  },
  {
    icon: LayoutDashboard,
    role: "구매 운영 담당자",
    title: "일일 검토·판단",
    judgment: "비용·납기·규격 중 어떤 기준이 우선인가",
    objects: "비교 후보 · 견적 회신 · 승인 대기 건",
    action: "검토 완료 → 승인 요청 → 발주 전환",
    accent: true,
  },
  {
    icon: BarChart3,
    role: "운영 관리자",
    title: "통제·누락 점검",
    judgment: "어디서 병목이 생기고 있는가",
    objects: "SLA 준수율 · 지연 건 · 팀 워크로드",
    action: "병목 식별 → 에스컬레이션 → 기준 조정",
    accent: false,
  },
  {
    icon: Wrench,
    role: "프로세스 설계자",
    title: "반복 흐름 개선",
    judgment: "어떤 워크플로를 표준화할 것인가",
    objects: "반복 요청 패턴 · 승인 단계 · 자동화 후보",
    action: "패턴 분석 → 워크플로 정의 → 점진 적용",
    accent: false,
  },
];

const SYSTEM_EVIDENCE = [
  { icon: UserCheck,      text: "배정 → 승인 → 수주·입고까지 상태 추적" },
  { icon: ArrowRightLeft, text: "비교·견적·발주가 하나의 작업 흐름으로 연결" },
  { icon: AlertTriangle,  text: "SLA·예외·병목이 같은 화면에서 드러남" },
  { icon: Timer,          text: "요청 준비 항목을 바로 검토, 다음 단계로 전환" },
];

export function OpsConsolePreviewSection() {
  return (
    <section className="py-12 md:py-16" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #162A42" }}>
      <div className="max-w-[1100px] mx-auto px-4 md:px-6">
        <div className="mb-6 md:mb-8">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#60A5FA" }}>
            Operations Console
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight mb-1.5">
            역할별 작업면 — 각자의 판단이 빨라지는 구조
          </h2>
          <p className="text-[11px] md:text-xs max-w-lg" style={{ color: "#6A7A8E" }}>
            검색 결과 정리에서 끝나지 않고, 비교 검토·요청 준비·누락 점검·운영 판단까지 이어지는 작업 흐름.
          </p>
        </div>

        {/* Workbench teaser cards — 2×2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
          {WORKBENCH_LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.title}
                className="rounded-lg p-4 transition-colors"
                style={{ backgroundColor: "#0A1828", border: "1px solid #162A42" }}
              >
                {/* Role tag + icon + title */}
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#142840" }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: layer.accent ? "#2563EB" : "#4A5E78" }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>{layer.role}</p>
                    <p className="text-[12px] font-bold text-white leading-tight">{layer.title}</p>
                  </div>
                </div>

                {/* Judgment point — what decision gets faster */}
                <div className="rounded px-2.5 py-2 mb-2" style={{ backgroundColor: "#0D1428", border: "1px solid #1A2D48" }}>
                  <p className="text-[9px] font-bold uppercase mb-0.5" style={{ color: "#4A5E78" }}>판단 포인트</p>
                  <p className="text-[11px] font-medium" style={{ color: "#C8D4E5" }}>{layer.judgment}</p>
                </div>

                {/* Objects + Action — operational, not descriptive */}
                <div className="flex flex-col gap-1">
                  <p className="text-[10px]" style={{ color: "#5A6A7E" }}>
                    <span className="font-semibold" style={{ color: "#6A7A8E" }}>객체</span>  {layer.objects}
                  </p>
                  <p className="text-[10px]" style={{ color: "#5A6A7E" }}>
                    <span className="font-semibold" style={{ color: "#6A7A8E" }}>흐름</span>  {layer.action}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* System evidence — compact strip */}
        <div className="rounded-lg px-4 py-3.5" style={{ backgroundColor: "#0A1828", border: "1px solid #162A42" }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "#4A5E78" }}>
            System Evidence
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SYSTEM_EVIDENCE.map((proof) => {
              const Icon = proof.icon;
              return (
                <div key={proof.text} className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#4A5E78" }} strokeWidth={1.8} />
                  <span className="text-[11px] leading-relaxed" style={{ color: "#8A99AF" }}>{proof.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
