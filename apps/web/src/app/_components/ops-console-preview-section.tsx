"use client";

/*
 * ── Workbench Preview ──────────────────────────────────────────────
 *  Role: 실제 제품 작업면의 일부를 잘라서 보여주는 preview
 *  Tone: "기능이 많다"가 아니라 "작업면이 강하다"
 *  Style: 테이블/리스트 형태의 product surface mockup
 *  NOT: feature card / marketing description
 * ────────────────────────────────────────────────────────────────────
 */

/* 각 workbench는 실제 제품 화면의 핵심 구간을 시뮬레이션 */
const WORKBENCH_PREVIEWS = [
  {
    surface: "검색 워크벤치",
    description: "후보를 구조화해서 비교 가능한 상태로",
    columns: ["제품명", "벤더", "규격", "단가", "납기"],
    rows: [
      ["PBS Buffer 10X", "Sigma-Aldrich", "1L", "₩45,000", "2일"],
      ["PBS Solution 10X", "Thermo Fisher", "1L", "₩42,300", "3일"],
      ["PBS Tablet 100T", "MP Biomedicals", "100T", "₩38,500", "5일"],
    ],
    action: "3건 선택 → 비교표 생성",
  },
  {
    surface: "비교 판단면",
    description: "스펙·가격·납기 delta를 한 화면에서 판단",
    columns: ["항목", "Sigma", "Thermo", "MP Bio"],
    rows: [
      ["단가", "₩45,000", "₩42,300 ✦", "₩38,500 ✦✦"],
      ["납기", "2일 ✦✦", "3일 ✦", "5일"],
      ["순도", "≥99.0%", "≥99.0%", "≥98.5%"],
    ],
    action: "최적 후보 확정 → 견적 요청",
  },
  {
    surface: "요청·견적 흐름",
    description: "비교 결과에서 바로 handoff — 수기 전환 없음",
    columns: ["견적 대상", "벤더", "수량", "상태"],
    rows: [
      ["PBS Buffer 10X", "Sigma-Aldrich", "5L", "회신 대기"],
      ["PBS Solution 10X", "Thermo Fisher", "5L", "견적 수신"],
      ["DMEM High Glucose", "Gibco", "6×500mL", "승인 대기"],
    ],
    action: "견적 확정 → 승인 요청 → 발주 전환",
  },
  {
    surface: "입고·재고 운영면",
    description: "발주–입고–재고가 하나의 source of truth",
    columns: ["품목", "Lot#", "입고일", "수량", "위치"],
    rows: [
      ["PBS Buffer 10X", "SLCH8734", "04-01", "5L", "냉장-A2"],
      ["DMEM High Gluc.", "2587441", "04-02", "6×500mL", "냉장-B1"],
      ["FBS Premium", "S18923", "03-28", "500mL", "냉동-C3"],
    ],
    action: "입고 확인 → Lot 등록 → 재고 자동 갱신",
  },
];

export function OpsConsolePreviewSection() {
  return (
    <section className="py-12 md:py-16" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #162A42" }}>
      <div className="max-w-[1100px] mx-auto px-4 md:px-6">
        <div className="mb-6 md:mb-8">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
            style={{ color: "#60A5FA" }}
          >
            Workbench Preview
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight mb-1.5">
            각 운영면의 실제 작업 구조
          </h2>
          <p className="text-[11px] md:text-xs max-w-lg" style={{ color: "#6A7A8E" }}>
            기능 목록이 아닌, 각 작업면에서 실제로 보는 화면의 핵심 구간.
          </p>
        </div>

        {/* 2×2 workbench preview grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WORKBENCH_PREVIEWS.map((wb) => (
            <div
              key={wb.surface}
              className="rounded-lg overflow-hidden"
              style={{ backgroundColor: "#0A1828", border: "1px solid #162A42" }}
            >
              {/* Surface header bar — 실제 제품 화면의 title bar 느낌 */}
              <div className="px-3.5 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid #162A42" }}>
                <div>
                  <span className="text-[11px] font-bold text-white">{wb.surface}</span>
                  <span className="text-[10px] ml-2" style={{ color: "#5A6A7E" }}>{wb.description}</span>
                </div>
              </div>

              {/* Mini table — 제품 화면 절단 preview */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr style={{ backgroundColor: "#081222" }}>
                      {wb.columns.map((col) => (
                        <th
                          key={col}
                          className="px-2.5 py-1.5 text-left font-semibold whitespace-nowrap"
                          style={{ color: "#4A5E78" }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wb.rows.map((row, i) => (
                      <tr
                        key={i}
                        style={{
                          backgroundColor: i % 2 === 0 ? "transparent" : "#081222",
                          borderTop: "1px solid #0F1F35",
                        }}
                      >
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="px-2.5 py-1.5 whitespace-nowrap"
                            style={{
                              color: cell.includes("✦") ? "#60A5FA" : "#8A99AF",
                              fontWeight: j === 0 ? 600 : 400,
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action flow strip — 이 화면에서 다음으로 넘어가는 흐름 */}
              <div className="px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: "#081222", borderTop: "1px solid #0F1F35" }}>
                <span className="text-[9px] font-bold uppercase" style={{ color: "#4A5E78" }}>Next</span>
                <span className="text-[10px]" style={{ color: "#60A5FA" }}>{wb.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
