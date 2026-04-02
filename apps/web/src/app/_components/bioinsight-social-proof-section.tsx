import { Search, GitCompareArrows, FileText, Package } from "lucide-react";

/*
 * ── Capability Band ────────────────────────────────────────────────
 *  Role: Hero 선언 직후, LabAxis가 책임지는 운영 surface 4개를 압축 제시
 *  Tone: hero보다 한 단계 올라간 bridge surface
 *  NOT: feature grid / marketing card
 *  IS:  "이 제품이 어떤 운영 순간을 책임지는가"
 * ────────────────────────────────────────────────────────────────────
 */

const CAPABILITIES = [
  {
    icon: Search,
    surface: "검색 워크벤치",
    responsibility: "후보를 구조화해서 비교 가능한 상태로 만든다",
    what: "벤더 10곳 개별 방문 → 한 화면에서 후보 정리",
  },
  {
    icon: GitCompareArrows,
    surface: "비교 판단면",
    responsibility: "스펙·가격·납기를 delta-first로 판단한다",
    what: "엑셀 수기 비교 → 팀 단위 실시간 판단 워크스페이스",
  },
  {
    icon: FileText,
    surface: "요청·견적 작업면",
    responsibility: "비교 결과에서 바로 handoff — 견적 요청까지",
    what: "이메일·전화 수기 요청 → 비교표에서 바로 견적 전송",
  },
  {
    icon: Package,
    surface: "입고·재고 운영면",
    responsibility: "발주–입고–재고를 하나의 source of truth로 연결",
    what: "수동 등록·Lot 누락 → 입고 즉시 반영, 이력 추적",
  },
];

export function BioInsightSocialProofSection() {
  return (
    <section
      style={{
        backgroundColor: "#0B1E35",
        borderTop: "1px solid #1E3050",
        borderBottom: "1px solid #1E3050",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 py-8 md:py-10">
        {/* Eyebrow */}
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-5 text-center md:text-left"
          style={{ color: "#60A5FA" }}
        >
          Platform Capabilities
        </p>

        {/* 4 capability blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.surface}
                className="rounded-lg p-4"
                style={{ backgroundColor: "#081628", border: "1px solid #162A42" }}
              >
                {/* Icon + Surface name */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#142840" }}
                  >
                    <Icon className="h-3 w-3" style={{ color: "#60A5FA" }} strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-bold text-white">{cap.surface}</span>
                </div>

                {/* Responsibility — 이 surface가 책임지는 운영 순간 */}
                <p className="text-[11px] font-medium leading-snug mb-2" style={{ color: "#C8D4E5" }}>
                  {cap.responsibility}
                </p>

                {/* What changes — 간결한 before→after */}
                <p className="text-[10px] leading-relaxed" style={{ color: "#5A6A7E" }}>
                  {cap.what}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
