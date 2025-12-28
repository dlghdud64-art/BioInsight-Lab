// 플랜별 기능 제한 및 권한 관리

export enum SubscriptionPlan {
  FREE = "FREE",
  TEAM = "TEAM",
  ORGANIZATION = "ORGANIZATION",
}

export interface PlanLimits {
  maxMembers: number | null;
  maxQuotesPerMonth: number | null;
  maxSharedLinks: number | null;
  features: {
    exportPack: boolean;
    advancedReports: boolean;
    budgetManagement: boolean;
    autoReorder: boolean;
    vendorPortal: boolean;
    inboundEmail: boolean;
    sso: boolean;
    onPremise: boolean;
    prioritySupport: boolean;
  };
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.FREE]: {
    maxMembers: 3,
    maxQuotesPerMonth: 10,
    maxSharedLinks: 5,
    features: {
      exportPack: false,
      advancedReports: false,
      budgetManagement: false,
      autoReorder: false,
      vendorPortal: false,
      inboundEmail: false,
      sso: false,
      onPremise: false,
      prioritySupport: false,
    },
  },
  [SubscriptionPlan.TEAM]: {
    maxMembers: 20,
    maxQuotesPerMonth: 100,
    maxSharedLinks: 50,
    features: {
      exportPack: true,
      advancedReports: true,
      budgetManagement: true,
      autoReorder: true,
      vendorPortal: false,
      inboundEmail: true,
      sso: false,
      onPremise: false,
      prioritySupport: false,
    },
  },
  [SubscriptionPlan.ORGANIZATION]: {
    maxMembers: null, // 무제한
    maxQuotesPerMonth: null, // 무제한
    maxSharedLinks: null, // 무제한
    features: {
      exportPack: true,
      advancedReports: true,
      budgetManagement: true,
      autoReorder: true,
      vendorPortal: true,
      inboundEmail: true,
      sso: true,
      onPremise: true,
      prioritySupport: true,
    },
  },
};

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS[SubscriptionPlan.FREE];
}

