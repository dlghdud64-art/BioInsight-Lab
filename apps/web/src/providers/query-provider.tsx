"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 60 * 1000, // 10 minutes (성능 최적화 - 증가)
            gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime - 증가)
            refetchOnWindowFocus: false,
            refetchOnMount: false, // 캐시된 데이터가 있으면 재요청하지 않음
            retry: (failureCount, error: any) => {
              // 4xx 에러는 재시도하지 않음
              if (error?.status >= 400 && error?.status < 500) {
                return false;
              }
              // 최대 1번 재시도
              return failureCount < 1;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}