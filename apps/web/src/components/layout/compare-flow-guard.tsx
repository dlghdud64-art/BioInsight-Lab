"use client";

/**
 * CompareFlowGuard
 *
 * 비교 상태의 유효 범위를 플로우 경로(/app/search, /app/compare, /app/quote)로 제한.
 * - 플로우 → 외부 이동: 현재 비교 목록을 stash하고 비움
 * - 외부 → 플로우 재진입: stash가 있으면 복원 토스트 표시
 *
 * 루트 레이아웃에 배치하여 모든 경로 변경을 감지한다.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCompareStore, isFlowPath } from "@/lib/store/compare-store";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function CompareFlowGuard() {
  const pathname = usePathname();
  const router = useRouter();
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
      const timer = setTimeout(() => {
        if (hasStash()) {
          const stashedIds = useCompareStore.getState()._stashedIds;
          const stashedCount = stashedIds.length;
          if (stashedCount === 0) return; // 빈 stash면 무시

          toast({
            title: "이전 비교 목록이 있습니다",
            description: `${stashedCount}개 제품을 복원할 수 있습니다`,
            duration: 10000,
            action: (
              <ToastAction altText="복원" onClick={() => {
                // 1. stash → productIds 복원
                restoreFromStash();
                // 2. 성공 피드백
                toast({
                  title: `${stashedCount}개 항목을 비교 목록으로 복원했습니다`,
                  description: "비교 화면으로 이동합니다",
                  duration: 3000,
                });
                // 3. compare 화면으로 이동
                router.push("/app/compare");
              }}>
                복원
              </ToastAction>
            ),
          });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, productIds.length, stashAndClear, restoreFromStash, clearStash, hasStash, toast, router]);

  return null;
}
