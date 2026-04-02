import { Clock, AlertTriangle, PackageX, TrendingDown } from "lucide-react";

/*
 * ── Bridge Surface ──────────────────────────────────────────────────
 *  Role: Hero의 flagship 선언 → Proof 섹션으로의 구조적 연결
 *  Tone: deep navy에서 약간 올라온 content surface
 *  Content: 병목 증거 숫자 3개 + 절감 요약 1줄
 *  NOT: 파이프라인 pill row 반복 (hero에 이미 있음)
 * ────────────────────────────────────────────────────────────────────
 */

export function BioInsightSocialProofSection() {
  return (
    <section
      style={{
        backgroundColor: "#0B1E35",
        borderTop: "1px solid #1E3050",
        borderBottom: "1px solid #1E3050",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 py-6 md:py-8">
        {/* 병목 증거 — 숫자가 먼저 보이는 구조 */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4">
          {[
            { icon: Clock, stat: "30분+", label: "건당 검색 시간", desc: "벤더 10곳 개별 방문", color: "#F59E0B" },
            { icon: AlertTriangle, stat: "45분+", label: "건당 견적 수집", desc: "이메일·전화 수기 정리", color: "#F59E0B" },
            { icon: PackageX, stat: "15%+", label: "연간 재고 손실", desc: "반영 누락·만료 미발견", color: "#EF4444" },
          ].map((item, i) => (
            <div key={i} className="text-center md:text-left md:flex md:items-center md:gap-3">
              <item.icon className="h-4 w-4 mx-auto md:mx-0 mb-1 md:mb-0 flex-shrink-0" style={{ color: item.color }} strokeWidth={1.5} />
              <div>
                <p className="text-lg md:text-xl font-extrabold text-white leading-none">{item.stat}</p>
                <p className="text-[10px] md:text-[11px] font-semibold mt-0.5" style={{ color: "#8A99AF" }}>{item.label}</p>
                <p className="text-[9px] md:text-[10px] hidden md:block" style={{ color: "#5A6A7E" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 절감 요약 — 단일 라인 */}
        <div className="flex items-center justify-center gap-2 py-2 rounded-lg" style={{ backgroundColor: "#081628", border: "1px solid #162A42" }}>
          <TrendingDown className="h-3 w-3 text-emerald-400 flex-shrink-0" />
          <span className="text-[10px] md:text-[11px]" style={{ color: "#8A99AF" }}>
            LabAxis 도입 시
            <strong className="text-emerald-400 ml-1.5">검색 70%↓</strong>
            <span className="mx-1.5" style={{ color: "#3A5068" }}>·</span>
            <strong className="text-emerald-400">견적 80%↓</strong>
            <span className="mx-1.5" style={{ color: "#3A5068" }}>·</span>
            <strong className="text-emerald-400">재고 손실 60%↓</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
