"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, type LucideIcon } from "lucide-react";
import { AiDraftPreviewDialog } from "./ai-draft-preview-dialog";

interface AiActionButtonProps {
  label: string;
  icon?: LucideIcon;
  generateEndpoint: string;
  generatePayload: Record<string, unknown>;
  onApproved?: (result: Record<string, unknown>) => void;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
}

export function AiActionButton({
  label,
  icon: Icon,
  generateEndpoint,
  generatePayload,
  onApproved,
  variant = "outline",
  size = "sm",
  className,
  disabled,
}: AiActionButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    actionId: string;
    title: string;
    emailSubject: string;
    emailBody: string;
    metadata?: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch(generateEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generatePayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "생성 실패" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setPreviewData({
        actionId: data.actionId,
        title: data.preview?.title || label,
        emailSubject: data.preview?.emailSubject || "",
        emailBody: data.preview?.emailBody || "",
        metadata: {
          deliveryDate: data.preview?.suggestedDeliveryDate,
          vendorName: data.preview?.vendorName,
        },
      });
      setPreviewOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async (modified: { emailBody: string; emailSubject?: string }) => {
    if (!previewData) return;
    setIsApproving(true);

    try {
      const res = await fetch(`/api/ai-actions/${previewData.actionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            ...generatePayload,
            emailBody: modified.emailBody,
            emailSubject: modified.emailSubject,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "승인 실패" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      setPreviewOpen(false);
      setPreviewData(null);
      onApproved?.(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "승인 실패");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || isGenerating}
        onClick={handleGenerate}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : Icon ? (
          <Icon className="h-4 w-4 mr-1.5" />
        ) : null}
        {isGenerating ? "초안 생성 중..." : label}
      </Button>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {previewData && (
        <AiDraftPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={previewData.title}
          emailSubject={previewData.emailSubject}
          emailBody={previewData.emailBody}
          metadata={previewData.metadata as { vendorName?: string; deliveryDate?: string }}
          onApprove={handleApprove}
          isApproving={isApproving}
        />
      )}
    </>
  );
}
