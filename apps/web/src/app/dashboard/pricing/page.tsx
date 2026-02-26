"use client";

import { Check, Minus, Building2, Users, User, Package, CreditCard, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PricingPage() {
  return (
    <div className="flex-1 space-y-12 p-4 md:p-8 pt-6 max-w-6xl mx-auto w-full">
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          연구실 규모에 맞는 최적의 플랜을 선택하세요.
        </h2>
        <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto">
          엑셀 수기 관리에서 벗어나, 연구에만 집중할 수 있는 완벽한 환경을 구축하세요.
        </p>
      </div>

      {/* 3단 요금제 카드 */}
      <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
        {/* Starter */}
        <Card className="border-slate-200 dark:border-slate-800 flex flex-col">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <User className="text-slate-600 dark:text-slate-400 w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">스타터 (Starter)</CardTitle>
            <CardDescription className="mt-2">초기 랩실 및 개인 연구원</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">무료</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                개인 전용 (팀원 초대 불가)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                재고 관리 (최대 100개)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                최저가 견적 요청 및 발주
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                기본 재고 관리
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              현재 사용 중
            </Button>
          </CardFooter>
        </Card>

        {/* Pro (Best Choice) */}
        <Card className="border-blue-600 dark:border-blue-500 shadow-lg relative flex flex-col transform md:-translate-y-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide">
            BEST CHOICE
          </div>
          <CardHeader className="text-center pb-4 pt-8">
            <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
              <Users className="text-blue-600 dark:text-blue-400 w-6 h-6" />
            </div>
            <CardTitle className="text-2xl text-blue-900 dark:text-blue-100">프로 (Pro)</CardTitle>
            <CardDescription className="mt-2">체계적인 관리가 필요한 대학/벤처</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">₩99,000</span>
              <span className="text-slate-500 dark:text-slate-400"> / 월</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                팀원 및 재고 무제한
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                Lot / 유효기한 개별 추적
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                MSDS 및 고위험 물질 관리
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                예산 설정 및 지출 분석 대시보드
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              14일 무료 체험 시작
            </Button>
          </CardFooter>
        </Card>

        {/* Enterprise */}
        <Card className="border-slate-200 dark:border-slate-800 flex flex-col">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Building2 className="text-slate-600 dark:text-slate-400 w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">엔터프라이즈</CardTitle>
            <CardDescription className="mt-2">기업 연구소 및 대형 R&D 센터</CardDescription>
            <div className="mt-4">
              <span className="text-3xl font-bold">도입 문의</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                Pro 기능 전체 포함
              </li>
              <li className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                단일 세금계산서 (통합 정산)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                커스텀 결재선 (Approval)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                ERP 연동
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                전담 매니저
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full bg-slate-50 dark:bg-slate-900/50">
              영업팀과 상담하기
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* 상세 기능 비교표 */}
      <div className="mt-16 max-w-5xl mx-auto">
        <h3 className="text-2xl font-bold text-center mb-8">상세 기능 비교</h3>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[30%]">기능</TableHead>
                <TableHead className="text-center">Starter</TableHead>
                <TableHead className="text-center bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold">
                  Pro
                </TableHead>
                <TableHead className="text-center">Enterprise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 카테고리 1: 재고 관리 */}
              <TableRow className="bg-slate-50/50 dark:bg-slate-900/30">
                <TableCell colSpan={4} className="font-bold text-slate-600 dark:text-slate-400 text-xs py-2">
                  <span className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-slate-500" />
                    재고 관리
                  </span>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">팀원 수</TableCell>
                <TableCell className="text-center text-slate-500 dark:text-slate-400">1명</TableCell>
                <TableCell className="text-center font-bold text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-950/20">
                  무제한
                </TableCell>
                <TableCell className="text-center text-slate-600 dark:text-slate-300 font-medium">무제한</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">재고 등록 한도</TableCell>
                <TableCell className="text-center text-slate-500 dark:text-slate-400">최대 100개</TableCell>
                <TableCell className="text-center font-bold text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-950/20">
                  무제한
                </TableCell>
                <TableCell className="text-center text-slate-600 dark:text-slate-300 font-medium">무제한</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">Lot 및 유효기한 개별 관리</TableCell>
                <TableCell className="text-center">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/20">
                  <Check className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">MSDS / 안전 관리</TableCell>
                <TableCell className="text-center">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/20">
                  <Check className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>

              {/* 카테고리 2: 구매 및 정산 */}
              <TableRow className="bg-slate-50/50 dark:bg-slate-900/30">
                <TableCell colSpan={4} className="font-bold text-slate-600 dark:text-slate-400 text-xs py-2">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                    구매 및 정산
                  </span>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">최저가 견적 요청</TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
                <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/20">
                  <Check className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">단일 세금계산서 (통합 정산)</TableCell>
                <TableCell className="text-center">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/20">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">커스텀 결재선 (Approval)</TableCell>
                <TableCell className="text-center">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/20">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>

              {/* 카테고리 3: 분석 및 권한 */}
              <TableRow className="bg-slate-50/50 dark:bg-slate-900/30">
                <TableCell colSpan={4} className="font-bold text-slate-600 dark:text-slate-400 text-xs py-2">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5 text-slate-500" />
                    분석 및 권한
                  </span>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">예산 설정 및 팀원별 지출 분석</TableCell>
                <TableCell className="text-center">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/20">
                  <Check className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">ERP / 구매 시스템 연동</TableCell>
                <TableCell className="text-center">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/20">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">전담 매니저</TableCell>
                <TableCell className="text-center">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/20">
                  <Minus className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="w-4 h-4 mx-auto text-emerald-500" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
