"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const InventoryMain = dynamic(
  () => import("./inventory-main").then((m) => m.InventoryMain),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 md:p-8 space-y-4 animate-pulse">
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
    <Suspense fallback={null}>
      <InventoryMain />
    </Suspense>
  );
}
