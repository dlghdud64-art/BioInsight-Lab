/**
 * §placeholder-success-gate P1 (2026-09-11) — 벤더 로그인 링크 발송을 폐기한다.
 *
 * 이 화면은 "이메일로 로그인 링크를 발송했습니다. 메일함을 확인해주세요." 를 띄웠으나
 * api/vendor/auth/send-link 는 TODO 만 있고 토큰 생성·저장·발송이 전부 없었다.
 * 거래처가 오지 않을 메일을 기다리는 상태였다 — 앞선 §placeholder-success-audit 4건과
 * 달리 **살아 있는 외부 표면**이다.
 *
 * §route-duplication(호영님 2026-08-10): 벤더 견적 회신의 canonical 은 토큰 경로다.
 * 로그인 벤더용 포털은 §vendor-portal-identity 이후 새로 설계한다(app/vendor/page.tsx).
 * 그 결정에 로그인 페이지 폐기는 없었으므로 **삭제하지 않고 안내 화면으로 보낸다.**
 *
 * 파일을 남기는 이유는 둘이다:
 *   ① 벤더가 북마크했거나 예전 안내로 들어온 외부 URL 이 404 가 되지 않는다.
 *   ② ui-rebrand-labaxis 가 이 경로를 직접 읽는다(파일 부재 = RED).
 *
 * 🛑 permanentRedirect(308) 를 쓰지 말 것. 브라우저가 캐시해 §vendor-portal-identity
 *    에서 되살릴 때 벤더 단말에서 풀리지 않는다. 임시(307)로 둔다.
 */
import { redirect } from "next/navigation";

export default function VendorLoginPage() {
  redirect("/vendor");
}
