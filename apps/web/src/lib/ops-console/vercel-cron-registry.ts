export type VercelCronEnvironment = "prod-only";

export type VercelCronRegistryEntry = {
  path: string;
  schedule: string;
  scheduleKst: string;
  purposeKo: string;
  environment: VercelCronEnvironment;
  runBoundaryKo: string;
  manualGateKo: string;
  operatorCheckKo: string;
  expectedResultKo: string;
};

export const VERCEL_CRON_REGISTRY: readonly VercelCronRegistryEntry[] = [
  {
    path: "/api/cron/dashboard-snapshot",
    schedule: "0 0 * * *",
    scheduleKst: "매일 09:00 KST",
    purposeKo: "대시보드 KPI 스냅샷을 조직별로 1회 적재합니다.",
    environment: "prod-only",
    runBoundaryKo: "Vercel production deployment에서만 자동 실행합니다. preview/local은 수동 검증만 허용합니다.",
    manualGateKo: "배포 전 vercel.json diff와 Vercel Cron 등록 화면을 확인하고, 이상 시 Vercel Dashboard에서 cron을 중지하거나 CRON_SECRET을 회전합니다.",
    operatorCheckKo: "최근 실행 결과 1건과 snapshot 저장 건수를 확인합니다.",
    expectedResultKo: "조직별 dashboard snapshot 1회 생성",
  },
  {
    path: "/api/cron/user-soft-delete-purge",
    schedule: "0 2 * * *",
    scheduleKst: "매일 11:00 KST",
    purposeKo: "30일 경과 soft-deleted 사용자를 hard purge하고 audit을 남깁니다.",
    environment: "prod-only",
    runBoundaryKo: "Vercel production deployment에서만 자동 실행합니다. preview/local은 수동 검증만 허용합니다.",
    manualGateKo: "운영자가 삭제 후보 수와 audit 보존 조건을 확인한 뒤 배포하며, 이상 시 Vercel Dashboard에서 cron을 중지하거나 CRON_SECRET을 회전합니다.",
    operatorCheckKo: "purgedCount, failedCount, audit USER_DELETED 기록을 확인합니다.",
    expectedResultKo: "30일 경과 삭제 사용자 purge 1회 처리",
  },
  {
    path: "/api/cron/inventory-check",
    schedule: "0 8 * * *",
    scheduleKst: "매일 17:00 KST",
    purposeKo: "만료 임박 및 부족 재고를 감지해 INVENTORY_LOW/EXPIRING 알림을 만듭니다.",
    environment: "prod-only",
    runBoundaryKo: "Vercel production deployment에서만 자동 실행합니다. preview/local은 수동 검증만 허용합니다.",
    manualGateKo: "운영자가 재고 알림 대상과 알림 중복 여부를 확인한 뒤 배포하며, 이상 시 Vercel Dashboard에서 cron을 중지하거나 CRON_SECRET을 회전합니다.",
    operatorCheckKo: "감지된 재고 이슈 수와 생성된 알림 이벤트 수를 확인합니다.",
    expectedResultKo: "재고 부족/만료 임박 알림 생성",
  },
  {
    path: "/api/cron/order-followup-check",
    schedule: "0 9 * * *",
    scheduleKst: "매일 18:00 KST",
    purposeKo: "회신 지연 주문을 감지해 follow-up 작업을 만듭니다.",
    environment: "prod-only",
    runBoundaryKo: "Vercel production deployment에서만 자동 실행합니다. preview/local은 수동 검증만 허용합니다.",
    manualGateKo: "운영자가 follow-up 후보와 중복 작업 여부를 확인한 뒤 배포하며, 이상 시 Vercel Dashboard에서 cron을 중지하거나 CRON_SECRET을 회전합니다.",
    operatorCheckKo: "생성된 follow-up 작업 수와 skipped duplicate 수를 확인합니다.",
    expectedResultKo: "지연 주문 follow-up 1회 감지",
  },
  {
    path: "/api/cron/quote-expiry-check",
    schedule: "0 10 * * *",
    scheduleKst: "매일 19:00 KST",
    purposeKo: "유효기간이 지난 견적을 감지해 QUOTE_EXPIRED 알림을 만듭니다.",
    environment: "prod-only",
    runBoundaryKo: "Vercel production deployment에서만 자동 실행합니다. preview/local은 수동 검증만 허용합니다.",
    manualGateKo: "운영자가 만료 후보와 NotificationEvent 중복 여부를 확인한 뒤 배포하며, 이상 시 Vercel Dashboard에서 cron을 중지하거나 CRON_SECRET을 회전합니다.",
    operatorCheckKo: "notified, skippedDuplicate, errors 값을 확인합니다.",
    expectedResultKo: "만료 견적 알림 1회 감지",
  },
] as const;

export function getVercelCronRegistryEntry(path: string) {
  return VERCEL_CRON_REGISTRY.find((entry) => entry.path === path);
}
