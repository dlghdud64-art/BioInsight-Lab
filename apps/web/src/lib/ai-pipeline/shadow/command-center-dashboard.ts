// @ts-nocheck — shadow pipeline: experimental code, type-check deferred
/**
 * Command Center Dashboard — 리더십 액션 아이템 중심 뷰
 *
 * 기술 로그가 아닌 "지금 어디에 투자를 늘리고 어디를 차단할 것인가?"를
 * 묻는 Action Item 중심의 리더십 뷰 데이터를 제공합니다.
 */

import { getPortfolioMode } from "./expansion-policy";
import { getPendingDecisions } from "./executive-decision-matrix";

export type ActionItemPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ActionItemStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface ActionItem {
  priority: ActionItemPriority;
  title: string;
  description: string;
  owner: string | null;
  deadline: string | null;
  status: ActionItemStatus;
  category: "SAFETY" | "EXPANSION" | "BUDGET" | "COMPLIANCE" | "OPERATIONS";
}

export interface CommandCenterData {
  generatedAt: string;
  portfolioHealth: "GREEN" | "YELLOW" | "RED";
  portfolioMode: string;
  topActionItems: ActionItem[];
  activeSimulations: number;
  pendingDecisions: number;
  forecastSummary: {
    week1Bottleneck: string | null;
    week2Bottleneck: string | null;
    week4Bottleneck: string | null;
  };
  budgetUtilization: {
    totalBudget: number;
    used: number;
    remaining: number;
    utilizationPercent: number;
  };
  keyNumbers: {
    activeDocTypes: number;
    pendingPromotions: number;
    openIncidents: number;
    reviewBacklog: number;
    falseSafeThisWeek: number;
  };
}

/**
 * Command Center 데이터 생성
 */
export function getCommandCenterData(params: {
  activeDocTypes: number;
  pendingPromotions: number;
  openIncidents: number;
  reviewBacklog: number;
  falseSafeThisWeek: number;
  totalBudget: number;
  usedBudget: number;
  forecast?: {
    week1Bottleneck: string | null;
    week2Bottleneck: string | null;
    week4Bottleneck: string | null;
  };
}): CommandCenterData {
  const mode = getPortfolioMode();
  const pending = getPendingDecisions();

  // Auto-generate action items
  const actionItems: ActionItem[] = [];

  if (params.openIncidents > 0) {
    actionItems.push({
      priority: "CRITICAL",
      title: `미해결 인시던트 ${params.openIncidents}건`,
      description: "인시던트 해결 후 포트폴리오 모드 복구 검토",
      owner: null,
      deadline: null,
      status: "OPEN",
      category: "SAFETY",
    });
  }

  if (params.falseSafeThisWeek > 0) {
    actionItems.push({
      priority: "CRITICAL",
      title: `금주 False-safe ${params.falseSafeThisWeek}건 감지`,
      description: "Auto-verify 정책 강화 및 패턴 분석 필요",
      owner: null,
      deadline: null,
      status: "OPEN",
      category: "SAFETY",
    });
  }

  if (params.reviewBacklog > 50) {
    actionItems.push({
      priority: "HIGH",
      title: `리뷰 백로그 ${params.reviewBacklog}건 누적`,
      description: "리뷰어 증원 또는 승격 일시 중단 검토",
      owner: null,
      deadline: null,
      status: "OPEN",
      category: "OPERATIONS",
    });
  }

  if (params.pendingPromotions > 0) {
    actionItems.push({
      priority: "MEDIUM",
      title: `승격 대기 ${params.pendingPromotions}건`,
      description: "다음 Expansion Council에서 승격 순서 결정 필요",
      owner: null,
      deadline: null,
      status: "OPEN",
      category: "EXPANSION",
    });
  }

  const health = params.openIncidents > 0 || params.falseSafeThisWeek > 0
    ? "RED"
    : mode.current !== "NORMAL" || params.reviewBacklog > 50
      ? "YELLOW"
      : "GREEN";

  return {
    generatedAt: new Date().toISOString(),
    portfolioHealth: health,
    portfolioMode: mode.current,
    topActionItems: actionItems,
    activeSimulations: 0,
    pendingDecisions: pending.length,
    forecastSummary: params.forecast ?? { week1Bottleneck: null, week2Bottleneck: null, week4Bottleneck: null },
    budgetUtilization: {
      totalBudget: params.totalBudget,
      used: params.usedBudget,
      remaining: params.totalBudget - params.usedBudget,
      utilizationPercent: params.totalBudget > 0
        ? Math.round((params.usedBudget / params.totalBudget) * 100)
        : 0,
    },
    keyNumbers: {
      activeDocTypes: params.activeDocTypes,
      pendingPromotions: params.pendingPromotions,
      openIncidents: params.openIncidents,
      reviewBacklog: params.reviewBacklog,
      falseSafeThisWeek: params.falseSafeThisWeek,
    },
  };
}
