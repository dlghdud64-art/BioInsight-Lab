"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Headphones, Phone, Mail, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SupportPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title.trim() || !body.trim()) {
      toast({
        title: "입력해주세요",
        description: "문의 유형, 제목, 내용을 모두 입력해 주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast({
      title: "문의가 접수되었습니다",
      description: "담당자가 확인 후 연락드리겠습니다.",
    });
    setCategory("");
    setTitle("");
    setBody("");
    setIsSubmitting(false);
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col space-y-2 mb-8">
        <h2 className="text-3xl font-bold tracking-tight">1:1 문의하기 🎧</h2>
        <p className="text-muted-foreground">
          궁금한 점이 있으시면 문의 유형과 내용을 남겨 주시면 빠르게 답변드립니다.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* 왼쪽: 문의 폼 */}
        <div className="lg:col-span-3">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Headphones className="h-5 w-5 text-blue-600" />
                문의 작성
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">문의 유형</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="유형을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quote">견적·발주</SelectItem>
                      <SelectItem value="product">제품·검색</SelectItem>
                      <SelectItem value="account">계정·조직</SelectItem>
                      <SelectItem value="billing">결제·세금</SelectItem>
                      <SelectItem value="etc">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">제목</Label>
                  <Input
                    id="title"
                    placeholder="문의 제목을 입력하세요"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">내용</Label>
                  <Textarea
                    id="body"
                    placeholder="문의 내용을 자세히 적어 주세요."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="min-h-[160px] resize-none border-slate-200"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "접수 중..." : "문의 접수하기"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 고객센터 안내 */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 h-fit">
            <CardHeader>
              <CardTitle className="text-lg">고객센터 연락처</CardTitle>
              <p className="text-sm text-muted-foreground">
                전화·이메일로도 문의하실 수 있습니다.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-slate-100 p-2">
                  <Phone className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">전화</p>
                  <p className="text-sm text-slate-600">1544-XXXX</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-slate-100 p-2">
                  <Mail className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">이메일</p>
                  <p className="text-sm text-slate-600 break-all">
                    support@bioinsight-lab.com
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-slate-100 p-2">
                  <Clock className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">운영시간</p>
                  <p className="text-sm text-slate-600">
                    평일 09:00–18:00 (주말·공휴일 휴무)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
