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
import { Search, FileSpreadsheet, ArrowRight, UploadCloud, Loader2 } from "lucide-react";

export function BioInsightHeroSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
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

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "파일을 선택해주세요",
        description: "업로드할 파일을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toast({
      title: "견적 요청이 접수되었습니다",
      description: "대시보드에서 확인해주세요.",
    });
    setIsUploading(false);
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

          {/* 인기 검색어 칩 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6 md:gap-3">
            <span className="text-sm text-slate-500 font-medium">🔥 인기:</span>
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

          {/* 빠른 견적 요청 CTA: 클릭 시 팝업(Dialog) */}
          <div className="mt-10 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <p className="text-sm text-slate-500 mb-3">
              찾으시는 제품이 없거나 엑셀 구매 리스트가 있으신가요?
            </p>
            <Dialog
              open={isOpen}
              onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) setFile(null);
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all hover:-translate-y-0.5 shadow-sm px-8 h-12"
                >
                  <FileSpreadsheet className="mr-2 h-5 w-5" />
                  엑셀/파일로 한 번에 견적 받기
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>파일로 견적 요청</DialogTitle>
                  <DialogDescription>
                    엑셀 또는 CSV 파일을 업로드하면 품목을 자동으로 읽어 견적 요청을 만들어 드립니다.
                  </DialogDescription>
                </DialogHeader>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="견적용 파일 선택"
                />

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                  className={cn(
                    "mt-4 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer",
                    file ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  )}
                >
                  <UploadCloud className={cn("h-10 w-10 mb-3", file ? "text-blue-600" : "text-slate-400")} />
                  {file ? (
                    <p className="text-sm font-semibold text-blue-700">선택된 파일: {file.name}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700">
                        클릭하거나 파일을 이곳으로 드래그하세요
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        PDF, Excel, CSV 지원 (최대 10MB)
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isUploading}>
                    취소
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        접수 중...
                      </>
                    ) : (
                      "견적 요청하기"
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

