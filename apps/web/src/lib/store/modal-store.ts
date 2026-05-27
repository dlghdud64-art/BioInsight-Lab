/**
 * modal-store.ts
 *
 * 전역 통합 모달 상태 관리 (Zustand)
 *
 * 기존에 각 컴포넌트에서 useState로 분산 관리하던 모달 상태를
 * 중앙 집중형으로 통합한다.
 *
 * 사용법:
 *   openModal("label_scanner", { inventoryId: "123" })
 *   closeModal()
 *
 * 설계 원칙:
 * - 동시에 하나의 모달만 표시 (z-index 충돌 방지)
 * - 스택이 필요한 경우 queue 방식으로 확장 가능
 * - URL deep-link 연동은 use-overlay-deep-link.ts와 호환 유지
 * - 모달 닫힘 시 props 초기화로 메모리 누수 방지
 */

import { create } from "zustand";

// ══════════════════════════════════════════════
// Modal Type Registry
// ══════════════════════════════════════════════

/**
 * 시스템에 등록된 모달 타입.
 * 새 모달 추가 시 여기에 타입을 등록하고,
 * GlobalModal registry에 컴포넌트를 매핑한다.
 */
export type ModalType =
  | "label_scanner"
  | "qr_scanner"
  | "add_inventory"
  | "bulk_import"
  | "purchase"
  | "checkout"
  | "dispatch"
  | "usage"
  | "workbench_progress"
  | "quote_intake"
  | "ai_quote_parse"
  | "confirm"         // 범용 확인 다이얼로그
  | "alert";          // 범용 알림 다이얼로그

/**
 * 모달 사이즈 규격
 * - sm: 경고창, 확인 다이얼로그 (max-w-md)
 * - md: 일반 폼, 설정 (max-w-lg)
 * - lg: 데이터 비교, 리스트 (max-w-3xl)
 * - xl: 워크벤치, 상세 분석 (max-w-5xl)
 * - full: 전체화면 오버레이
 */
export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

// ══════════════════════════════════════════════
// Store State
// ══════════════════════════════════════════════

interface ModalState {
  /** 현재 모달이 열려있는지 */
  isOpen: boolean;

  /** 현재 표시 중인 모달 타입 */
  modalType: ModalType | null;

  /** 모달에 전달할 props (제네릭) */
  modalProps: Record<string, unknown>;

  /** 모달 사이즈 오버라이드 (기본값은 registry에서 결정) */
  sizeOverride: ModalSize | null;

  /** 모달 열기 */
  openModal: (
    type: ModalType,
    props?: Record<string, unknown>,
    options?: { size?: ModalSize },
  ) => void;

  /** 모달 닫기 */
  closeModal: () => void;

  /** 모달 props 업데이트 (열려있는 상태에서) */
  updateProps: (props: Record<string, unknown>) => void;
}

// ══════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════

export const useModalStore = create<ModalState>((set) => ({
  isOpen: false,
  modalType: null,
  modalProps: {},
  sizeOverride: null,

  openModal: (type, props = {}, options) => {
    set({
      isOpen: true,
      modalType: type,
      modalProps: props,
      sizeOverride: options?.size ?? null,
    });
  },

  closeModal: () => {
    set({
      isOpen: false,
      // 닫힌 후 애니메이션 완료까지 타입/props 유지 → AnimatePresence exit
      // 실제 초기화는 BaseModal의 onExitComplete에서 수행
    });
    // 300ms 후 완전 초기화 (exit 애니메이션 시간)
    setTimeout(() => {
      set((state) => {
        // 이미 다른 모달이 열렸으면 초기화하지 않음
        if (state.isOpen) return state;
        return { modalType: null, modalProps: {}, sizeOverride: null };
      });
    }, 350);
  },

  updateProps: (props) => {
    set((state) => ({
      modalProps: { ...state.modalProps, ...props },
    }));
  },
}));

// ══════════════════════════════════════════════
// Convenience hooks
// ══════════════════════════════════════════════

/** 모달 열기 함수만 가져오는 hook */
export function useOpenModal() {
  return useModalStore((s) => s.openModal);
}

/** 모달 닫기 함수만 가져오는 hook */
export function useCloseModal() {
  return useModalStore((s) => s.closeModal);
}
