import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export function useTrackBehavior() {
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (data: {
      action: "click" | "compare_add" | "compare_remove" | "quote_add" | "favorite_add" | "favorite_remove";
      productId: string;
      metadata?: Record<string, any>;
    }) => {
      if (!session?.user?.id) {
        return; // 비로그인 사용자는 추적하지 않음
      }

      const response = await fetch("/api/analytics/user-behavior", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to track behavior");
      }

      return response.json();
    },
  });
}