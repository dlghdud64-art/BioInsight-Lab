"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LifeBuoy,
  Send,
  Loader2,
  Search,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Settings,
  Paperclip,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  X,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FEATURE_CATEGORIES = [
  { value: "search", label: "시약·장비 검색", icon: Search, color: "text-slate-400 bg-[#23262b]" },
  { value: "quote", label: "견적 요청·비교", icon: ShoppingCart, color: "text-slate-400 bg-[#23262b]" },
  { value: "inventory", label: "재고 관리", icon: Package, color: "text-slate-400 bg-[#23262b]" },
  { value: "purchase", label: "구매 운영·이력", icon: BarChart3, color: "text-slate-400 bg-[#23262b]" },
  { value: "team", label: "팀·조직 관리", icon: Users, color: "text-slate-400 bg-[#23262b]" },
  { value: "account", label: "계정·결제", icon: Settings, color: "text-slate-400 bg-[#23262b]" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "낮음", description: "일반 문의, 기능 개선 제안" },
  { value: "medium", label: "보통", description: "사용 중 불편 사항" },
  { value: "high", label: "높음", description: "업무 진행 차단 이슈" },
];

// 임시 문의 이력 (추후 API 연동)
const MOCK_TICKETS = [
  {
    id: "TK-001",
    title: "견적 요청 메일이 벤더에게 전송되지 않습니다",
    category: "quote",
    status: "answered",
    createdAt: "2026-03-08",
    answeredAt: "2026-03-09",
  },
  {
    id: "TK-002",
    title: "CSV 업로드 시 일부 행이 누락됩니다",
    category: "purchase",
    status: "in_progress",
    createdAt: "2026-03-10",
    answeredAt: null,
  },
];

export default function DashboardSupportPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [category, setCategory] = useState("");
  const [relatedResource, setRelatedResource] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("medium");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files).filter((f) => f.size <= 10 * 1024 * 1024);
    setAttachments((prev) => [...prev, ...newFiles].slice(0, 5));
    e.target.value = "";
  };

  const handleRemoveFile = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title.trim() || !body.trim()) {
      toast({
        title: "필수 항목을 입력해주세요",
        description: "관련 기능, 제목, 내용을 모두 입력해 주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast({
      title: "문의가 접수되었습니다",
      description: "담당자가 확인 후 답변드리겠습니다. 이력에서 상태를 확인할 수 있습니다.",
    });
    setCategory("");
    setRelatedResource("");
    setTitle("");
    setBody("");
    setPriority("medium");
    setAttachments([]);
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-700/60 text-slate-500 bg-transparent gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500/60 inline-block" />접수 대기
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/25 text-blue-400 bg-blue-500/[0.06] gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />확인 중
          </Badge>
        );
      case "answered":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/25 text-emerald-400 bg-emerald-500/[0.06] gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />답변 완료
          </Badge>
        );
      default:
        return null;
    }
  };

  const getCategoryLabel = (val: string) => {
    return FEATURE_CATEGORIES.find((c) => c.value === val)?.label || val;
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 max-w-5xl mx-auto w-full">
      {/* ── 페이지 헤더 ── */}
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          운영 지원 센터
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          사용 중 발생한 이슈나 기능 관련 문의를 남겨주세요. 관련 주문·견적·재고 정보를 함께 전달하면 더 빠르게 처리됩니다.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── 좌측: 문의 작성 ── */}
        <div className="space-y-5">
          <div className="rounded-xl border border-[#2c2f35] bg-[#1c1e22] shadow-sm">
            <div className="px-5 py-4 border-b border-[#2c2f35]">
              <h2 className="text-[15px] font-semibold text-slate-100 flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-slate-400" />
                문의 작성
              </h2>
            </div>
            <div className="px-5 py-5">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 관련 기능 선택 */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-slate-200">
                    관련 기능 <span className="text-red-400/80 text-[10px]">필수</span>
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FEATURE_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(cat.value)}
                          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all ${
                            isSelected
                              ? "border-blue-500/50 bg-blue-500/[0.08] ring-1 ring-blue-500/30"
                              : "border-[#2c2f35] bg-[#22252a] hover:border-[#3a3d44] hover:bg-[#282b31]"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "bg-blue-600/20" : cat.color
                          }`}>
                            <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-blue-400" : ""}`} />
                          </div>
                          <span className={`text-xs font-medium ${isSelected ? "text-blue-300" : "text-slate-300"}`}>
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 관련 리소스 연결 */}
                <div className="space-y-2">
                  <Label htmlFor="related-resource" className="text-xs font-semibold text-slate-200">
                    관련 주문/견적/재고 ID <span className="text-slate-500 font-normal text-[10px]">(선택)</span>
                  </Label>
                  <Input
                    id="related-resource"
                    placeholder="예: QT-20260310-001, 주문번호, 재고 품목명 등"
                    value={relatedResource}
                    onChange={(e) => setRelatedResource(e.target.value)}
                    className="border-[#2c2f35] bg-[#282b31] text-sm text-slate-200 h-10 placeholder:text-slate-500 focus:border-blue-500/40 focus:bg-[#2c2f35]"
                  />
                  <p className="text-[11px] text-slate-500">관련 건을 연결하면 담당자가 더 빠르게 확인할 수 있습니다.</p>
                </div>

                {/* 우선순위 */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-slate-200">우선순위</Label>
                  <div className="flex gap-2">
                    {PRIORITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPriority(opt.value)}
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition-all ${
                          priority === opt.value
                            ? opt.value === "high"
                              ? "border-red-500/30 bg-red-500/[0.06] ring-1 ring-red-500/20"
                              : opt.value === "medium"
                              ? "border-amber-500/30 bg-amber-500/[0.06] ring-1 ring-amber-500/20"
                              : "border-blue-500/30 bg-blue-500/[0.06] ring-1 ring-blue-500/20"
                            : "border-[#2c2f35] bg-[#22252a] hover:bg-[#282b31]"
                        }`}
                      >
                        <span className={`text-xs font-semibold ${
                          priority === opt.value
                            ? opt.value === "high" ? "text-red-400" : opt.value === "medium" ? "text-amber-400" : "text-blue-400"
                            : "text-slate-400"
                        }`}>{opt.label}</span>
                        <p className={`text-[10px] mt-0.5 ${priority === opt.value ? "text-slate-400" : "text-slate-600"}`}>{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 제목 */}
                <div className="space-y-2">
                  <Label htmlFor="ticket-title" className="text-xs font-semibold text-slate-200">
                    제목 <span className="text-red-400/80 text-[10px]">필수</span>
                  </Label>
                  <Input
                    id="ticket-title"
                    placeholder="이슈를 간단히 요약해주세요"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border-[#2c2f35] bg-[#282b31] text-sm text-slate-200 h-10 placeholder:text-slate-500 focus:border-blue-500/40 focus:bg-[#2c2f35]"
                  />
                </div>

                {/* 내용 */}
                <div className="space-y-2">
                  <Label htmlFor="ticket-body" className="text-xs font-semibold text-slate-200">
                    상세 내용 <span className="text-red-400/80 text-[10px]">필수</span>
                  </Label>
                  <Textarea
                    id="ticket-body"
                    placeholder="문제 상황, 재현 방법, 기대 동작 등을 구체적으로 적어주세요."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="min-h-[160px] resize-none border-[#2c2f35] bg-[#282b31] text-sm text-slate-200 leading-relaxed p-4 placeholder:text-slate-500 focus:border-blue-500/40 focus:bg-[#2c2f35]"
                  />
                </div>

                {/* 첨부파일 */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-200">
                    첨부파일 <span className="text-slate-500 font-normal text-[10px]">(선택, 최대 5개)</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 rounded-md border border-[#2c2f35] bg-[#22252a] px-2.5 py-1.5 text-xs text-slate-300">
                        <FileText className="h-3 w-3 text-slate-500" />
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-500">({(file.size / 1024).toFixed(0)}KB)</span>
                        <button type="button" onClick={() => handleRemoveFile(idx)} className="text-slate-500 hover:text-red-400 ml-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {attachments.length < 5 && (
                      <label className="flex items-center gap-1.5 rounded-md border border-dashed border-[#3a3d44] bg-[#22252a] px-3 py-1.5 text-xs text-slate-500 hover:border-slate-500 hover:text-slate-400 cursor-pointer transition-colors">
                        <Paperclip className="h-3 w-3" />
                        파일 추가
                        <input type="file" className="hidden" onChange={handleFileAdd} multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv" />
                      </label>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600">PDF, 이미지, 엑셀 파일 · 파일당 최대 10MB</p>
                </div>

                {/* 제출 */}
                <div className="pt-3 border-t border-[#2c2f35]">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold h-10 px-6 gap-2 text-sm"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />접수 중...</>
                    ) : (
                      <><Send className="h-4 w-4" />문의 접수하기</>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ── 우측: 문의 이력 + 안내 ── */}
        <div className="space-y-5">
          {/* 문의 이력 */}
          <div className="rounded-xl border border-[#2c2f35] bg-[#1a1c20] shadow-sm">
            <div className="px-4 py-3 border-b border-[#2c2f35] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                내 문의 이력
              </h3>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-[11px] text-slate-500 hover:text-slate-300 font-medium transition-colors"
              >
                {showHistory ? "접기" : "전체 보기"}
              </button>
            </div>
            <div className="px-4 py-3">
              <div className="space-y-2">
                {MOCK_TICKETS.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-lg border border-[#2c2f35] bg-[#22252a] px-3.5 py-3 hover:bg-[#282b31] transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono text-slate-600">{ticket.id}</span>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <p className="text-[13px] font-medium text-slate-200 leading-snug mb-2">{ticket.title}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {ticket.createdAt}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span>{getCategoryLabel(ticket.category)}</span>
                    </div>
                    {ticket.status === "answered" && (
                      <div className="mt-2.5 pt-2 border-t border-[#2c2f35] flex items-center gap-1.5 text-[11px] text-emerald-400/80 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        {ticket.answeredAt} 답변 완료
                        <ChevronRight className="h-3 w-3 ml-auto text-slate-600" />
                      </div>
                    )}
                    {ticket.status === "in_progress" && (
                      <div className="mt-2.5 pt-2 border-t border-[#2c2f35] flex items-center gap-1.5 text-[11px] text-blue-400/80 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        담당자 확인 중
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!showHistory && MOCK_TICKETS.length > 2 && (
                <p className="text-[11px] text-slate-600 text-center mt-3">
                  외 {MOCK_TICKETS.length - 2}건 더보기
                </p>
              )}
            </div>
          </div>

          {/* 운영 안내 */}
          <div className="rounded-xl border border-[#2c2f35] bg-[#1a1c20] shadow-sm">
            <div className="px-4 py-3 border-b border-[#2c2f35]">
              <h3 className="text-sm font-semibold text-slate-200">지원 안내</h3>
            </div>
            <div className="px-4 py-3 space-y-3.5">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#23262b] flex items-center justify-center flex-shrink-0">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300">응답 시간</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">평일 09:00–18:00 접수 기준, 당일 내 1차 확인</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#23262b] flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300">처리 프로세스</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">접수 → 담당자 배정 → 확인 → 답변 → 완료</p>
                </div>
              </div>
              <div className="border-t border-[#2c2f35] pt-3">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  긴급 이슈는 우선순위 '높음'으로 접수해주세요.
                  도입·요금 관련 문의는 <a href="/support" className="text-blue-400/80 hover:text-blue-300 hover:underline">도입 문의 페이지</a>를 이용해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
