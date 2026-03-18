"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
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
  ChevronRight,
  X,
  FileText,
  KeyRound,
  FileUp,
  ClipboardList,
  FlaskConical,
  UserPlus,
  FileWarning,
  GitCompareArrows,
  ShieldCheck,
  LogIn,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ── 운영 흐름 카테고리 (8개) ── */
const FLOW_CATEGORIES = [
  { value: "search", label: "검색", icon: Search },
  { value: "compare", label: "비교", icon: GitCompareArrows },
  { value: "quote", label: "견적 요청", icon: ShoppingCart },
  { value: "purchase", label: "구매 운영", icon: BarChart3 },
  { value: "inventory", label: "재고 관리", icon: Package },
  { value: "organization", label: "조직/권한", icon: Users },
  { value: "safety", label: "안전 관리", icon: ShieldCheck },
  { value: "account", label: "계정/로그인", icon: LogIn },
];

/* ── 업무 영향도 ── */
const IMPACT_OPTIONS = [
  { value: "inquiry", label: "확인 문의", colorClass: "text-slate-400" },
  { value: "delay", label: "업무 지연", colorClass: "text-amber-400" },
  { value: "urgent", label: "즉시 조치 필요", colorClass: "text-red-400" },
];

/* ── Self-serve 빠른 해결 칩 ── */
const QUICK_RESOLVE = [
  { label: "비밀번호/로그인", icon: KeyRound, href: "/dashboard/settings" },
  { label: "CSV 업로드 오류", icon: FileUp, href: "/dashboard/inventory" },
  { label: "견적 상태 확인", icon: ClipboardList, href: "/dashboard/quotes" },
  { label: "재고 Lot/유효기간", icon: FlaskConical, href: "/dashboard/inventory" },
  { label: "권한/멤버 초대", icon: UserPlus, href: "/dashboard/settings/enterprise" },
  { label: "PDF 분석 실패", icon: FileWarning, href: "/extract" },
];

/* ── 내 최근 요청 mock ── */
const MOCK_RECENT = [
  { title: "CSV 업로드 오류 문의", status: "in_progress" as const, ago: "1일 전" },
  { title: "권한 변경 요청", status: "done" as const, ago: "3일 전" },
  { title: "견적 응답 지연 문의", status: "pending" as const, ago: "5일 전" },
];

/* ── 자주 해결되는 도움말 ── */
const FAQ_ITEMS = [
  "CSV 형식 오류 해결",
  "견적 요청 재전송",
  "Lot 유효기간 일괄 수정",
  "멤버 초대 방법",
];

const statusConfig = {
  pending: { label: "대기", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  in_progress: { label: "처리 중", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  done: { label: "완료", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
};

export default function DashboardSupportPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [category, setCategory] = useState("");
  const [impact, setImpact] = useState("");
  const [relatedItem, setRelatedItem] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!category || !impact || !title.trim() || !body.trim()) {
      toast({
        title: "필수 항목을 입력해주세요",
        description: "운영 흐름, 영향도, 제목, 상세 설명을 모두 입력해 주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast({
      title: "이슈가 접수되었습니다",
      description: "담당자가 확인 후 답변드리겠습니다.",
    });
    setCategory("");
    setImpact("");
    setRelatedItem("");
    setTitle("");
    setBody("");
    setAttachments([]);
    setIsSubmitting(false);
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-8 pt-4 md:pt-6 max-w-6xl mx-auto w-full">
      {/* ── 상단 헤더 ── */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-100">운영 지원 센터</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          검색, 비교, 견적, 구매, 재고, 조직 운영 중 발생한 이슈를 구조화해서 전달하세요.
        </p>
      </div>

      {/* ── Self-serve 빠른 해결 ── */}
      <div className="bg-pn border border-bd rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-300 mb-3">문의 전에 확인하세요</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_RESOLVE.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 bg-el border border-bd rounded-lg px-3 py-2 hover:bg-st transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-300">{item.label}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* ── 메인 2컬럼 ── */}
      <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
        {/* 좌측: 운영 이슈 입력 패널 */}
        <div className="bg-pn border border-bd rounded-xl p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 운영 흐름 선택 */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-300">
                운영 흐름 <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FLOW_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/5"
                          : "bg-el border-bd hover:bg-st"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? "text-blue-400" : "text-slate-400"}`} />
                      <span className={`text-xs ${isSelected ? "text-blue-400 font-semibold" : "text-slate-400"}`}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 업무 영향도 */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-300">
                업무 영향도 <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                {IMPACT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setImpact(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      impact === opt.value
                        ? `${opt.colorClass} border-current bg-current/5`
                        : "text-slate-400 border-bd bg-el hover:bg-st"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 관련 항목 */}
            <div className="space-y-2">
              <Label htmlFor="related-item" className="text-xs font-semibold text-slate-300">
                관련 항목 <span className="text-slate-500 font-normal">(선택)</span>
              </Label>
              <Input
                id="related-item"
                placeholder="품목명, 견적번호, 발주번호, Lot 등"
                value={relatedItem}
                onChange={(e) => setRelatedItem(e.target.value)}
                className="border-bd text-sm h-9"
              />
            </div>

            {/* 제목 */}
            <div className="space-y-2">
              <Label htmlFor="ticket-title" className="text-xs font-semibold text-slate-300">
                제목 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ticket-title"
                placeholder="이슈를 간단히 요약해주세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-bd text-sm"
              />
            </div>

            {/* 상세 설명 */}
            <div className="space-y-2">
              <Label htmlFor="ticket-body" className="text-xs font-semibold text-slate-300">
                상세 설명 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="ticket-body"
                placeholder="문제 상황, 재현 방법, 기대 동작 등을 구체적으로 적어주세요."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="resize-none border-bd text-sm"
              />
            </div>

            {/* 첨부 파일 */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-300">
                첨부 파일 <span className="text-slate-500 font-normal">(선택, 최대 5개)</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded-md border border-bd bg-el px-2.5 py-1.5 text-xs text-slate-300">
                    <FileText className="h-3 w-3 text-slate-500" />
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-500">({(file.size / 1024).toFixed(0)}KB)</span>
                    <button type="button" onClick={() => handleRemoveFile(idx)} className="text-slate-500 hover:text-red-400 ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {attachments.length < 5 && (
                  <label className="flex items-center gap-1.5 rounded-md border border-dashed border-bd bg-pn px-3 py-1.5 text-xs text-slate-500 hover:border-blue-500 hover:text-blue-400 cursor-pointer transition-colors">
                    <Paperclip className="h-3 w-3" />
                    파일 추가
                    <input type="file" className="hidden" onChange={handleFileAdd} multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv" />
                  </label>
                )}
              </div>
              <p className="text-[10px] text-slate-500">PDF, 이미지, 엑셀 파일 · 파일당 최대 10MB</p>
            </div>

            {/* 제출 */}
            <div className="pt-1">
              <Button
                type="submit"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 px-6 gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />접수 중...</>
                ) : (
                  <><Send className="h-4 w-4" />이슈 전달하기</>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* 우측: 운영 지원 사이드바 */}
        <div className="space-y-4">
          {/* 내 최근 요청 */}
          <div className="bg-pn border border-bd rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-300 mb-3">내 최근 요청</p>
            <div className="space-y-2.5">
              {MOCK_RECENT.map((item, idx) => {
                const st = statusConfig[item.status];
                return (
                  <div key={idx} className="flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{item.ago}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 예상 응답 시간 */}
          <div className="bg-pn border border-bd rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-300">예상 응답 시간</p>
            </div>
            <p className="text-sm font-bold text-slate-200">평균 4시간 이내</p>
            <p className="text-[10px] text-slate-500 mt-0.5">업무일 기준</p>
          </div>

          {/* 자주 해결되는 도움말 */}
          <div className="bg-pn border border-bd rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-300 mb-3">자주 해결되는 도움말</p>
            <div className="space-y-1">
              {FAQ_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="w-full flex items-center justify-between rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-el transition-colors"
                >
                  <span>{item}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
