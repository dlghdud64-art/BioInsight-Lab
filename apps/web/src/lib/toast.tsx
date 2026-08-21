"use client";

/**
 * §global-toast(호영님 2026-08-21) — sonner 흡수 어댑터.
 *   기존 sonner 호출부(toast.success/error/info/warning(msg, opts))를
 *   전역 shadcn 토스트(카드 문법)로 라우팅한다. SonnerToaster 는 layout 에서 제거됨.
 *   opts: { description?, duration?, action?: { label, onClick } } — sonner 시그니처 호환.
 */

import * as React from "react";
import { toast as baseToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

type SonnerLikeOpts = {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type Variant = "success" | "error" | "info" | "warning";

function fire(variant: Variant, message: string, opts?: SonnerLikeOpts) {
  return baseToast({
    title: message,
    description: opts?.description,
    duration: opts?.duration,
    variant,
    action: opts?.action
      ? React.createElement(
          ToastAction,
          { altText: opts.action.label, onClick: opts.action.onClick },
          opts.action.label
        )
      : undefined,
  } as Parameters<typeof baseToast>[0]);
}

export const toast = {
  success: (m: string, o?: SonnerLikeOpts) => fire("success", m, o),
  error: (m: string, o?: SonnerLikeOpts) => fire("error", m, o),
  info: (m: string, o?: SonnerLikeOpts) => fire("info", m, o),
  warning: (m: string, o?: SonnerLikeOpts) => fire("warning", m, o),
};
