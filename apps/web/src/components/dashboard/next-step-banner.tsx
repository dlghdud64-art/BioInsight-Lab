"use client";

/**
 * §dashboard-shifan-adopt P2 / §dashboard-shifan-fidelity — SystemInsight "다음 단계 추천" 배너
 *
 * 정본: 시안 dashboard.jsx SystemInsight + "다음단계 배너 구현 지시문"(호영님 2026-06-16).
 *
 * deriveInsight 우선순위(첫 매칭 반환 — 가장 시급한 신호 하나만, 거짓 "데이터 없음" 금지):
 *   1) 예산 미설정 → "예산을 등록하면 지출 추적이 시작됩니다" [예산 설정]
 *   2) 안전재고 미달 N건 → "재고 점검이 필요합니다" [재고 점검]
 *   3) 발송 대기 견적 N건 → "발송 대기 견적 N건이 있습니다" [견적 워크벤치]
 *   4) 정상 → "지금은 처리할 운영 신호가 없습니다" (CTA 없음)
 *
 * 표시 규율:
 *   - 데이터 기반 항상 노출(allEmpty self-gate 폐지 — 시안 정합, GlobalEmpty와 공존).
 *   - dismiss(localStorage "lab_insight_dismissed") — 세션 넘어 유지.
 *   - 위치: StatLine 바로 아래, grid-main 위.
 *
 * 시각(시안 정합): 3-stop 네이비→블루 그라데이션 + 우상단 광택 ::after + 콘텐츠 z-10.
 * presentational — summary는 summarySection 훅 주입(신규 fetch 0). dead button 0(CTA wired).
 */

import { useEffect, useState } from "react";
import { Wallet, Boxes, Send, CheckCircle2, ChevronRight, X } from "lucide-react";
import type { DashboardSummary } from "@/lib/dashboard/summary-derive";

export interface NextStepBannerProps {
  summary: DashboardSummary | undefined;
}

interface Insight {
  icon: typeof Wallet;
  eyebrow: string;
  title: string;
  desc: string;
  cta: { label: string; href: string } | null;
}

/** 데이터로 메시지 결정 — 우선순위대로 첫 매칭 반환. */
function deriveInsight(summary: DashboardSummary): Insight {
  const { budget, modules } = summary;
  const stockShort = modules.stock.lowStock ?? modules.stock.reorderNeeded ?? 0;
  const quoteOpen = modules.quote.total ?? 0;

  if (!budget.isSet) {
    return {
      icon: Wallet,
      eyebrow: "다음 단계 추천",
      title: "예산을 등록하면 지출 추적이 시작됩니다",
      desc: `${quoteOpen > 0 ? `견적 ${quoteOpen}건이 진행 중입니다. ` : ""}예산을 설정하면 발주·지출 소진율이 자동으로 집계돼요.`,
      cta: { label: "예산 설정", href: "/dashboard/budget" },
    };
  }
  if (budget.usageRate >= 100) {
    return {
      icon: Wallet,
      eyebrow: "확인 필요",
      title: "예산 한도를 초과했습니다",
      desc: `소진율 ${budget.usageRate.toFixed(0)}% — 추가 발주를 보류하고 예산을 점검하세요.`,
      cta: { label: "예산 관리", href: "/dashboard/budget" },
    };
  }
  if (stockShort > 0) {
    return {
      icon: Boxes,
      eyebrow: "확인 필요",
      title: `안전재고 미달 ${stockShort}건 — 재고 점검이 필요합니다`,
      desc: "실험 일정에 영향을 줄 수 있는 품목이 있습니다. 재주문 후보를 확인하세요.",
      cta: { label: "재고 점검", href: "/dashboard/inventory?filter=low" },
    };
  }
  if (quoteOpen > 0) {
    return {
      icon: Send,
      eyebrow: "처리 대기",
      title: `발송 대기 견적 ${quoteOpen}건이 있습니다`,
      desc: "워크벤치에서 견적을 발송하고 발주로 전환하세요.",
      cta: { label: "견적 워크벤치", href: "/dashboard/quotes" },
    };
  }
  return {
    icon: CheckCircle2,
    eyebrow: "정상",
    title: "지금은 처리할 운영 신호가 없습니다",
    desc: "새로운 신호가 생기면 이 자리에서 가장 먼저 안내해 드릴게요.",
    cta: null,
  };
}

export function NextStepBanner({ summary }: NextStepBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem("lab_insight_dismissed") === "1") setDismissed(true);
    } catch {
      /* localStorage 차단 환경 — 기본 노출 */
    }
  }, []);

  // 데이터 미도착/dismiss 시에만 미렌더. allEmpty 여도 노출(시안 정합 — 데이터 기반 인사이트).
  if (!summary || dismissed) return null;

  const ins = deriveInsight(summary);
  const Icon = ins.icon;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem("lab_insight_dismissed", "1");
    } catch {
      /* 차단 환경 — state만 */
    }
  };

  return (
    <div
      // §quotes-mobile-density 정합 — 견적 우선추천 카드와 동일한 thin inline 1행(navy 토큰 공유,
      //   룰베이스 next-action 배너 = 동일 역할 → 크기 일치). 3행 스택(~80px) → 단일 truncate 행(~52px).
      className="relative overflow-hidden rounded-[14px] px-3.5 py-2 text-white flex items-center gap-2.5"
      style={{
        background: "linear-gradient(100deg, #1b2b50 0%, #243a72 55%, #2f6be0 130%)",
        boxShadow: "0 6px 18px -8px rgba(20,38,80,.55)",
      }}
    >
      {/* 우상단 광택 레이어 — pointer-events-none, 콘텐츠 아래. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{ background: "radial-gradient(120% 180% at 92% 0%, rgba(255,255,255,0.10), transparent 60%)" }}
      />
      <Icon className="relative z-10 h-4 w-4 flex-none text-white" aria-hidden="true" />
      {/* eyebrow + 제목 + 설명 inline.
       *  §dashboard-mobile-refine P2 (호영님 2026-07-20) — 모바일은 문구가 잘리면 다음 행동을 못 읽으므로
       *  line-clamp-2 로 2줄 전문 노출(배너 높이 자동 확장). sm↑ 는 기존 thin 1행(truncate) 유지 →
       *  견적 PriorityRecommendationCard 와의 데스크탑 밀도 정합(§nextstep-banner-density) 보존.
       *  F5 판정(i): 모바일 한정 밀도 차는 역할 차이(대시보드=단일 배너 / 견적=리스트 즉시 노출)로 수용. */}
      <p className="relative z-10 min-w-0 flex-1 text-[12.5px] leading-snug line-clamp-2 sm:line-clamp-none sm:truncate [text-wrap:pretty]">
        <span className="mr-1.5 font-extrabold uppercase tracking-[0.09em] text-[10px]" style={{ color: "#a9c2f5" }}>
          {ins.eyebrow}
        </span>
        <b className="font-bold text-white">{ins.title}</b>
        <span style={{ color: "#c7d4ee" }}>{" — "}{ins.desc}</span>
      </p>
      {ins.cta && (
        <a
          href={ins.cta.href}
          className="relative z-10 inline-flex flex-none items-center gap-1 rounded-[11px] bg-white px-2.5 py-1.5 text-[12px] font-bold min-h-[44px] sm:min-h-0 transition-colors hover:bg-[#eef2fb]"
          style={{ color: "#1b2b50" }}
        >
          <span className="hidden sm:inline">{ins.cta.label}</span>
          <ChevronRight className="h-4 w-4" />
        </a>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="다음 단계 추천 닫기"
        className="relative z-10 inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg transition-colors hover:bg-white/[0.14] hover:text-white"
        style={{ color: "#b9c8e6" }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
