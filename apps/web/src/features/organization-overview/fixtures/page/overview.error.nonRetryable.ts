/** Organization Overview — Error NonRetryable (권한 없음 / 삭제된 조직) */
export const overviewErrorNonRetryableFixture = {
  state: "error" as const,
  error: { code: "FORBIDDEN", message: "이 조직의 운영 데이터에 접근할 권한이 없습니다." },
  isRetryable: false,
  pageState: { isLoading: false, hasPartialError: false, errorBlocks: [] },
};
