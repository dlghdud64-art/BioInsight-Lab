export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 벤더 포털 진입 — 견적 회신은 **토큰 경로가 canonical** 이다.
 *
 * §route-duplication (2026-08-10, 호영님 결정): 같은 도메인 행위(벤더 견적 회신)에
 *   토큰 경로와 로그인 포털 경로가 각자 라우트를 갖고 각자 진화했다. 토큰 경로만
 *   구현돼 있었고, 포털 경로는 **하드코딩 mock** 으로 채워져 있었다
 *   (실재하지 않는 견적 요청과 조직명을 아무 방문자에게나 렌더).
 *   → 포털 RFQ 경로를 폐기하고 토큰 경로를 canonical 로 확정했다.
 *
 * 이 화면은 조작된 데이터를 보여주지 않기 위해 목록을 **만들지 않는다**.
 * 로그인 벤더용 포털 회신은 §vendor-portal-identity(벤더 계정 체계) 이후에
 * 새로 설계한다 — 지금 것을 되살리는 트랙이 아니다.
 */
export default function VendorPortalEntryPage() {
  return (
    <div className="min-h-screen bg-pg">
      <div className="bg-pn border-b border-bd">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-slate-100">벤더 포털</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-lg border border-bd bg-pn p-5">
          <h2 className="text-base font-semibold text-slate-100">
            견적 회신은 요청 메일의 링크로 진행합니다
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            받으신 견적 요청 메일에 포함된 회신 링크를 열면 품목별 단가와 납기를
            입력할 수 있습니다. 이 포털 화면에서는 요청 목록을 제공하지 않습니다.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            링크를 찾을 수 없거나 만료됐다면 요청을 보낸 담당자에게 재발송을
            요청해 주세요.
          </p>
        </div>

        <div className="mt-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/vendor/logout">로그아웃</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
