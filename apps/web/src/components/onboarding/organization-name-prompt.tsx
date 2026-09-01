"use client";

/**
 * §onboarding-blocker 3a — 조직 이름 확인 1스텝 (호영님 결정 2026-08-12)
 *
 * 가입 시 조직은 **자동 생성**된다(`auth.ts`). 그래서 사용자는 어떤 경우에도 막히지
 * 않는다 — workspace 도 함께 생기고 권한도 채워진다. 다만 그 이름은 시스템이 만든
 * **제안**이므로, 확정 전까지 임시임이 화면에 드러나야 한다.
 *
 *   자동 생성만 하고 이름을 지어내면 §fabricated-data-surface 에 닿는다.
 *   유도 화면 단독은 실험실 사용자가 "조직" 개념 앞에서 이탈한다.
 *   → **시스템이 제안하고 사용자가 확정한다.**
 *
 * 형태:
 *   · 임시 이름이면 다이얼로그 1스텝 — 기본값이 채워져 있고 **"임시" 라고 명시**된다
 *   · 건너뛰면 기본값 유지 + **상단 배너**("조직 이름 설정")
 *   · 저장하면 `PATCH /api/organizations/[id]` — 그때부터 임시가 아니다
 *
 * ⚠️ same-canvas — 신규 라우트를 만들지 않는다(page-per-feature 회귀 금지).
 * ⚠️ 임시 여부는 스키마 플래그가 아니라 `isProvisionalOrgName` 파생이다(3a 는 스키마 무관).
 * ⚠️ 조직이 **0** 인 경우(자동 생성 실패)도 같은 프롬프트가 받는다 — 무음 실패 금지.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, AlertCircle } from "lucide-react";
import { csrfFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { isProvisionalOrgName, deriveDefaultOrgName } from "@/lib/organization/default-name";

/** 건너뛰기 기억 — 다이얼로그 재노출만 막고 배너는 유지한다(정보를 숨기지 않는다). */
const SKIP_KEY = "org-name-prompt-skipped-v1";

interface OrgLite {
  id: string;
  name: string;
}

export function OrganizationNamePrompt() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [skipped, setSkipped] = useState(true); // 초기값 true — 판정 전 깜빡임 방지
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      setSkipped(localStorage.getItem(SKIP_KEY) === "1");
    } catch {
      setSkipped(false);
    }
  }, []);

  const { data } = useQuery({
    queryKey: ["onboarding-org-name"],
    queryFn: async (): Promise<OrgLite[]> => {
      const res = await fetch("/api/organizations");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.organizations ?? []) as OrgLite[];
    },
    enabled: status === "authenticated",
    staleTime: 60 * 1000,
  });

  const user = session?.user ?? null;
  const orgs = data ?? [];
  // 임시 이름을 가진 조직 — 자동 생성 직후 상태
  const provisional = orgs.find((o) => isProvisionalOrgName(o.name, user)) ?? null;

  /**
   * 🛑 조직 **0** — 자동 생성이 실패했거나(예외는 로그인만 살리고 삼킨다) 기본명을
   *   도출하지 못해 건너뛴 경우다. 여기서 `null` 을 반환하면 사용자는 **조용히 빈 상태**로
   *   남는다 — 3a 이전과 똑같아진다(권한 공집합 · 라우트 37개 차단 · workspace 부재).
   *   그래서 같은 프롬프트가 **생성 모드**로 받는다.
   */
  const needsOrg = data !== undefined && orgs.length === 0;

  useEffect(() => {
    if (provisional && !value) setValue(provisional.name);
    else if (needsOrg && !value) setValue(deriveDefaultOrgName(user) ?? "");
  }, [provisional, needsOrg, user, value]);

  if (status !== "authenticated") return null;
  if (!provisional && !needsOrg) return null;

  const skip = () => {
    try {
      localStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* storage 불가 — 다이얼로그가 다시 뜰 뿐, 데이터 영향 0 */
    }
    setSkipped(true);
  };

  const save = async () => {
    const next = value.trim();
    if (!next || saving) return;
    setSaving(true);
    try {
      // 조직 0 이면 **생성**, 임시 이름이면 **개명**. 같은 프롬프트가 두 상태를 받는다.
      const res = needsOrg
        ? await csrfFetch(`/api/organizations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: next }),
          })
        : await csrfFetch(`/api/organizations/${provisional!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: next }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        // 실패를 성공처럼 보이지 않게 한다(placeholder success 금지).
        toast({
          title: needsOrg ? "조직을 만들지 못했습니다" : "조직 이름을 저장하지 못했습니다",
          description: body?.error ?? "잠시 후 다시 시도해주세요.",
          variant: "destructive",
        });
        return;
      }
      try {
        localStorage.removeItem(SKIP_KEY);
      } catch {
        /* no-op */
      }
      await queryClient.invalidateQueries({ queryKey: ["onboarding-org-name"] });
      // §invite-flow Phase 2 — usePermission 이 useActiveOrganization 을 읽도록 바뀌었다.
      //   조직을 만든 직후 권한이 stale 로 남지 않도록 그 훅의 키까지 함께 무효화한다.
      //   ("user-org-membership" 은 다른 소비자를 위해 유지 — 끊는 게 아니라 더한다.)
      await queryClient.invalidateQueries({ queryKey: ["user-org-membership"] });
      await queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      await queryClient.invalidateQueries({ queryKey: ["active-organization"] });
    } catch {
      toast({ title: "네트워크 오류로 저장하지 못했습니다", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── 건너뛴 뒤: 상단 배너 ── */
  if (skipped) {
    // 조직 0 은 임시 이름보다 심각하다 — 톤을 red 로(§11.302 위험).
    const tone = needsOrg
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-yellow-200 bg-yellow-50 text-yellow-800";
    const btnTone = needsOrg
      ? "border-red-300 hover:bg-red-100"
      : "border-yellow-300 hover:bg-yellow-100";
    return (
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${tone}`}>
        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1">
          {needsOrg ? (
            <>
              <strong>조직이 없습니다</strong> — 재고·견적·예산 기능이 열리지 않습니다
            </>
          ) : (
            <>
              조직 이름이 <strong>임시</strong>입니다 — 현재 &ldquo;{provisional!.name}&rdquo;
            </>
          )}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={`h-8 bg-white text-xs font-semibold ${btnTone}`}
          onClick={() => setSkipped(false)}
        >
          {needsOrg ? "조직 만들기" : "조직 이름 설정"}
        </Button>
      </div>
    );
  }

  /* ── 1스텝 다이얼로그 ── */
  return (
    <Dialog open onOpenChange={(o) => !o && skip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            {needsOrg ? "조직을 만들어 주세요" : "조직 이름을 알려주세요"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs leading-relaxed text-slate-500">
          {needsOrg ? (
            <>
              소속 조직이 없어 재고·견적·예산 기능이 열리지 않습니다. 이름만 정하면
              바로 시작할 수 있고, 나중에 설정에서 바꿀 수 있습니다.
            </>
          ) : (
            <>
              아래 이름은 <strong>임시로 지어둔 값</strong>입니다 — 회사명을 추측하지
              않았습니다. 실제 사용하시는 이름으로 바꿔주세요. 나중에 설정에서도 바꿀 수
              있습니다.
            </>
          )}
        </p>

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={deriveDefaultOrgName(user) ?? "조직 이름"}
          className="mt-1"
          autoFocus
        />

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-9" onClick={skip}>
            나중에 하기
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 font-semibold"
            disabled={saving || !value.trim()}
            onClick={save}
          >
            {saving ? "저장 중…" : needsOrg ? "이 이름으로 만들기" : "이 이름으로 시작"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
