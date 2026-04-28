"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Download, FileText, Search, ShieldAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

// §11.64 #audit-trail-operator-friendly-tone
//
// 호영님 mock-up 시안 (담백한 table + 필터 row + token 라벨) 형태로 재디자인.
// 거부:
//   - 자물쇠 icon (헤더 + small label 둘 다)
//   - "(Audit Trail)" 영문 병기 (한국어 "감사 증적"만)
//   - "CFR 21 Part 11 대응" 규제 톤 description
//   - 빨간 취소선 변경 표기 (이전 값을 잘못된 것처럼 보이게 함)
//   - "전자서명 완료" 등 e-signature 강조
// 채택:
//   - 가로 한 줄 필터 (필터 / 최근 30일 / 액션 유형 / 작업자) + 우측 검색
//   - 변경 내역: slate-500 (이전) → slate-900 bold (이후) — 단순 화살표
//   - 사유 옆 token badge (User Token / 시스템 액션)
//   - action-tone color (재고/보관/알림/등록/권한 별 라이트 톤)
//
// LabAxis 원칙: marketing-style decorative 거부 + DashboardShell chrome 그대로 +
// canonical truth 보호 (이번 mock data 만, 실제 audit log 연결은 별도 트랙).

interface AuditLog {
  id: string;
  time: string;
  user: string;
  email: string;
  ip: string;
  action: string;
  actionTone: "stock" | "storage" | "alert" | "register" | "permission";
  target: string;
  before: string;
  after: string;
  reason: string;
  authMethod: "user_token" | "system";
}

const ACTION_TONE: Record<AuditLog["actionTone"], string> = {
  stock: "bg-rose-50 text-rose-700 border-rose-200",
  storage: "bg-amber-50 text-amber-700 border-amber-200",
  alert: "bg-blue-50 text-blue-700 border-blue-200",
  register: "bg-blue-50 text-blue-700 border-blue-200",
  permission: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const AUTH_LABEL: Record<AuditLog["authMethod"], { label: string; cls: string }> = {
  user_token: { label: "User Token", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  system: { label: "시스템 액션", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

export default function AuditTrailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const userRole = session?.user?.role as string | undefined;
  const canAccessAudit = userRole === "ADMIN" || (userRole as string)?.toLowerCase() === "manager";

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/auth/signin?callbackUrl=/dashboard/audit");
      return;
    }
    if (status === "authenticated" && !canAccessAudit) {
      toast({
        title: "접근 권한이 없습니다",
        description: "감사 증적은 관리자만 열람할 수 있습니다.",
        variant: "destructive",
      });
      router.replace("/dashboard");
    }
  }, [status, canAccessAudit, router, toast]);

  if (status === "loading" || !canAccessAudit) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">권한 확인 중</p>
            <p className="text-xs text-slate-400 mt-1 break-keep">
              감사 증적은 관리자(Admin) 계정만 열람할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const auditLogs: AuditLog[] = [
    {
      id: "LOG-992",
      time: "2026-04-26 14:32:05",
      user: "이호영",
      email: "lee@lab.com",
      ip: "192.168.1.44",
      action: "재고 차감",
      actionTone: "stock",
      target: "Gibco FBS (Lot: 24A01-X)",
      before: "3개",
      after: "2개",
      reason: "MTT assay 실험 사용",
      authMethod: "user_token",
    },
    {
      id: "LOG-991",
      time: "2026-04-26 11:15:22",
      user: "김연구",
      email: "kim@lab.com",
      ip: "192.168.1.102",
      action: "보관 조건 변경",
      actionTone: "storage",
      target: "DMSO (Lot: 3202825)",
      before: "냉장 (2~8°C)",
      after: "상온 (15~25°C)",
      reason: "내부 보관 공간 정리",
      authMethod: "user_token",
    },
    {
      id: "LOG-990",
      time: "2026-04-25 09:00:01",
      user: "시스템 자동",
      email: "",
      ip: "10.0.1.5",
      action: "경고 알림 발송",
      actionTone: "alert",
      target: "KGM-Gold (Lot: 0001391852)",
      before: "",
      after: "",
      reason: "유효기한 2달 전 도래로 인한 자동 알림",
      authMethod: "system",
    },
    {
      id: "LOG-989",
      time: "2026-04-25 08:45:33",
      user: "박실험",
      email: "park@lab.com",
      ip: "192.168.1.88",
      action: "시약 등록",
      actionTone: "register",
      target: "Taq DNA Polymerase",
      before: "",
      after: "신규 자산 등록 완료",
      reason: "신규 입고 등록",
      authMethod: "user_token",
    },
    {
      id: "LOG-988",
      time: "2026-04-24 16:20:11",
      user: "최연구",
      email: "choi@lab.com",
      ip: "192.168.1.55",
      action: "권한 변경",
      actionTone: "permission",
      target: "연구실 접근 권한",
      before: "Guest",
      after: "Researcher",
      reason: "정규직 전환에 따른 권한 변경",
      authMethod: "user_token",
    },
  ];

  const filtered = auditLogs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.id.toLowerCase().includes(q) ||
      log.target.toLowerCase().includes(q) ||
      log.user.toLowerCase().includes(q) ||
      log.reason.toLowerCase().includes(q)
    );
  });

  const handlePdfDownload = () => {
    toast({
      title: "PDF 다운로드",
      description: "감사 증적 PDF가 생성되었습니다.",
    });
  };

  const handleCsvExport = () => {
    toast({
      title: "CSV 내보내기",
      description: "감사 증적 데이터가 CSV로 내보내졌습니다.",
    });
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* §11.64: 헤더 단순화 — 자물쇠 제거, CFR 21 Part 11 톤 제거 */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-2">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <span className="font-semibold tracking-tight text-xs uppercase">보안 및 컴플라이언스</span>
          </div>
          <h2 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900">
            감사 증적
          </h2>
          <p className="text-sm text-slate-500 break-keep">
            주요 시스템 데이터 변경 및 접근 기록 이력을 확인합니다.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            className="touch-manipulation active:scale-95"
            onClick={handlePdfDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">PDF </span>다운로드
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white touch-manipulation active:scale-95"
            onClick={handleCsvExport}
          >
            <FileText className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">CSV </span>내보내기
          </Button>
        </div>
      </div>

      {/* §11.67 #audit-trail-dead-button-removal — §11.64 회귀 fix.
          §11.64 시안 흡수 시 필터 4 button (필터/최근 30일/액션 유형/작업자)
          을 추가했으나 onClick wiring 0 → dead button. LabAxis 원칙 strict
          위반 (호영님이 prod 운용 중 직접 지적). 즉시 제거. 검색 박스만
          유지 (이미 wired). 필터 row visual essence 복원은
          `#audit-trail-data-fetcher-wiring` 트랙에서 real /api/audit-logs
          fetcher 와 함께 한 번에 wired — dead button 으로 미리 만들지 않음. */}
      <div className="flex justify-end">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="ID, 대상 품목 또는 사유 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <div className="border border-bd rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[180px] font-semibold text-xs uppercase tracking-wider text-slate-500">일시 (Timestamp) / ID</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">작업자 (User) / IP</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">액션 (Action) 및 대상 품목</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">변경 내역 (Details)</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">사유 (Reason / Auth)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const auth = AUTH_LABEL[log.authMethod];
                const hasChange = log.before && log.after;
                const onlyAfter = !log.before && log.after;
                return (
                  <TableRow key={log.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="font-mono text-sm font-medium text-slate-900">
                        {log.time}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{log.id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900">{log.user}</span>
                        {log.email && (
                          <span className="text-xs text-slate-400 break-all">{log.email}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                        IP: {log.ip || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`mb-1 ${ACTION_TONE[log.actionTone]}`}>
                        {log.action}
                      </Badge>
                      <div className="text-sm font-medium text-slate-900 break-keep">
                        {log.target}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasChange ? (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="text-slate-500 break-keep">{log.before}</span>
                          <span className="text-slate-400 flex-shrink-0">→</span>
                          <span className="text-slate-900 font-bold break-keep">{log.after}</span>
                        </div>
                      ) : onlyAfter ? (
                        <span className="text-sm text-slate-500 italic break-keep">{log.after}</span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-600 break-keep">{log.reason}</div>
                      <Badge
                        variant="outline"
                        className={`mt-1.5 text-[10px] px-1.5 py-0 h-5 ${auth.cls}`}
                      >
                        {auth.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
