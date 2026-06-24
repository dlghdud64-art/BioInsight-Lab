"use client";

import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // §auth §3 — silent refresh(보수적 additive). NextAuth 내장:
  //   · refetchInterval: 활성(visible) 세션을 5분마다 /api/auth/session 재조회 → JWT updateAge rolling 연장(무음).
  //   · refetchOnWindowFocus: 탭 복귀 시 세션 재검증(기본 true 명시 — §2 AuthFocusGuard 와 정합).
  //   토스트/리다이렉트 0(무음). 실제 만료 시에만 §2(선제)/api-client(반응형) 401 경로가 redirect.
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      {children}
    </SessionProvider>
  );
}







