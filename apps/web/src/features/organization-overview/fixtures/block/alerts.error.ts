/** Alerts Block — Error */
export const alertsErrorFixture = {
  state: "error" as const,
  error: { code: "FETCH_FAILED", message: "운영 경고를 불러오지 못했습니다" },
  isRetryable: true,
};
