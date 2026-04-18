/** Organization Overview — Error Retryable (일시적 네트워크/서버 오류) */
export const overviewErrorRetryableFixture = {
  state: "error" as const,
  error: { code: "NETWORK_TIMEOUT", message: "운영 데이터를 불러오지 못했습니다. 네트워크 상태를 확인해주세요." },
  isRetryable: true,
  pageState: { isLoading: false, hasPartialError: true, errorBlocks: ["alerts", "workQueue", "approvalInbox", "activityFeed"] },
};
