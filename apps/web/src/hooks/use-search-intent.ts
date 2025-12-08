import { useMutation } from "@tanstack/react-query";

export function useSearchIntent() {
  return useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/search/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze search intent");
      }

      return response.json();
    },
  });
}




export function useSearchIntent() {
  return useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/search/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze search intent");
      }

      return response.json();
    },
  });
}




export function useSearchIntent() {
  return useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/search/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze search intent");
      }

      return response.json();
    },
  });
}





