"use client";

/**
 * §auth §2 #auth-focus-guard — 재포커스 세션 유효성 선제 게이트 (보수적 additive).
 *
 * 탭 복귀(visibilitychange/focus) 시 getSession()으로 세션 유효성을 선제 확인 →
 * 인증된 적 있던 사용자의 세션이 만료된 경우, 기존 signin redirect 경로를 재사용해
 * 사용자가 클릭하기 전에 재로그인으로 유도(반응형 401 대기로 인한 죽은 화면 차단).
 *
 * 안전장치:
 *   - wasAuthed 게이트: 공개 방문자/미인증 초기 상태엔 무동작(로그인 적 있는 세션만).
 *   - 보호 경로(PROTECTED_PREFIXES)에서만 — 공개/landing/auth 경로 무동작.
 *   - signin-path guard + 300ms debounce → redirect loop / focus storm 0.
 *   - canonical = getSession() 결과만 신뢰(자체 만료 계산 0 → 가짜 만료 강제 로그아웃 방지).
 *   - NextAuth 기본 동작·기존 반응형 401(api-client) 제거 0 = additive.
 */

import { useEffect, useRef } from "react";
import { useSession, getSession } from "next-auth/react";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/app",
  "/quotes",
  "/products",
  "/protocol",
  "/search",
  "/_workbench",
];

function isProtectedPath(path: string): boolean {
  if (path.startsWith("/auth")) return false;
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export function AuthFocusGuard() {
  const { status } = useSession();
  const wasAuthedRef = useRef(false);

  useEffect(() => {
    if (status === "authenticated") wasAuthedRef.current = true;
  }, [status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const verify = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        // 로그인 적 있던 사용자만(공개 방문자 제외).
        if (!wasAuthedRef.current) return;
        const path = window.location.pathname;
        if (!isProtectedPath(path) || path.startsWith("/auth/signin")) return;
        // canonical 유효성 = getSession(). null → 만료/무효 → 선제 redirect(기존 경로 재사용).
        const session = await getSession();
        if (session) return; // 유효 → 무동작
        const callbackUrl = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.href = `/auth/signin?callbackUrl=${callbackUrl}`;
      }, 300);
    };

    document.addEventListener("visibilitychange", verify);
    window.addEventListener("focus", verify);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", verify);
      window.removeEventListener("focus", verify);
    };
  }, []);

  return null;
}
