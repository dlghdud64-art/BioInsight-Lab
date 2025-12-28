"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";

export default function VendorLoginPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendLink = async () => {
    if (!email || !email.includes("@")) {
      toast({
        title: "오류",
        description: "올바른 이메일 주소를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSending(true);
      const response = await fetch("/api/vendor/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) throw new Error("Failed to send login link");

      toast({
        title: "로그인 링크 발송",
        description: "이메일로 로그인 링크를 발송했습니다. 메일함을 확인해주세요.",
      });
      setEmail("");
    } catch (error) {
      console.error("Send link error:", error);
      toast({
        title: "오류",
        description: "로그인 링크 발송에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            벤더 포털
          </h1>
          <p className="text-sm text-slate-600">
            견적 요청을 확인하고 회신하세요
          </p>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium">
                이메일 주소
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="vendor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSending) {
                    handleSendLink();
                  }
                }}
                className="mt-1"
              />
            </div>

            <Button
              onClick={handleSendLink}
              disabled={isSending}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  발송 중...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  로그인 링크 보내기
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              입력하신 이메일로 로그인 링크가 발송됩니다.
              <br />
              링크는 24시간 동안 유효합니다.
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            문의사항이 있으신가요?{" "}
            <a href="mailto:support@bioinsight.lab" className="text-blue-600 hover:underline">
              support@bioinsight.lab
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

