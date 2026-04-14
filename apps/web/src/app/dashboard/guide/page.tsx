"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Rocket,
  GitCompareArrows,
  FileText,
  Package,
  Users,
  Bell,
  Brain,
  UserCog,
  ArrowRight,
  BookOpen,
  HelpCircle,
  MessageSquare,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Clock,
  LogIn,
  ShoppingCart,
  BarChart3,
  Shield,
  Mail,
  FileUp,
  Wrench,
  ClipboardPaste,
  RotateCcw,
  CreditCard,
  MessageCircle,
} from "lucide-react";

/* ─────────────────────────── 최근 업데이트 ─────────────────────────── */
const RECENT_UPDATES = [
  {
    date: "2026-03-15",
    tag: "신규",
    tagColor: "bg-emerald-50 text-emerald-600",
    title: "AI BOM 추출 기능 출시",
    desc: "PDF 업로드 시 품목 자동 인식 및 BOM 추출을 지원합니다.",
  },
  {
    date: "2026-03-10",
    tag: "개선",
    tagColor: "bg-blue-50 text-blue-600",
    title: "비교 워크스페이스 UX 개선",
    desc: "행 기반 레이아웃, 드래그 정렬, 그룹 비교 기능이 추가되었습니다.",
  },
  {
    date: "2026-03-05",
    tag: "개선",
    tagColor: "bg-blue-50 text-blue-600",
    title: "운영 콘솔 V1 출시",
    desc: "작업 대기열, 이슈 분류, 에스컬레이션, 개인 워크로드 관리가 가능합니다.",
  },
  {
    date: "2026-02-28",
    tag: "수정",
    tagColor: "bg-amber-50 text-amber-600",
    title: "하루 한 번 요약 이메일 발송 안정화",
    desc: "일부 조직에서 발송이 누락되던 문제가 해결되었습니다.",
  },
];

/* ─────────────────────────── 카테고리 정의 ─────────────────────────── */
const GUIDE_CATEGORIES = [
  { id: "getting-started", label: "시작하기", icon: Rocket },
  { id: "search-compare", label: "검색과 비교", icon: GitCompareArrows },
  { id: "quote-purchase", label: "견적 요청과 구매", icon: ShoppingCart },
  { id: "inventory", label: "입고와 재고 운영", icon: Package },
  { id: "org-role", label: "조직/권한 관리", icon: Users },
  { id: "notification", label: "알림/설정/구독", icon: Bell },
  { id: "ai-bom-pdf", label: "AI/BOM/PDF 활용", icon: Brain },
  { id: "role-guide", label: "역할별 가이드", icon: UserCog },
];

/* ─────────────────────────── 가이드 항목 ─────────────────────────── */
interface GuideEntry {
  id: string;
  category: string;
  icon: React.ElementType;
  title: string;
  what: string;
  when: string;
  keyInputs: string[];
  nextAction: string;
  link: { label: string; href: string };
  relatedFaq?: string;
}

const GUIDE_ENTRIES: GuideEntry[] = [
  // ── 시작하기 ──
  {
    id: "gs-1",
    category: "getting-started",
    icon: LogIn,
    title: "회원가입 및 로그인",
    what: "이메일 또는 소셜 로그인으로 계정을 생성하고 대시보드에 접속합니다.",
    when: "LabAxis를 처음 사용할 때",
    keyInputs: ["이메일 주소", "비밀번호 또는 소셜 계정"],
    nextAction: "첫 대시보드 둘러보기",
    link: { label: "로그인 페이지로 이동", href: "/auth/signin" },
  },
  {
    id: "gs-2",
    category: "getting-started",
    icon: BarChart3,
    title: "대시보드 이해하기",
    what: "견적 현황, 최근 활동, 재고 알림, 팀 요약을 한 화면에서 확인합니다.",
    when: "로그인 직후 또는 전체 현황을 파악하고 싶을 때",
    keyInputs: [],
    nextAction: "검색 또는 견적 관리로 이동",
    link: { label: "대시보드 열기", href: "/dashboard" },
  },
  {
    id: "gs-3",
    category: "getting-started",
    icon: Users,
    title: "조직 생성 및 팀원 초대",
    what: "새 조직을 만들고 이메일로 팀원을 초대하여 협업을 시작합니다.",
    when: "팀 단위로 LabAxis를 사용할 때",
    keyInputs: ["조직명", "초대할 이메일 주소", "역할(Viewer/Requester/Approver/Admin)"],
    nextAction: "멤버 역할 설정",
    link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },

  // ── 검색과 비교 ──
  {
    id: "sc-1",
    category: "search-compare",
    icon: Search,
    title: "통합 검색",
    what: "500만 건 이상의 시약·장비 데이터베이스에서 이름, CAS 번호, 카탈로그 번호로 검색합니다.",
    when: "필요한 시약이나 장비를 찾을 때",
    keyInputs: ["제품명", "CAS Number", "카탈로그 번호", "브랜드"],
    nextAction: "검색 결과에서 비교 항목 추가",
    link: { label: "검색 시작하기", href: "/dashboard/search" },
  },
  {
    id: "sc-2",
    category: "search-compare",
    icon: GitCompareArrows,
    title: "비교 워크스페이스",
    what: "여러 제품을 행 기반으로 나란히 비교하여 가격, 규격, 납기를 한눈에 파악합니다.",
    when: "동일 품목의 제조사·규격·가격을 비교하고 싶을 때",
    keyInputs: ["비교할 품목 (검색에서 추가)", "그룹 설정"],
    nextAction: "최적 품목 선택 후 견적 요청",
    link: { label: "비교 워크스페이스 열기", href: "/compare" },
  },

  // ── 견적 요청과 구매 ──
  {
    id: "qp-1",
    category: "quote-purchase",
    icon: FileText,
    title: "견적 요청",
    what: "비교에서 선택한 품목이나 직접 입력한 품목 목록으로 견적을 요청합니다.",
    when: "구매 전 가격·납기를 확인해야 할 때",
    keyInputs: ["품목 목록", "수량", "희망 납기", "특이사항"],
    nextAction: "벤더 회신 확인 → 가격 비교",
    link: { label: "견적 관리로 이동", href: "/dashboard/quotes" },
  },
  {
    id: "qp-2",
    category: "quote-purchase",
    icon: GitCompareArrows,
    title: "견적 비교 및 확정",
    what: "복수 벤더의 회신을 가격·납기·MOQ 기준으로 비교하고 최종 견적을 확정합니다.",
    when: "벤더 회신이 도착한 후",
    keyInputs: ["벤더별 회신 내용", "비교 기준"],
    nextAction: "승인 요청 또는 발주 진행",
    link: { label: "견적 관리로 이동", href: "/dashboard/quotes" },
  },
  {
    id: "qp-3",
    category: "quote-purchase",
    icon: ShoppingCart,
    title: "발주 및 구매 관리",
    what: "확정된 견적을 기반으로 발주를 진행하고, 구매 이력·증빙을 관리합니다.",
    when: "견적 확정 후 발주가 필요할 때",
    keyInputs: ["발주 수량", "결제 방식", "증빙 파일"],
    nextAction: "입고 대기 → 재고 반영",
    link: { label: "구매 운영 보기", href: "/dashboard/purchases" },
  },

  // ── 입고와 재고 운영 ──
  {
    id: "inv-1",
    category: "inventory",
    icon: Package,
    title: "입고 등록",
    what: "배송된 품목을 수령 확인하고 실제 입고 수량·Lot 번호·유효기간을 등록합니다.",
    when: "주문한 시약이나 장비가 도착했을 때",
    keyInputs: ["입고 수량", "Lot 번호", "유효기간", "보관 위치"],
    nextAction: "재고 현황 확인",
    link: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "inv-2",
    category: "inventory",
    icon: Shield,
    title: "안전재고·유효기간·재주문",
    what: "품목별 안전재고 기준을 설정하고, 유효기간 임박 시 자동 알림을 받습니다. 재고 부족 품목은 재주문 요청으로 바로 연결됩니다.",
    when: "재고 부족이나 기한 만료를 사전에 방지하고 싶을 때",
    keyInputs: ["안전재고 수량", "알림 기준일", "재주문 수량"],
    nextAction: "부족 품목 자동 견적 요청",
    link: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "inv-3",
    category: "inventory",
    icon: Search,
    title: "바코드 스캔 입고",
    what: "스마트폰 카메라로 바코드를 스캔하여 빠르게 입고를 처리합니다.",
    when: "다량의 품목을 빠르게 입고할 때",
    keyInputs: ["바코드 (카메라 스캔)"],
    nextAction: "수량 확인 후 입고 완료",
    link: { label: "스캔 입고 열기", href: "/dashboard/inventory/scan" },
  },
  {
    id: "inv-4",
    category: "inventory",
    icon: Brain,
    title: "재고 운영 도우미 (AI 어시스턴트)",
    what: "AI가 Lot 번호 추적, 유효기간 만료 예측, 사용량 기반 재주문 시점을 제안합니다. 재고 패널 하단의 어시스턴트 버튼으로 실행합니다.",
    when: "재고 운영에 대한 조언이나 자동화된 추천이 필요할 때",
    keyInputs: ["현재 재고 데이터 (자동 참조)"],
    nextAction: "추천 사항 검토 → 재주문/폐기 결정",
    link: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },

  // ── 조직/권한 관리 ──
  {
    id: "org-1",
    category: "org-role",
    icon: Users,
    title: "멤버 초대 및 역할 관리",
    what: "팀원에게 Viewer, Requester, Approver, Admin, Owner 역할을 부여합니다.",
    when: "새 팀원이 합류하거나 권한을 변경할 때",
    keyInputs: ["이메일 주소", "역할 선택"],
    nextAction: "초대 이메일 발송 확인",
    link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },
  {
    id: "org-2",
    category: "org-role",
    icon: Shield,
    title: "승인 체계 설정",
    what: "견적 확정·발주 시 Approver의 승인을 거치도록 워크플로를 설정합니다.",
    when: "고액 구매나 팀 내부 승인 프로세스가 필요할 때",
    keyInputs: ["승인 필수 금액 기준", "승인자 지정"],
    nextAction: "승인 요청 테스트",
    link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },
  {
    id: "org-3",
    category: "org-role",
    icon: Shield,
    title: "Owner / Admin / 일반 멤버 권한 차이",
    what: "Owner는 조직당 1명으로 결제, 조직 삭제, 소유권 이전 등 최고 권한을 갖습니다. Admin은 멤버 초대·역할 변경·설정을 관리하지만 Owner 변경이나 조직 삭제는 불가합니다. Approver는 승인, Requester는 요청, Viewer는 조회만 가능합니다.",
    when: "역할별 접근 범위를 확인하거나 변경해야 할 때",
    keyInputs: [],
    nextAction: "역할 변경은 조직 설정에서 수행",
    link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },

  // ── 알림/설정/구독 ──
  {
    id: "noti-1",
    category: "notification",
    icon: Bell,
    title: "알림 채널 설정",
    what: "이메일, 인앱 알림, 하루 한 번 요약 등 알림 수신 방식을 선택합니다.",
    when: "중요 알림을 놓치고 싶지 않을 때",
    keyInputs: ["알림 유형별 ON/OFF", "수신 채널"],
    nextAction: "하루 한 번 요약 시간 설정",
    link: { label: "알림 설정으로 이동", href: "/dashboard/settings" },
  },
  {
    id: "noti-2",
    category: "notification",
    icon: Mail,
    title: "알림 전달 방식: 즉시 vs 하루 한 번 요약",
    what: "견적 회신·재고 경고 등 긴급 알림은 즉시 이메일로 발송되고, 팀 활동·일반 변동은 하루 한 번 요약 이메일로 묶어 전달됩니다. 설정에서 어떤 항목을 즉시/요약에 포함할지 선택할 수 있습니다.",
    when: "알림이 너무 많거나, 중요 알림만 즉시 받고 싶을 때",
    keyInputs: ["즉시 알림 항목", "하루 한 번 요약 수신 시간"],
    nextAction: "요약 내용 커스터마이즈",
    link: { label: "알림 설정으로 이동", href: "/dashboard/settings" },
  },
  {
    id: "noti-3",
    category: "notification",
    icon: Wrench,
    title: "구독 및 플랜 관리",
    what: "현재 구독 상태를 확인하고 플랜 변경·해지를 처리합니다.",
    when: "플랜을 업그레이드하거나 해지를 검토할 때",
    keyInputs: [],
    nextAction: "플랜 비교 후 변경",
    link: { label: "구독 관리로 이동", href: "/dashboard/settings/plans" },
  },
  {
    id: "noti-4",
    category: "notification",
    icon: CreditCard,
    title: "해지 및 의견 수집 흐름",
    what: "구독 해지를 요청하면 해지 사유를 선택하는 간단한 설문이 표시됩니다. 해지 후에도 현재 결제 주기 종료까지 서비스가 유지되며, 90일간 데이터가 보관됩니다. 재구독 시 데이터가 복원됩니다.",
    when: "구독 해지를 고려하거나 요금 부담을 줄이고 싶을 때",
    keyInputs: [],
    nextAction: "해지 사유 선택 → 확인 → 유예 기간 안내",
    link: { label: "구독 관리로 이동", href: "/dashboard/settings/plans" },
  },

  // ── AI/BOM/PDF 활용 ──
  {
    id: "ai-1",
    category: "ai-bom-pdf",
    icon: FileUp,
    title: "PDF 업로드 및 분석",
    what: "카탈로그, 견적서, 발주서 PDF를 업로드하면 AI가 품목을 자동 추출합니다.",
    when: "종이 견적서나 카탈로그 PDF에서 품목을 빠르게 추출하고 싶을 때",
    keyInputs: ["PDF 파일 (텍스트 기반 권장)"],
    nextAction: "추출 결과 확인 → 비교/견적 연결",
    link: { label: "PDF 분석 시작", href: "/dashboard/quotes" },
  },
  {
    id: "ai-2",
    category: "ai-bom-pdf",
    icon: ClipboardPaste,
    title: "PDF 분석 실패 시 대체 경로 (텍스트 붙여넣기)",
    what: "스캔본·암호화·손상 PDF 등으로 분석에 실패하면, 품목 목록을 직접 텍스트로 붙여넣어 동일한 BOM 추출 결과를 얻을 수 있습니다. 견적 생성 화면의 '텍스트 입력' 탭을 선택하세요.",
    when: "PDF 분석이 실패하거나 이미지 기반 스캔 PDF를 사용할 때",
    keyInputs: ["품목 목록 텍스트 (줄바꿈 구분)"],
    nextAction: "AI 파싱 결과 확인 → 비교/견적 연결",
    link: { label: "견적 생성 열기", href: "/dashboard/quotes" },
  },
  {
    id: "ai-3",
    category: "ai-bom-pdf",
    icon: Brain,
    title: "BOM 추출",
    what: "실험 프로토콜이나 논문 PDF에서 필요한 시약 목록(BOM)을 자동 추출합니다.",
    when: "실험 계획서에서 필요 물품을 한 번에 추출하고 싶을 때",
    keyInputs: ["PDF 파일", "추출 범위 설정"],
    nextAction: "BOM 목록 검토 → 검색/견적 연결",
    link: { label: "BOM 추출 시작", href: "/dashboard/quotes" },
  },
  {
    id: "ai-4",
    category: "ai-bom-pdf",
    icon: Sparkles,
    title: "AI 텍스트 대체",
    what: "제품명이 약어이거나 불분명할 때 AI가 정확한 정식 제품명을 제안합니다.",
    when: "검색 결과가 부정확하거나 품목 특정이 어려울 때",
    keyInputs: ["원본 텍스트"],
    nextAction: "대체 결과 확인 → 검색 재실행",
    link: { label: "검색에서 사용하기", href: "/dashboard/search" },
  },

  // ── 역할별 가이드 ──
  {
    id: "role-1",
    category: "role-guide",
    icon: UserCog,
    title: "연구원 (Requester)",
    what: "시약 검색, 비교, 견적 요청을 주로 수행하며, 입고된 시약의 재고를 관리합니다.",
    when: "실험에 필요한 시약을 직접 찾아 요청해야 할 때",
    keyInputs: [],
    nextAction: "검색 → 비교 → 견적 요청",
    link: { label: "검색 시작하기", href: "/dashboard/search" },
  },
  {
    id: "role-2",
    category: "role-guide",
    icon: ShoppingCart,
    title: "구매 담당 (Approver)",
    what: "연구원이 요청한 견적을 검토·승인하고 벤더와의 커뮤니케이션 및 발주를 처리합니다.",
    when: "견적 승인 요청이 도착했을 때",
    keyInputs: [],
    nextAction: "견적 검토 → 승인/반려 → 발주",
    link: { label: "견적 관리로 이동", href: "/dashboard/quotes" },
  },
  {
    id: "role-3",
    category: "role-guide",
    icon: BarChart3,
    title: "랩 매니저 (Admin)",
    what: "팀 전체의 예산, 재고, 구매 현황을 모니터링하고 보고서를 생성합니다.",
    when: "팀 운영 현황을 종합적으로 파악해야 할 때",
    keyInputs: [],
    nextAction: "대시보드 → 분석 → 보고서",
    link: { label: "분석 보기", href: "/dashboard/analytics" },
  },
  {
    id: "role-4",
    category: "role-guide",
    icon: Shield,
    title: "관리자 (Owner)",
    what: "조직 설정, 멤버 관리, 구독·결제, 보안 정책 등 시스템 전반을 관리합니다. Owner는 조직당 1명으로, 결제·삭제·소유권 이전 등 최고 권한을 보유합니다.",
    when: "조직 레벨의 설정 변경이 필요할 때",
    keyInputs: [],
    nextAction: "조직 설정 → 멤버 → 구독 관리",
    link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },
];

/* ─────────────────────────── 컴포넌트 ─────────────────────────── */
export default function GuidePage() {
  const [activeCategory, setActiveCategory] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = useMemo(() => {
    let items = GUIDE_ENTRIES;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.what.toLowerCase().includes(q) ||
          e.when.toLowerCase().includes(q) ||
          e.keyInputs.some((k) => k.toLowerCase().includes(q))
      );
    } else {
      items = items.filter((e) => e.category === activeCategory);
    }
    return items;
  }, [activeCategory, searchQuery]);

  const activeCategoryMeta = GUIDE_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className="flex-1 pt-2 md:pt-4 max-w-5xl mx-auto w-full">
      {/* ── 헤더 ── */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">
          이용 가이드
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          LabAxis의 모든 기능을 단계별로 안내합니다. 카테고리를 선택하거나 검색으로 원하는 가이드를 찾아보세요.
        </p>
      </div>

      {/* ── 검색바 ── */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="가이드 검색 (예: 견적 요청, 재고, PDF 분석)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-el border-bd text-slate-900 placeholder:text-slate-500 focus:border-bd focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* ── 최근 업데이트 ── */}
      <div className="rounded-xl bg-pn border border-bd p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-900">최근 업데이트</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {RECENT_UPDATES.map((update, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg bg-pn border border-bd px-3.5 py-3"
            >
              <div className="flex flex-col items-start gap-1 flex-shrink-0">
                <span className="text-[10px] text-slate-500 font-mono">{update.date}</span>
                <Badge className={`text-[10px] px-1.5 py-0 border-0 font-medium ${update.tagColor}`}>
                  {update.tag}
                </Badge>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 leading-snug">{update.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{update.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 메인 레이아웃: 사이드바 + 콘텐츠 ── */}
      <div className="flex gap-5">
        {/* 사이드바 네비게이션 */}
        <nav className="hidden md:block w-52 flex-shrink-0">
          <div className="sticky top-4 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold px-3 mb-2">
              카테고리
            </p>
            {GUIDE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = !searchQuery && activeCategory === cat.id;
              const count = GUIDE_ENTRIES.filter((e) => e.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchQuery("");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "text-slate-500 hover:text-slate-700 hover:bg-pn border border-transparent"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                  <span className="truncate">{cat.label}</span>
                  <span className={`ml-auto text-[10px] ${isActive ? "text-blue-600/70" : "text-slate-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* 사이드바 하단 링크 */}
            <div className="border-t border-bd mt-4 pt-4 space-y-1">
              <Link
                href="/dashboard/faq"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-pn transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                자주 묻는 질문
                <ExternalLink className="h-2.5 w-2.5 ml-auto text-slate-600" />
              </Link>
              <Link
                href="/dashboard/support"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-pn transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                1:1 문의하기
                <ExternalLink className="h-2.5 w-2.5 ml-auto text-slate-600" />
              </Link>
            </div>
          </div>
        </nav>

        {/* 모바일 카테고리 탭 */}
        <div className="md:hidden w-full">
          <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide mb-4">
            {GUIDE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = !searchQuery && activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-pn border border-bd text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-500"}`} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* 모바일 콘텐츠 영역 */}
          <GuideContent
            entries={filteredEntries}
            searchQuery={searchQuery}
            activeCategoryMeta={activeCategoryMeta}
          />

          {/* 모바일 하단 지원 */}
          <MobileSupportFooter />
        </div>

        {/* 데스크탑 콘텐츠 영역 */}
        <div className="hidden md:block flex-1 min-w-0">
          <GuideContent
            entries={filteredEntries}
            searchQuery={searchQuery}
            activeCategoryMeta={activeCategoryMeta}
          />
        </div>
      </div>

      {/* 데스크탑 하단 지원 */}
      <div className="hidden md:block mt-8 mb-4">
        <div className="rounded-xl bg-pn border border-bd px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <HelpCircle className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">추가 도움이 필요하신가요?</p>
              <p className="text-xs text-slate-500 mt-0.5">FAQ를 확인하거나 1:1 문의를 남겨주세요.</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <Link href="/dashboard/faq">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-bd text-slate-600 bg-transparent hover:bg-pn hover:text-slate-900"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                자주 묻는 질문
              </Button>
            </Link>
            <Link href="/dashboard/support">
              <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <MessageSquare className="h-3.5 w-3.5" />
                1:1 문의하기
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 가이드 콘텐츠 ── */
function GuideContent({
  entries,
  searchQuery,
  activeCategoryMeta,
}: {
  entries: GuideEntry[];
  searchQuery: string;
  activeCategoryMeta: (typeof GUIDE_CATEGORIES)[number] | undefined;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-pn border border-bd py-16 text-center">
        <Search className="h-8 w-8 text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600 mb-1">검색 결과가 없습니다</p>
        <p className="text-xs text-slate-500">다른 키워드로 검색하거나 카테고리를 변경해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 카테고리 제목 (검색 중이 아닐 때) */}
      {!searchQuery && activeCategoryMeta && (
        <div className="flex items-center gap-2 mb-1">
          <activeCategoryMeta.icon className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-700">{activeCategoryMeta.label}</h2>
          <Badge className="text-[10px] px-1.5 py-0 bg-el border-bd text-slate-500">
            {entries.length}개 가이드
          </Badge>
        </div>
      )}

      {searchQuery && (
        <p className="text-xs text-slate-500 mb-1">
          &quot;{searchQuery}&quot; 검색 결과 {entries.length}건
        </p>
      )}

      {entries.map((entry) => {
        const Icon = entry.icon;
        return (
          <Card
            key={entry.id}
            className="bg-pn border-bd hover:border-bd transition-colors overflow-hidden"
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start gap-3.5">
                {/* 아이콘 */}
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* 타이틀 */}
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">{entry.title}</h3>

                  {/* 정보 그리드 */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-16 flex-shrink-0 pt-0.5">
                        기능
                      </span>
                      <p className="text-xs text-slate-600 leading-relaxed">{entry.what}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-16 flex-shrink-0 pt-0.5">
                        사용 시점
                      </span>
                      <p className="text-xs text-slate-500 leading-relaxed">{entry.when}</p>
                    </div>
                    {entry.keyInputs.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-16 flex-shrink-0 pt-0.5">
                          주요 입력
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {entry.keyInputs.map((input, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-bd text-slate-500 bg-el"
                            >
                              {input}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-16 flex-shrink-0 pt-0.5">
                        다음 단계
                      </span>
                      <div className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3 text-emerald-500" />
                        <p className="text-xs text-emerald-600">{entry.nextAction}</p>
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <Link href={entry.link.href}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs border-bd text-slate-600 bg-transparent hover:bg-el hover:text-slate-900 hover:border-blue-200"
                    >
                      {entry.link.label}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── 모바일 하단 지원 ── */
function MobileSupportFooter() {
  return (
    <div className="rounded-xl bg-pn border border-bd px-4 py-4 mt-6 mb-4">
      <p className="text-sm font-semibold text-slate-700 mb-3">추가 도움이 필요하신가요?</p>
      <div className="flex flex-col gap-2">
        <Link href="/dashboard/faq">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-bd text-slate-600 bg-transparent hover:bg-pn w-full"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            자주 묻는 질문
          </Button>
        </Link>
        <Link href="/dashboard/support">
          <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white w-full">
            <MessageSquare className="h-3.5 w-3.5" />
            1:1 문의하기
          </Button>
        </Link>
      </div>
    </div>
  );
}
