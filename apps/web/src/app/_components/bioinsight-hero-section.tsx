"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import Link from "next/link";
import { Search, MessageSquareText, UploadCloud, Loader2, Flame, ArrowRight } from "lucide-react";
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

  const popularSearches = ["FBS", "Pipette", "Conical Tube", "Centrifuge", "DMEM", "Trypsin"];

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
          <h1 className="text-3xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight py-2">
            전 세계 500만 개 시약/장비, <br className="hidden sm:block" />
            <span className="text-blue-600">최저가 검색부터 견적까지</span>
          </h1>
          
          <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-2">
            더 이상 구글링하지 마세요. <br />
            BioInsight Lab이 스펙 비교부터 최적 견적까지 한 번에 찾아드립니다.
          </p>
        </div>

        {/* 2. 중앙 대형 검색창 (구글 스타일) */}
        <div className="mt-8 md:mt-12 w-full max-w-[90%] md:!max-w-[800px] lg:!max-w-[1000px] mx-auto px-4 relative z-10">
          <form onSubmit={handleSearch} className="relative w-full">
            <div className="flex items-center w-full h-14 md:h-20 bg-white rounded-full border border-slate-200 md:border-2 shadow-lg md:shadow-2xl px-2 md:px-4 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
              {/* 돋보기 아이콘 */}
              <Search className="ml-2 md:ml-4 h-5 w-5 md:h-8 md:w-8 text-slate-400 shrink-0" />
              
              {/* 입력창 */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="찾으시는 시약명, CAS Number, 제조사를 입력해보세요"
                className="flex-1 bg-transparent px-3 md:px-6 text-base md:text-2xl text-slate-900 placeholder:text-slate-400 outline-none min-w-0 font-medium h-full border-0"
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

          {/* 메인 CTA: Get Started + 요금제 보기 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 md:mt-10">
            <Link href="/test/search">
              <Button
                size="lg"
                className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg border-slate-200 dark:border-slate-800"
              >
                요금제 보기
              </Button>
            </Link>
          </div>

          {/* 인기 검색어 칩 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6 md:gap-3">
            <span className="text-sm text-slate-500 font-medium flex items-center gap-1">
              <Flame className="h-4 w-4 text-slate-500" />
              인기:
            </span>
            {popularSearches.map((term) => (
              <Badge
                key={term}
                variant="secondary"
                className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors px-3 py-1.5 text-sm font-medium"
                onClick={() => {
                  setSearchQuery(term);
                  router.push(`/test/search?q=${encodeURIComponent(term)}`);
                }}
              >
                #{term}
              </Badge>
            ))}
          </div>

          {/* 맞춤 소싱 및 도입 문의 CTA */}
          <div className="mt-10 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <p className="text-sm text-slate-500 mb-3">
              원하는 제품이 없거나, 연구실 맞춤 도입 상담이 필요하신가요?
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
                  className="rounded-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all hover:-translate-y-0.5 shadow-sm px-8 h-12"
                >
                  <MessageSquareText className="mr-2 h-5 w-5" />
                  전문가에게 맞춤 소싱 및 도입 문의하기
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

