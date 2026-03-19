/**
 * Organization Overview — Empty (운영 작업 시작 전)
 *
 * 모든 큐가 비어 있고, 아직 검색/업로드가 없는 상태.
 * KPI 0, alerts/workQueue/approvalInbox/activityFeed 모두 empty.
 */
export const overviewEmptyFixture = {
  state: "empty" as const,
  kpis: [
    { key: "reviewNeeded", title: "검토 필요", value: 0, description: "Step 1에서 확인이 필요한 항목입니다", statusLabel: "정상", tone: "green" },
    { key: "compareWaiting", title: "비교 확정 대기", value: 0, description: "후보 선택이 필요한 항목입니다", statusLabel: "정상", tone: "green" },
    { key: "quoteDraftReady", title: "견적 초안 제출 가능", value: 0, description: "Step 3에서 바로 제출할 수 있습니다", statusLabel: "없음", tone: "slate" },
    { key: "approvalPending", title: "승인 대기", value: 0, description: "검토 또는 제출 승인이 필요한 요청입니다", statusLabel: "정상", tone: "green" },
    { key: "budgetWarning", title: "예산 확인 필요", value: 0, description: "제출 전 예산 검토가 필요한 항목입니다", statusLabel: "정상", tone: "green" },
    { key: "inventoryDuplicate", title: "재고 중복 가능", value: 0, description: "기존 재고와 중복 구매 가능성이 있습니다", statusLabel: "정상", tone: "green" },
    { key: "activeMembers", title: "활성 멤버", value: 1, description: "최근 작업이 있는 조직 멤버 수입니다", statusLabel: "운영 중", tone: "slate" },
    { key: "recentActivity", title: "최근 7일 활동", value: 0, description: "검토, 비교, 제출, 승인 이벤트 기준입니다", statusLabel: "활동 추적 중", tone: "slate" },
  ],
  stepFunnel: {
    stages: [
      { key: "step1", title: "검토 큐", count: 0, description: "입력 해석과 항목 검토가 진행 중입니다", subStatus: "검토 필요 0 · 실패 0", ctaLabel: "검토 큐 열기", linkHref: "/test/search" },
      { key: "step2", title: "비교 큐", count: 0, description: "후보 선택과 비교 확정이 필요한 항목입니다", subStatus: "선택 필요 0 · 확정 0", ctaLabel: "비교 큐 열기", linkHref: "/test/compare" },
      { key: "step3", title: "견적 초안", count: 0, description: "제출 전 수량·단위·예산을 확인할 수 있습니다", subStatus: "제출 가능 0 · 보류 0", ctaLabel: "견적 초안 열기", linkHref: "/test/quote" },
    ],
  },
  alerts: { isEmpty: true, items: [] },
  workQueue: { isEmpty: true, sections: [] },
  approvalInbox: { pendingCount: 0, pendingDescription: "현재 승인 대기 요청이 없습니다", myRequestsCount: 0, myRequestsDescription: "내가 요청한 승인이 없습니다", recentDecisions: [] },
  activityFeed: { isEmpty: true, items: [] },
  quickLinks: [
    { label: "Step 1 검토 큐 열기", href: "/test/search" },
    { label: "Step 2 비교 큐 열기", href: "/test/compare" },
    { label: "Step 3 견적 초안 열기", href: "/test/quote" },
    { label: "멤버 및 접근 관리 보기", href: "/dashboard/organizations" },
  ],
  pageState: { isLoading: false, hasPartialError: false, errorBlocks: [] },
};
