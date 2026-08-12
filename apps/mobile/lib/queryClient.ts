import { QueryClient, MutationCache, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { Sentry } from "./sentry";

// React Query <-> NetInfo 연동: 오프라인 시 자동 pause, 온라인 복귀 시 자동 refetch
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2분
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      // 모든 mutation 에러를 Sentry에 자동 보고
      Sentry.captureException(error);
    },
  }),
});
