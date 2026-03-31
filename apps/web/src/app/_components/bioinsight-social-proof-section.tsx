import { Search, GitCompare, FileText, ShoppingCart, PackageCheck, Warehouse, ChevronRight } from "lucide-react";

// 파이프라인 단계별 시맨틱 컬러 — 앞선 섹션 색상 계열과 통일
const PIPELINE_STEPS = [
  { num: 1, icon: Search,       label: "검색",    desc: "통합 검색",    color: "#6FA2FF", bgColor: "rgba(111,162,255,0.12)", highlight: true },
  { num: 2, icon: GitCompare,   label: "비교",    desc: "스펙·가격 비교", color: "#67C5E0", bgColor: "rgba(103,197,224,0.10)", highlight: false },
  { num: 3, icon: FileText,     label: "견적 요청", desc: "요청서 생성",  color: "#6FA2FF", bgColor: "rgba(111,162,255,0.12)", highlight: true },
  { num: 4, icon: ShoppingCart, label: "발주",    desc: "승인·발주",    color: "#F0A832", bgColor: "rgba(240,168,50,0.10)",  highlight: false },
  { num: 5, icon: PackageCheck, label: "입고",    desc: "검수·반영",    color: "#4ECDA4", bgColor: "rgba(78,205,164,0.10)",  highlight: false },
  { num: 6, icon: Warehouse,    label: "재고 운영", desc: "Lot·유효기간", color: "#4ECDA4", bgColor: "rgba(78,205,164,0.12)", highlight: true },
];

export function BioInsightSocialProofSection() {
  return (
    <section style={{ backgroundColor: "#0F1520", borderTop: "1px solid rgba(120,160,230,0.08)", borderBottom: "1px solid rgba(120,160,230,0.10)" }}>
      <div className="max-w-[1240px] mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-1 md:gap-0 overflow-x-auto">
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex items-center shrink-0">
                <div
                  className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg transition-colors"
                  style={step.highlight ? { backgroundColor: "#1A2433" } : undefined}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      backgroundColor: step.highlight ? step.bgColor : "rgba(30,37,48,0.8)",
                      color: step.highlight ? step.color : "#4A5E78",
                    }}
                  >
                    {step.num}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold leading-none"
                      style={{ color: step.highlight ? "#F3F7FF" : "#94A3B8" }}
                    >
                      {step.label}
                    </p>
                    <p className="text-[10px] leading-none mt-0.5 hidden md:block" style={{ color: "#667389" }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ChevronRight className="h-3 w-3 shrink-0 mx-0.5" style={{ color: "#354459" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
