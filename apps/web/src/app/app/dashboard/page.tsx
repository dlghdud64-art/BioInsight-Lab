"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /app/dashboard — /dashboard로 리다이렉트
 * middleware.ts에서 인증 체크 후 접근 가능
 */
export default function AppDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}
