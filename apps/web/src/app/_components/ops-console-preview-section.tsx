"use client";

import { Search, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

/*
 * ── Live Action Preview ───────────────────────────────────────────
 *  Role: 설명 카드 대신, 실제 사용자가 보게 될 화면 구조를 보여줌
 *  Layout: split preview — 좌측 후보 리스트 + 우측 AI 선택안 rail
 *  NOT: feature description cards / marketing copy
 * ────────────────────────────────────────────────────────────────────
 */

const CANDIDATES = [
  { name: "BioKorea PCR Tubes 0.2mL", price: "₩185,000", lead: "3일", tag: "최저가" },
  { name: "LabSource PCR Tubes 0.2mL", price: "₩198,000", lead: "5일", tag: null },
  { name: "SciSupply PCR Tubes 0.2mL", price: "₩210,000", lead: "2일", tag: "납기최단" },
];

const AI_OPTIONS = [
  { level: "추천", supplier: "BioKorea", price: "₩185,000", reasons: ["최저가", "납기 3일", "기존 거래처"], selected: true },
  { level: "대체", supplier: "SciSupply", price: "₩210,000", reasons: ["납기 2일", "긴급 시 유리"], selected: false },
  { level: "보수", supplier: "LabSource", price: "₩198,000", reasons: ["MOQ 5+", "중간 가격대"], selected: false },
];

export function OpsConsolePreviewSection() {
  return (
    <section className="py-10 md:py-14" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #162A42" }}>
      <div className="max-w-[1100px] mx-auto px-4 md:px-6">
        {/* Section header — minimal */}
        <div className="mb-6 md:mb-8">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
            style={{ color: "#60A5FA" }}
          >
            Live Action Preview
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
            실제 운영 화면에서 검토와 판단이 이어집니다
          </h2>
        </div>

        {/* Split preview surface */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: "#081628", border: "1px solid #162A42" }}
        >
          {/* Top bar — search context */}
          <div
            className="px-5 py-3 flex items-center gap-3"
            style={{ backgroundColor: "#071222", borderBottom: "1px solid #0F1F35" }}
          >
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-3.5 w-3.5" style={{ color: "#4A5E78" }} />
              <span className="text-[11px] font-medium" style={{ color: "#8A99AF" }}>PCR Tubes 0.2mL</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#142840", color: "#60A5FA" }}>3건 비교</span>
            </div>
            <span className="text-[10px]" style={{ color: "#4A5E78" }}>검색 → 비교 → 선택</span>
          </div>

          {/* Body: 2-panel split */}
          <div className="flex flex-col md:flex-row">
            {/* Left: candidate list */}
            <div className="flex-1 md:border-r" style={{ borderColor: "#162A42" }}>
              <div className="px-4 py-2.5" style={{ borderBottom: "1px solid #0F1F35" }}>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>후보 리스트</span>
              </div>
              <div className="divide-y" style={{ borderColor: "#0F1F35" }}>
                {CANDIDATES.map((c, i) => (
                  <div
                    key={c.name}
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ backgroundColor: i === 0 ? "rgba(37,99,235,0.04)" : "transparent" }}
                  >
                    <div className="min-w-0">
                      <p className={`text-[12px] font-medium ${i === 0 ? "text-white" : ""}`} style={{ color: i === 0 ? undefined : "#8A99AF" }}>{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: "#5A6A7E" }}>{c.lead}</span>
                        {c.tag && (
                          <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "#142840", color: "#60A5FA" }}>{c.tag}</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[12px] font-semibold ${i === 0 ? "text-white" : ""}`} style={{ color: i === 0 ? undefined : "#6A7A8E" }}>{c.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: AI option rail */}
            <div className="md:w-[320px] flex-shrink-0">
              <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ borderBottom: "1px solid #0F1F35" }}>
                <Sparkles className="h-3 w-3" style={{ color: "#60A5FA" }} />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>AI 선택안</span>
              </div>
              <div className="divide-y" style={{ borderColor: "#0F1F35" }}>
                {AI_OPTIONS.map((opt) => (
                  <div
                    key={opt.supplier}
                    className="px-4 py-3"
                    style={{ backgroundColor: opt.selected ? "rgba(37,99,235,0.06)" : "transparent" }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[9px] font-bold px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: opt.selected ? "#1E3A5C" : "#142840",
                            color: opt.selected ? "#60A5FA" : "#5A6A7E",
                          }}
                        >
                          {opt.level}
                        </span>
                        <span className={`text-[11px] font-medium ${opt.selected ? "text-white" : ""}`} style={{ color: opt.selected ? undefined : "#8A99AF" }}>{opt.supplier}</span>
                        {opt.selected && <CheckCircle2 className="h-3 w-3" style={{ color: "#60A5FA" }} />}
                      </div>
                      <span className={`text-[11px] font-semibold ${opt.selected ? "text-white" : ""}`} style={{ color: opt.selected ? undefined : "#6A7A8E" }}>{opt.price}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {opt.reasons.map((r) => (
                        <span key={r} className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "#0D1E35", color: "#5A6A7E", border: "1px solid #1A2D48" }}>{r}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom dock — action zone */}
          <div
            className="px-5 py-3 flex items-center justify-between gap-3"
            style={{ backgroundColor: "#071222", borderTop: "1px solid #0F1F35" }}
          >
            <div className="flex items-center gap-3">
              <button
                className="text-[11px] font-semibold px-4 py-1.5 rounded-md flex items-center gap-1.5"
                style={{ backgroundColor: "#2563EB", color: "#FFFFFF", boxShadow: "0 0 16px rgba(37,99,235,0.25)" }}
              >
                요청 생성 <ArrowRight className="h-3 w-3" />
              </button>
              <button
                className="text-[11px] font-medium px-3 py-1.5 rounded-md"
                style={{ backgroundColor: "transparent", color: "#60A5FA", border: "1px solid #1E3A5C" }}
              >
                발주 전환 준비
              </button>
            </div>
            <span className="text-[10px] hidden sm:inline" style={{ color: "#4A5E78" }}>
              선택안 확정 → 요청 생성 → 발주 준비
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
