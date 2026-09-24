import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * 발주 상세 미연결 안내 — §po-seed-cutoff (2026-09-22 · 호영님 판정)
 *
 * 🛑 발주 상세·발송 워크벤치는 ops-console **시드**(po-001~003)에서만 발주를 찾았다.
 *    시드 id 로 들어오면 지어낸 발주를 상세까지 그렸고, **실제 주문 id 로 들어오면 「찾을 수 없음」** 이었다.
 *    입고 화면들이 실제 주문 id 로 이 경로를 걸고 있었으므로 그 링크는 100% 막힌 길이었다(같은 커밋에서 링크 제거).
 *
 * 🔑 **레이아웃 복원 지점**(호영님 지시 2026-09-24): 상세 본문(승인 스트립·라인 실행·확인/인계 · 1,311줄)이
 *    살아 있던 마지막 커밋은 `c7796538` 이다(삭제는 `fe89d14c`). 실제 발주 조회를 구현할 사람은
 *    `git show c7796538:apps/web/src/app/dashboard/purchase-orders/[poId]/page.tsx` 로 꺼내 쓴다.
 *    발송 워크벤치·오버레이 본문은 `fe89d14c`(dispatch) · `96414c4e`(overlay) 직전 판본에 있다.
 *
 * 지금: 시드 조회를 끊었다. 실제 발주를 읽는 배선은 **이 트랙의 범위가 아니다**(기능 개발 ·
 *   발주는 ENABLE_PURCHASING=false 로 꺼져 있는 미완 기능). 그래서 「찾을 수 없음」 이라고 말하지 않는다 —
 *   찾아본 적이 없기 때문이다. 화면이 자기 상태를 사실대로 말한다.
 */
export function PoUnwiredNotice({ title }: { title: string }) {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/dashboard/purchase-orders"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 발주 관리
      </Link>
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3">
        <p className="text-[13px] font-bold text-gray-500">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500 break-keep">
          이 화면은 아직 실제 발주에 연결되지 않았습니다. 진행 중인 입고는 입고 관리에서 볼 수 있습니다.
        </p>
        <Link
          href="/dashboard/receiving"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          입고 관리로 이동 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
