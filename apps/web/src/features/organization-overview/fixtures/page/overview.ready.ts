/**
 * Organization Overview — Ready (정상 운영 상태)
 *
 * 검토 필요 항목, 비교 대기, 견적 준비, 승인 대기 등이 적당히 존재.
 * KPI가 모두 0이 아닌 실제 운영 플로우 상태.
 */
export const overviewReadyFixture = {
  state: "ready" as const,
  kpis: [
    { key: "reviewNeeded", title: "검토 필요", value: 9, description: "Step 1에서 확인이 필요한 항목입니다", statusLabel: "확인 필요", tone: "amber" },
    { key: "compareWaiting", title: "비교 확정 대기", value: 5, description: "후보 선택이 필요한 항목입니다", statusLabel: "처리 가능", tone: "blue" },
    { key: "quoteDraftReady", title: "견적 초안 제출 가능", value: 4, description: "Step 3에서 바로 제출할 수 있습니다", statusLabel: "즉시 처리 가능", tone: "green" },
    { key: "approvalPending", title: "승인 대기", value: 2, description: "검토 또는 제출 승인이 필요한 요청입니다", statusLabel: "대기 중", tone: "amber" },
    { key: "budgetWarning", title: "예산 확인 필요", value: 1, description: "제출 전 예산 검토가 필요한 항목입니다", statusLabel: "검토 필요", tone: "amber" },
    { key: "inventoryDuplicate", title: "재고 중복 가능", value: 2, description: "기존 재고와 중복 구매 가능성이 있습니다", statusLabel: "대조 필요", tone: "amber" },
    { key: "activeMembers", title: "활성 멤버", value: 7, description: "최근 작업이 있는 조직 멤버 수입니다", statusLabel: "운영 중", tone: "slate" },
    { key: "recentActivity", title: "최근 7일 활동", value: 34, description: "검토, 비교, 제출, 승인 이벤트 기준입니다", statusLabel: "활동 추적 중", tone: "slate" },
  ],
  stepFunnel: {
    stages: [
      { key: "step1", title: "검토 큐", count: 24, description: "입력 해석과 항목 검토가 진행 중입니다", subStatus: "검토 필요 9 · 실패 3", ctaLabel: "검토 큐 열기", linkHref: "/app/search" },
      { key: "step2", title: "비교 큐", count: 9, description: "후보 선택과 비교 확정이 필요한 항목입니다", subStatus: "선택 필요 5 · 확정 4", ctaLabel: "비교 큐 열기", linkHref: "/app/compare" },
      { key: "step3", title: "견적 초안", count: 6, description: "제출 전 수량·단위·예산을 확인할 수 있습니다", subStatus: "제출 가능 4 · 보류 2", ctaLabel: "견적 초안 열기", linkHref: "/app/quote" },
    ],
  },
  alerts: {
    isEmpty: false,
    items: [
      { id: "alert-1", severity: "warning", severityLabel: "주의", title: "예산 확인 필요", description: "제출 전 검토가 필요한 견적 초안 1건", ctaLabel: "예산 확인 항목 보기", linkHref: "/app/quote" },
      { id: "alert-2", severity: "warning", severityLabel: "주의", title: "재고 중복 가능", description: "기존 보유 재고와 대조가 필요한 항목 2건", ctaLabel: "재고 대조 항목 보기", linkHref: "/dashboard/inventory" },
    ],
  },
  workQueue: {
    isEmpty: false,
    sections: [
      { id: "ready", title: "즉시 승인 가능", count: 6, description: "검토가 끝나 바로 다음 단계로 보낼 수 있습니다", details: [{ label: "확정 가능", count: 6 }], ctaLabel: "승인 가능한 항목 보기", linkHref: "/app/search" },
      { id: "selection-needed", title: "후보 선택 필요", count: 5, description: "비교 후 선택 확정이 필요한 항목입니다", details: [{ label: "프로토콜 기반", count: 2 }, { label: "엑셀 기반", count: 3 }], ctaLabel: "비교 확정하러 가기", linkHref: "/app/compare" },
    ],
  },
  approvalInbox: {
    pendingCount: 2,
    pendingDescription: "구매 또는 운영 승인 후 진행할 수 있습니다",
    myRequestsCount: 1,
    myRequestsDescription: "현재 승인 대기 중입니다",
    recentDecisions: [
      { id: "dec-1", action: "프로토콜 기반 항목 2건 승인", state: "approved", stateLabel: "승인" },
    ],
  },
  activityFeed: {
    isEmpty: false,
    items: [
      { id: "ev-1", action: "5개 항목을 비교 큐로 전송했습니다", actor: "운영 담당자", timeFormatted: "30분 전" },
      { id: "ev-2", action: "3개 견적 초안을 제출 가능 상태로 변경했습니다", actor: "구매 담당자", timeFormatted: "1시간 전" },
      { id: "ev-3", action: "예산 확인 요청 1건을 승인했습니다", actor: "관리자", timeFormatted: "2시간 전" },
      { id: "ev-4", action: "엑셀 업로드 12행이 검토 큐에 추가됐습니다", actor: "연구원", timeFormatted: "3시간 전" },
    ],
  },
  quickLinks: [
    { label: "Step 1 검토 큐 열기", href: "/app/search" },
    { label: "Step 2 비교 큐 열기", href: "/app/compare" },
    { label: "Step 3 견적 초안 열기", href: "/app/quote" },
    { label: "승인 요청 보기", href: "/dashboard/settings" },
    { label: "멤버 및 접근 관리 보기", href: "/dashboard/organizations" },
    { label: "정책 및 설정 보기", href: "/dashboard/settings" },
  ],
  pageState: { isLoading: false, hasPartialError: false, errorBlocks: [] },
};
