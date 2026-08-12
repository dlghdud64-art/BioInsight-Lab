"use client";

import { Suspense } from "react";
import { VendorPortalBoard } from "./_components/board";

export const dynamic = "force-dynamic";

export default function VendorPortalPage() {
  return (
    <Suspense fallback={<div className="h-40 rounded-lg bg-slate-100 animate-pulse" />}>
      <VendorPortalBoard />
    </Suspense>
  );
}
