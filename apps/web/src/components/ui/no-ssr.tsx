/**
 * §11.214b Path Z — NoSSR wrapper (client-only mount)
 *
 * 자식 component 를 SSR pass 에서 render 안하고 CSR mount 후에만 render.
 * Next.js client component 도 initial SSR HTML 생성하므로, render 자체가
 * SSR-CSR 다른 시점에 다른 결과 가능 (Date.now / new Date / Math.random
 * / window-only API / store hydration 등). NoSSR 은 mount 전 fallback
 * 만 render → SSR HTML ≡ CSR initial render → hydration mismatch 0.
 *
 * inventory 의 `dynamic import + ssr: false` 패턴과 동일 효과, 다만
 * file 분리 없이 default export 만 wrap 가능.
 *
 * Trade-off:
 *   - SSR HTML 에 placeholder (또는 빈) 만 → first paint 직후 placeholder
 *   - CSR mount 후 actual content (1 frame ~16ms 후 swap)
 *   - SEO 영향 0 (dashboard 는 internal authenticated)
 *
 * Lock:
 *   - useEffect + useState mount-after-render 패턴
 *   - fallback prop 으로 placeholder 명시 가능 (skeleton 등)
 *   - children 은 mount 후에만 render — 그때 NOW / store / DOM 모두 valid
 *
 * Usage:
 *   export default function Page() {
 *     return (
 *       <NoSSR fallback={<PageSkeleton />}>
 *         <PageInner />
 *       </NoSSR>
 *     );
 *   }
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface NoSSRProps {
  /** mount 후 render 할 children */
  children: ReactNode;
  /** SSR + mount 전 fallback (default: null) */
  fallback?: ReactNode;
}

export function NoSSR({ children, fallback = null }: NoSSRProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
