import {
  Search, GitCompare, FileText, ShoppingCart, PackageCheck,
  Warehouse, ChevronRight, Users, Clock, Shield,
} from "lucide-react";

const FLOW_STAGES = [
  {
    icon: Search,
    title: "통합 검색",
    desc: "시약명·CAS No.·제조사로 검색, 대체 후보 자동 매칭",
    detail: "500만+ 글로벌 카탈로그 DB",
  },
  {
    icon: GitCompare,
    title: "비교 워크스페이스",
    desc: "벤더별 가격·납기·스펙을 나란히 비교",
    detail: "비교 세션 자동 저장 · 공유",
  },
  {
    icon: FileText,
    title: "견적 관리",
    desc: "견적 요청·회신·비교를 한곳에서 추적",
    detail: "SLA 추적 · 자동 리마인더",
  },
  {
    icon: ShoppingCart,
    title: "발주·승인",
    desc: "승인 워크플로 → 발주 전환 → 공급사 전달",
    detail: "역할별 승인 · 감사 로그",
  },
  {
    icon: PackageCheck,
    title: "입고 확인",
    desc: "수령 확인·검수·수량 검증 → 재고 자동 반영",
    detail: "입고 지연 에스컬레이션",
  },
  {
    icon: Warehouse,
    title: "재고·운영",
    desc: "실시간 재고 현황, 안전재고 알림, 자동 재주문",
    detail: "유통기한 · 보관조건 추적",
  },
];

const OPS_CAPABILITIES = [
  { icon: Users, label: "배정·인수인계", desc: "담당자 명확화, handoff 추적" },
  { icon: Clock, label: "SLA 관리", desc: "초과 시 자동 에스컬레이션" },
  { icon: Shield, label: "거버넌스", desc: "일일 검토 · 감사 · 개선 모드" },
];

export function PlatformFlowSection() {
  return (
    <section className="py-14 md:py-20 bg-slate-950 border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="mb-10 md:mb-14">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Operations Pipeline
          </p>
          <h2 className="text-lg md:text-2xl font-bold text-slate-100 tracking-tight mb-1">
            검색에서 재고까지, 끊기지 않는 운영 흐름
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl">
            각 단계의 상태·담당자·SLA가 하나의 콘솔에서 실시간으로 연결됩니다.
          </p>
        </div>

        {/* Desktop: Timeline */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-6 left-6 right-6 h-px bg-slate-800" />

            <div className="grid grid-cols-6 gap-0">
              {FLOW_STAGES.map((stage, idx) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.title} className="relative flex flex-col items-center text-center px-2">
                    {/* Node */}
                    <div className="relative z-10 w-12 h-12 rounded-md border border-slate-700 bg-slate-900 flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5 text-slate-300" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-semibold text-slate-200 mb-0.5">{stage.title}</span>
                    <span className="text-[10px] text-slate-400 leading-tight mb-1">{stage.desc}</span>
                    <span className="text-[9px] text-slate-500 leading-tight">{stage.detail}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile: Dense list */}
        <div className="md:hidden space-y-0 border border-slate-800 rounded-md overflow-hidden">
          {FLOW_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div key={stage.title} className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-800 last:border-b-0 bg-slate-900">
                <div className="flex-shrink-0 w-8 h-8 rounded-md border border-slate-700 bg-slate-800 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-200">{stage.title}</span>
                  <p className="text-[11px] text-slate-400 leading-tight">{stage.desc}</p>
                </div>
                {idx < FLOW_STAGES.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-slate-700 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Ops Capabilities Strip */}
        <div className="mt-10 md:mt-14 border border-slate-800 rounded-md bg-slate-900/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Operational Control
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {OPS_CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.label} className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" strokeWidth={1.8} />
                  <div>
                    <span className="text-xs font-semibold text-slate-300">{cap.label}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">{cap.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
