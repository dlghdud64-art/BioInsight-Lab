"use client";

/**
 * §11.371-3 #scan-hub — 글로벌 스캔 단일 진입 허브.
 *
 * Header 글로벌 "스캔" 버튼 → openModal("scan_hub") → 본 picker → 입력 유형 선택:
 *   - 라벨 직접등록   → label_scanner  (scan-label, 라벨 전용 파서)
 *   - 거래명세서 입고 → smart_receiving (parse-image, 견적/명세서 파서)
 *   - QR 재고조회     → qr_scanner
 *
 * 진입점 이원화(§11.315-b 분리) 해소 + 파서 미스매치 원천 차단(사용자가 입력유형
 * 직접 선택). same-canvas: 단일 BaseModal 안에서 모드 전환(openModal 체이닝).
 * dead button 0 — 각 카드는 실제 모달 오픈으로 wiring.
 *
 * §scan-hub-color(스캔 허브 구현 지시문) — "의도를 색으로 분리". 입고=green(ok #1b9e5a),
 *   사용=amber(warn #d8870b). 그룹색을 방향 배지·아이콘 칩·hover 테두리·화살표에 일괄 적용.
 *   amber는 본 surface 의도색으로 호영님 룰링(가)에 의해 §11.302 supersede. 라우팅·구조 무변경.
 */

import { useOpenModal } from "@/lib/store/modal-store";
import { ScanLine, FileText, QrCode, ChevronRight, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

// §scan-hub-color — 의도별 토큰. 입고=ok(green) / 사용=warn(amber). 정본 지시문 팔레트.
//   hoverBorder/chevronHover 는 Tailwind arbitrary(전체 리터럴이라 JIT 생성됨).
const TONE = {
  in: {
    ink: "#1b9e5a",
    weak: "#e6f5ec",
    dir: "증가",
    hoverBorder: "hover:border-[#9fd6ba]",
    chevronHover: "group-hover:text-[#1b9e5a]",
  },
  use: {
    ink: "#d8870b",
    weak: "#fbf0db",
    dir: "차감",
    hoverBorder: "hover:border-[#edc991]",
    chevronHover: "group-hover:text-[#d8870b]",
  },
} as const;

// §11.379 — 스캔 IA 입고/사용 2분류. 재고 흐름 방향으로 묶어 사용자 의도 명확화.
//   입고 스캔(재고 +): 라벨 직접등록 + 거래명세서 입고.
//   재고 사용(재고 −): QR 차감(조회 후 수량 확인→차감 확정. GlobalQRScannerModal).
const SCAN_GROUPS = [
  {
    section: "입고 스캔",
    hint: "재고 증가",
    tone: "in" as const,
    sectionIcon: ArrowDownToLine,
    options: [
      {
        type: "label_scanner",
        icon: ScanLine,
        title: "라벨 직접등록",
        desc: "시약·소모품 라벨을 촬영해 재고에 바로 등록",
      },
      {
        type: "smart_receiving",
        icon: FileText,
        title: "거래명세서 입고",
        desc: "명세서·PO를 촬영해 다품목 일괄 입고",
      },
    ],
  },
  {
    section: "재고 사용",
    hint: "재고 차감",
    tone: "use" as const,
    sectionIcon: ArrowUpFromLine,
    options: [
      {
        type: "qr_scanner",
        icon: QrCode,
        title: "QR 재고 사용",
        desc: "QR 코드로 재고를 조회하고 사용량을 차감",
      },
    ],
  },
] as const;

/** BaseModal 내부 렌더 콘텐츠. GlobalModal registry(scan_hub)에서 사용. */
export function ScanHubContent() {
  const openModal = useOpenModal();
  return (
    <div className="space-y-4 py-1" data-testid="scan-hub">
      {SCAN_GROUPS.map((group) => {
        const SectionIcon = group.sectionIcon;
        const t = TONE[group.tone];
        return (
          <div key={group.section}>
            {/* §scan-hub-color — 섹션 헤더: 방향 아이콘 칩 + 제목 + 방향 배지(그룹색). */}
            <div className="flex items-center gap-2 px-1 mb-2">
              <span
                className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
                style={{ background: t.weak }}
              >
                <SectionIcon className="h-3.5 w-3.5" style={{ color: t.ink }} />
              </span>
              <span className="text-[12px] font-bold text-slate-900">{group.section}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: t.weak, color: t.ink }}
              >
                {t.dir} · {group.hint}
              </span>
            </div>
            <div className="space-y-2">
              {group.options.map((o) => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.type}
                    type="button"
                    data-testid={`scan-hub-${o.type}`}
                    onClick={() => openModal(o.type)}
                    className={`group w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 min-h-[44px] text-left transition-colors ${t.hoverBorder} hover:bg-slate-50 active:scale-[0.99]`}
                  >
                    {/* §scan-hub-color — 아이콘 칩: 그룹색 weak 배경 + ink 아이콘. */}
                    <span
                      className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ background: t.weak }}
                    >
                      <Icon className="h-4 w-4" style={{ color: t.ink }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
                      <span className="block text-xs text-slate-500 truncate">{o.desc}</span>
                    </span>
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 text-slate-300 transition-colors ${t.chevronHover}`} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
