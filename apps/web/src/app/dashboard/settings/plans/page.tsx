"use client";

export const dynamic ="force-dynamic";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
  Component,
  type ReactNode,
} from "react";
import * as React from"react";
import { useSession } from"next-auth/react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from"@tanstack/react-query";
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { Label } from"@/components/ui/label";
import {
 CheckCircle2,
 Users,
 Building,
 Building2,
 Package,
 Calendar,
 CreditCard,
 BarChart3,
 Loader2,
 ArrowUpRight,
 ArrowDownRight,
 Check,
 Crown,
 Mail,
 AlertCircle,
 RefreshCw,
} from"lucide-react";
import { cn } from"@/lib/utils";
import { useToast } from"@/hooks/use-toast";
import {
 SubscriptionPlan,
 PLAN_LIMITS,
 PLAN_DISPLAY,
 PLAN_PRICES,
 PLAN_ORDER,
 ENTERPRISE_INFO,
 getAnnualMonthlyPrice,
 getAnnualTotalPrice,
 getPlanLimits,
} from"@/lib/plans";
import CheckoutDialog from"@/components/checkout/CheckoutDialog";

// ═══════════════════════════════════════════════════════════════════
// 로컬 ErrorBoundary — 글로벌 에러 화면으로 보내지 않고 페이지 내에서 처리
// ═══════════════════════════════════════════════════════════════════
interface ErrorBoundaryProps {
 children: ReactNode;
}

interface ErrorBoundaryState {
 hasError: boolean;
 error: Error | null;
}

class PlansErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
 constructor(props: ErrorBoundaryProps) {
 super(props);
 this.state = { hasError: false, error: null };
 }

 static getDerivedStateFromError(error: Error): ErrorBoundaryState {
 return { hasError: true, error };
 }

 componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
 console.error("[PlansPage] ErrorBoundary caught:", {
 message: error.message,
 stack: error.stack,
 componentStack: errorInfo.componentStack,
 });
 }

 render(): ReactNode {
 if (this.state.hasError) {
 return (
 <div className="container mx-auto px-4 py-8">
 <div className="max-w-xl mx-auto">
 <Card className="border-red-200 border-red-200">
 <CardContent className="py-12 text-center space-y-4">
 <div className="flex justify-center">
 <div className="rounded-full bg-red-50 bg-red-100 p-3">
 <AlertCircle className="h-8 w-8 text-red-500"/>
 </div>
 </div>
 <div>
 <p className="text-base font-medium text-slate-900">
 구독 정보를 불러오지 못했습니다.
 </p>
 <p className="text-sm text-slate-400 mt-1">
 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.
 </p>
 </div>
 {process.env.NODE_ENV ==="development"&& this.state.error && (
 <div className="text-left bg-slate-50 bg-slate-100 rounded-lg p-3 mt-4">
 <p className="text-xs font-mono text-red-600 text-red-600 break-all">
 {this.state.error.message}
 </p>
 </div>
 )}
 <Button
 onClick={() => {
 this.setState({ hasError: false, error: null });
 }}
 className="mt-4"
 >
 <RefreshCw className="mr-2 h-4 w-4"/>
 다시 시도
 </Button>
 </CardContent>
 </Card>
 </div>
 </div>
 );
 }
 return this.props.children;
 }
}

// ═══════════════════════════════════════════════════════════════════
// Safe plan config access — 알 수 없는 plan slug 방어
// ═══════════════════════════════════════════════════════════════════
const VALID_PLANS = new Set(Object.values(SubscriptionPlan));

function resolvePlan(rawPlan: unknown): SubscriptionPlan {
 if (typeof rawPlan ==="string"&& VALID_PLANS.has(rawPlan as SubscriptionPlan)) {
 return rawPlan as SubscriptionPlan;
 }
 return SubscriptionPlan.FREE;
}

function safePlanDisplay(plan: SubscriptionPlan) {
 return PLAN_DISPLAY[plan] ?? PLAN_DISPLAY[SubscriptionPlan.FREE];
}

function safePlanLimits(plan: SubscriptionPlan) {
 return PLAN_LIMITS[plan] ?? PLAN_LIMITS[SubscriptionPlan.FREE];
}

function safePlanPrice(plan: SubscriptionPlan): number {
 return PLAN_PRICES[plan] ?? 0;
}

function safePlanOrder(plan: SubscriptionPlan): number {
 return PLAN_ORDER[plan] ?? 0;
}

// ═══════════════════════════════════════════════════════════════════
// 플랜 카드 & 기능 비교 (정적 데이터 — plans.ts 기준)
// ═══════════════════════════════════════════════════════════════════
const FEATURE_COMPARISON = [
 { key:"exportPack", label:"데이터 내보내기", desc:"Excel/PDF 일괄 내보내기"},
 { key:"approvalWorkflow", label:"전자결재 승인 라인", desc:"구매 요청 워크플로우"},
 { key:"budgetManagement", label:"예산 통합 관리", desc:"예산 배정·집행·초과 관리"},
 { key:"autoReorder", label:"자동 재주문", desc:"안전재고 기반 자동 발주"},
 { key:"advancedReports", label:"고급 리포트", desc:"맞춤 분석 및 내보내기"},
 { key:"lotManagement", label:"Lot 관리", desc:"Lot별 수량·위치·유효기한 추적"},
 { key:"auditTrail", label:"Audit Trail", desc:"변경 이력 및 감사 증적"},
 { key:"inboundEmail", label:"이메일 연동", desc:"견적 이메일 자동 처리"},
 { key:"vendorPortal", label:"벤더 포털", desc:"공급사 직접 견적 응답"},
 { key:"sso", label:"SSO (통합 인증)", desc:"SAML/OAuth 기반 로그인 — Enterprise 전용"},
 { key:"prioritySupport", label:"전담 매니저 및 SLA", desc:"우선 기술 지원 — Enterprise 전용"},
] as const;

const PLAN_CARDS = [
 {
 id: SubscriptionPlan.FREE,
 icon: Package,
 features: [
"개인 전용 (팀원 초대 불가)",
"기본 검색 및 비교",
"품목 등록 (최대 10개)",
"기본 견적 요청",
 ],
 },
 {
 id: SubscriptionPlan.TEAM,
 icon: Users,
 features: [
"팀원 5명까지",
"팀원 공유 재고",
"후보 품목 공유",
"구매 요청 워크플로우",
"품목 등록 (최대 50개)",
"엑셀 업로드 · CSV 내보내기",
"대체품 추천",
 ],
 },
 {
 id: SubscriptionPlan.ORGANIZATION,
 icon: Building,
 features: [
"팀원 무제한",
"전자결재 승인 라인",
"예산 통합 관리",
"Audit Trail",
"MSDS 자동 연동",
"Lot 관리 · 재고 소진 알림",
"관리자 운영 대시보드",
"품목 등록 무제한",
 ],
 },
];

// ═══════════════════════════════════════════════════════════════════
// Skeleton 컴포넌트 — 데이터 준비 전 표시
// ═══════════════════════════════════════════════════════════════════
function PlansSkeleton() {
 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
 <div className="container mx-auto px-4 py-8">
 <div className="max-w-7xl mx-auto space-y-6">
 <div>
 <div className="h-8 w-48 bg-slate-200 bg-slate-200 rounded animate-pulse"/>
 <div className="h-4 w-72 bg-slate-200 bg-slate-200 rounded animate-pulse mt-2"/>
 </div>
 {/* 현재 구독 skeleton */}
 <Card className="bg-white bg-white border border-slate-200 shadow-sm">
 <CardHeader className="pb-3">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 bg-slate-200 bg-slate-200 rounded-xl animate-pulse"/>
 <div className="space-y-2">
 <div className="h-5 w-32 bg-slate-200 bg-slate-200 rounded animate-pulse"/>
 <div className="h-4 w-24 bg-slate-200 bg-slate-200 rounded animate-pulse"/>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
 {Array.from({ length: 5 }).map((_, i) => (
 <div key={i} className="rounded-lg bg-slate-50 bg-slate-100/50 p-3">
 <div className="h-3 w-16 bg-slate-200 bg-slate-200 rounded animate-pulse mb-2"/>
 <div className="h-4 w-20 bg-slate-200 bg-slate-200 rounded animate-pulse"/>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 {/* 플랜 카드 skeleton */}
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
 {Array.from({ length: 4 }).map((_, i) => (
 <Card key={i} className="bg-white bg-white border border-slate-200">
 <CardHeader>
 <div className="h-6 w-24 bg-slate-200 bg-slate-200 rounded animate-pulse"/>
 <div className="h-8 w-32 bg-slate-200 bg-slate-200 rounded animate-pulse mt-4"/>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {Array.from({ length: 4 }).map((_, j) => (
 <div key={j} className="h-4 w-full bg-slate-200 bg-slate-200 rounded animate-pulse"/>
 ))}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════════
// Plan intent 라우팅 매핑 — /pricing resolver 와 합을 맞춘다
//  starter → FREE (여기서는 체크아웃 대상 아님)
//  team    → TEAM
//  business→ ORGANIZATION
//  enterprise → 도달하지 않음 (resolver 에서 /support 로 보냄)
// ═══════════════════════════════════════════════════════════════════
const PLAN_INTENT_TO_ENUM: Record<string, SubscriptionPlan | null> = {
  starter: SubscriptionPlan.FREE,
  team: SubscriptionPlan.TEAM,
  business: SubscriptionPlan.ORGANIZATION,
  enterprise: null,
};

const PLAN_INTENT_LABELS: Record<string, string> = {
  starter: "Starter",
  team: "Team",
  business: "Business",
  enterprise: "Enterprise",
};

// ═══════════════════════════════════════════════════════════════════
// 메인 페이지 컴포넌트
// ═══════════════════════════════════════════════════════════════════
function PlansPageContent() {
 const { data: session, status: sessionStatus } = useSession();
 const { toast } = useToast();
 const queryClient = useQueryClient();
 const searchParams = useSearchParams();
 const [selectedOrgId, setSelectedOrgId] = useState<string>("");
 const [isAnnual, setIsAnnual] = useState(false);
 const [checkoutTarget, setCheckoutTarget] = useState<SubscriptionPlan | null>(null);

 // ── /pricing resolver 로부터 전달된 intent 파라미터 ──
 const intentPlanRaw = searchParams?.get("plan") ?? null;
 const intentAction = searchParams?.get("intent") ?? null;
 const intentWorkspaceId = searchParams?.get("workspaceId") ?? null;
 const intentPlanEnum: SubscriptionPlan | null = intentPlanRaw
   ? PLAN_INTENT_TO_ENUM[intentPlanRaw] ?? null
   : null;
 const intentPlanLabel = intentPlanRaw
   ? PLAN_INTENT_LABELS[intentPlanRaw] ?? intentPlanRaw
   : null;
 const autoCheckoutTriggeredRef = useRef(false);

 // ┌─────────────────────────────────────────────┐
 // │ HOOKS — 모두 최상단, 조건부 return 전에 배치 │
 // └─────────────────────────────────────────────┘

 // ── 조직 목록 ──
 const {
 data: organizationsData,
 isLoading: orgsLoading,
 isError: orgsError,
 error: orgsErrorObj,
 refetch: refetchOrgs,
 } = useQuery({
 queryKey: ["user-organizations"],
 queryFn: async () => {
 const response = await fetch("/api/organizations");
 if (!response.ok) {
 const err = await response.json().catch(() => ({}));
 throw new Error(
 (err as { error?: string })?.error ??"조직 목록을 불러오지 못했습니다."
 );
 }
 return response.json();
 },
 enabled: sessionStatus ==="authenticated",
 retry: 2,
 retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
 staleTime: 30_000,
 });

 const organizations = organizationsData?.organizations ?? [];

 // ── selectedOrgId 초기화 — hook 위반 없이 최상단에서 ──
 //    intentWorkspaceId 가 유효한 소속 조직이면 우선 선택한다.
 useEffect(() => {
 if (organizations.length === 0 || selectedOrgId) return;
 if (intentWorkspaceId) {
 const match = organizations.find(
 (org: any) => org.id === intentWorkspaceId
 );
 if (match) {
 setSelectedOrgId(match.id);
 return;
 }
 }
 setSelectedOrgId(organizations[0].id);
 }, [organizations, selectedOrgId, intentWorkspaceId]);

 // ── selectedOrg 파생 ──
 const selectedOrg = selectedOrgId
 ? organizations.find((org: any) => org.id === selectedOrgId) ?? null
 : organizations[0] ?? null;

 // ── 구독 정보 (org 준비 후에만 fetch) ──
 const {
 data: subscriptionData,
 isLoading: subLoading,
 isError: subError,
 error: subErrorObj,
 isFetching: subFetching,
 refetch: refetchSub,
 } = useQuery({
 queryKey: ["subscription", selectedOrgId],
 queryFn: async () => {
 if (!selectedOrgId) return null;
 const response = await fetch(
 `/api/organizations/${selectedOrgId}/subscription`
 );
 if (!response.ok) {
 const err = await response.json().catch(() => ({}));
 throw new Error(
 (err as { error?: string })?.error ??"구독 정보를 불러오지 못했습니다."
 );
 }
 return response.json();
 },
 // ★ org가 확정된 후에만 fetch — 핵심 방어
 enabled: !!selectedOrgId && sessionStatus ==="authenticated",
 retry: 2,
 retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
 staleTime: 30_000,
 // ★ 조직 전환 시 이전 데이터를 잠깐 보여주고, fetching 상태로 구분
 placeholderData: keepPreviousData,
 });

 // ── 플랜 변경 mutation ──
 const upgradeMutation = useMutation({
 mutationFn: async ({
 organizationId,
 plan,
 }: {
 organizationId: string;
 plan: SubscriptionPlan;
 }) => {
 const response = await fetch(
 `/api/organizations/${organizationId}/subscription`,
 {
 method:"POST",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ plan, periodMonths: isAnnual ? 12 : 1 }),
 }
 );
 const data = await response.json().catch(() => ({}));
 if (!response.ok) {
 throw new Error(
 (data as { error?: string })?.error ??"요금제 변경에 실패했습니다."
 );
 }
 return data;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
 queryClient.invalidateQueries({
 queryKey: ["subscription", selectedOrgId],
 });
 toast({
 title:"플랜 변경 완료",
 description:"구독이 성공적으로 변경되었습니다.",
 });
 },
 onError: (error: Error) => {
 toast({
 title:"요금제 변경 실패",
 description: error.message,
 variant:"destructive",
 });
 },
 });

 // ── 진단 로깅 (개발 환경) ──
 useEffect(() => {
 if (process.env.NODE_ENV ==="development") {
 console.debug("[PlansPage] State:", {
 sessionStatus,
 userId: session?.user?.id ?? null,
 orgsLoading,
 orgsError,
 organizationCount: organizations.length,
 selectedOrgId: selectedOrgId ||"(empty)",
 selectedOrgName: selectedOrg?.name ??"(null)",
 subLoading,
 subFetching,
 subError,
 subscriptionPlan: subscriptionData?.subscription?.plan ??"(null)",
 orgPlan: selectedOrg?.plan ??"(null)",
 intentPlanRaw,
 intentAction,
 intentWorkspaceId,
 });
 }
 });

 // ── intent=checkout 자동 트리거 ──
 //   pricing resolver 에서 보내온 plan 파라미터가 유효하고,
 //   현재 구독 플랜과 다르면 CheckoutDialog 를 한 번만 자동으로 연다.
 useEffect(() => {
 if (autoCheckoutTriggeredRef.current) return;
 if (intentAction !== "checkout") return;
 if (!intentPlanEnum) return;
 if (intentPlanEnum === SubscriptionPlan.FREE) return;
 if (!selectedOrgId) return;
 if (subLoading || subFetching) return;

 const currentEnum = resolvePlan(
 subscriptionData?.subscription?.plan ?? selectedOrg?.plan ?? "FREE"
 );
 if (intentPlanEnum === currentEnum) return;

 autoCheckoutTriggeredRef.current = true;
 setCheckoutTarget(intentPlanEnum);
 }, [
 intentAction,
 intentPlanEnum,
 selectedOrgId,
 subLoading,
 subFetching,
 subscriptionData,
 selectedOrg,
 ]);

 // ── 조직 전환 핸들러 ──
 const handleOrgChange = useCallback(
 (newOrgId: string) => {
 setSelectedOrgId(newOrgId);
 // 이전 subscription 캐시를 즉시 무효화하여 stale 데이터 방지
 queryClient.removeQueries({ queryKey: ["subscription", selectedOrgId] });
 },
 [queryClient, selectedOrgId]
 );

 // ┌─────────────────────────────────────────────┐
 // │ 여기부터 조건부 렌더 — 모든 hooks 위에 완료 │
 // └─────────────────────────────────────────────┘

 // ── 상태 1: 세션 로딩 ──
 if (sessionStatus ==="loading") {
 return <PlansSkeleton />;
 }

 // ── 상태 2: 인증 안 됨 ──
 if (sessionStatus ==="unauthenticated") {
 return (
 <div className="container mx-auto px-4 py-8">
 <Card>
 <CardContent className="py-12 text-center">
 <p className="text-muted-foreground">로그인이 필요합니다.</p>
 </CardContent>
 </Card>
 </div>
 );
 }

 // ── 상태 3: 조직 데이터 로딩 ──
 if (orgsLoading) {
 return <PlansSkeleton />;
 }

 // ── 상태 4: 조직 목록 조회 실패 (inline retry) ──
 if (orgsError) {
 return (
 <div className="container mx-auto px-4 py-8">
 <div className="max-w-xl mx-auto">
 <Card className="border-amber-200 border-amber-200">
 <CardContent className="py-12 text-center space-y-4">
 <AlertCircle className="h-8 w-8 text-amber-500 mx-auto"/>
 <div>
 <p className="text-base font-medium text-slate-900">
 조직 정보를 불러오지 못했습니다.
 </p>
 <p className="text-sm text-slate-400 mt-1">
 {(orgsErrorObj as Error)?.message ??"잠시 후 다시 시도하거나 관리자에게 문의해 주세요."}
 </p>
 </div>
 <Button onClick={() => refetchOrgs()}>
 <RefreshCw className="mr-2 h-4 w-4"/>
 다시 시도
 </Button>
 </CardContent>
 </Card>
 </div>
 </div>
 );
 }

 // ── 상태 5: 소속 조직 없음 ──
 if (organizations.length === 0 || !selectedOrg) {
 return (
 <div className="container mx-auto px-4 py-8">
 <div className="max-w-xl mx-auto">
 <Card>
 <CardContent className="py-12 text-center space-y-4">
 <Building2 className="h-8 w-8 text-slate-400 mx-auto"/>
 <div>
 <p className="text-base font-medium text-slate-900">
 소속된 조직이 없습니다.
 </p>
 <p className="text-sm text-slate-400 mt-1">
 조직에 가입하거나 새 조직을 생성해주세요.
 </p>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 );
 }

 // ═══════════════════════════════════════════════════════════════
 // 데이터 준비 완료 — 안전한 파생 값 계산
 // ═══════════════════════════════════════════════════════════════
 const subscription = subscriptionData?.subscription ?? null;

 // plan slug → enum (방어적 변환)
 const currentPlan = resolvePlan(
 subscription?.plan ?? selectedOrg?.plan ??"FREE"
 );
 const limits = safePlanLimits(currentPlan);
 const currentDisplay = safePlanDisplay(currentPlan);

 // 구독 상세 (모든 필드 null-safe)
 const currentSeats =
 subscription?.currentSeats ?? selectedOrg?.memberCount ?? 1;
 const maxSeats = limits.maxMembers;
 const nextPaymentDate = (() => {
 try {
 if (!subscription?.currentPeriodEnd) return null;
 return new Date(subscription.currentPeriodEnd).toLocaleDateString(
"ko-KR",
 { year:"numeric", month:"long", day:"numeric"}
 );
 } catch {
 return null;
 }
 })();

 // 가격 계산 (safe)
 const getDisplayPrice = (plan: SubscriptionPlan): number => {
 const base = safePlanPrice(plan);
 if (base === 0) return 0;
 return isAnnual ? getAnnualMonthlyPrice(plan) : base;
 };

 const formatPrice = (amount: number): string => {
 if (amount === 0) return"무료";
 return `₩${amount.toLocaleString()}`;
 };

 // 버튼 상태 (safe)
 const getButtonInfo = (planId: SubscriptionPlan) => {
 if (planId === currentPlan) {
 return {
 label:"현재 사용 중",
 disabled: true,
 isUpgrade: false,
 isDowngrade: false,
 };
 }
 const currentOrder = safePlanOrder(currentPlan);
 const targetOrder = safePlanOrder(planId);
 const isUpgrade = targetOrder > currentOrder;
 return {
 label: isUpgrade ?"업그레이드":"다운그레이드",
 disabled: false,
 isUpgrade,
 isDowngrade: !isUpgrade,
 };
 };

 const handlePlanChange = (planId: SubscriptionPlan) => {
 // CheckoutDialog로 진입
 setCheckoutTarget(planId);
 };

 // ── pricing resolver 에서 넘어온 intent 배너 ──
 const intentBanner: {
 variant: "info" | "warning";
 title: string;
 message: string;
 } | null = (() => {
 if (intentAction !== "checkout") return null;
 if (!intentPlanLabel) return null;
 if (intentPlanEnum === currentPlan) {
 return {
 variant: "info",
 title: "이미 해당 플랜을 사용 중입니다",
 message: `${intentPlanLabel} 플랜으로 이미 구독 중이라 추가 변경이 필요하지 않습니다.`,
 };
 }
 if (intentPlanEnum === null) {
 return {
 variant: "warning",
 title: "알 수 없는 플랜 선택",
 message: "요청하신 플랜 정보를 확인할 수 없습니다. 아래 카드에서 다시 선택해 주세요.",
 };
 }
 return {
 variant: "info",
 title: `${intentPlanLabel} 플랜 결제를 시작합니다`,
 message: "현재 조직 상태를 확인했습니다. 결제 창이 자동으로 열리며, 닫혀 있다면 아래 버튼으로 다시 시작하실 수 있습니다.",
 };
 })();

 // ═══════════════════════════════════════════════════════════════
 // 메인 렌더
 // ═══════════════════════════════════════════════════════════════
 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
 <div className="container mx-auto px-4 py-8">
 <div className="max-w-7xl mx-auto space-y-6">
 {/* ── 헤더 ── */}
 <div>
 <h1 className="text-3xl font-bold text-slate-900 mb-2">
 구독 플랜 관리
 </h1>
 <p className="text-slate-400">
 조직별 구독 플랜을 확인하고 변경할 수 있습니다.
 </p>
 </div>

 {/* ── pricing resolver 배너 ── */}
 {intentBanner && (
 <div
 className={cn(
 "rounded-lg border px-4 py-3 flex items-start gap-3",
 intentBanner.variant === "warning"
 ? "border-amber-300 bg-amber-50 text-amber-900"
 : "border-blue-300 bg-blue-50 text-blue-900"
 )}
 role="status"
 >
 <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
 <div className="min-w-0">
 <p className="font-semibold text-sm">{intentBanner.title}</p>
 <p className="text-sm mt-0.5 leading-relaxed">
 {intentBanner.message}
 </p>
 </div>
 </div>
 )}

 {/* ── 조직 선택 ── */}
 {organizations.length > 1 && (
 <Card className="bg-white bg-white backdrop-blur-sm border border-slate-200/50 border-slate-200 shadow-sm">
 <CardContent className="pt-6">
 <div className="flex items-center gap-4">
 <Label
 htmlFor="team-select"
 className="text-sm font-medium text-slate-600 whitespace-nowrap"
 >
 조직 선택
 </Label>
 <Select
 value={selectedOrgId}
 onValueChange={handleOrgChange}
 >
 <SelectTrigger
 id="team-select"
 className="w-[300px] bg-slate-100 border-slate-300"
 >
 <SelectValue placeholder="조직을 선택하세요"/>
 </SelectTrigger>
 <SelectContent>
 {organizations.map((org: any) => (
 <SelectItem key={org.id} value={org.id}>
 {org.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>
 )}

 {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ① 현재 구독 상태 (최상단)
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
 <Card
 className={cn(
"bg-white bg-white border border-slate-200 shadow-sm relative",
 subFetching &&"opacity-60"
 )}
 >
 {/* 조직 전환 중 로딩 오버레이 */}
 {subFetching && (
 <div className="absolute inset-0 flex items-center justify-center bg-white/50 bg-white/50 z-10 rounded-lg">
 <Loader2 className="h-5 w-5 animate-spin text-blue-500"/>
 </div>
 )}

 <CardHeader className="pb-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div
 className={cn(
"p-2.5 rounded-xl",
 currentPlan === SubscriptionPlan.ORGANIZATION
 ?"bg-indigo-100 bg-indigo-100"
 : currentPlan === SubscriptionPlan.TEAM
 ?"bg-blue-100 bg-blue-100"
 :"bg-slate-100 bg-slate-100"
 )}
 >
 <Crown
 className={cn(
"h-5 w-5",
 currentPlan === SubscriptionPlan.ORGANIZATION
 ?"text-indigo-600 text-indigo-600"
 : currentPlan === SubscriptionPlan.TEAM
 ?"text-blue-600 text-blue-600"
 :"text-slate-400"
 )}
 />
 </div>
 <div>
 <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
 현재 구독
 <Badge
 className={cn(
"text-xs",
 currentPlan === SubscriptionPlan.ORGANIZATION
 ?"bg-indigo-100 text-indigo-700 border-indigo-200 bg-indigo-100 text-indigo-600 border-indigo-200"
 : currentPlan === SubscriptionPlan.TEAM
 ?"bg-blue-100 text-blue-700 border-blue-200 bg-blue-100 text-blue-600 border-blue-200"
 :"bg-slate-100 text-slate-600 border-slate-200 bg-slate-100 text-slate-400 border-slate-300"
 )}
 >
 {currentDisplay.displayName}
 </Badge>
 </CardTitle>
 <CardDescription className="text-slate-400 mt-0.5">
 {selectedOrg.name}
 </CardDescription>
 </div>
 </div>
 {currentPlan !== SubscriptionPlan.FREE && (
 <div className="text-right">
 <p className="text-2xl font-bold text-slate-900">
 {formatPrice(getDisplayPrice(currentPlan))}
 <span className="text-sm font-normal text-slate-500 ml-1">
 /월
 </span>
 </p>
 {isAnnual && (
 <p className="text-xs text-green-600 text-green-600 mt-0.5">
 연간 결제 10% 할인 적용
 </p>
 )}
 </div>
 )}
 </div>
 </CardHeader>
 <CardContent>
 {/* 구독 조회 실패 시 inline error */}
 {subError && !subFetching ? (
 <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 bg-amber-900/20 border border-amber-200 border-amber-200">
 <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0"/>
 <div className="flex-1">
 <p className="text-sm font-medium text-amber-800 text-amber-600">
 구독 상세 정보를 불러오지 못했습니다.
 </p>
 <p className="text-xs text-amber-600 text-amber-400 mt-0.5">
 {(subErrorObj as Error)?.message ??"잠시 후 다시 시도해주세요."}
 </p>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={() => refetchSub()}
 className="border-amber-300 border-amber-300 text-amber-700 text-amber-600"
 >
 <RefreshCw className="mr-1.5 h-3.5 w-3.5"/>
 재시도
 </Button>
 </div>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
 <div className="rounded-lg bg-slate-50 bg-slate-100/50 p-3">
 <div className="flex items-center gap-2 mb-1.5">
 <Package className="h-3.5 w-3.5 text-slate-400"/>
 <span className="text-xs text-slate-400">
 현재 플랜
 </span>
 </div>
 <p className="text-sm font-semibold text-slate-900">
 {currentDisplay.displayName}
 </p>
 </div>
 <div className="rounded-lg bg-slate-50 bg-slate-100/50 p-3">
 <div className="flex items-center gap-2 mb-1.5">
 <CreditCard className="h-3.5 w-3.5 text-slate-400"/>
 <span className="text-xs text-slate-400">
 결제 주기
 </span>
 </div>
 <p className="text-sm font-semibold text-slate-900">
 {currentPlan === SubscriptionPlan.FREE
 ?"-"
 : isAnnual
 ?"연간"
 :"월간"}
 </p>
 </div>
 <div className="rounded-lg bg-slate-50 bg-slate-100/50 p-3">
 <div className="flex items-center gap-2 mb-1.5">
 <Calendar className="h-3.5 w-3.5 text-slate-400"/>
 <span className="text-xs text-slate-400">
 다음 결제일
 </span>
 </div>
 <p className="text-sm font-semibold text-slate-900">
 {currentPlan === SubscriptionPlan.FREE
 ?"-"
 : nextPaymentDate ??"-"}
 </p>
 </div>
 <div className="rounded-lg bg-slate-50 bg-slate-100/50 p-3">
 <div className="flex items-center gap-2 mb-1.5">
 <Users className="h-3.5 w-3.5 text-slate-400"/>
 <span className="text-xs text-slate-400">
 좌석 사용량
 </span>
 </div>
 <p className="text-sm font-semibold text-slate-900">
 {currentSeats}명 /{""}
 {maxSeats === null ?"무제한": `${maxSeats}명`}
 </p>
 </div>
 <div className="rounded-lg bg-slate-50 bg-slate-100/50 p-3">
 <div className="flex items-center gap-2 mb-1.5">
 <BarChart3 className="h-3.5 w-3.5 text-slate-400"/>
 <span className="text-xs text-slate-400">
 월간 견적
 </span>
 </div>
 <p className="text-sm font-semibold text-slate-900">
 {limits.maxQuotesPerMonth === null
 ?"무제한"
 : `${limits.maxQuotesPerMonth}건`}
 </p>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ② 결제 주기 토글
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
 <div className="flex items-center justify-center">
 <div className="bg-white bg-white rounded-full p-1 inline-flex border border-slate-200 border-slate-300 shadow-sm">
 <button
 type="button"
 onClick={() => setIsAnnual(false)}
 className={cn(
"px-5 py-2 text-sm font-medium rounded-full transition-all duration-200",
 !isAnnual
 ?"bg-white text-slate-900 shadow-sm"
 :"text-slate-500 hover:text-slate-700"
 )}
 >
 월간 결제
 </button>
 <button
 type="button"
 onClick={() => setIsAnnual(true)}
 className={cn(
"px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-2",
 isAnnual
 ?"bg-white text-slate-900 shadow-sm"
 :"text-slate-500 hover:text-slate-700"
 )}
 >
 연간 결제
 <span
 className={cn(
"text-xs px-2 py-0.5 rounded-full font-medium",
 isAnnual
 ?"bg-green-500 text-white"
 :"bg-green-100 text-green-700 bg-green-100 text-green-600"
 )}
 >
 10% 할인
 </span>
 </button>
 </div>
 </div>

 {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ③ 플랜 카드
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
 {PLAN_CARDS.map((card) => {
 const display = safePlanDisplay(card.id);
 const planLimits = safePlanLimits(card.id);
 const isCurrentPlan = card.id === currentPlan;
 const isBusiness = card.id === SubscriptionPlan.ORGANIZATION;
 const isIntentTarget =
 intentAction === "checkout" &&
 intentPlanEnum !== null &&
 card.id === intentPlanEnum &&
 !isCurrentPlan;
 const Icon = card.icon;
 const btnInfo = getButtonInfo(card.id);
 const price = getDisplayPrice(card.id);
 const originalPrice = safePlanPrice(card.id);

 return (
 <Card
 key={card.id}
 className={cn(
"relative flex flex-col transition-all duration-300 hover:shadow-lg bg-white",
 isCurrentPlan &&
"ring-2 ring-emerald-500 shadow-lg border-emerald-200 border-emerald-200",
 !isCurrentPlan &&
 isIntentTarget &&
"ring-2 ring-indigo-500 shadow-xl border-indigo-200",
 !isCurrentPlan &&
 !isIntentTarget &&
 display.isRecommended &&
"ring-2 ring-blue-500 shadow-xl border-blue-200 border-blue-200",
 !isCurrentPlan &&
 !isIntentTarget &&
 !display.isRecommended &&
"border-slate-200"
 )}
 >
 <CardHeader className="pb-3 pt-5">
 {/* 상태 배지 — 카드 내부 상단에 안정적 배치 (overflow-hidden 잘림 방지) */}
 {(isCurrentPlan || (!isCurrentPlan && display.isRecommended)) && (
 <div className="mb-2">
 {isCurrentPlan ? (
 <Badge className="bg-emerald-600 text-white px-3 py-1 text-xs whitespace-nowrap w-fit">
 현재 플랜
 </Badge>
 ) : (
 <Badge className="bg-blue-600 text-white px-3 py-1 text-xs whitespace-nowrap w-fit">
 연구팀·구매팀 표준 플랜
 </Badge>
 )}
 </div>
 )}
 <div className="flex items-center gap-3 mb-2">
 <div
 className={cn(
"p-2 rounded-lg",
 isCurrentPlan
 ?"bg-emerald-100 bg-emerald-900/30"
 : isBusiness
 ?"bg-blue-100 bg-blue-100"
 :"bg-slate-100 bg-slate-100"
 )}
 >
 <Icon
 className={cn(
"h-5 w-5",
 isCurrentPlan
 ?"text-emerald-600 text-emerald-400"
 : isBusiness
 ?"text-blue-600 text-blue-600"
 :"text-slate-400"
 )}
 />
 </div>
 <div>
 <CardTitle className="text-xl font-bold text-slate-900">
 {display.displayName}
 </CardTitle>
 <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
 {display.tagline}
 </p>
 </div>
 </div>
 <CardDescription className="text-sm text-slate-400">
 {display.description}
 </CardDescription>

 <div className="mt-4">
 <div className="flex items-baseline gap-1.5">
 {isAnnual && originalPrice > 0 && (
 <span className="text-lg text-slate-400 line-through mr-1">
 ₩{originalPrice.toLocaleString()}
 </span>
 )}
 <span className="text-3xl font-extrabold text-slate-900">
 {formatPrice(price)}
 </span>
 {price > 0 && (
 <span className="text-sm text-slate-400">
 /월
 </span>
 )}
 </div>
 {isAnnual && price > 0 && (
 <p className="text-xs text-green-600 text-green-600 mt-1">
 연 {formatPrice(getAnnualTotalPrice(card.id))} (10% 할인)
 </p>
 )}
 </div>

 <div className="mt-2">
 <span className="text-xs text-slate-400">
 팀원{""}
 {planLimits.maxMembers === null
 ?"무제한"
 : planLimits.maxMembers === 1
 ?"개인 전용"
 : `최대 ${planLimits.maxMembers}명`}
 </span>
 </div>
 </CardHeader>

 <CardContent className="flex flex-col flex-1 space-y-4">
 <div className="space-y-2.5 flex-1">
 {card.features.map((feature) => (
 <div
 key={feature}
 className="flex items-start gap-2.5"
 >
 <Check
 className={cn(
"h-4 w-4 flex-shrink-0 mt-0.5",
 isCurrentPlan
 ?"text-emerald-500"
 : isBusiness
 ?"text-blue-500"
 :"text-green-500"
 )}
 />
 <span className="text-sm text-slate-600 leading-tight">
 {feature}
 </span>
 </div>
 ))}
 </div>

 <div className="pt-4 mt-auto">
 {btnInfo.disabled ? (
 <Button
 className="w-full bg-slate-100 bg-slate-100 text-slate-400 hover:bg-slate-100 hover:bg-slate-100 cursor-not-allowed"
 disabled
 >
 현재 사용 중인 플랜
 </Button>
 ) : (
 <Button
 className={cn(
"w-full shadow-sm hover:shadow-md transition-all",
 btnInfo.isDowngrade
 ?"bg-slate-200 bg-slate-200 text-slate-600 hover:bg-slate-300"
 : isBusiness
 ?"bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
 :"bg-blue-600 hover:bg-blue-700 text-white"
 )}
 onClick={() => handlePlanChange(card.id)}
 disabled={upgradeMutation.isPending}
 >
 {upgradeMutation.isPending ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
 처리 중...
 </>
 ) : (
 <>
 {btnInfo.isUpgrade && (
 <ArrowUpRight className="mr-1.5 h-4 w-4"/>
 )}
 {btnInfo.isDowngrade && (
 <ArrowDownRight className="mr-1.5 h-4 w-4"/>
 )}
 {btnInfo.label}
 </>
 )}
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 );
 })}

 {/* Enterprise 카드 */}
 <Card className="relative flex flex-col border-slate-200 bg-white hover:shadow-lg transition-all duration-300">
 <CardHeader className="pb-3 pt-6">
 <div className="flex items-center gap-3 mb-2">
 <div className="p-2 rounded-lg bg-slate-100 bg-slate-100">
 <Building2 className="h-5 w-5 text-slate-400"/>
 </div>
 <div>
 <CardTitle className="text-xl font-bold text-slate-900">
 {ENTERPRISE_INFO.displayName}
 </CardTitle>
 <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
 {ENTERPRISE_INFO.tagline}
 </p>
 </div>
 </div>
 <CardDescription className="text-sm text-slate-400">
 {ENTERPRISE_INFO.description}
 </CardDescription>
 <div className="mt-4">
 <span className="text-3xl font-extrabold text-slate-900">
 {ENTERPRISE_INFO.priceDisplay}
 </span>
 </div>
 <div className="mt-2">
 <span className="text-xs text-slate-400">
 팀원 무제한 · 전담 매니저 배정
 </span>
 </div>
 </CardHeader>
 <CardContent className="flex flex-col flex-1 space-y-4">
 <div className="space-y-2.5 flex-1">
 {ENTERPRISE_INFO.features.map((feature) => (
 <div key={feature} className="flex items-start gap-2.5">
 <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-500"/>
 <span className="text-sm text-slate-600 leading-tight">
 {feature}
 </span>
 </div>
 ))}
 </div>
 <div className="pt-4 mt-auto">
 <Button
 variant="outline"
 className="w-full border-slate-300 border-slate-300 hover:bg-slate-50 hover:bg-slate-100"
 onClick={() => {
 window.location.href ="/support";
 }}
 >
 <Mail className="mr-2 h-4 w-4"/>
 도입 상담 문의
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ④ 기능 비교 테이블
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
 <Card className="bg-white bg-white border border-slate-200 shadow-sm overflow-hidden">
 <CardHeader className="pb-2">
 <CardTitle className="text-lg text-slate-900">
 운영 기능 비교
 </CardTitle>
 <CardDescription className="text-sm text-slate-400">
 Team은 협업 중심 · Business부터 조직 운영 통제가 시작됩니다.
 </CardDescription>
 </CardHeader>
 <CardContent className="p-0">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-slate-200 border-slate-300 bg-slate-50 bg-slate-100/50">
 <th className="text-left py-3 px-4 font-semibold text-slate-600 w-[220px]">
 기능
 </th>
 <th className="text-center py-3 px-3 font-semibold text-slate-400 w-[100px]">
 Starter
 </th>
 <th className="text-center py-3 px-3 font-semibold text-slate-400 w-[100px]">
 Team
 </th>
 <th className="text-center py-3 px-3 font-semibold text-blue-700 text-blue-600 bg-blue-50/50 bg-blue-50/50 w-[100px]">
 Business
 </th>
 <th className="text-center py-3 px-3 font-semibold text-slate-400 w-[100px]">
 Enterprise
 </th>
 </tr>
 </thead>
 <tbody>
 <tr className="border-b border-slate-100 border-slate-200 bg-slate-50/50 bg-slate-100/30">
 <td className="py-2.5 px-4 font-medium text-slate-400">팀원 수</td>
 <td className="text-center py-2.5 px-3 text-slate-400 font-medium">1명</td>
 <td className="text-center py-2.5 px-3 text-slate-400 font-medium">5명</td>
 <td className="text-center py-2.5 px-3 bg-blue-50/30 bg-blue-50/30 text-blue-700 text-blue-600 font-semibold">무제한</td>
 <td className="text-center py-2.5 px-3 text-slate-400 font-medium">무제한</td>
 </tr>
 <tr className="border-b border-slate-100 border-slate-200 bg-slate-50/50 bg-slate-100/30">
 <td className="py-2.5 px-4 font-medium text-slate-400">품목 등록 수</td>
 <td className="text-center py-2.5 px-3 text-slate-400 font-medium">10개</td>
 <td className="text-center py-2.5 px-3 text-slate-400 font-medium">50개</td>
 <td className="text-center py-2.5 px-3 bg-blue-50/30 bg-blue-50/30 text-blue-700 text-blue-600 font-semibold">무제한</td>
 <td className="text-center py-2.5 px-3 text-slate-400 font-medium">무제한</td>
 </tr>
 {FEATURE_COMPARISON.map((feat) => {
 const starterHas =
 (safePlanLimits(SubscriptionPlan.FREE).features as any)?.[feat.key] ?? false;
 const teamHas =
 (safePlanLimits(SubscriptionPlan.TEAM).features as any)?.[feat.key] ?? false;
 const businessHas =
 (safePlanLimits(SubscriptionPlan.ORGANIZATION).features as any)?.[feat.key] ?? false;
 const enterpriseHas = true;

 const renderCell = (has: boolean, isBiz: boolean = false) =>
 has ? (
 <CheckCircle2
 className={cn(
"h-4 w-4 mx-auto",
 isBiz
 ?"text-blue-500"
 :"text-green-500 text-green-600"
 )}
 />
 ) : (
 <span className="text-slate-600 text-slate-600 text-lg leading-none">
 —
 </span>
 );

 return (
 <tr
 key={feat.key}
 className="border-b border-slate-100 border-slate-200 hover:bg-slate-50/50 hover:bg-slate-100/30 transition-colors"
 >
 <td className="py-2.5 px-4">
 <div>
 <span className="font-medium text-slate-600">
 {feat.label}
 </span>
 <p className="text-xs text-slate-400 text-slate-500 mt-0.5">
 {feat.desc}
 </p>
 </div>
 </td>
 <td className="text-center py-2.5 px-3">{renderCell(starterHas)}</td>
 <td className="text-center py-2.5 px-3">{renderCell(teamHas)}</td>
 <td className="text-center py-2.5 px-3 bg-blue-50/30 bg-blue-50/30">
 {renderCell(businessHas, true)}
 </td>
 <td className="text-center py-2.5 px-3">{renderCell(enterpriseHas)}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </CardContent>
 </Card>

 {/* ── 문의 안내 ── */}
 <Card className="bg-slate-50 bg-white/50 border border-slate-200">
 <CardContent className="py-6">
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
 <div>
 <p className="text-sm font-medium text-slate-600">
 플랜 선택이 어려우신가요?
 </p>
 <p className="text-xs text-slate-400 mt-0.5">
 도입 규모와 필요 기능에 맞는 플랜을 추천해드립니다.
 </p>
 </div>
 <Button
 variant="outline"
 size="sm"
 className="whitespace-nowrap"
 onClick={() => {
 window.location.href = `/support?subject=${encodeURIComponent("플랜 상담 문의")}`;
 }}
 >
 <Mail className="mr-2 h-4 w-4"/>
 요금 & 도입 문의
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>

 {/* ── 결제 세션 다이얼로그 ── */}
 {checkoutTarget && selectedOrg && (
 <CheckoutDialog
 open={!!checkoutTarget}
 onOpenChange={(open) => { if (!open) setCheckoutTarget(null); }}
 currentPlan={currentPlan}
 targetPlan={checkoutTarget}
 isAnnual={isAnnual}
 currentSeats={currentSeats}
 organizationId={selectedOrg.id}
 onComplete={() => {
 setCheckoutTarget(null);
 queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
 queryClient.invalidateQueries({ queryKey: ["subscription", selectedOrgId] });
 }}
 />
 )}
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════════
// Export — Suspense + ErrorBoundary 로 감싸서 내보냄
//   Suspense 는 useSearchParams() 요구사항 (Next.js 14)
// ═══════════════════════════════════════════════════════════════════
export default function PlansPage() {
 return (
 <Suspense fallback={<PlansSkeleton />}>
 <PlansErrorBoundary>
 <PlansPageContent />
 </PlansErrorBoundary>
 </Suspense>
 );
}
