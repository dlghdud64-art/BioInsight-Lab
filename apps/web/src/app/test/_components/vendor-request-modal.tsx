"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Loader2, Mail } from "lucide-react";

interface VendorRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId?: string;
  onSuccess?: () => void;
}

interface VendorInput {
  email: string;
  name?: string;
}

export function VendorRequestModal({
  open,
  onOpenChange,
  quoteId,
  onSuccess,
}: VendorRequestModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorInput[]>([{ email: "", name: "" }]);
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddVendor = () => {
    setVendors([...vendors, { email: "", name: "" }]);
  };

  const handleRemoveVendor = (index: number) => {
    if (vendors.length > 1) {
      setVendors(vendors.filter((_, i) => i !== index));
    }
  };

  const handleVendorChange = (index: number, field: keyof VendorInput, value: string) => {
    const newVendors = [...vendors];
    newVendors[index][field] = value;
    setVendors(newVendors);
  };

  const handleSubmit = async () => {
    // Validation
    const validVendors = vendors.filter((v) => v.email.trim() !== "");
    if (validVendors.length === 0) {
      toast({
        title: "벤더 이메일 필요",
        description: "최소 1개의 벤더 이메일을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validVendors.filter((v) => !emailRegex.test(v.email));
    if (invalidEmails.length > 0) {
      toast({
        title: "이메일 형식 오류",
        description: "올바른 이메일 주소를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!quoteId) {
      toast({
        title: "견적 ID 없음",
        description: "견적을 먼저 저장해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/quotes/${quoteId}/vendor-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendors: validVendors,
          message: message.trim() || undefined,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청 전송에 실패했습니다.");
      }

      const result = await response.json();

      toast({
        title: "견적 요청 전송 완료",
        description: `${result.sent}개 벤더에게 견적 요청이 전송되었습니다.`,
      });

      // Reset form
      setVendors([{ email: "", name: "" }]);
      setMessage("");
      setExpiresInDays(14);

      // Close modal
      onOpenChange(false);

      // Callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "견적 요청 전송 실패",
        description: error.message || "견적 요청을 전송할 수 없습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            견적 요청 보내기
          </DialogTitle>
          <DialogDescription>
            벤더에게 이메일로 견적 요청을 전송합니다. 벤더는 로그인 없이 견적을 제출할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Vendors */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">벤더 정보</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddVendor}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                벤더 추가
              </Button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {vendors.map((vendor, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {index + 1}
                      </Badge>
                      <Input
                        type="email"
                        placeholder="벤더 이메일 (필수)"
                        value={vendor.email}
                        onChange={(e) => handleVendorChange(index, "email", e.target.value)}
                        className="h-8 text-sm flex-1"
                      />
                    </div>
                    <Input
                      type="text"
                      placeholder="벤더명 (선택)"
                      value={vendor.name || ""}
                      onChange={(e) => handleVendorChange(index, "name", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  {vendors.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveVendor(index)}
                      className="h-8 w-8 text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="vendor-message" className="text-sm font-semibold">
              요청 메시지 (선택)
            </Label>
            <Textarea
              id="vendor-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="벤더에게 전달할 메시지를 입력하세요."
              className="text-sm min-h-[100px]"
            />
            <p className="text-xs text-slate-500">
              메시지는 이메일과 함께 벤더에게 전달됩니다.
            </p>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expires-in-days" className="text-sm font-semibold">
              회신 마감일
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="expires-in-days"
                type="number"
                min="1"
                max="365"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 14)}
                className="h-8 text-sm w-24"
              />
              <span className="text-sm text-slate-600">일 후</span>
            </div>
            <p className="text-xs text-slate-500">
              {expiresInDays}일 후에 견적 회신이 마감됩니다.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                견적 요청 보내기
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
