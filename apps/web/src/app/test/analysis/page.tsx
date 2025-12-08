"use client";

import { StepShell } from "../_components/step-shell";
import { AnalysisPanel, AnalysisResults } from "../_components/analysis-panel";

export default function AnalysisPage() {
  return (
    <StepShell
      left={<AnalysisPanel />}
      right={<AnalysisResults />}
    />
  );
}





