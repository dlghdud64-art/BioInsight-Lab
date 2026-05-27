"use client";

import { StepShell } from "../_components/step-shell";
import { AnalysisPanel } from "../_components/analysis-panel";

// AnalysisResults 컴포넌트가 없으므로 제거
export default function AnalysisPage() {
  return (
    <StepShell
      left={<AnalysisPanel />}
      right={<div className="p-4 text-sm text-slate-500">분석 결과가 여기에 표시됩니다.</div>}
    />
  );
}





