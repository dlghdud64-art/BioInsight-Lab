"use client";

/**
 * GlobalModal — 전역 모달 렌더러
 *
 * App layout에 단 하나만 배치. useModalStore의 상태를 구독하여
 * 현재 활성 모달을 BaseModal 안에 렌더링한다.
 *
 * 새 모달 추가 시:
 * 1. modal-store.ts의 ModalType에 타입 추가
 * 2. 아래 MODAL_REGISTRY에 컴포넌트 + 기본 사이즈 등록
 * 3. 어디서든 openModal("타입", { props }) 호출
 */

import { lazy, Suspense } from "react";
import { BaseModal } from "@/components/ui/base-modal";
import { useModalStore, type ModalType, type ModalSize } from "@/lib/store/modal-store";
import { Loader2 } from "lucide-react";

// ══════════════════════════════════════════════
// Modal Registry
// ══════════════════════════════════════════════

interface ModalRegistryEntry {
  /** lazy-loaded 컴포넌트 */
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  /** 기본 사이즈 */
  defaultSize: ModalSize;
  /** 기본 타이틀 (props로 오버라이드 가능) */
  defaultTitle?: string;
  /** 기본 서브타이틀 */
  defaultSubtitle?: string;
}

/**
 * 모달 타입 → 컴포넌트 매핑 레지스트리
 *
 * lazy import로 코드 스플리팅. 모달을 열 때만 해당 컴포넌트를 로드한다.
 */
const MODAL_REGISTRY: Partial<Record<ModalType, ModalRegistryEntry>> = {
  // §11.371-3 — 글로벌 스캔 단일 진입 허브 (라벨/거래명세서/QR picker)
  scan_hub: {
    component: lazy(() =>
      import("@/components/inventory/ScanHubModal").then((m) => ({
        default: m.ScanHubContent,
      })),
    ),
    defaultSize: "sm",
    defaultTitle: "스캔",
    defaultSubtitle: "라벨 등록 · 거래명세서 입고 · QR 조회 중에서 선택하세요.",
  },
  label_scanner: {
    component: lazy(() =>
      import("@/components/inventory/LabelScannerModal").then((m) => ({
        default: m.LabelScannerContent,
      })),
    ),
    // §11.374-vivino — 풀블리드 카메라(h-[68vh])가 작은 모달(md=max-w-lg)에 갇히지 않게 full.
    //   카메라 + 촬영 오버레이가 한 화면(스크롤 0). 폼 step 은 full 안에서 가운데 정렬.
    defaultSize: "full",
    defaultTitle: "라벨 직접등록",
    defaultSubtitle: "시약·소모품 라벨을 스캔하여 자동 인식 후 재고에 직접 등록합니다.",
  },
  // §11.371-3 — 거래명세서/PO 입고 (parse-image). Content-only 어댑터 사용.
  smart_receiving: {
    component: lazy(() =>
      import("@/components/inventory/SmartReceivingScannerModal").then((m) => ({
        default: m.SmartReceivingContent,
      })),
    ),
    defaultSize: "md",
    defaultTitle: "거래명세서 입고",
    defaultSubtitle: "명세서·PO를 촬영하면 품목·수량·LOT을 자동 인식해 입고합니다.",
  },
  qr_scanner: {
    component: lazy(() =>
      import("@/components/inventory/GlobalQRScannerModal").then((m) => ({
        default: m.GlobalQRScannerContent,
      })),
    ),
    // §11.374-vivino — QR 풀블리드(h-[60vh])도 작은 모달에 갇히지 않게 full.
    defaultSize: "full",
    defaultTitle: "QR 스캐너",
    defaultSubtitle: "QR 코드를 스캔하여 재고를 조회합니다.",
  },
  // add_inventory: 추후 Content export 분리 후 등록
  // checkout, dispatch, usage: 추후 마이그레이션 대상
  bulk_import: {
    component: lazy(() =>
      import("@/components/inventory/BulkImportModal").then((m) => ({
        default: m.BulkImportContent,
      })),
    ),
    defaultSize: "lg",
    defaultTitle: "대량 가져오기",
    defaultSubtitle: "CSV 또는 Excel 파일로 재고를 일괄 등록합니다.",
  },
  purchase: {
    component: lazy(() =>
      import("@/components/purchase/PurchaseModal").then((m) => ({
        default: m.PurchaseContent,
      })),
    ),
    defaultSize: "lg",
    defaultTitle: "구매 내역 가져오기",
    defaultSubtitle: "TSV/Excel 파일로 구매 내역을 일괄 등록합니다.",
  },
  workbench_progress: {
    component: lazy(() =>
      import("@/components/dashboard/overlay/workbench-progress-overlay").then((m) => ({
        default: m.WorkbenchProgressContent,
      })),
    ),
    defaultSize: "xl",
    defaultTitle: "작업 진행 상황",
    defaultSubtitle: "현재 실행 중인 워크벤치 작업의 진행 상태입니다.",
  },
  confirm: {
    component: lazy(() => Promise.resolve({
      default: ({ message, onConfirm }: { message: string; onConfirm?: () => void }) => (
        <div className="text-center py-4">
          <p className="text-sm text-slate-700">{message}</p>
        </div>
      ),
    })),
    defaultSize: "sm",
    defaultTitle: "확인",
  },
  alert: {
    component: lazy(() => Promise.resolve({
      default: ({ message }: { message: string }) => (
        <div className="text-center py-4">
          <p className="text-sm text-slate-700">{message}</p>
        </div>
      ),
    })),
    defaultSize: "sm",
    defaultTitle: "알림",
  },
};

// ══════════════════════════════════════════════
// Loading fallback
// ══════════════════════════════════════════════

function ModalLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
    </div>
  );
}

// ══════════════════════════════════════════════
// GlobalModal Component
// ══════════════════════════════════════════════

export function GlobalModal() {
  const { isOpen, modalType, modalProps, sizeOverride, closeModal } = useModalStore();

  // 등록되지 않은 모달 타입이면 렌더링하지 않음
  const entry = modalType ? MODAL_REGISTRY[modalType] : null;

  if (!entry) {
    // registry에 없으면 BaseModal만 열지 않음
    // (기존 방식으로 직접 관리하는 모달은 그대로 동작)
    return null;
  }

  const Component = entry.component;
  const size = sizeOverride ?? entry.defaultSize;
  const title = (modalProps.title as string) ?? entry.defaultTitle;
  const subtitle = (modalProps.subtitle as string) ?? entry.defaultSubtitle;

  return (
    <BaseModal
      open={isOpen}
      onClose={closeModal}
      size={size}
      title={title}
      subtitle={subtitle}
      headerIcon={modalProps.headerIcon as React.ReactNode}
      footer={modalProps.footer as React.ReactNode}
      closeOnBackdropClick={modalProps.closeOnBackdropClick !== false}
      closeOnEsc={modalProps.closeOnEsc !== false}
    >
      <Suspense fallback={<ModalLoadingFallback />}>
        <Component {...modalProps} onClose={closeModal} />
      </Suspense>
    </BaseModal>
  );
}
