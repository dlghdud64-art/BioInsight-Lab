"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, X } from "lucide-react";

interface AiDraftPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  emailSubject?: string;
  emailBody: string;
  metadata?: {
    vendorName?: string;
    itemCount?: number;
    deliveryDate?: string;
  };
  onApprove: (modifiedPayload: { emailBody: string; emailSubject?: string }) => void;
  isApproving?: boolean;
}

export function AiDraftPreviewDialog({
  open,
  onOpenChange,
  title,
  emailSubject,
  emailBody,
  metadata,
  onApprove,
  isApproving,
}: AiDraftPreviewDialogProps) {
  const [editedBody, setEditedBody] = useState(emailBody);
  const [editedSubject, setEditedSubject] = useState(emailSubject || "");

  // emailBody가 변경되면 초기화
  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setEditedBody(emailBody);
      setEditedSubject(emailSubject || "");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 메타데이터 */}
          {metadata && (
            <div className="flex flex-wrap gap-2">
              {metadata.vendorName && (
                <Badge variant="outline" className="text-xs">
                  {metadata.vendorName}
                </Badge>
              )}
              {metadata.itemCount && (
                <Badge variant="outline" className="text-xs">
                  {metadata.itemCount}건
                </Badge>
              )}
              {metadata.deliveryDate && (
                <Badge variant="outline" className="text-xs">
                  납기 {metadata.deliveryDate}
                </Badge>
              )}
            </div>
          )}

          {/* 이메일 제목 */}
          {emailSubject !== undefined && (
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
                제목
              </label>
              <input
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#333338] rounded-lg bg-white dark:bg-[#1a1a1e] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 이메일 본문 */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              본문
            </label>
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              rows={14}
              className="text-sm font-mono resize-y"
            />
          </div>

          <p className="text-[11px] text-slate-400 text-slate-500">
            내용을 수정한 뒤 승인할 수 있습니다. 승인 후에는 되돌릴 수 없습니다.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isApproving}
          >
            <X className="h-4 w-4 mr-1" />
            취소
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onApprove({
                emailBody: editedBody,
                emailSubject: editedSubject || undefined,
              })
            }
            disabled={isApproving || !editedBody.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            승인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
