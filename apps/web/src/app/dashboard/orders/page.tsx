"use client";

/**
 * /dashboard/orders → /dashboard/purchases redirect
 *
 * 발주 전환 큐는 구매 운영 안으로 흡수됨.
 * pre-PO conversion readiness는 구매 운영 queue에서 처리.
 * 이 route는 1 release 동안만 유지 후 제거.
 *
 * TODO: 다음 릴리스에서 이 파일과 orders/ 디렉토리 삭제
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrdersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/purchases?view=conversion-ready");
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-slate-500">구매 운영으로 이동 중...</p>
    </div>
  );
}
