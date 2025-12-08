"use client";

import { ReactNode } from "react";

interface StepShellProps {
  left: ReactNode;
  right: ReactNode;
}

export function StepShell({ left, right }: StepShellProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px),minmax(0,1fr)]">
      <aside className="space-y-4">{left}</aside>
      <section className="space-y-4">{right}</section>
    </div>
  );
}





