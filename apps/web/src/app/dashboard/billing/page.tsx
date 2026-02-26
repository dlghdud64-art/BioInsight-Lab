"use client";

export const dynamic = "force-dynamic";

import { Receipt, FileText, CheckCircle, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function BillingPage() {
  return (
    <div className="w-full px-4 md:px-6 py-6 pt-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 페이지 헤더 */}
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">정산 및 세금계산서</h2>
          <p className="text-muted-foreground">
            여러 벤더의 구매 내역을 BioInsight 단일 세금계산서로 한 번에 처리하세요.
          </p>
        </div>

        {/* KPI 카드 - 이번 달 정산 요약 */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                이번 달 청구 금액
              </CardTitle>
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/40">
                <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold md:text-3xl">₩ 12,450,000</div>
              <p className="text-xs text-muted-foreground mt-1">통합 청구</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                미납 금액
              </CardTitle>
              <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/40">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 md:text-3xl">
                ₩ 0
              </div>
              <p className="text-xs text-muted-foreground mt-1">모두 결제 완료</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                발행된 세금계산서
              </CardTitle>
              <div className="rounded-full bg-slate-100 p-2 dark:bg-slate-800">
                <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold md:text-3xl">1 건</div>
              <p className="text-xs text-muted-foreground mt-1">여러 건 → 1건 통합</p>
            </CardContent>
          </Card>
        </div>

        {/* 통합 세금계산서 내역 (메인 카드) */}
        <Card className="shadow-sm border-blue-200 dark:border-blue-800">
          <CardHeader className="rounded-t-lg border-b border-blue-100 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">2026년 2월 통합 세금계산서</CardTitle>
                <CardDescription className="mt-1 font-medium text-slate-600 dark:text-slate-400">
                  Sigma-Aldrich, Thermo Fisher, Eppendorf 외 3곳 통합
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="h-6 w-fit shrink-0 rounded-full border-blue-200 bg-blue-100 px-2.5 font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
              >
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                국세청 전송 완료
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">결제 기한: 2026.03.10</p>
                <p className="mt-1 text-2xl font-bold">₩ 12,450,000</p>
              </div>
              <Button className="w-fit bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                <Download className="mr-2 h-4 w-4" />
                계산서 다운로드
              </Button>
            </div>

            {/* 포함된 상세 주문 내역 (서브 테이블) */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
                포함된 상세 주문 내역
              </h4>
              <div className="overflow-x-auto">
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>주문 일자</TableHead>
                    <TableHead>주문명</TableHead>
                    <TableHead>벤더명</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>2026.02.05</TableCell>
                    <TableCell className="font-medium">Gibco FBS (500ml) 외 2건</TableCell>
                    <TableCell>Thermo Fisher</TableCell>
                    <TableCell className="text-right">₩ 3,200,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2026.02.12</TableCell>
                    <TableCell className="font-medium">Acetone 500ml 외 1건</TableCell>
                    <TableCell>Sigma-Aldrich</TableCell>
                    <TableCell className="text-right">₩ 2,800,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2026.02.15</TableCell>
                    <TableCell className="font-medium">Pipette tips (박스) 외 3건</TableCell>
                    <TableCell>Eppendorf</TableCell>
                    <TableCell className="text-right">₩ 1,950,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2026.02.18</TableCell>
                    <TableCell className="font-medium">Cell culture media kit</TableCell>
                    <TableCell>Merck</TableCell>
                    <TableCell className="text-right">₩ 2,100,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2026.02.22</TableCell>
                    <TableCell className="font-medium">Lab consumables 세트</TableCell>
                    <TableCell>VWR</TableCell>
                    <TableCell className="text-right">₩ 2,400,000</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 추가: 발행 완료 상태 예시 카드 (선택) - 리스트 형태 강조용 */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">다른 월 통합 세금계산서</CardTitle>
            <CardDescription>과거 발행된 통합 세금계산서 목록</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              <li className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">2026년 1월 통합 세금계산서</p>
                  <p className="text-xs text-muted-foreground">
                    Sigma-Aldrich, Thermo Fisher 외 2곳 통합
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                >
                  발행 완료
                </Badge>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">₩ 8,200,000</span>
                  <Button variant="outline" size="sm">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    다운로드
                  </Button>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
