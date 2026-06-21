"use client";

/**
 * §quote-perm-gate (지시문 §10) — 품위 있는 권한 안내.
 *
 * 권한 없는 작업(견적 비교·스캔)에서 빨간 에러박스 dead-end ❌ 대신:
 *   잠금 아이콘 + 현재 역할/필요 권한 + 실 CTA(조직 만들기·참여 → /dashboard/organizations).
 *   모달을 먼저 열고 막판 403 던지는 패턴 금지 — 사전체크 후 이 안내를 노출한다.
 *   CTA는 권한 획득 실경로(조직 소속)로 연결(dead button 0).
 */

import Link from "next/link";
import { Lock } from "lucide-react";

export function PermissionNotice({
  title,
  currentRole,
  neededLabel,
}: {
  title: string;
  currentRole: string | null;
  neededLabel: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-8 px-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Lock className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900 break-keep">{title}</p>
        <p className="mt-1 text-xs text-slate-500 break-keep">
          현재 권한: <span className="font-medium text-slate-600">{currentRole ?? "조직 미소속"}</span>
          {" · "}필요: <span className="font-medium text-slate-600">{neededLabel}</span>
        </p>
      </div>
      <Link
        href="/dashboard/organizations"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2f6be0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#244e9e] min-h-[44px]"
      >
        조직 만들기 · 참여
      </Link>
      <p className="text-[11px] text-slate-400 break-keep">조직에 소속되면 견적 비교·스캔 등 협업 기능을 사용할 수 있습니다.</p>
    </div>
  );
}
