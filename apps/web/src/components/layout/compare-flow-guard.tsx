"use client";

/**
 * CompareFlowGuard
 *
 * 비교 상태의 유효 범위를 플로우 경로(/test/search, /test/compare, /test/quote)로 제한.
 * - 플로우 → 외부 이동: 현재 비교 목록을 stash하고 비움
 * - 외부 → 플로우 재진입: stash가 있으면 복원 토스트 표시
 *
 * 루트 레이아웃에 배치하여 모든 경로 변경을 감지한다.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCompareStore, isFlowPath } from "@/lib/store/compare-store";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function CompareFlowGuard() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const { toast } = useToast();

  const stashAndClear = useCompareStore((s) => s.stashAndClear);
  const restoreFromStash = useCompareStore((s) => s.restoreFromStash);
  const clearStash = useCompareStore((s) => s.clearStash);
  const hasStash = useCompareStore((s) => s.hasStash);
  const productIds = useCompareStore((s) => s.productIds);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    // 초기 마운트 시: 플로우 외부에 있는데 productIds가 남아있으면 stash
    if (prev === null) {
      if (!isFlowPath(pathname) && productIds.length > 0) {
        stashAndClear();
      }
      return;
    }

    const wasInFlow = isFlowPath(prev);
    const nowInFlow = isFlowPath(pathname);

    // 플로우 → 외부: stash + clear
    if (wasInFlow && !nowInFlow) {
      if (productIds.length > 0) {
        stashAndClear();
      }
    }

    // 외부 → 플로우: stash 복원 제안
    if (!wasInFlow && nowInFlow) {
      // 약간의 딜레이로 렌더 완료 후 토스트 표시
      const timer = setTimeout(() => {
        if (hasStash()) {
          const stashedCount = useCompareStore.getState()._stashedIds.length;
          toast({
            title: "이전 비교 목록이 있습니다",
            description: `${stashedCount}개 제품을 복원할까요?`,
            duration: 8000,
            action: (
              <ToastAction altText="복원" onClick={() => restoreFromStash()}>
                복원
              </ToastAction>
            ),
          });
          // 토스트를 무시하면 다음 이탈 시 stash 덮어씌워짐 (자연 폐기)
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, productIds.length, stashAndClear, restoreFromStash, clearStash, hasStash, toast]);

  return null; // UI 없음 — 사이드이펙트 전용
}
