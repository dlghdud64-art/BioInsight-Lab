/** Alerts Block — Ready */
export const alertsReadyFixture = {
  state: "ready" as const,
  data: {
    items: [
      { id: "alert-budget", severity: "warning", severityLabel: "주의", title: "예산 확인 필요", description: "제출 전 검토가 필요한 견적 초안 2건", ctaLabel: "예산 확인 항목 보기", linkHref: "/test/quote" },
      { id: "alert-inventory", severity: "warning", severityLabel: "주의", title: "재고 중복 가능", description: "기존 보유 재고와 대조가 필요한 항목 3건", ctaLabel: "재고 대조 항목 보기", linkHref: "/dashboard/inventory" },
      { id: "alert-stale", severity: "urgent", severityLabel: "긴급", title: "승인 지연", description: "3일 이상 대기 중인 승인 요청 1건", ctaLabel: "승인 요청 보기", linkHref: "/dashboard/settings" },
    ],
  },
};
