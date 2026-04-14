"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
// Select 컴포넌트는 추후 티켓 상세 뷰에서 사용 예정
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
  ChevronDown,
  ChevronUp,
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
  LifeBuoy,
  Send,
  Loader2,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Zap,
  Target,
  ArrowUpRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOntologyContextLayerStore } from "@/lib/store/ontology-context-layer-store";

/* ═══════════════════════════════════════════════════════════════════
   Tab 1: 운영 매뉴얼 — 데이터
   ═══════════════════════════════════════════════════════════════════ */

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
}

const GUIDE_ENTRIES: GuideEntry[] = [
  // ── 시작하기 ──
  { id: "gs-1", category: "getting-started", icon: LogIn, title: "회원가입 및 로그인", what: "이메일 또는 소셜 로그인으로 계정을 생성하고 대시보드에 접속합니다.", when: "LabAxis를 처음 사용할 때", keyInputs: ["이메일 주소", "비밀번호 또는 소셜 계정"], nextAction: "첫 대시보드 둘러보기", link: { label: "로그인 페이지로 이동", href: "/auth/signin" } },
  { id: "gs-2", category: "getting-started", icon: BarChart3, title: "대시보드 이해하기", what: "견적 현황, 최근 활동, 재고 알림, 팀 요약을 한 화면에서 확인합니다.", when: "로그인 직후 또는 전체 현황을 파악하고 싶을 때", keyInputs: [], nextAction: "검색 또는 견적 관리로 이동", link: { label: "대시보드 열기", href: "/dashboard" } },
  { id: "gs-3", category: "getting-started", icon: Users, title: "조직 생성 및 팀원 초대", what: "새 조직을 만들고 이메일로 팀원을 초대하여 협업을 시작합니다.", when: "팀 단위로 LabAxis를 사용할 때", keyInputs: ["조직명", "초대할 이메일 주소", "역할(Viewer/Requester/Approver/Admin)"], nextAction: "멤버 역할 설정", link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" } },
  // ── 검색과 비교 ──
  { id: "sc-1", category: "search-compare", icon: Search, title: "통합 검색", what: "500만 건 이상의 시약·장비 데이터베이스에서 이름, CAS 번호, 카탈로그 번호로 검색합니다.", when: "필요한 시약이나 장비를 찾을 때", keyInputs: ["제품명", "CAS Number", "카탈로그 번호", "브랜드"], nextAction: "검색 결과에서 비교 항목 추가", link: { label: "검색 시작하기", href: "/dashboard/search" } },
  { id: "sc-2", category: "search-compare", icon: GitCompareArrows, title: "비교 워크스페이스", what: "여러 제품을 행 기반으로 나란히 비교하여 가격, 규격, 납기를 한눈에 파악합니다.", when: "동일 품목의 제조사·규격·가격을 비교하고 싶을 때", keyInputs: ["비교할 품목 (검색에서 추가)", "그룹 설정"], nextAction: "최적 품목 선택 후 견적 요청", link: { label: "비교 워크스페이스 열기", href: "/compare" } },
  // ── 견적 요청과 구매 ──
  { id: "qp-1", category: "quote-purchase", icon: FileText, title: "견적 요청", what: "비교에서 선택한 품목이나 직접 입력한 품목 목록으로 견적을 요청합니다.", when: "구매 전 가격·납기를 확인해야 할 때", keyInputs: ["품목 목록", "수량", "희망 납기", "특이사항"], nextAction: "벤더 회신 확인 → 가격 비교", link: { label: "견적 관리로 이동", href: "/dashboard/quotes" } },
  { id: "qp-2", category: "quote-purchase", icon: GitCompareArrows, title: "견적 비교 및 확정", what: "복수 벤더의 회신을 가격·납기·MOQ 기준으로 비교하고 최종 견적을 확정합니다.", when: "벤더 회신이 도착한 후", keyInputs: ["벤더별 회신 내용", "비교 기준"], nextAction: "승인 요청 또는 발주 진행", link: { label: "견적 관리로 이동", href: "/dashboard/quotes" } },
  { id: "qp-3", category: "quote-purchase", icon: ShoppingCart, title: "발주 및 구매 관리", what: "확정된 견적을 기반으로 발주를 진행하고, 구매 이력·증빙을 관리합니다.", when: "견적 확정 후 발주가 필요할 때", keyInputs: ["발주 수량", "결제 방식", "증빙 파일"], nextAction: "입고 대기 → 재고 반영", link: { label: "구매 운영 보기", href: "/dashboard/purchases" } },
  // ── 입고와 재고 운영 ──
  { id: "inv-1", category: "inventory", icon: Package, title: "입고 등록", what: "배송된 품목을 수령 확인하고 실제 입고 수량·Lot 번호·유효기간을 등록합니다.", when: "주문한 시약이나 장비가 도착했을 때", keyInputs: ["입고 수량", "Lot 번호", "유효기간", "보관 위치"], nextAction: "재고 현황 확인", link: { label: "재고 관리 열기", href: "/dashboard/inventory" } },
  { id: "inv-2", category: "inventory", icon: Shield, title: "안전재고·유효기간·재주문", what: "품목별 안전재고 기준을 설정하고, 유효기간 임박 시 자동 알림을 받습니다. 재고 부족 품목은 재주문 요청으로 바로 연결됩니다.", when: "재고 부족이나 기한 만료를 사전에 방지하고 싶을 때", keyInputs: ["안전재고 수량", "알림 기준일", "재주문 수량"], nextAction: "부족 품목 자동 견적 요청", link: { label: "재고 관리 열기", href: "/dashboard/inventory" } },
  { id: "inv-3", category: "inventory", icon: Search, title: "바코드 스캔 입고", what: "스마트폰 카메라로 바코드를 스캔하여 빠르게 입고를 처리합니다.", when: "다량의 품목을 빠르게 입고할 때", keyInputs: ["바코드 (카메라 스캔)"], nextAction: "수량 확인 후 입고 완료", link: { label: "스캔 입고 열기", href: "/dashboard/inventory/scan" } },
  { id: "inv-4", category: "inventory", icon: Brain, title: "재고 운영 도우미 (AI 어시스턴트)", what: "AI가 Lot 번호 추적, 유효기간 만료 예측, 사용량 기반 재주문 시점을 제안합니다.", when: "재고 운영에 대한 조언이나 자동화된 추천이 필요할 때", keyInputs: ["현재 재고 데이터 (자동 참조)"], nextAction: "추천 사항 검토 → 재주문/폐기 결정", link: { label: "재고 관리 열기", href: "/dashboard/inventory" } },
  // ── 조직/권한 관리 ──
  { id: "org-1", category: "org-role", icon: Users, title: "멤버 초대 및 역할 관리", what: "팀원에게 Viewer, Requester, Approver, Admin, Owner 역할을 부여합니다.", when: "새 팀원이 합류하거나 권한을 변경할 때", keyInputs: ["이메일 주소", "역할 선택"], nextAction: "초대 이메일 발송 확인", link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" } },
  { id: "org-2", category: "org-role", icon: Shield, title: "승인 체계 설정", what: "견적 확정·발주 시 Approver의 승인을 거치도록 워크플로를 설정합니다.", when: "고액 구매나 팀 내부 승인 프로세스가 필요할 때", keyInputs: ["승인 필수 금액 기준", "승인자 지정"], nextAction: "승인 요청 테스트", link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" } },
  { id: "org-3", category: "org-role", icon: Shield, title: "Owner / Admin / 일반 멤버 권한 차이", what: "Owner는 조직당 1명으로 결제, 조직 삭제, 소유권 이전 등 최고 권한을 갖습니다. Admin은 멤버 초대·역할 변경·설정을 관리하지만 Owner 변경이나 조직 삭제는 불가합니다.", when: "역할별 접근 범위를 확인하거나 변경해야 할 때", keyInputs: [], nextAction: "역할 변경은 조직 설정에서 수행", link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" } },
  // ── 알림/설정/구독 ──
  { id: "noti-1", category: "notification", icon: Bell, title: "알림 채널 설정", what: "이메일, 인앱 알림, 하루 한 번 요약 등 알림 수신 방식을 선택합니다.", when: "중요 알림을 놓치고 싶지 않을 때", keyInputs: ["알림 유형별 ON/OFF", "수신 채널"], nextAction: "하루 한 번 요약 시간 설정", link: { label: "알림 설정으로 이동", href: "/dashboard/settings" } },
  { id: "noti-2", category: "notification", icon: Mail, title: "알림 전달 방식: 즉시 vs 하루 한 번 요약", what: "견적 회신·재고 경고 등 긴급 알림은 즉시 이메일로 발송되고, 팀 활동·일반 변동은 하루 한 번 요약 이메일로 묶어 전달됩니다.", when: "알림이 너무 많거나, 중요 알림만 즉시 받고 싶을 때", keyInputs: ["즉시 알림 항목", "하루 한 번 요약 수신 시간"], nextAction: "요약 내용 커스터마이즈", link: { label: "알림 설정으로 이동", href: "/dashboard/settings" } },
  { id: "noti-3", category: "notification", icon: Wrench, title: "구독 및 플랜 관리", what: "현재 구독 상태를 확인하고 플랜 변경·해지를 처리합니다.", when: "플랜을 업그레이드하거나 해지를 검토할 때", keyInputs: [], nextAction: "플랜 비교 후 변경", link: { label: "구독 관리로 이동", href: "/dashboard/settings/plans" } },
  { id: "noti-4", category: "notification", icon: CreditCard, title: "해지 및 의견 수집 흐름", what: "구독 해지를 요청하면 해지 사유를 선택하는 간단한 설문이 표시됩니다. 해지 후에도 현재 결제 주기 종료까지 서비스가 유지되며, 90일간 데이터가 보관됩니다.", when: "구독 해지를 고려하거나 요금 부담을 줄이고 싶을 때", keyInputs: [], nextAction: "해지 사유 선택 → 확인 → 유예 기간 안내", link: { label: "구독 관리로 이동", href: "/dashboard/settings/plans" } },
  // ── AI/BOM/PDF 활용 ──
  { id: "ai-1", category: "ai-bom-pdf", icon: FileUp, title: "PDF 업로드 및 분석", what: "카탈로그, 견적서, 발주서 PDF를 업로드하면 AI가 품목을 자동 추출합니다.", when: "종이 견적서나 카탈로그 PDF에서 품목을 빠르게 추출하고 싶을 때", keyInputs: ["PDF 파일 (텍스트 기반 권장)"], nextAction: "추출 결과 확인 → 비교/견적 연결", link: { label: "PDF 분석 시작", href: "/dashboard/quotes" } },
  { id: "ai-2", category: "ai-bom-pdf", icon: ClipboardPaste, title: "PDF 분석 실패 시 대체 경로 (텍스트 붙여넣기)", what: "스캔본·암호화·손상 PDF 등으로 분석에 실패하면, 품목 목록을 직접 텍스트로 붙여넣어 동일한 BOM 추출 결과를 얻을 수 있습니다.", when: "PDF 분석이 실패하거나 이미지 기반 스캔 PDF를 사용할 때", keyInputs: ["품목 목록 텍스트 (줄바꿈 구분)"], nextAction: "AI 파싱 결과 확인 → 비교/견적 연결", link: { label: "견적 생성 열기", href: "/dashboard/quotes" } },
  { id: "ai-3", category: "ai-bom-pdf", icon: Brain, title: "BOM 추출", what: "실험 프로토콜이나 논문 PDF에서 필요한 시약 목록(BOM)을 자동 추출합니다.", when: "실험 계획서에서 필요 물품을 한 번에 추출하고 싶을 때", keyInputs: ["PDF 파일", "추출 범위 설정"], nextAction: "BOM 목록 검토 → 검색/견적 연결", link: { label: "BOM 추출 시작", href: "/dashboard/quotes" } },
  { id: "ai-4", category: "ai-bom-pdf", icon: Sparkles, title: "AI 텍스트 대체", what: "제품명이 약어이거나 불분명할 때 AI가 정확한 정식 제품명을 제안합니다.", when: "검색 결과가 부정확하거나 품목 특정이 어려울 때", keyInputs: ["원본 텍스트"], nextAction: "대체 결과 확인 → 검색 재실행", link: { label: "검색에서 사용하기", href: "/dashboard/search" } },
  // ── 역할별 가이드 ──
  { id: "role-1", category: "role-guide", icon: UserCog, title: "연구원 (Requester)", what: "시약 검색, 비교, 견적 요청을 주로 수행하며, 입고된 시약의 재고를 관리합니다.", when: "실험에 필요한 시약을 직접 찾아 요청해야 할 때", keyInputs: [], nextAction: "검색 → 비교 → 견적 요청", link: { label: "검색 시작하기", href: "/dashboard/search" } },
  { id: "role-2", category: "role-guide", icon: ShoppingCart, title: "구매 담당 (Approver)", what: "연구원이 요청한 견적을 검토·승인하고 벤더와의 커뮤니케이션 및 발주를 처리합니다.", when: "견적 승인 요청이 도착했을 때", keyInputs: [], nextAction: "견적 검토 → 승인/반려 → 발주", link: { label: "견적 관리로 이동", href: "/dashboard/quotes" } },
  { id: "role-3", category: "role-guide", icon: BarChart3, title: "랩 매니저 (Admin)", what: "팀 전체의 예산, 재고, 구매 현황을 모니터링하고 보고서를 생성합니다.", when: "팀 운영 현황을 종합적으로 파악해야 할 때", keyInputs: [], nextAction: "대시보드 → 분석 → 보고서", link: { label: "분석 보기", href: "/dashboard/analytics" } },
  { id: "role-4", category: "role-guide", icon: Shield, title: "관리자 (Owner)", what: "조직 설정, 멤버 관리, 구독·결제, 보안 정책 등 시스템 전반을 관리합니다. Owner는 조직당 1명으로, 결제·삭제·소유권 이전 등 최고 권한을 보유합니다.", when: "조직 레벨의 설정 변경이 필요할 때", keyInputs: [], nextAction: "조직 설정 → 멤버 → 구독 관리", link: { label: "조직 설정으로 이동", href: "/dashboard/organizations" } },
];

/* ═══════════════════════════════════════════════════════════════════
   Tab 2: 문제 해결 — 시나리오 런북 데이터
   ═══════════════════════════════════════════════════════════════════ */

const RUNBOOK_CATEGORIES = [
  { value: "all", label: "전체" },
  { value: "account", label: "계정/로그인" },
  { value: "search-compare", label: "검색/비교/견적" },
  { value: "purchase-inventory", label: "구매/재고" },
  { value: "org-role", label: "조직/권한" },
  { value: "notification", label: "알림/이메일" },
  { value: "ai-pdf", label: "PDF/BOM/AI" },
  { value: "billing", label: "구독/결제" },
  { value: "error", label: "오류 해결" },
];

interface RunbookItem {
  id: string;
  category: string;
  symptom: string;
  impact: string;
  possibleCauses: string[];
  immediateActions: string[];
  escalation: string;
  relatedGuide?: { label: string; href: string };
  cta?: { label: string; href: string };
}

const RUNBOOK_ITEMS: RunbookItem[] = [
  // ── 계정/로그인 ──
  {
    id: "rb-acc-1", category: "account",
    symptom: "비밀번호를 잊어 로그인할 수 없음",
    impact: "서비스 접근 불가",
    possibleCauses: ["비밀번호 분실", "소셜 로그인 전용 계정에서 이메일 로그인 시도"],
    immediateActions: ["로그인 화면에서 '비밀번호 찾기' 클릭", "등록된 이메일로 재설정 링크 발송 (24시간 유효)", "소셜 계정인 경우 해당 소셜 로그인으로 접속"],
    escalation: "재설정 이메일이 도착하지 않으면 스팸 폴더 확인 후 지원 티켓 접수",
    cta: { label: "로그인 페이지로 이동", href: "/auth/signin" },
  },
  {
    id: "rb-acc-2", category: "account",
    symptom: "계정 삭제를 원하지만 Owner 역할이라 진행이 안 됨",
    impact: "계정 정리 불가",
    possibleCauses: ["조직 Owner가 소유권을 이전하지 않음"],
    immediateActions: ["조직 설정 > 소유권 이전에서 Admin 중 한 명을 새 Owner로 지정", "이전 완료 후 설정 > 계정 > 계정 삭제 진행", "삭제 후 30일 유예 기간 내 로그인 시 삭제 취소 가능"],
    escalation: "소유권 이전 대상자가 없으면 지원 티켓으로 조직 해산 요청",
    cta: { label: "계정 설정으로 이동", href: "/dashboard/settings" },
  },
  // ── 검색/비교/견적 ──
  {
    id: "rb-sc-1", category: "search-compare",
    symptom: "검색 결과가 너무 많아 원하는 품목을 특정할 수 없음",
    impact: "비교·견적 진행 지연",
    possibleCauses: ["일반 명칭으로 검색", "필터를 적용하지 않음"],
    immediateActions: ["CAS 번호 또는 카탈로그 번호로 검색", "브랜드·용량·규격 필터를 조합하여 결과 축소", "AI 텍스트 대체 기능으로 약어를 정식 명칭으로 변환"],
    escalation: "제품이 데이터베이스에 없는 경우 지원 티켓으로 품목 추가 요청",
    cta: { label: "검색 시작하기", href: "/dashboard/search" },
  },
  {
    id: "rb-sc-2", category: "search-compare",
    symptom: "견적 요청 후 현재 상태를 확인할 수 없음",
    impact: "구매 일정 관리 어려움",
    possibleCauses: ["견적 관리 페이지를 확인하지 않음", "알림 설정이 꺼져 있음"],
    immediateActions: ["견적 관리 페이지에서 진행 상태(요청됨/회신 도착/확정됨) 실시간 확인", "설정 > 알림에서 견적 회신 알림 활성화"],
    escalation: "벤더 회신이 비정상적으로 지연될 경우 지원 티켓 접수",
    cta: { label: "견적 관리로 이동", href: "/dashboard/quotes" },
  },
  // ── 구매/재고 ──
  {
    id: "rb-pi-1", category: "purchase-inventory",
    symptom: "안전재고 알림이 오지 않음",
    impact: "재고 부족 시점을 놓칠 수 있음",
    possibleCauses: ["안전재고 기준이 설정되지 않음", "알림 채널(이메일/인앱)이 꺼져 있음"],
    immediateActions: ["재고 목록에서 품목 클릭 → 안전재고 기준 수량 설정", "설정 > 알림에서 재고 알림 채널 활성화 확인"],
    escalation: "설정 후에도 알림이 발송되지 않으면 지원 티켓 접수",
    relatedGuide: { label: "안전재고 관리 가이드", href: "/dashboard/support-center" },
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "rb-pi-2", category: "purchase-inventory",
    symptom: "CSV/엑셀 업로드로 구매 이력 등록 시 일부 행이 누락됨",
    impact: "구매 이력 불일치",
    possibleCauses: ["CSV 인코딩 문제 (UTF-8 아닌 경우)", "필수 필드 누락", "파일 크기 초과 (50MB 제한)"],
    immediateActions: ["파일을 UTF-8 인코딩으로 저장 후 재업로드", "업로드 전 미리보기에서 필드 매핑 결과 확인", "50MB 초과 시 파일 분할"],
    escalation: "반복 실패 시 오류 메시지와 원본 파일을 첨부하여 지원 티켓 접수",
    cta: { label: "구매 운영 보기", href: "/dashboard/purchases" },
  },
  {
    id: "rb-pi-3", category: "purchase-inventory",
    symptom: "유효기간이 임박한 재고를 일괄 확인하고 싶음",
    impact: "만료 시약 사용 위험",
    possibleCauses: ["필터 사용법을 모름"],
    immediateActions: ["재고 관리 페이지에서 '유효기간 임박' 필터 적용", "알림 설정에서 만료 N일 전 경고 활성화"],
    escalation: "해당 없음 — 자가 해결 가능",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  // ── 조직/권한 ──
  {
    id: "rb-org-1", category: "org-role",
    symptom: "팀원이 초대 이메일을 받지 못함",
    impact: "팀 합류 지연",
    possibleCauses: ["입력한 이메일 주소 오류", "스팸/정크 폴더로 분류", "회사 이메일 보안 정책으로 외부 메일 차단"],
    immediateActions: ["수신자에게 스팸/정크 폴더 확인 요청", "조직 관리자가 이메일 주소 정확성 재확인", "IT 부서에 noreply@labaxis.io 도메인 허용 요청"],
    escalation: "위 조치 후에도 미수신이면 지원 티켓으로 수동 초대 요청",
    cta: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },
  // ── 알림/이메일 ──
  {
    id: "rb-noti-1", category: "notification",
    symptom: "이메일 알림이 오지 않음",
    impact: "견적 회신, 재고 경고 등 중요 알림 놓침",
    possibleCauses: ["이메일 알림 설정 꺼짐", "스팸 폴더로 분류", "등록 이메일 주소 오류"],
    immediateActions: ["스팸/정크 폴더 확인", "설정 > 알림에서 이메일 알림 활성화 여부 확인", "등록된 이메일 주소가 정확한지 확인"],
    escalation: "설정 정상인데도 미수신이면 지원 티켓 접수",
    cta: { label: "알림 설정 확인", href: "/dashboard/settings" },
  },
  // ── PDF/BOM/AI ──
  {
    id: "rb-ai-1", category: "ai-pdf",
    symptom: "PDF 분석이 실패함",
    impact: "품목 자동 추출 불가 → 수동 입력 필요",
    possibleCauses: ["이미지 기반 스캔 PDF (텍스트 선택 불가)", "암호화된 파일", "손상된 파일", "50MB 초과"],
    immediateActions: ["텍스트 선택이 가능한 PDF로 재업로드", "파일 크기 50MB 이하 확인", "대안: 견적 생성 > '텍스트 입력' 탭에서 품목 목록 직접 붙여넣기"],
    escalation: "지원이 필요한 파일 형식이면 지원 티켓으로 파일 첨부 후 문의",
    relatedGuide: { label: "PDF 분석 가이드", href: "/dashboard/support-center" },
    cta: { label: "견적 생성 열기", href: "/dashboard/quotes" },
  },
  {
    id: "rb-ai-2", category: "ai-pdf",
    symptom: "BOM 추출 결과가 부정확함",
    impact: "잘못된 품목으로 견적 요청 가능",
    possibleCauses: ["원본 PDF의 품목명이 약어 또는 불완전", "복잡한 테이블 구조"],
    immediateActions: ["추출 결과 화면에서 품목명·수량·단위 직접 수정", "불필요한 항목 삭제 후 '확정'", "AI 텍스트 대체 기능으로 약어를 정식 명칭으로 변환"],
    escalation: "반복적으로 추출 품질이 낮으면 지원 티켓으로 개선 요청",
    relatedGuide: { label: "BOM 추출 가이드", href: "/dashboard/support-center" },
  },
  // ── 구독/결제 ──
  {
    id: "rb-bill-1", category: "billing",
    symptom: "해지 후 데이터가 어떻게 되는지 확인하고 싶음",
    impact: "데이터 손실 우려",
    possibleCauses: ["해지 프로세스에 대한 정보 부족"],
    immediateActions: ["해지 시 현재 결제 주기 종료까지 서비스 유지", "이후 90일간 데이터 보관", "90일 내 재구독 시 데이터 복원", "90일 경과 후 영구 삭제"],
    escalation: "데이터 백업이 필요하면 지원 티켓으로 내보내기 요청",
    relatedGuide: { label: "해지 흐름 가이드", href: "/dashboard/support-center" },
  },
  // ── 오류 해결 ──
  {
    id: "rb-err-1", category: "error",
    symptom: "페이지가 로딩되지 않거나 빈 화면이 나타남",
    impact: "서비스 이용 불가",
    possibleCauses: ["브라우저 캐시 문제", "오래된 브라우저 버전", "네트워크 연결 불안정"],
    immediateActions: ["브라우저 캐시 삭제 후 새로고침 (Ctrl+Shift+R)", "Chrome, Edge, Safari 최신 버전으로 업데이트", "네트워크 연결 확인"],
    escalation: "문제 지속 시 브라우저 콘솔 스크린샷과 함께 지원 티켓 접수",
  },
  {
    id: "rb-err-2", category: "error",
    symptom: "파일 업로드가 계속 실패함",
    impact: "PDF 분석, 증빙 첨부 등 업로드 기반 기능 사용 불가",
    possibleCauses: ["파일 크기 초과 (최대 50MB)", "지원하지 않는 형식", "VPN 환경에서의 네트워크 제한"],
    immediateActions: ["파일 크기(50MB)와 형식(PDF, CSV, XLSX, 이미지) 확인", "VPN 일시 해제 후 재시도", "안정적인 네트워크 환경에서 업로드"],
    escalation: "반복 실패 시 오류 메시지와 함께 지원 티켓 접수",
  },
  {
    id: "rb-err-3", category: "error",
    symptom: "견적 요청 제출 시 오류가 발생함",
    impact: "견적 요청 진행 불가",
    possibleCauses: ["필수 항목(품목명, 수량) 미입력", "특수문자 포함", "네트워크 불안정"],
    immediateActions: ["필수 항목 모두 입력 확인", "특수문자 제거 후 재시도", "네트워크 상태 확인"],
    escalation: "오류 메시지와 함께 지원 티켓 접수",
  },
];

/* ═══════════════════════════════════════════════════════════════════
   Tab 3: 지원 티켓 — 데이터
   ═══════════════════════════════════════════════════════════════════ */

const TICKET_CATEGORIES = [
  { value: "search", label: "시약·장비 검색", icon: Search },
  { value: "quote", label: "견적 요청·비교", icon: ShoppingCart },
  { value: "inventory", label: "재고 관리", icon: Package },
  { value: "purchase", label: "구매 운영·이력", icon: BarChart3 },
  { value: "team", label: "팀·조직 관리", icon: Users },
  { value: "account", label: "계정·결제", icon: CreditCard },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "낮음", description: "일반 문의, 기능 개선 제안" },
  { value: "medium", label: "보통", description: "사용 중 불편 사항" },
  { value: "high", label: "높음", description: "업무 진행 차단 이슈" },
];

const MOCK_TICKETS = [
  { id: "TK-001", title: "견적 요청 메일이 벤더에게 전송되지 않습니다", category: "quote", status: "answered", createdAt: "2026-03-08", answeredAt: "2026-03-09" },
  { id: "TK-002", title: "CSV 업로드 시 일부 행이 누락됩니다", category: "purchase", status: "in_progress", createdAt: "2026-03-10", answeredAt: null },
];

/* ═══════════════════════════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════════════════════════ */

type TabId = "manual" | "troubleshoot" | "ticket";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "manual", label: "운영 매뉴얼", icon: BookOpen },
  { id: "troubleshoot", label: "문제 해결", icon: Wrench },
  { id: "ticket", label: "지원 티켓", icon: MessageSquare },
];

function isTabId(value: string | null): value is TabId {
  return value === "manual" || value === "troubleshoot" || value === "ticket";
}

export default function SupportCenterPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") ?? null;

  const [activeTab, setActiveTab] = useState<TabId>(
    isTabId(tabParam) ? tabParam : "manual"
  );

  // URL → state 동기화 (외부 deep link 진입 시)
  useEffect(() => {
    if (isTabId(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // activeTab을 의존성에서 빼서 사용자 클릭이 URL에 의해 덮이지 않게 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  // ── Ontology contextual layer: support 진입 시 recovery-mode 주입 ──
  // `?from=/dashboard/orders&sourceEntityType=order&sourceEntityId=ORD-001`
  // 파라미터가 있으면 ontology drawer 가 "원래 작업으로 복귀" recovery CTA 를 만든다.
  // 파라미터가 없으면 drawer 는 null (resolver 가 support_center route 에서 direct entry 로 간주 → 비노출).
  const ontologyUpdate = useOntologyContextLayerStore((s) => s.updateContext);
  useEffect(() => {
    const fromRoute = searchParams?.get("from") ?? null;
    const sourceEntityType = searchParams?.get("sourceEntityType") ?? undefined;
    const sourceEntityId = searchParams?.get("sourceEntityId") ?? undefined;
    const sourceLabel = searchParams?.get("sourceLabel") ?? undefined;

    ontologyUpdate(pathname ?? "/dashboard/support-center", {
      sourceContext: fromRoute
        ? {
            sourceRoute: fromRoute,
            sourceEntityType,
            sourceEntityId,
            sourceLabel,
          }
        : null,
    });
    // pathname / searchParams 만 의존 — activeTab 변경 시 재주입할 필요 없음
  }, [pathname, searchParams, ontologyUpdate]);

  const handleTabChange = (next: TabId) => {
    setActiveTab(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ── 통합 검색 (Phase 5) ──
  // 문서 / 런북 / 티켓을 한 입력창에서 탐색. same-canvas 유지.
  const [globalSearch, setGlobalSearch] = useState("");
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return null;

    const manualHits = GUIDE_ENTRIES.filter(
      (e) => e.title.toLowerCase().includes(q) || e.what.toLowerCase().includes(q) || e.when.toLowerCase().includes(q),
    ).slice(0, 4).map((e) => ({ type: "manual" as const, id: e.id, title: e.title, desc: e.what, href: e.link.href }));

    const runbookHits = RUNBOOK_ITEMS.filter(
      (r) => r.symptom.toLowerCase().includes(q) || r.possibleCauses.some((c) => c.toLowerCase().includes(q)),
    ).slice(0, 4).map((r) => ({ type: "troubleshoot" as const, id: r.id, title: r.symptom, desc: r.impact, href: null }));

    const ticketHits = MOCK_TICKETS.filter(
      (t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
    ).slice(0, 3).map((t) => ({ type: "ticket" as const, id: t.id, title: t.title, desc: t.id, href: null }));

    // 현재 탭 결과를 우선 정렬
    const all = [...manualHits, ...runbookHits, ...ticketHits];
    all.sort((a, b) => {
      const aMatch = a.type === activeTab ? 0 : 1;
      const bMatch = b.type === activeTab ? 0 : 1;
      return aMatch - bMatch;
    });

    return all.length > 0 ? all : null;
  }, [globalSearch, activeTab]);

  return (
    <div className="flex-1 pt-2 md:pt-4 max-w-5xl mx-auto w-full">
      {/* ── 헤더 + Context Strip ── */}
      <div className="mb-5 px-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">
          운영 지원 센터
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          운영 중 필요한 문서, 문제 해결, 지원 요청을 같은 화면에서 처리합니다.
        </p>
        {/* Context strip — 진입 경로가 있으면 표시 */}
        {(() => {
          const fromRoute = searchParams?.get("from") ?? null;
          const sourceLabel = searchParams?.get("sourceLabel") ?? null;
          const sourceEntityId = searchParams?.get("sourceEntityId") ?? null;
          if (!fromRoute && !sourceEntityId) return null;
          const moduleLabel = sourceLabel ?? fromRoute?.split("/").pop() ?? "이전 화면";
          return (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {sourceEntityId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
                  <FileText className="h-3 w-3" />
                  {sourceEntityId}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
                진입 경로: {moduleLabel}
              </span>
              <Link href={fromRoute ?? "/dashboard"}>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                  원래 작업으로 복귀 <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          );
        })()}
      </div>

      {/* ── 통합 검색 (Phase 5) ── */}
      <div className="relative mb-4 px-1" style={{ zIndex: 30 }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="문서, 문제 해결, 티켓을 한 번에 검색 (예: PDF 실패, 승인, 재고)"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="pl-10 h-10 bg-slate-50 border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 rounded-xl"
        />
        {globalSearch && (
          <button
            onClick={() => setGlobalSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {/* 검색 결과 드롭다운 — same-canvas 안에서 표시 */}
        {globalSearchResults && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
            {globalSearchResults.map((r) => {
              const typeLabel = r.type === "manual" ? "매뉴얼" : r.type === "troubleshoot" ? "문제 해결" : "티켓";
              const typeColor = r.type === "manual" ? "bg-blue-50 text-blue-600" : r.type === "troubleshoot" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600";
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                  onClick={() => {
                    setGlobalSearch("");
                    if (r.type !== activeTab) handleTabChange(r.type as TabId);
                    // 탭 내부 검색으로 handoff: 각 탭이 자체 search 로 이어받음
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge className={`text-[9px] px-1.5 py-0 border-0 ${typeColor}`}>{typeLabel}</Badge>
                    {r.type === activeTab && (
                      <span className="text-[9px] text-blue-500 font-medium">현재 탭</span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-700 truncate">{r.title}</p>
                  <p className="text-[11px] text-slate-400 truncate">{r.desc}</p>
                </button>
              );
            })}
          </div>
        )}
        {globalSearch && !globalSearchResults && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-6 text-center">
            <Search className="h-6 w-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">검색 결과가 없습니다</p>
          </div>
        )}
      </div>

      {/* ── 탭 네비게이션 ── */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 탭 콘텐츠 ── */}
      {activeTab === "manual" && <ManualTab />}
      {activeTab === "troubleshoot" && (
        <TroubleshootTab
          onCreateTicketFromRunbook={(title, body) => {
            // 티켓 탭으로 전환 + prefill URL params 주입
            const params = new URLSearchParams(searchParams?.toString() ?? "");
            params.set("tab", "ticket");
            params.set("ticketTitle", title);
            params.set("ticketBody", body);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            setActiveTab("ticket");
          }}
        />
      )}
      {activeTab === "ticket" && <TicketTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tab 1: 운영 매뉴얼
   ═══════════════════════════════════════════════════════════════════ */

function ManualTab() {
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
          e.keyInputs.some((k) => k.toLowerCase().includes(q)),
      );
    } else {
      items = items.filter((e) => e.category === activeCategory);
    }
    return items;
  }, [activeCategory, searchQuery]);

  const activeCategoryMeta = GUIDE_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div>
      {/* 검색바 */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="매뉴얼 검색 (예: 견적 요청, 재고, PDF 분석)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* 최근 업데이트 */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-900">최근 업데이트</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {RECENT_UPDATES.map((update, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-white border border-slate-200 px-3.5 py-3">
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

      {/* 메인 레이아웃: 사이드바 + 콘텐츠 */}
      <div className="flex gap-5">
        {/* 데스크탑 사이드바 */}
        <nav className="hidden md:block w-52 flex-shrink-0">
          <div className="sticky top-4 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold px-3 mb-2">카테고리</p>
            {GUIDE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = !searchQuery && activeCategory === cat.id;
              const count = GUIDE_ENTRIES.filter((e) => e.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                  <span className="truncate">{cat.label}</span>
                  <span className={`ml-auto text-[10px] ${isActive ? "text-blue-500" : "text-slate-500"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* 모바일 카테고리 탭 */}
        <div className="md:hidden w-full">
          <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide snap-x mb-4">
            {GUIDE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = !searchQuery && activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 snap-start ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-500"}`} />
                  {cat.label}
                </button>
              );
            })}
          </div>
          <ManualContent entries={filteredEntries} searchQuery={searchQuery} activeCategoryMeta={activeCategoryMeta} />
        </div>

        {/* 데스크탑 콘텐츠 */}
        <div className="hidden md:block flex-1 min-w-0">
          <ManualContent entries={filteredEntries} searchQuery={searchQuery} activeCategoryMeta={activeCategoryMeta} />
        </div>
      </div>
    </div>
  );
}

function ManualContent({
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
      <div className="rounded-xl bg-slate-50 border border-slate-200 py-16 text-center">
        <Search className="h-8 w-8 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500 mb-1">검색 결과가 없습니다</p>
        <p className="text-xs text-slate-500">다른 키워드로 검색하거나 카테고리를 변경해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!searchQuery && activeCategoryMeta && (
        <div className="flex items-center gap-2 mb-1">
          <activeCategoryMeta.icon className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-700">{activeCategoryMeta.label}</h2>
          <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 border-slate-200 text-slate-500">
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
          <Card key={entry.id} className="bg-white border-slate-200 hover:border-slate-300 transition-colors overflow-hidden">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">{entry.title}</h3>
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-16 flex-shrink-0 pt-0.5">기능</span>
                      <p className="text-xs text-slate-600 leading-relaxed">{entry.what}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-16 flex-shrink-0 pt-0.5">사용 시점</span>
                      <p className="text-xs text-slate-500 leading-relaxed">{entry.when}</p>
                    </div>
                    {entry.keyInputs.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-16 flex-shrink-0 pt-0.5">주요 입력</span>
                        <div className="flex flex-wrap gap-1">
                          {entry.keyInputs.map((input, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-500 bg-slate-50">{input}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-16 flex-shrink-0 pt-0.5">다음 단계</span>
                      <div className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3 text-emerald-500" />
                        <p className="text-xs text-emerald-600">{entry.nextAction}</p>
                      </div>
                    </div>
                  </div>
                  <Link href={entry.link.href}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 text-slate-500 bg-transparent hover:bg-slate-50 hover:text-slate-700 hover:border-blue-300">
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

/* ═══════════════════════════════════════════════════════════════════
   Tab 2: 문제 해결 (시나리오 런북)
   ═══════════════════════════════════════════════════════════════════ */

function TroubleshootTab({ onCreateTicketFromRunbook }: { onCreateTicketFromRunbook?: (title: string, body: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredItems = useMemo(() => {
    let items = RUNBOOK_ITEMS;
    if (activeCategory !== "all") {
      items = items.filter((r) => r.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (r) =>
          r.symptom.toLowerCase().includes(q) ||
          r.possibleCauses.some((c) => c.toLowerCase().includes(q)) ||
          r.immediateActions.some((a) => a.toLowerCase().includes(q)),
      );
    }
    return items;
  }, [activeCategory, searchQuery]);

  const getCategoryColor = (cat: string) => {
    const colorMap: Record<string, string> = {
      account: "bg-violet-50 text-violet-600 border-violet-200",
      "search-compare": "bg-blue-50 text-blue-600 border-blue-200",
      "purchase-inventory": "bg-emerald-50 text-emerald-600 border-emerald-200",
      "org-role": "bg-amber-50 text-amber-600 border-amber-200",
      notification: "bg-cyan-50 text-cyan-600 border-cyan-200",
      "ai-pdf": "bg-indigo-50 text-indigo-600 border-indigo-200",
      billing: "bg-pink-50 text-pink-600 border-pink-200",
      error: "bg-red-50 text-red-600 border-red-200",
    };
    return colorMap[cat] || "bg-slate-50 text-slate-500 border-slate-200";
  };

  const getCategoryLabel = (cat: string) => {
    return RUNBOOK_CATEGORIES.find((c) => c.value === cat)?.label || cat;
  };

  return (
    <div>
      {/* 검색바 */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="증상 검색 (예: PDF 실패, 알림 안 옴, 비밀번호)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide snap-x mb-5">
        {RUNBOOK_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 snap-start ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700"
              }`}
            >
              {cat.label}
              <span className={`text-[10px] ml-0.5 ${isActive ? "text-blue-200" : "text-slate-500"}`}>
                {cat.value === "all" ? RUNBOOK_ITEMS.length : RUNBOOK_ITEMS.filter((r) => r.category === cat.value).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* 결과 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          {searchQuery ? `"${searchQuery}" 검색 결과 ${filteredItems.length}건` : `${filteredItems.length}개의 시나리오`}
        </p>
        {filteredItems.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => setExpandedIds(new Set(filteredItems.map((r) => r.id)))} className="text-[11px] text-slate-500 hover:text-slate-600 transition-colors">모두 펼치기</button>
            <span className="text-slate-400">|</span>
            <button onClick={() => setExpandedIds(new Set())} className="text-[11px] text-slate-500 hover:text-slate-600 transition-colors">모두 접기</button>
          </div>
        )}
      </div>

      {/* 런북 목록 */}
      <div className="space-y-2 mb-8">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 py-16 text-center">
            <Search className="h-8 w-8 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 mb-1">검색 결과가 없습니다</p>
            <p className="text-xs text-slate-500 mb-4">다른 키워드로 검색하거나 카테고리를 변경해보세요.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isExpanded ? "bg-white border-slate-300 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* 증상 헤더 */}
                <button onClick={() => toggleExpand(item.id)} className="w-full text-left px-4 md:px-5 py-4 flex items-start gap-3 group">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isExpanded ? "bg-amber-50" : "bg-slate-100"}`}>
                    <AlertTriangle className={`h-3 w-3 transition-colors ${isExpanded ? "text-amber-500" : "text-slate-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className={`text-[10px] px-1.5 py-0 border font-medium ${getCategoryColor(item.category)}`}>
                        {getCategoryLabel(item.category)}
                      </Badge>
                      <span className="text-[10px] text-slate-500">영향: {item.impact}</span>
                    </div>
                    <p className={`text-sm font-medium leading-snug transition-colors ${isExpanded ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"}`}>
                      {item.symptom}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500 flex-shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1 group-hover:text-slate-500" />}
                </button>

                {/* 런북 상세 */}
                {isExpanded && (
                  <div className="px-4 md:px-5 pb-5 border-t border-slate-200">
                    <div className="space-y-4 pt-4">
                      {/* 가능한 원인 */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Target className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">가능한 원인</span>
                        </div>
                        <div className="space-y-1 ml-5">
                          {item.possibleCauses.map((cause, i) => (
                            <p key={i} className="text-xs text-slate-500 leading-relaxed flex items-start gap-2">
                              <span className="text-slate-400 mt-0.5">-</span>{cause}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* 즉시 조치 */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Zap className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">즉시 조치</span>
                        </div>
                        <div className="space-y-1.5 ml-5">
                          {item.immediateActions.map((action, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">{i + 1}</span>
                              <p className="text-xs text-slate-600 leading-relaxed">{action}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 에스컬레이션 기준 */}
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5">
                        <div className="flex items-start gap-2">
                          <ArrowUpRight className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">에스컬레이션 기준</span>
                            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">{item.escalation}</p>
                          </div>
                        </div>
                      </div>

                      {/* 하단 CTA */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {item.relatedGuide && (
                          <Link href={item.relatedGuide.href}>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 text-slate-500 bg-transparent hover:bg-slate-50 hover:text-slate-700">
                              <BookOpen className="h-3 w-3" />
                              {item.relatedGuide.label}
                            </Button>
                          </Link>
                        )}
                        {item.cta && (
                          <Link href={item.cta.href}>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-blue-200 text-blue-600 bg-transparent hover:bg-blue-50 hover:text-blue-700">
                              {item.cta.label}
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                        {onCreateTicketFromRunbook && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs border-amber-200 text-amber-600 bg-transparent hover:bg-amber-50 hover:text-amber-700"
                            onClick={() => {
                              const body = [
                                `증상: ${item.symptom}`,
                                `영향: ${item.impact}`,
                                `가능한 원인: ${item.possibleCauses.join(", ")}`,
                                "",
                                "즉시 조치 수행 결과:",
                                ...item.immediateActions.map((a, i) => `${i + 1}. ${a} → (결과 기입)`),
                                "",
                                "추가 설명:",
                              ].join("\n");
                              onCreateTicketFromRunbook(
                                `[문제 해결] ${item.symptom}`,
                                body,
                              );
                            }}
                          >
                            <MessageSquare className="h-3 w-3" />
                            이 이슈로 티켓 생성
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tab 3: 지원 티켓
   ═══════════════════════════════════════════════════════════════════ */

function TicketTab() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // ── Source context prefill (ontology recovery mode + runbook handoff) ──
  // Source 1: URL params — ?from=<route>&sourceEntityType=<type>&sourceEntityId=<id>
  // Source 2: Runbook → ticket — ?ticketTitle=<title>&ticketBody=<body>
  const srcFromRoute = searchParams?.get("from") ?? null;
  const srcEntityType = searchParams?.get("sourceEntityType") ?? null;
  const srcEntityId = searchParams?.get("sourceEntityId") ?? null;
  const srcLabel = searchParams?.get("sourceLabel") ?? null;
  const ticketTitleParam = searchParams?.get("ticketTitle") ?? null;
  const ticketBodyParam = searchParams?.get("ticketBody") ?? null;
  const hasSourceContext = Boolean(srcFromRoute || srcEntityId || ticketTitleParam);

  const [view, setView] = useState<"list" | "compose">(
    hasSourceContext ? "compose" : "list",
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [relatedResource, setRelatedResource] = useState(() => {
    if (srcEntityId) {
      return srcEntityType
        ? `${srcEntityType}: ${srcEntityId}`
        : srcEntityId;
    }
    return srcLabel ?? srcFromRoute ?? "";
  });
  const [title, setTitle] = useState(() => {
    if (ticketTitleParam) return ticketTitleParam;
    if (srcEntityId) return `[${srcEntityType ?? "이슈"}] ${srcEntityId} 관련 문의`;
    if (srcLabel) return `${srcLabel} 관련 문의`;
    return "";
  });
  const [body, setBody] = useState(() => {
    if (ticketBodyParam) return ticketBodyParam;
    if (!hasSourceContext) return "";
    const lines: string[] = [];
    lines.push("진입 경로: " + (srcFromRoute ?? "(미상)"));
    if (srcEntityId) lines.push(`대상: ${srcEntityType ?? "entity"} / ${srcEntityId}`);
    lines.push("");
    lines.push("문제 상황:");
    lines.push("");
    lines.push("재현 단계:");
    return lines.join("\n");
  });
  const [priority, setPriority] = useState("medium");
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

  const resetForm = () => {
    setCategory("");
    setRelatedResource("");
    setTitle("");
    setBody("");
    setPriority("medium");
    setAttachments([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title.trim() || !body.trim()) {
      toast({ title: "필수 항목을 입력해주세요", description: "관련 기능, 제목, 내용을 모두 입력해 주세요.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast({ title: "문의가 접수되었습니다", description: "담당자가 확인 후 답변드리겠습니다." });
    resetForm();
    setIsSubmitting(false);
    setView("list");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-500 bg-transparent gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />접수 대기
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-600 bg-blue-50 gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />확인 중
          </Badge>
        );
      case "answered":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-600 bg-emerald-50 gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />답변 완료
          </Badge>
        );
      default:
        return null;
    }
  };

  const getCategoryLabel = (val: string) => {
    return TICKET_CATEGORIES.find((c) => c.value === val)?.label || val;
  };

  // ── Desktop: Queue (left) + Compose/Detail (right) split ──
  // ── Mobile: list / compose / detail 단일 뷰 전환 ──

  const ticketQueueRail = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">내 티켓</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-blue-600 hover:bg-blue-50"
          onClick={() => { setView("compose"); setSelectedTicketId(null); }}
        >
          <Send className="h-3 w-3 mr-1" />새 문의
        </Button>
      </div>
      {MOCK_TICKETS.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="h-6 w-6 text-slate-300 mx-auto mb-2" />
          <p className="text-[11px] text-slate-500">접수한 문의가 없습니다</p>
        </div>
      ) : (
        MOCK_TICKETS.map((ticket) => {
          const isSelected = selectedTicketId === ticket.id;
          return (
            <button
              key={ticket.id}
              onClick={() => { setSelectedTicketId(ticket.id); setView("list"); }}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                isSelected
                  ? "border-blue-300 bg-blue-50/60"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-slate-500">{ticket.id}</span>
                {getStatusBadge(ticket.status)}
              </div>
              <p className="text-xs font-medium text-slate-700 leading-snug truncate">{ticket.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-200 text-slate-500">
                  {getCategoryLabel(ticket.category)}
                </Badge>
                <span className="text-[10px] text-slate-400">{ticket.createdAt}</span>
              </div>
            </button>
          );
        })
      )}
      {/* 지원 안내 (compact) */}
      <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
        <p className="text-[10px] font-semibold text-slate-500 mb-1.5">지원 안내</p>
        <p className="text-[10px] text-slate-400 leading-relaxed">평일 09-18시 접수 기준 당일 1차 확인</p>
        <p className="text-[10px] text-slate-400 leading-relaxed">접수 → 배정 → 확인 → 답변 → 완료</p>
      </div>
    </div>
  );

  // 선택된 티켓 상세 (간단 버전)
  const selectedTicket = MOCK_TICKETS.find((t) => t.id === selectedTicketId);
  const ticketDetailPanel = selectedTicket ? (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">{selectedTicket.id}</span>
          {getStatusBadge(selectedTicket.status)}
        </div>
        <span className="text-[10px] text-slate-400">{selectedTicket.createdAt}</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-2">{selectedTicket.title}</h3>
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-500 mb-4">
        {getCategoryLabel(selectedTicket.category)}
      </Badge>
      {selectedTicket.status === "answered" && selectedTicket.answeredAt && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 mt-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">답변 완료 ({selectedTicket.answeredAt})</span>
          </div>
          <p className="text-xs text-emerald-600 leading-relaxed">담당자가 답변을 등록했습니다.</p>
        </div>
      )}
      {selectedTicket.status === "in_progress" && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mt-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
            <span className="text-xs font-semibold text-blue-700">담당자 확인 중</span>
          </div>
        </div>
      )}
    </div>
  ) : null;

  // ── Compose form (공통 — desktop/mobile 양쪽에서 사용) ──
  const composeForm = (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-5 py-5">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold text-slate-700">관련 기능 <span className="text-red-500 text-[10px]">필수</span></Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TICKET_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.value;
                return (
                  <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.98] ${isSelected ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-blue-100" : "bg-white border border-slate-200"}`}>
                      <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-blue-600" : "text-slate-500"}`} />
                    </div>
                    <span className={`text-xs font-medium ${isSelected ? "text-blue-700" : "text-slate-600"}`}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="related-resource" className="text-xs font-semibold text-slate-700">관련 주문/견적/재고 ID <span className="text-slate-500 font-normal text-[10px]">(선택)</span></Label>
            <Input id="related-resource" placeholder="예: QT-20260310-001" value={relatedResource} onChange={(e) => setRelatedResource(e.target.value)} className="border-slate-200 bg-slate-50 text-sm text-slate-700 h-10 placeholder:text-slate-500 focus:border-blue-500 focus:bg-white" />
          </div>
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold text-slate-700">우선순위</Label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setPriority(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition-all active:scale-[0.98] ${priority === opt.value ? (opt.value === "high" ? "border-red-200 bg-red-50 ring-1 ring-red-200" : opt.value === "medium" ? "border-amber-200 bg-amber-50 ring-1 ring-amber-200" : "border-blue-200 bg-blue-50 ring-1 ring-blue-200") : "border-slate-200 bg-slate-50 hover:bg-white"}`}>
                  <span className={`text-xs font-semibold ${priority === opt.value ? (opt.value === "high" ? "text-red-600" : opt.value === "medium" ? "text-amber-600" : "text-blue-600") : "text-slate-500"}`}>{opt.label}</span>
                  <p className="text-[10px] mt-0.5 text-slate-500">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-title" className="text-xs font-semibold text-slate-700">제목 <span className="text-red-500 text-[10px]">필수</span></Label>
            <Input id="ticket-title" placeholder="이슈를 간단히 요약해주세요" value={title} onChange={(e) => setTitle(e.target.value)} className="border-slate-200 bg-slate-50 text-sm text-slate-700 h-10 placeholder:text-slate-500 focus:border-blue-500 focus:bg-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-body" className="text-xs font-semibold text-slate-700">상세 내용 <span className="text-red-500 text-[10px]">필수</span></Label>
            <Textarea id="ticket-body" placeholder="문제 상황, 재현 방법, 기대 동작 등을 구체적으로 적어주세요." value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder:text-slate-500 focus:border-blue-500 focus:bg-white resize-none" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700">첨부 파일 <span className="text-slate-500 font-normal text-[10px]">(선택, 최대 5개 · 10MB)</span></Label>
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <Paperclip className="h-3 w-3 text-slate-400" />{file.name}
                  <button type="button" onClick={() => handleRemoveFile(i)} className="text-slate-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors">
                <Paperclip className="h-3 w-3" />파일 선택
                <input type="file" className="hidden" multiple onChange={handleFileAdd} />
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-10 px-6 gap-2 text-sm" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />접수 중...</> : <><Send className="h-4 w-4" />문의 접수하기</>}
            </Button>
            <button type="button" onClick={() => setView("list")} className="text-xs text-slate-500 hover:text-slate-600">취소</button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── Desktop split layout ──
  return (
    <div className="flex gap-5">
      {/* 좌측 큐 (desktop only) */}
      <nav className="hidden md:block w-56 flex-shrink-0">
        <div className="sticky top-4">{ticketQueueRail}</div>
      </nav>

      {/* 모바일: list/compose/detail 단일 뷰 전환 */}
      <div className="md:hidden w-full">
        {view === "list" && !selectedTicketId && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">접수한 문의를 확인하고 새 티켓을 작성할 수 있습니다.</p>
              <Button onClick={() => setView("compose")} className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white h-9 px-4">
                <Send className="h-3.5 w-3.5" />새 문의
              </Button>
            </div>
            {ticketQueueRail}
          </div>
        )}
        {view === "list" && selectedTicketId && ticketDetailPanel && (
          <div>
            <button onClick={() => setSelectedTicketId(null)} className="flex items-center gap-1 text-xs text-slate-500 mb-3">
              <ChevronRight className="h-3 w-3 rotate-180" />목록으로
            </button>
            {ticketDetailPanel}
          </div>
        )}
        {view === "compose" && (
          <div>
            <button onClick={() => { setView("list"); setSelectedTicketId(null); }} className="flex items-center gap-1 text-xs text-slate-500 mb-3">
              <ChevronRight className="h-3 w-3 rotate-180" />목록으로
            </button>
            <h2 className="text-sm font-semibold text-slate-700 mb-4">새 문의 작성</h2>
            {composeForm}
          </div>
        )}
      </div>

      {/* 데스크탑 센터: compose 또는 detail */}
      <div className="hidden md:block flex-1 min-w-0">
        {view === "compose" ? (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => { setView("list"); setSelectedTicketId(null); }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-600 transition-colors"
              >
                <ChevronRight className="h-3 w-3 rotate-180" />
                목록으로
              </button>
              <h2 className="text-sm font-semibold text-slate-700">새 문의 작성</h2>
            </div>
            {composeForm}
          </div>
        ) : selectedTicketId && ticketDetailPanel ? (
          ticketDetailPanel
        ) : (
          <div className="rounded-xl bg-slate-50 border border-slate-200 py-16 text-center">
            <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-1">티켓을 선택하거나 새 문의를 작성하세요</p>
            <Button onClick={() => setView("compose")} variant="outline" size="sm" className="mt-3 gap-1.5 text-xs">
              <Send className="h-3.5 w-3.5" />새 문의 작성
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // compose form 은 위에서 composeForm 로 추출 완료.
}
// ── 아래 이전 compose form 코드는 composeForm 변수로 이동 완료. 남은 잔여물 제거. ──
// (이전 1321~1432 라인 삭제됨)
