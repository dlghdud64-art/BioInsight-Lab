/** Organization Overview — Unavailable (플랜 제한 / 기능 비활성) */
export const overviewUnavailableFixture = {
  state: "unavailable" as const,
  title: "운영 허브를 사용할 수 없습니다",
  description: "조직 운영 허브는 Team 플랜 이상에서 사용할 수 있습니다.",
  primaryAction: { label: "플랜 업그레이드", href: "/pricing" },
  pageState: { isLoading: false, hasPartialError: false, errorBlocks: [] },
};
