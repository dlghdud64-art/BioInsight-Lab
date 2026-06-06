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
 */

import { useOpenModal } from "@/lib/store/modal-store";
import { ScanLine, FileText, QrCode, ChevronRight, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

// §11.379 — 스캔 IA 입고/사용 2분류. 재고 흐름 방향으로 묶어 사용자 의도 명확화.
//   입고 스캔(재고 +): 라벨 직접등록 + 거래명세서 입고.
//   재고 사용(재고 −): QR 차감(조회 후 수량 확인→차감 확정. GlobalQRScannerModal).
const SCAN_GROUPS = [
  {
    section: "입고 스캔",
    hint: "재고 증가",
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
        return (
          <div key={group.section}>
            <div className="flex items-center gap-1.5 px-1 mb-1.5">
              <SectionIcon className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {group.section}
              </span>
              <span className="text-[10px] font-medium text-slate-400">· {group.hint}</span>
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
                    className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 min-h-[44px] text-left transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
                  >
                    <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                      <Icon className="h-4 w-4 text-slate-700" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
                      <span className="block text-xs text-slate-500 truncate">{o.desc}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
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
