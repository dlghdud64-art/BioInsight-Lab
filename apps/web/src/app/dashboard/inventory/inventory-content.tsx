"use client";

import { Suspense } from "react";
import { Package } from "lucide-react";
import dynamic from "next/dynamic";

// Block A: 전체 본문 — dynamic import로 분리하여 별도 chunk 생성
const InventoryMain = dynamic(
  () => import("./inventory-main").then((m) => m.InventoryMain),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-full px-4 md:px-6 py-6 md:py-8 space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded bg-el" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-el" />
          ))}
        </div>
        <div className="h-96 rounded-xl bg-el" />
      </div>
    ),
  }
);

export function InventoryContent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <InventoryMain />
    </Suspense>
  );
}
