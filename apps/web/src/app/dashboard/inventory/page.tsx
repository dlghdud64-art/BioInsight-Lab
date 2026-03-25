"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const InventoryContent = dynamic(
  () => import("./inventory-content").then((m) => m.InventoryContent),
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

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryContent />
    </Suspense>
  );
}
