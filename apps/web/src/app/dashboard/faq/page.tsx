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
  ChevronDown,
  ChevronUp,
  ArrowRight,
  HelpCircle,
  MessageSquare,
  LogIn,
  GitCompareArrows,
  ShoppingCart,
  Users,
  Bell,
  CreditCard,
  Brain,
  AlertTriangle,
  BookOpen,
  ExternalLink,
} from "lucide-react";

/* ─────────────────────────── 카테고리 ─────────────────────────── */
const FAQ_CATEGORIES = [
  { value: "all", label: "전체", icon: HelpCircle },
  { value: "account", label: "계정/로그인", icon: LogIn },
  { value: "search-compare", label: "검색/비교/견적", icon: GitCompareArrows },
  { value: "purchase-inventory", label: "구매/재고", icon: ShoppingCart },
  { value: "org-role", label: "조직/권한", icon: Users },
  { value: "notification", label: "알림/이메일/하루 한 번 요약", icon: Bell },
  { value: "ai-pdf", label: "PDF/BOM/AI 분석", icon: Brain },
  { value: "billing", label: "구독/결제/해지", icon: CreditCard },
  { value: "error", label: "오류 해결", icon: AlertTriangle },
];

/* ─────────────────────────── FAQ 항목 ─────────────────────────── */
interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  guideLink?: { label: string; href: string };
  cta?: { label: string; href: string };
}

const FAQ_ITEMS: FaqItem[] = [
  // ── 계정/로그인 ──
  {
    id: "acc-1",
    category: "account",
    question: "비밀번호를 잊어버렸는데 어떻게 재설정하나요?",
    answer: "로그인 화면에서 '비밀번호 찾기'를 클릭하면 등록된 이메일로 재설정 링크가 발송됩니다. 링크는 24시간 유효하며, 만료 시 다시 요청할 수 있습니다.",
    cta: { label: "로그인 페이지로 이동", href: "/auth/signin" },
  },
  {
    id: "acc-2",
    category: "account",
    question: "소셜 로그인(Google/GitHub)으로 가입하면 이메일 로그인도 되나요?",
    answer: "소셜 로그인으로 가입하면 해당 소셜 계정으로만 로그인됩니다. 이메일/비밀번호 로그인을 추가로 사용하려면 설정 > 계정에서 비밀번호를 설정할 수 있습니다.",
    cta: { label: "계정 설정으로 이동", href: "/dashboard/settings" },
  },
  {
    id: "acc-3",
    category: "account",
    question: "계정을 완전히 삭제하고 싶은데 어떻게 하나요?",
    answer: "설정 > 계정 > 계정 삭제에서 요청할 수 있습니다. 삭제를 요청하면 30일 유예 기간이 주어지며, 이 기간 내에는 로그인하면 삭제가 취소됩니다. 조직 Owner인 경우 먼저 소유권을 이전해야 합니다.",
    cta: { label: "계정 설정으로 이동", href: "/dashboard/settings" },
  },

  // ── 검색/비교/견적 ──
  {
    id: "sc-1",
    category: "search-compare",
    question: "비교 품목은 어디에서 추가하나요?",
    answer: "통합 검색 결과에서 품목 카드의 '비교에 추가' 버튼을 클릭하면 비교 워크스페이스에 추가됩니다. 비교 워크스페이스에서 직접 품목 이름을 검색하여 추가할 수도 있습니다.",
    guideLink: { label: "비교 워크스페이스 가이드", href: "/dashboard/guide" },
    cta: { label: "비교 워크스페이스 열기", href: "/compare" },
  },
  {
    id: "sc-2",
    category: "search-compare",
    question: "검색 결과가 너무 많아서 원하는 품목을 찾기 어렵습니다.",
    answer: "검색어를 더 구체적으로 입력하면 결과를 좁힐 수 있습니다. CAS 번호나 카탈로그 번호로 검색하면 가장 정확합니다. 또한 필터(브랜드, 용량, 규격)를 조합하여 결과를 좁힐 수 있습니다.",
    cta: { label: "검색 시작하기", href: "/dashboard/search" },
  },
  {
    id: "sc-3",
    category: "search-compare",
    question: "견적 요청은 공급사에 자동 발송되나요?",
    answer: "아닙니다. LabAxis에서 견적을 '요청'하면 시스템 내에서 견적 리스트가 생성되며, 실제 공급사에 대한 발송은 구매 담당자가 별도로 처리합니다. 향후 직접 발송 기능이 추가될 예정입니다.",
    guideLink: { label: "견적 요청 가이드", href: "/dashboard/guide" },
  },
  {
    id: "sc-4",
    category: "search-compare",
    question: "견적 요청 후 현재 상태를 어디서 확인하나요?",
    answer: "견적 관리 페이지에서 요청한 견적의 진행 상태(요청됨, 회신 도착, 확정됨 등)를 실시간으로 확인할 수 있습니다. 벤더 회신이 도착하면 이메일과 인앱 알림으로 동시에 통지됩니다.",
    cta: { label: "견적 관리로 이동", href: "/dashboard/quotes" },
  },
  {
    id: "sc-5",
    category: "search-compare",
    question: "견적 요청을 여러 벤더에 동시에 보낼 수 있나요?",
    answer: "네, 견적 리스트에서 품목을 선택한 후 복수 벤더를 지정하여 한 번에 견적 요청을 보낼 수 있습니다. 회신이 도착하면 비교 테이블에서 가격, 납기, MOQ를 나란히 비교할 수 있습니다.",
    cta: { label: "견적 관리로 이동", href: "/dashboard/quotes" },
  },

  // ── 구매/재고 ──
  {
    id: "pi-1",
    category: "purchase-inventory",
    question: "입고 후 Lot 번호를 변경할 수 있나요?",
    answer: "네, 재고 관리에서 해당 품목을 클릭하면 상세 정보 패널이 열립니다. Lot 번호, 유효기간, 보관 위치 등을 수정할 수 있습니다. 변경 이력은 활동 로그에 자동 기록됩니다.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "pi-2",
    category: "purchase-inventory",
    question: "안전재고 알림은 어떻게 설정하나요?",
    answer: "재고 목록에서 품목을 클릭 후 '안전재고 기준' 항목에 최소 유지 수량을 설정합니다. 재고가 이 수량 이하로 떨어지면 대시보드 경고와 이메일 알림이 발송됩니다. 알림 설정에서 채널을 선택할 수 있습니다.",
    guideLink: { label: "안전재고 관리 가이드", href: "/dashboard/guide" },
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "pi-3",
    category: "purchase-inventory",
    question: "구매 후 증빙 자료(세금계산서, 거래명세서)를 어디서 확인하나요?",
    answer: "구매 운영 페이지에서 각 구매 건의 상세 정보를 확인할 수 있습니다. 증빙 섹션에서 세금계산서, 거래명세서 파일을 직접 첨부하거나 다운로드할 수 있습니다.",
    cta: { label: "구매 운영 보기", href: "/dashboard/purchases" },
  },
  {
    id: "pi-4",
    category: "purchase-inventory",
    question: "엑셀 양식으로 구매 이력을 일괄 등록할 수 있나요?",
    answer: "네, 구매 운영 페이지에서 CSV/엑셀 파일을 업로드하면 시스템이 자동으로 파싱하여 구매 이력에 반영합니다. 업로드 전 미리보기에서 필드 매핑 결과를 확인할 수 있습니다.",
    cta: { label: "구매 운영 보기", href: "/dashboard/purchases" },
  },
  {
    id: "pi-5",
    category: "purchase-inventory",
    question: "유효기간이 임박한 재고를 한꺼번에 확인할 수 있나요?",
    answer: "재고 관리 페이지에서 '유효기간 임박' 필터를 적용하면 만료가 가까운 품목만 모아볼 수 있습니다. 알림 설정에서 만료 N일 전 경고를 켜두면 자동으로 이메일·인앱 알림이 발송됩니다.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "pi-6",
    category: "purchase-inventory",
    question: "재고 부족 품목을 바로 재주문할 수 있나요?",
    answer: "안전재고 이하로 떨어진 품목은 재고 목록에서 '재주문' 버튼이 활성화됩니다. 클릭하면 해당 품목이 견적 요청 양식에 자동으로 채워져 빠르게 재주문을 진행할 수 있습니다.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },

  // ── 조직/권한 ──
  {
    id: "org-1",
    category: "org-role",
    question: "조직에서 Owner(소유자)와 Admin(관리자)의 차이는 무엇인가요?",
    answer: "Owner는 조직당 1명으로, 조직 삭제, 결제 관리, Owner 이전 등 최고 권한을 가집니다. Admin은 멤버 초대, 역할 변경, 설정 관리가 가능하지만 Owner 변경이나 조직 삭제는 할 수 없습니다. Owner는 API/UI에서 변경·삭제가 보호됩니다.",
    guideLink: { label: "역할별 가이드", href: "/dashboard/guide" },
  },
  {
    id: "org-2",
    category: "org-role",
    question: "역할별 접근 권한은 어떻게 다른가요?",
    answer: "Viewer는 조회만 가능하고, Requester는 견적 요청과 검색을 할 수 있습니다. Approver는 여기에 승인 권한이 추가되고, Admin은 조직 설정과 멤버 관리가 가능합니다. Owner는 모든 권한을 가지며 결제와 조직 삭제를 포함합니다.",
    guideLink: { label: "멤버 역할 가이드", href: "/dashboard/guide" },
    cta: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },
  {
    id: "org-3",
    category: "org-role",
    question: "팀원을 초대하려면 어떻게 하나요?",
    answer: "조직 설정 > 멤버 관리에서 이메일 주소로 팀원을 초대할 수 있습니다. 초대받은 팀원은 이메일의 링크를 통해 가입하면 자동으로 팀에 합류됩니다. 초대 시 역할을 지정할 수 있습니다.",
    cta: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },
  {
    id: "org-4",
    category: "org-role",
    question: "팀 재고와 개인 재고는 어떻게 구분되나요?",
    answer: "재고 관리 페이지 상단의 '내 재고 / 팀 재고' 탭으로 전환할 수 있습니다. 팀 재고는 같은 조직의 모든 멤버가 조회 가능하며, 개인 재고는 본인만 관리합니다. 개인 재고 품목을 팀 재고로 이전할 수도 있습니다.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "org-5",
    category: "org-role",
    question: "Owner를 다른 사람에게 이전할 수 있나요?",
    answer: "네, 조직 설정 > 소유권 이전에서 기존 Admin 중 한 명을 새 Owner로 지정할 수 있습니다. 이전이 완료되면 기존 Owner는 Admin으로 변경됩니다. 이 작업은 되돌릴 수 없으므로 신중하게 진행하세요.",
    cta: { label: "조직 설정으로 이동", href: "/dashboard/organizations" },
  },

  // ── 알림/이메일/하루 한 번 요약 ──
  {
    id: "noti-1",
    category: "notification",
    question: "하루 한 번 요약 이메일이란 무엇인가요?",
    answer: "하루 한 번 요약은 하루 동안의 핵심 활동(새 견적 회신, 재고 알림, 팀원 활동 등)을 하나의 이메일로 정리하여 매일 지정된 시간에 발송하는 기능입니다. 설정 > 알림에서 수신 시간과 포함 항목을 설정할 수 있습니다.",
    guideLink: { label: "알림 전달 방식 가이드", href: "/dashboard/guide" },
    cta: { label: "알림 설정으로 이동", href: "/dashboard/settings" },
  },
  {
    id: "noti-2",
    category: "notification",
    question: "즉시 알림과 하루 한 번 요약은 어떻게 다른가요?",
    answer: "즉시 알림은 견적 회신 도착, 재고 경고 등 긴급한 이벤트 발생 시 실시간으로 이메일·인앱 알림을 보냅니다. 하루 한 번 요약은 팀 활동, 일반 변동 등 비긴급 항목을 모아 하루에 한 통으로 정리하여 발송합니다. 설정에서 어떤 항목을 즉시/요약에 배치할지 선택할 수 있습니다.",
    cta: { label: "알림 설정으로 이동", href: "/dashboard/settings" },
  },
  {
    id: "noti-3",
    category: "notification",
    question: "특정 알림만 끄고 싶은데 가능한가요?",
    answer: "네, 설정 > 알림에서 알림 유형별로 이메일, 인앱, 푸시 채널을 개별 ON/OFF 할 수 있습니다. 예를 들어 견적 회신은 이메일로만, 재고 알림은 인앱으로만 받도록 설정할 수 있습니다.",
    cta: { label: "알림 설정으로 이동", href: "/dashboard/settings" },
  },
  {
    id: "noti-4",
    category: "notification",
    question: "이메일 알림이 오지 않는데 어떻게 하나요?",
    answer: "먼저 스팸/정크 폴더를 확인해주세요. 설정 > 알림에서 이메일 알림이 활성화되어 있는지, 등록된 이메일 주소가 정확한지 확인하세요. 그래도 문제가 계속되면 1:1 문의를 남겨주세요.",
    cta: { label: "알림 설정 확인", href: "/dashboard/settings" },
  },

  // ── PDF/BOM/AI 분석 ──
  {
    id: "ai-1",
    category: "ai-pdf",
    question: "PDF 분석이 실패하면 어떻게 하나요?",
    answer: "PDF 분석 실패의 주요 원인은 이미지 기반 스캔 PDF, 암호화된 파일, 손상된 파일입니다. 텍스트 선택이 가능한 PDF를 사용해주세요. 파일 크기 제한(50MB)도 확인해주세요. 분석이 불가능한 경우 견적 생성 화면의 '텍스트 입력' 탭에서 품목 목록을 직접 붙여넣으면 동일한 결과를 얻을 수 있습니다.",
    guideLink: { label: "PDF 분석 가이드", href: "/dashboard/guide" },
  },
  {
    id: "ai-2",
    category: "ai-pdf",
    question: "스캔본 PDF도 분석할 수 있나요?",
    answer: "현재는 텍스트 기반 PDF만 지원합니다. 스캔본(이미지) PDF의 경우 OCR 처리가 필요하며, 이 기능은 향후 업데이트에서 지원 예정입니다. 대안으로 품목 목록을 텍스트로 직접 붙여넣어 분석할 수 있습니다.",
  },
  {
    id: "ai-3",
    category: "ai-pdf",
    question: "BOM 추출 결과가 정확하지 않은데 어떻게 수정하나요?",
    answer: "BOM 추출 결과 화면에서 각 항목을 직접 편집할 수 있습니다. 품목명, 수량, 단위 등을 수정하고 불필요한 항목은 삭제할 수 있습니다. 수정 후 '확정'을 누르면 수정된 목록이 견적 요청에 사용됩니다.",
    guideLink: { label: "BOM 추출 가이드", href: "/dashboard/guide" },
  },
  {
    id: "ai-4",
    category: "ai-pdf",
    question: "AI 텍스트 대체는 어떤 경우에 유용한가요?",
    answer: "약어('FBS' -> 'Fetal Bovine Serum'), 구어체 표현, 불완전한 품목명을 정식 명칭으로 변환할 때 유용합니다. 검색 결과가 부정확하거나 원하는 품목이 나오지 않을 때 AI 대체 기능을 활용하면 정확도가 높아집니다.",
    cta: { label: "검색에서 사용하기", href: "/dashboard/search" },
  },
  {
    id: "ai-5",
    category: "ai-pdf",
    question: "재고 운영 도우미는 어디서 사용하나요?",
    answer: "재고 관리 페이지에서 Lot 추적, 유효기간 확인, 사용량 기반 재주문 시점 안내 등을 확인할 수 있습니다. 현재 재고 데이터를 참조하여 운영자가 빠르게 검토할 수 있도록 정리합니다.",
    cta: { label: "재고 관리 열기", href: "/dashboard/inventory" },
  },
  {
    id: "ai-6",
    category: "ai-pdf",
    question: "AI는 어디까지 도와주나요?",
    answer: "LabAxis의 AI는 검색 결과 정리, 비교 후보 제안, 공급사 요청서에 반영할 메시지와 문의 항목 준비를 지원합니다. 운영자는 이를 검토한 뒤 적용하거나 수정할 수 있습니다.",
  },
  {
    id: "ai-7",
    category: "ai-pdf",
    question: "AI가 공급사 요청서를 자동으로 전송하나요?",
    answer: "아닙니다. LabAxis의 AI는 요청서에 반영할 항목을 정리하고 초안을 준비하는 단계까지 지원합니다. 현재는 공급사 요청서를 검토 없이 자동 확정하거나 자동 전송하지 않습니다. 최종 반영과 전송은 운영자가 직접 검토한 뒤 진행합니다.",
  },
  {
    id: "ai-8",
    category: "ai-pdf",
    question: "운영자가 직접 확인해야 하나요?",
    answer: "네. LabAxis는 운영자의 검토를 전제로 다음 단계를 더 빠르게 준비하도록 돕습니다. AI는 반영할 항목을 정리하고 초안을 준비하지만, 최종 적용과 수정은 운영자가 직접 판단할 수 있게 설계되어 있습니다.",
  },

  // ── 구독/결제/해지 ──
  {
    id: "bill-1",
    category: "billing",
    question: "해지하면 데이터는 어떻게 되나요?",
    answer: "구독 해지 시 현재 결제 주기가 끝날 때까지 서비스가 유지됩니다. 이후 90일간 데이터가 보관되며, 이 기간 내에 재구독하면 데이터가 복원됩니다. 90일이 지나면 데이터가 영구 삭제됩니다.",
    guideLink: { label: "해지 흐름 가이드", href: "/dashboard/guide" },
  },
  {
    id: "bill-2",
    category: "billing",
    question: "플랜을 중간에 업그레이드하면 요금은 어떻게 계산되나요?",
    answer: "남은 기간에 대해 일할 계산됩니다. 예를 들어 월 구독 중간에 상위 플랜으로 변경하면, 남은 일수에 대한 차액만 결제됩니다. 다운그레이드는 다음 결제 주기부터 적용됩니다.",
    cta: { label: "플랜 비교하기", href: "/dashboard/settings/plans" },
  },
  {
    id: "bill-3",
    category: "billing",
    question: "연구비 카드로 결제할 수 있나요?",
    answer: "네, 대학교 산학협력단 및 기업 연구소의 규정에 맞춰 연구비 카드 결제를 지원합니다. 결제 시 카드 종류를 선택하면 관련 증빙 서류가 자동으로 생성됩니다.",
    cta: { label: "결제 관리로 이동", href: "/dashboard/billing" },
  },
  {
    id: "bill-4",
    category: "billing",
    question: "세금계산서를 발행받을 수 있나요?",
    answer: "네, 사업자등록번호를 등록하면 결제 시 전자세금계산서가 자동 발행됩니다. 결제 관리 페이지에서 사업자 정보를 미리 등록해두면 편리합니다. 이전 거래에 대한 세금계산서도 요청할 수 있습니다.",
    cta: { label: "결제 관리로 이동", href: "/dashboard/billing" },
  },
  {
    id: "bill-5",
    category: "billing",
    question: "해지 시 의견을 남기면 어떻게 반영되나요?",
    answer: "해지를 진행하면 간단한 해지 사유 설문이 표시됩니다. 선택한 사유와 추가 의견은 LabAxis 제품팀에 전달되어 서비스 개선에 활용됩니다. 의견 제출 후에도 유예 기간 동안은 언제든 재구독이 가능합니다.",
  },

  // ── 오류 해결 ──
  {
    id: "err-1",
    category: "error",
    question: "페이지가 로딩되지 않거나 빈 화면이 나타납니다.",
    answer: "브라우저 캐시를 삭제하고 새로고침(Ctrl+Shift+R)해주세요. 브라우저를 최신 버전으로 업데이트하는 것도 도움이 됩니다. Chrome, Edge, Safari 최신 버전을 권장합니다. 문제가 지속되면 브라우저 콘솔 스크린샷과 함께 1:1 문의해주세요.",
  },
  {
    id: "err-2",
    category: "error",
    question: "파일 업로드가 계속 실패합니다.",
    answer: "파일 크기(최대 50MB), 형식(PDF, CSV, XLSX), 네트워크 연결을 확인해주세요. VPN을 사용 중이라면 일시적으로 끄고 시도해보세요. 대용량 파일의 경우 안정적인 네트워크 환경에서 업로드하는 것을 권장합니다.",
  },
  {
    id: "err-3",
    category: "error",
    question: "견적 요청 제출 시 오류가 발생합니다.",
    answer: "필수 항목(품목명, 수량)이 모두 입력되었는지 확인해주세요. 특수문자가 포함된 경우 오류가 발생할 수 있으니 제거 후 다시 시도해주세요. 네트워크 상태를 확인하고, 문제가 지속되면 오류 메시지와 함께 1:1 문의를 남겨주세요.",
  },
  {
    id: "err-4",
    category: "error",
    question: "초대 이메일이 도착하지 않습니다.",
    answer: "스팸/정크 폴더를 확인해주세요. 조직 관리자에게 입력한 이메일 주소가 정확한지 재확인을 요청하세요. 회사 이메일 보안 정책으로 외부 메일이 차단될 수 있으니, IT 부서에 noreply@labaxis.io 도메인을 허용 목록에 추가해달라고 요청해보세요.",
  },
];

/* ─────────────────────────── 컴포넌트 ─────────────────────────── */
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

  const expandAll = () => {
    setExpandedIds(new Set(filteredFaqs.map((f) => f.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const filteredFaqs = useMemo(() => {
    let items = FAQ_ITEMS;
    if (activeCategory !== "all") {
      items = items.filter((f) => f.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeCategory, searchQuery]);

  const getCategoryBadge = (cat: string) => {
    const found = FAQ_CATEGORIES.find((c) => c.value === cat);
    return found?.label || cat;
  };

  const getCategoryColor = (cat: string) => {
    const colorMap: Record<string, string> = {
      account: "bg-violet-500/15 text-violet-400 border-violet-500/20",
      "search-compare": "bg-blue-500/15 text-blue-400 border-blue-500/20",
      "purchase-inventory": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      "org-role": "bg-amber-500/15 text-amber-400 border-amber-500/20",
      notification: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
      "ai-pdf": "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
      billing: "bg-pink-500/15 text-pink-400 border-pink-500/20",
      error: "bg-red-500/15 text-red-400 border-red-500/20",
    };
    return colorMap[cat] || "bg-pg/15 text-slate-400 border-slate-500/20";
  };

  return (
    <div className="flex-1 pt-2 md:pt-4 max-w-4xl mx-auto w-full">
      {/* ── 헤더 ── */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">
          자주 묻는 질문
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          LabAxis 사용 중 궁금한 점을 검색하거나 카테고리별로 찾아보세요. 원하는 답을 찾지 못하면 1:1 문의를 이용해주세요.
        </p>
      </div>

      {/* ── 검색바 ── */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="질문 검색 (예: PDF 분석, 안전재고, 해지, 하루 한 번 요약)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-el border-bd text-slate-900 placeholder:text-slate-500 focus:border-bd focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* ── 카테고리 탭 ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide mb-5">
        {FAQ_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.value;
          const count =
            cat.value === "all"
              ? FAQ_ITEMS.length
              : FAQ_ITEMS.filter((f) => f.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-pn border border-bd text-slate-400 hover:text-slate-700 hover:border-bd"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-500"}`} />
              {cat.label}
              <span
                className={`text-[10px] ml-0.5 ${
                  isActive ? "text-blue-200" : "text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 결과 헤더 ── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          {searchQuery
            ? `"${searchQuery}" 검색 결과 ${filteredFaqs.length}건`
            : `${filteredFaqs.length}개의 질문`}
        </p>
        {filteredFaqs.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-[11px] text-slate-500 hover:text-slate-600 transition-colors"
            >
              모두 펼치기
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={collapseAll}
              className="text-[11px] text-slate-500 hover:text-slate-600 transition-colors"
            >
              모두 접기
            </button>
          </div>
        )}
      </div>

      {/* ── FAQ 목록 ── */}
      <div className="space-y-2">
        {filteredFaqs.length === 0 ? (
          <div className="rounded-xl bg-pn border border-bd py-16 text-center">
            <Search className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600 mb-1">검색 결과가 없습니다</p>
            <p className="text-xs text-slate-500 mb-4">
              다른 키워드로 검색하거나 카테고리를 변경해보세요.
            </p>
            <Link href="/dashboard/support">
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                1:1 문의하기
              </Button>
            </Link>
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isExpanded = expandedIds.has(faq.id);
            return (
              <div
                key={faq.id}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isExpanded
                    ? "bg-pn border-bd"
                    : "bg-pn border-bd hover:border-bd"
                }`}
              >
                {/* 질문 헤더 */}
                <button
                  onClick={() => toggleExpand(faq.id)}
                  className="w-full text-left px-4 md:px-5 py-4 flex items-start gap-3 group"
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      isExpanded
                        ? "bg-blue-500/20"
                        : "bg-el"
                    }`}
                  >
                    <HelpCircle
                      className={`h-3 w-3 transition-colors ${
                        isExpanded ? "text-blue-400" : "text-slate-500"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        className={`text-[10px] px-1.5 py-0 border font-medium ${getCategoryColor(
                          faq.category
                        )}`}
                      >
                        {getCategoryBadge(faq.category)}
                      </Badge>
                    </div>
                    <p
                      className={`text-sm font-medium leading-snug transition-colors ${
                        isExpanded
                          ? "text-slate-900"
                          : "text-slate-600 group-hover:text-slate-900"
                      }`}
                    >
                      {faq.question}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-500 flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-600 flex-shrink-0 mt-1 group-hover:text-slate-400" />
                  )}
                </button>

                {/* 답변 */}
                {isExpanded && (
                  <div className="px-4 md:px-5 pb-4 ml-8 border-t border-bd">
                    <p className="text-sm text-slate-400 leading-relaxed py-3">
                      {faq.answer}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {faq.guideLink && (
                        <Link href={faq.guideLink.href}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs border-bd text-slate-400 bg-transparent hover:bg-el hover:text-slate-700"
                          >
                            <BookOpen className="h-3 w-3" />
                            {faq.guideLink.label}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Button>
                        </Link>
                      )}
                      {faq.cta && (
                        <Link href={faq.cta.href}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs border-blue-500/30 text-blue-400 bg-transparent hover:bg-blue-500/10 hover:text-blue-300"
                          >
                            {faq.cta.label}
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── 하단 지원 ── */}
      <div className="rounded-xl bg-pn border border-bd px-5 py-5 mt-8 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              원하는 답변을 찾지 못하셨나요?
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              1:1 문의를 남겨주시면 담당자가 직접 확인 후 답변드립니다.
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 flex-shrink-0">
          <Link href="/dashboard/guide">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-bd text-slate-600 bg-transparent hover:bg-pn hover:text-slate-900"
            >
              <BookOpen className="h-3.5 w-3.5" />
              이용 가이드
            </Button>
          </Link>
          <Link href="/dashboard/support">
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              1:1 문의하기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
