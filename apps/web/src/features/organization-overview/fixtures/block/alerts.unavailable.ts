/** Alerts Block — Unavailable */
export const alertsUnavailableFixture = {
  state: "unavailable" as const,
  title: "운영 경고 기능을 사용할 수 없습니다",
  description: "이 기능은 Business 플랜 이상에서 제공됩니다.",
  primaryAction: { label: "플랜 업그레이드", href: "/pricing" },
};
