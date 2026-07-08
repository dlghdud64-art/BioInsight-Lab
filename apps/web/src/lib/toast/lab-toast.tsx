"use client";

/**
 * §action-toast(호영님 2026-07-08) — 액션 알림 토스트 헬퍼 (A안: shadcn use-toast 위 얇은 래퍼).
 *
 * 지시문 5타입을 기존 shadcn toast() 호출로 매핑. 렌더러 단일(Toaster/Radix 재사용).
 *   success  초록 · ✓ · 3초 자동 · 액션 최대 1
 *   partial  주황 · ! · 수동 · "제외 N건 보기" 필수
 *   error    빨강 · ✕ · 수동 · "다시 시도" 필수
 *   progress 파랑 · ↻ · progress bar · 닫기 없음 · update()/close()
 *   undo     먹색 · ↺ · 5초 자동 · "실행 취소"
 *
 * desc 는 지시문 예시(<b>N건</b>)대로 HTML 허용 — 내부 카피 문자열만 사용(사용자 입력 주입 금지).
 */
import * as React from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export type LabToastAction = {
  label: string;
  primary?: boolean;
  onClick?: () => void;
  /** true 면 클릭해도 토스트 유지(기본은 클릭 시 닫힘) */
  keepOpen?: boolean;
};

type LabOpts = { actions?: LabToastAction[]; duration?: number };
type LabVariant = "success" | "warning" | "error" | "info" | "undo";

const DURATION: Record<LabVariant, number> = {
  success: 3000,
  undo: 5000,
  warning: Infinity, // 수동 닫힘
  error: Infinity,
  info: Infinity,
};

function htmlDesc(desc?: string): React.ReactNode {
  if (!desc) return undefined;
  return React.createElement("span", { dangerouslySetInnerHTML: { __html: desc } });
}

function actionEls(actions: LabToastAction[] | undefined, dismiss: () => void): React.ReactNode {
  if (!actions?.length) return undefined;
  return React.createElement(
    React.Fragment,
    null,
    ...actions.slice(0, 2).map((a, i) =>
      React.createElement(
        ToastAction,
        {
          key: i,
          altText: a.label,
          onClick: () => {
            a.onClick?.();
            if (!a.keepOpen) dismiss();
          },
          className: a.primary
            ? "bg-slate-900 text-white hover:bg-slate-800 border-slate-900"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
        },
        a.label,
      ),
    ),
  );
}

function make(variant: LabVariant, title: string, desc?: string, o?: LabOpts) {
  const t = toast({
    variant,
    title,
    description: htmlDesc(desc),
    duration: o?.duration ?? DURATION[variant],
  } as never);
  // dismiss 확보 후 action 주입(순환 회피).
  if (o?.actions?.length) {
    t.update({ id: t.id, action: actionEls(o.actions, t.dismiss) } as never);
  }
  return t;
}

export const labToast = {
  success: (title: string, desc?: string, o?: LabOpts) => make("success", title, desc, o),
  partial: (title: string, desc?: string, o?: LabOpts) => make("warning", title, desc, o),
  error: (title: string, desc?: string, o?: LabOpts) => make("error", title, desc, o),
  undo: (title: string, desc?: string, o?: LabOpts) => make("undo", title, desc, o),
  /** 진행률 토스트 — { update({title,desc,progress}), close() } 반환. */
  progress: (title: string, desc?: string, o?: { progress?: number }) => {
    const t = toast({
      variant: "info",
      title,
      description: htmlDesc(desc),
      duration: Infinity,
      progress: o?.progress ?? 0,
    } as never);
    return {
      update: (u: { title?: string; desc?: string; progress?: number }) =>
        t.update({
          id: t.id,
          ...(u.title !== undefined ? { title: u.title } : {}),
          ...(u.desc !== undefined ? { description: htmlDesc(u.desc) } : {}),
          ...(u.progress !== undefined ? { progress: u.progress } : {}),
        } as never),
      close: t.dismiss,
    };
  },
};
