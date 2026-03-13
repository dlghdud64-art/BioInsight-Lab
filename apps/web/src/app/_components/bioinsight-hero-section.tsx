"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Search, MessageSquareText, UploadCloud, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function BioInsightHeroSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [inquiryText, setInquiryText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/test/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmitInquiry = async () => {
    if (!inquiryText.trim()) {
      toast({
        title: "문의 내용을 입력해주세요",
        description: "문의 내용은 필수입니다.",
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toast({
      title: "문의가 접수되었습니다",
      description: "담당자가 빠르게 답변해 드리겠습니다.",
    });
    setIsUploading(false);
    setInquiryText("");
    setFile(null);
    setIsOpen(false);
  };

  return (
    <section className="relative w-full pt-32 md:pt-40 pb-20 overflow-hidden bg-white border-b border-slate-200 min-h-[60vh]">
      
      {/* 배경 패턴 (Grid) */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* 배경 데코레이션 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent pointer-events-none" />

      <div className="container px-4 md:px-6 mx-auto relative z-10 mt-8 md:mt-16">
        
        {/* 1. 메인 카피 */}
        <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8 mb-8 md:mb-12">
          <h1 className="text-[1.75rem] sm:text-5xl md:text-[4rem] xl:text-[4.5rem] font-extrabold tracking-tight text-slate-900 break-keep leading-[1.2] sm:leading-none max-w-3xl mx-auto">
            <span className="block pb-1.5 md:pb-3">
              시약과 장비를 <span className="text-blue-600">검색</span>한 뒤,
            </span>
            <span className="block pt-0.5 md:pt-2">
              견적 요청부터 <span className="text-blue-600">구매와 재고 관리</span>까지
            </span>
          </h1>

          <p className="text-[15px] md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed px-4 sm:px-2 break-keep">
            개인 연구부터 팀 운영까지 확장할 수 있는{" "}
            <br className="hidden sm:block" />
            바이오 운영 플랫폼입니다.
          </p>
        </div>

        {/* 2. 중앙 대형 검색창 (구글 스타일) - 모바일: w-full, mt-4로 공간 효율 */}
        <div className="mt-4 md:mt-12 w-full max-w-full md:max-w-[800px] lg:max-w-[1000px] mx-auto px-4 relative z-10">
          <form onSubmit={handleSearch} className="relative w-full">
            <div className="flex items-center w-full h-14 md:h-20 bg-white rounded-full border border-gray-200/80 md:border-gray-200/60 shadow-md md:shadow-2xl hover:shadow-2xl px-2 md:px-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-300 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)] transition-all duration-200">
              {/* 돋보기 아이콘 */}
              <Search className="ml-2 md:ml-4 h-5 w-5 md:h-8 md:w-8 text-slate-400 shrink-0" />
              
              {/* 입력창 */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="시약명, CAS No., 제조사 검색"
                className="flex-1 bg-transparent px-3 md:px-6 text-slate-900 placeholder:text-slate-400 outline-none min-w-0 font-medium h-full border-0 text-[16px] md:text-2xl"
              />

              {/* 검색 버튼 */}
              <Button
                type="submit"
                className="h-10 w-10 md:h-16 md:w-auto rounded-full shrink-0 md:px-10 bg-blue-600 hover:bg-blue-700 text-white transition-all"
              >
                <span className="md:hidden">
                  <Search className="h-5 w-5" />
                </span>
                <span className="hidden md:flex items-center gap-2 text-xl font-bold">
                  <Search className="h-5 w-5" />
                  검색
                </span>
              </Button>
            </div>
          </form>

          {/* 빠른 검색 — 2열 quick entry */}
          <div className="mt-5 md:mt-7 max-w-xs sm:max-w-sm md:max-w-lg mx-auto">
            <p className="text-xs text-slate-400 font-medium text-center mb-2.5">빠른 검색</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "시약·소모품", sub: "시약명으로 검색" },
                { label: "제조사", sub: "Thermo, Sigma…" },
                { label: "Cat. No", sub: "카탈로그 번호" },
                { label: "품목군", sub: "Antibody, Buffer…" },
              ].map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => router.push("/test/search")}
                  className="flex flex-col items-start px-3 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl text-left transition-all touch-manipulation"
                >
                  <span className="text-sm font-semibold text-slate-700">{entry.label}</span>
                  <span className="text-[11px] text-slate-400">{entry.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 맞춤 소싱 및 도입 문의 CTA */}
          <div className="mt-10 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <p className="text-sm text-slate-500 mb-3 px-4 sm:px-0">
              원하는 제품이 없거나 맞춤 도입이 필요하신가요?
            </p>
            <Dialog
              open={isOpen}
              onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) {
                  setInquiryText("");
                  setFile(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all hover:-translate-y-0.5 shadow-sm px-6 sm:px-8 h-11 sm:h-12 text-sm sm:text-base"
                >
                  <MessageSquareText className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sm:hidden">맞춤 도입 문의</span>
                  <span className="hidden sm:inline">전문가에게 맞춤 소싱 및 도입 문의하기</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle className="text-xl">맞춤 소싱 및 도입 문의</DialogTitle>
                  <DialogDescription>
                    궁금하신 점이나 찾으시는 품목을 남겨주시면, 담당자가 빠르게 답변해 드립니다.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  {/* [필수] 문의 내용 */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      문의 내용 <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      placeholder="어떤 시약/장비가 필요하신가요? 또는 궁금한 점을 자유롭게 남겨주세요."
                      className="min-h-[120px] resize-none"
                      value={inquiryText}
                      onChange={(e) => setInquiryText(e.target.value)}
                    />
                  </div>

                  {/* [선택] 참고용 파일 첨부 */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      참고용 파일 첨부 <span className="text-slate-400 font-normal">(선택사항)</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                      aria-label="참고용 파일 선택"
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                      className={cn(
                        "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer hover:bg-slate-50",
                        file ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50"
                      )}
                    >
                      <UploadCloud className={cn("h-6 w-6 mb-2", file ? "text-blue-600" : "text-slate-400")} />
                      {file ? (
                        <p className="text-sm font-semibold text-blue-700">{file.name}</p>
                      ) : (
                        <p className="text-sm text-slate-500">클릭하여 파일 업로드 (엑셀, PDF 등)</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isUploading}>
                    취소
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleSubmitInquiry}
                    disabled={isUploading || !inquiryText.trim()}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        접수 중...
                      </>
                    ) : (
                      "문의 접수하기"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </section>
  );
}

