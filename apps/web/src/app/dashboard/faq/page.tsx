"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  CreditCard,
  ArrowRight,
  LifeBuoy,
  HelpCircle,
  FileText,
  MessageSquare,
} from "lucide-react";

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  cta?: { label: string; href: string };
}

const FAQ_CATEGORIES = [
  { value: "all", label: "전체", icon: HelpCircle },
  { value: "quote", label: "견적", icon: FileText },
  { value: "purchase", label: "구매", icon: ShoppingCart },
  { value: "inventory", label: "재고", icon: Package },
  { value: "team", label: "계정/조직", icon: Users },
  { value: "billing", label: "결제/증빙", icon: CreditCard },
];

const FAQ_ITEMS: FaqItem[] = [
  // 견적
  {
    id: "q1",
    category: "quote",
    question: "견적 요청 후 현재 상태를 어디서 확인하나요?",
    answer: "대시보드 > 견적 관리 페이지에서 요청한 견적의 진행 상태(요청됨, 회신 도착, 확정됨 등)를 실시간으로 확인할 수 있습니다. 벤더 회신이 도착하면 이메일과 대시보드에서 동시에 알림을 받습니다.",
    cta: { label: "견적 관리로 이동", href: "/dashboard/quotes" },
  },
  {
    id: "q2",
    category: "quote",
    question: "견적 요청을 여러 벤더에 동시에 보낼 수 있나요?",
    answer: "네, 견적 리스트에서 품목을 선택한 후 복수 벤더를 지정하여 한 번에 견적 요청을 보낼 수 있습니다. 회신이 도착하면 비교 테이블에서 가격·납기·MOQ를 한눈에 비교할 수 있습니다.",
    cta: { label: "견적 요청하기", href: "/test/quote" },
  },
  // 구매
  {
    id: "q3",
    category: "purchase",
    question: "구매 후 증빙 자료(세금계산서, 거래명세서)를 어디서 확인하나요?",
    answer: "구매 운영 페이지에서 각 구매 건의 상세 정보를 확인할 수 있습니다. 고액 구매 건은 증빙 업로드 영역이 표시되며, 세금계산서·거래명세서 파일을 직접 첨부하거나 다운로드할 수 있습니다.",
    cta: { label: "구매 운영 보기", href: "/dashboard/purchases" },
  },
  {
    id: "q4",
    category: "purchase",
    question: "보유 중인 엑셀 양식으로 구매 이력을 등록할 수 있나요?",
    answer: "네, 구매 운영 페이지에서 CSV/엑셀 파일을 업로드하면 시스템이 자동으로 파싱하여 구매 이력에 반영합니다. 업로드 전 미리보기에서 매핑 결과를 확인할 수 있습니다.",
    cta: { label: "구매 운영 보기", href: "/dashboard/purchases" },
  },
  // 재고
  {
    id: "q5",
    category: "inventory",
    question: "구매한 품목을 재고에 반영하는 방법은?",
    answer: "구매 운영 페이지에서 입고 반영이 필요한 건을 선택하면 재고 관리 드로어가 '입고 반영' 모드로 열립니다. 실제 입고 수량, Lot 번호, 유효기간을 입력하고 '입고 반영 완료'를 누르면 재고에 자동 반영됩니다.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "q6",
    category: "inventory",
    question: "재고 부족 알림은 어떻게 설정하나요?",
    answer: "재고 목록에서 품목을 클릭하면 상세 드로어가 열립니다. '안전 재고 기준' 항목에서 최소 유지 수량을 설정하면, 해당 수량 이하로 떨어질 때 대시보드에서 경고 알림이 표시됩니다.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  // 계정/조직
  {
    id: "q7",
    category: "team",
    question: "팀원을 초대하려면 어떻게 하나요?",
    answer: "조직 설정 > 멤버 관리에서 이메일 주소로 팀원을 초대할 수 있습니다. 초대받은 팀원은 이메일의 링크를 통해 가입하면 자동으로 팀에 합류됩니다. 역할(Viewer, Requester, Approver, Admin)별 권한을 설정할 수 있습니다.",
    cta: { label: "조직 설정으로 이동", href: "/dashboard/organization" },
  },
  {
    id: "q8",
    category: "team",
    question: "팀 재고와 개인 재고는 어떻게 구분되나요?",
    answer: "재고 관리 페이지 상단의 '내 재고 / 팀 재고' 탭으로 전환할 수 있습니다. 팀 재고는 같은 조직에 소속된 모든 멤버가 조회할 수 있으며, 개인 재고는 본인만 관리합니다.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  // 결제/증빙
  {
    id: "q9",
    category: "billing",
    question: "전자세금계산서는 어떻게 발행받나요?",
    answer: "결제 완료 후 구매 운영 페이지에서 해당 건의 증빙 섹션에서 세금계산서 발행을 요청할 수 있습니다. 사업자등록번호와 담당자 정보를 등록해두면 자동 발행됩니다.",
    cta: { label: "구매 운영 보기", href: "/dashboard/purchases" },
  },
  {
    id: "q10",
    category: "billing",
    question: "연구비 카드로 결제할 수 있나요?",
    answer: "네, 대학교 산학협력단 및 기업 연구소의 규정에 맞춰 연구비 카드 결제를 지원합니다. 결제 시 카드 종류를 선택하면 관련 증빙 서류가 자동으로 생성됩니다.",
  },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredFaqs = useMemo(() => {
    let items = FAQ_ITEMS;
    if (activeCategory !== "all") {
      items = items.filter((f) => f.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeCategory, searchQuery]);

  const getCategoryBadge = (cat: string) => {
    const found = FAQ_CATEGORIES.find((c) => c.value === cat);
    return found?.label || cat;
  };

  return (
    <div className="flex-1 space-y-4 sm:space-y-6 pt-2 md:pt-4 max-w-4xl mx-auto w-full">
      {/* 페이지 헤더 */}
      <div className="space-y-1 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          도움말 센터
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed hidden sm:block">
          사용 중 자주 묻는 질문과 기능별 안내를 확인하세요.
        </p>
      </div>

      {/* 검색바 */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="질문 키워드로 검색 (예: 견적, 재고, 세금계산서)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 border-slate-200 text-sm bg-white"
        />
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {FAQ_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.value;
          const count = cat.value === "all"
            ? FAQ_ITEMS.length
            : FAQ_ITEMS.filter((f) => f.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
              {cat.label}
              <span className={`text-[10px] ml-0.5 ${isActive ? "text-blue-200" : "text-slate-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* FAQ 목록 */}
      <div className="space-y-2.5">
        {filteredFaqs.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="py-12 text-center">
              <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600 mb-1">검색 결과가 없습니다</p>
              <p className="text-xs text-slate-400">다른 키워드로 검색하거나 카테고리를 변경해보세요.</p>
            </CardContent>
          </Card>
        ) : (
          filteredFaqs.map((faq) => {
            const isExpanded = expandedIds.has(faq.id);
            return (
              <Card key={faq.id} className="border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleExpand(faq.id)}
                  className="w-full text-left px-4 md:px-5 py-4 flex items-start gap-3 hover:bg-slate-50/50 transition-colors"
                >
                  <HelpCircle className={`h-4.5 w-4.5 mt-0.5 flex-shrink-0 transition-colors ${isExpanded ? "text-blue-600" : "text-slate-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-500 font-medium">
                        {getCategoryBadge(faq.category)}
                      </Badge>
                    </div>
                    <p className={`text-sm font-medium leading-snug ${isExpanded ? "text-blue-900" : "text-slate-800"}`}>
                      {faq.question}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                  )}
                </button>
                {isExpanded && (
                  <CardContent className="pt-0 pb-4 px-4 md:px-5 ml-7 border-t border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed py-3">
                      {faq.answer}
                    </p>
                    {faq.cta && (
                      <Link href={faq.cta.href}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 mt-1">
                          {faq.cta.label}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* 하단 지원 연결 */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-8">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <LifeBuoy className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">원하는 답변을 찾지 못하셨나요?</p>
            <p className="text-xs text-slate-500 mt-0.5">운영 지원 센터에서 1:1 문의를 남겨주세요. 담당자가 직접 확인 후 답변드립니다.</p>
          </div>
        </div>
        <Link href="/dashboard/support" className="flex-shrink-0">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm gap-1.5 h-9">
            <MessageSquare className="h-3.5 w-3.5" />
            1:1 문의하기
          </Button>
        </Link>
      </div>
    </div>
  );
}
