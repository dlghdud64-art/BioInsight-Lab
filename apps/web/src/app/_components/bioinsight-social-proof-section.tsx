import { Search, GitCompare, FileText, ShoppingCart, PackageCheck, Warehouse, ChevronRight } from "lucide-react";

const PIPELINE_STEPS = [
  { num: 1, icon: Search, label: "검색", desc: "통합 검색", highlight: true },
  { num: 2, icon: GitCompare, label: "비교", desc: "스펙·가격 비교", highlight: false },
  { num: 3, icon: FileText, label: "견적 요청", desc: "요청서 생성", highlight: true },
  { num: 4, icon: ShoppingCart, label: "발주", desc: "승인·발주", highlight: false },
  { num: 5, icon: PackageCheck, label: "입고", desc: "검수·반영", highlight: false },
  { num: 6, icon: Warehouse, label: "재고 운영", desc: "Lot·유효기간", highlight: true },
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
                <div className={`flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg transition-colors ${step.highlight ? "bg-[#1A2433]" : ""}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${step.highlight ? "bg-blue-600/20 text-blue-400" : "bg-[#1E2530] text-slate-500"}`}>
                    {step.num}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold leading-none ${step.highlight ? "text-[#F3F7FF]" : "text-slate-300"}`}>{step.label}</p>
                    <p className="text-[10px] text-[#667389] leading-none mt-0.5 hidden md:block">{step.desc}</p>
                  </div>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-[#354459] shrink-0 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
