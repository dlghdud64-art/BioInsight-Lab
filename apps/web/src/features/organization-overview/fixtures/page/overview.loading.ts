/** Organization Overview — Loading (데이터 로딩 중) */
export const overviewLoadingFixture = {
  state: "loading" as const,
  pageState: { isLoading: true, hasPartialError: false, errorBlocks: [] },
};
