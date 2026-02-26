"use client";

import { Download, FileText, Lock, ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  time: string;
  user: string;
  ip: string;
  action: string;
  target: string;
  before: string;
  after: string;
  reason: string;
}

export default function AuditTrailPage() {
  const { toast } = useToast();

  const auditLogs: AuditLog[] = [
    {
      id: "LOG-992",
      time: "2026-02-26 14:32:05",
      user: "이호영 (lee@lab.com)",
      ip: "192.168.1.44",
      action: "재고 차감",
      target: "Gibco FBS (Lot: 24A01-X)",
      before: "3 개",
      after: "2 개",
      reason: "MTT assay 실험 사용 (전자서명 완료)",
    },
    {
      id: "LOG-991",
      time: "2026-02-26 11:15:22",
      user: "김연구 (kim@lab.com)",
      ip: "192.168.1.102",
      action: "보관 조건 변경",
      target: "DMSO (Lot: 3202825)",
      before: "냉장 (2~8°C)",
      after: "상온 (15~25°C)",
      reason: "GMP 보관 규정 업데이트 반영",
    },
    {
      id: "LOG-990",
      time: "2026-02-25 09:00:01",
      user: "시스템 자동 (System)",
      ip: "-",
      action: "경고 알림 발송",
      target: "KGM-Gold (Lot: 0001391852)",
      before: "-",
      after: "-",
      reason: "유효기한 2달 전 도래로 인한 자동 알림",
    },
    {
      id: "LOG-989",
      time: "2026-02-25 08:45:33",
      user: "박실험 (park@lab.com)",
      ip: "192.168.1.88",
      action: "시약 등록",
      target: "Taq DNA Polymerase (Lot: M0267-2026)",
      before: "-",
      after: "1 vial",
      reason: "신규 입고 등록",
    },
    {
      id: "LOG-988",
      time: "2026-02-24 16:20:11",
      user: "최연구 (choi@lab.com)",
      ip: "192.168.1.55",
      action: "협업 요청",
      target: "Corning Matrigel (Lot: 354234)",
      before: "-",
      after: "2ml 분주 요청",
      reason: "세포 배양 긴급 테스트용",
    },
  ];

  const handlePdfDownload = () => {
    toast({
      title: "PDF 다운로드",
      description: "실사 제출용 PDF가 생성되었습니다. 다운로드가 시작됩니다.",
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
            <Lock className="h-4 w-4" />
            <span className="font-semibold tracking-tight text-sm">보안 및 컴플라이언스</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            감사 증적 (Audit Trail)
            <Lock className="h-6 w-6 text-slate-500" />
          </h2>
          <p className="text-muted-foreground">
            시스템 내의 모든 데이터 변경 및 접근 기록을 추적합니다. (CFR 21 Part 11 대응)
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            onClick={handlePdfDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            PDF 다운로드
          </Button>
          <Button variant="outline" onClick={handleCsvExport}>
            <FileText className="w-4 h-4 mr-2" />
            CSV 내보내기
          </Button>
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
            <TableRow>
              <TableHead className="w-[180px] font-semibold">일시 (Timestamp) / ID</TableHead>
              <TableHead className="font-semibold">작업자 (User)</TableHead>
              <TableHead className="font-semibold">액션 (Action) 및 대상 품목 (Target)</TableHead>
              <TableHead className="font-semibold">변경 내역 (Details)</TableHead>
              <TableHead className="font-semibold">사유 (Reason / E-Signature)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.map((log) => (
              <TableRow
                key={log.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <TableCell>
                  <div className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                    {log.time}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{log.id}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{log.user}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    IP: {log.ip}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className="mb-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  >
                    {log.action}
                  </Badge>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {log.target}
                  </div>
                </TableCell>
                <TableCell>
                  {log.before !== "-" ? (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-red-500 dark:text-red-400 line-through decoration-red-300 dark:decoration-red-600">
                        {log.before}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {log.after}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{log.reason}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
