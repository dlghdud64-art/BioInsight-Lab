"use client";

/**
 * §invite-flow Phase 3-3 — 초대 수락 화면 (`/invite/[token]`)
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 3)
 *
 * 이 화면은 이 제품에서 **page-per-feature 예외**다 — 외부 링크의 착지점이라
 * 앱 셸 안에 둘 수 없다(로그인 전에도 열린다). 계획서 §4 에 그 사유가 명시돼 있다.
 *
 * 설계 기준 (Cowork QA 판정 2 · 조용한 실패 금지):
 *   · 실패를 **토스트로 끝내지 않는다.** 화면에 남는 영역으로 말한다 —
 *     여기는 착지점이라 토스트가 사라지면 사용자는 아무 단서 없이 흰 화면을 본다.
 *   · 문구는 **무엇을 하면 되는지까지** 말한다. "권한이 없습니다" 로 끝내지 않는다.
 *   · 🔑 "입력 보존" 의 자리: 이 화면엔 입력 폼이 없다. 같은 위험은 **로그인 왕복에서
 *     토큰을 잃는 것**이다 → `callbackUrl` 로 이 URL 을 그대로 들고 돌아온다.
 *   · 🔑 `alreadyMember: true` 는 **성공이다.** 200 인데 실패로 그리면 서버만 고친 셈이 된다
 *     (Cowork QA 지시). 두 번 눌러 P2002 로 갈린 경합도 이 경로로 돌아온다.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { csrfFetch } from "@/lib/api-client";

type PreviewStatus = "valid" | "revoked" | "expired" | "accepted";

interface Preview {
  organizationName: string | null;
  role: string;
  expiresAt: string;
  status: PreviewStatus;
  emailLocked: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  VIEWER: "조회",
  REQUESTER: "요청",
  APPROVER: "승인",
  ADMIN: "관리자",
  OWNER: "소유자",
};

/** 실패를 화면에 **남기는** 블록 — 토스트가 아니다. */
function Notice({
  tone,
  title,
  body,
  action,
}: {
  tone: "error" | "warn" | "ok";
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "warn"
        ? "bg-yellow-50 border-yellow-200 text-yellow-800"
        : "bg-red-50 border-red-200 text-red-700";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`} role="status">
      <div className="flex items-start gap-2">
        {tone === "ok" ? (
          <CheckCircle2 className="h-5 w-5 shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm">{body}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /** 수락 결과 — 성공/실패 모두 **화면에 남는다**(토스트 아님). */
  const [result, setResult] = useState<
    | { ok: true; alreadyMember: boolean; organizationId: string }
    | { ok: false; title: string; body: string; upgradeHref?: string }
    | null
  >(null);

  /* 🔑 로그인 왕복에서 토큰을 잃지 않는다 — 이 URL 그대로 돌아온다. */
  const signinHref = useMemo(
    () => `/auth/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`,
    [token],
  );

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/invites/${token}`);
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setLoadError(
            (data as { error?: string }).error ??
              "초대 정보를 불러오지 못했습니다.",
          );
        } else {
          setPreview((data as { invite: Preview }).invite);
        }
      } catch {
        if (alive) setLoadError("초대 정보를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const accept = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await csrfFetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      /* 🔑 200 은 성공이다 — `alreadyMember` 여도 마찬가지다.
       * 두 번 눌러 P2002 로 갈린 경합이 여기로 돌아온다(§3-2 후속). */
      if (res.ok && (data as { ok?: boolean }).ok) {
        setResult({
          ok: true,
          alreadyMember: Boolean((data as { alreadyMember?: boolean }).alreadyMember),
          organizationId: String((data as { organizationId?: string }).organizationId ?? ""),
        });
        return;
      }

      const d = data as {
        error?: string;
        code?: string;
        upgradeHref?: string;
        limit?: number;
      };
      if (res.status === 401) {
        router.push(signinHref);
        return;
      }
      setResult({
        ok: false,
        title:
          d.code === "SEAT_LIMIT"
            ? "이 조직에 남은 자리가 없습니다"
            : "수락하지 못했습니다",
        /* 무엇을 하면 되는지까지 — 서버가 이미 그 문구를 만든다(생성·수락 공용). */
        body: d.error ?? "잠시 후 다시 시도해 주세요.",
        upgradeHref: d.upgradeHref,
      });
    } catch {
      setResult({
        ok: false,
        title: "수락하지 못했습니다",
        body: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [token, router, signinHref]);

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-slate-500" />
            워크스페이스 초대
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </main>
  );

  if (loading || sessionStatus === "loading") {
    return shell(
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>,
    );
  }

  if (loadError || !preview) {
    return shell(
      <Notice
        tone="error"
        title="초대를 찾을 수 없습니다"
        body={loadError ?? "링크가 올바른지 확인하거나 초대한 분에게 새 링크를 요청해 주세요."}
      />,
    );
  }

  // ── 수락 결과가 있으면 그것이 화면이다 (토스트로 흘려보내지 않는다) ──
  if (result?.ok) {
    return shell(
      <>
        <Notice
          tone="ok"
          title={
            result.alreadyMember
              ? "이미 이 워크스페이스의 멤버입니다"
              : "워크스페이스에 참여했습니다"
          }
          body={
            result.alreadyMember
              ? `${preview.organizationName ?? "워크스페이스"} 에서 바로 작업을 시작할 수 있습니다.`
              : `${preview.organizationName ?? "워크스페이스"} 가 현재 워크스페이스로 설정되었습니다.`
          }
        />
        <Button className="w-full" onClick={() => router.push("/dashboard")}>
          대시보드로 이동
        </Button>
      </>,
    );
  }

  if (result && !result.ok) {
    return shell(
      <>
        <Notice
          tone="warn"
          title={result.title}
          body={result.body}
          action={
            result.upgradeHref ? (
              <Link href={result.upgradeHref}>
                <Button size="sm" variant="outline">
                  플랜 확인하기
                </Button>
              </Link>
            ) : undefined
          }
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setResult(null)}
        >
          돌아가기
        </Button>
      </>,
    );
  }

  if (preview.status !== "valid") {
    const copy: Record<Exclude<PreviewStatus, "valid">, { t: string; b: string }> = {
      revoked: {
        t: "취소된 초대입니다",
        b: "관리자가 이 초대를 거둬들였습니다 · 초대한 분에게 새 링크를 요청해 주세요.",
      },
      expired: {
        t: "만료된 초대입니다",
        b: "유효 기간이 지났습니다 · 초대한 분에게 새 링크를 요청해 주세요.",
      },
      accepted: {
        t: "이미 사용된 초대입니다",
        b: "이 링크는 이미 수락되었습니다 · 본인 계정이 맞다면 로그인 후 대시보드에서 확인해 주세요.",
      },
    };
    const c = copy[preview.status];
    return shell(<Notice tone="warn" title={c.t} body={c.b} />);
  }

  const orgName = preview.organizationName ?? "워크스페이스";
  const roleLabel = ROLE_LABEL[preview.role] ?? preview.role;

  return shell(
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">초대된 워크스페이스</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{orgName}</p>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">역할</dt>
            <dd className="text-slate-800">{roleLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">만료</dt>
            <dd className="text-slate-800">
              {new Date(preview.expiresAt).toLocaleDateString("ko-KR")}
            </dd>
          </div>
        </dl>
      </div>

      {preview.emailLocked && (
        <p className="text-xs text-slate-500">
          지정된 이메일 주소로만 수락할 수 있습니다 · 초대받은 계정으로 로그인해 주세요.
        </p>
      )}

      {sessionStatus === "authenticated" ? (
        <Button className="w-full" onClick={accept} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          초대 수락
        </Button>
      ) : (
        <>
          <Button className="w-full" onClick={() => router.push(signinHref)}>
            로그인하고 수락하기
          </Button>
          <p className="text-xs text-slate-500">
            로그인 후 이 화면으로 돌아옵니다.
          </p>
        </>
      )}
    </>,
  );
}
