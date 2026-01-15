import { Metadata } from "next"
import Link from "next/link"
import { 
  ChevronRight, Plus, Search, MoreHorizontal, 
  FileText, ArrowUpDown 
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"

export const metadata: Metadata = {
  title: "견적 관리",
  description: "견적 요청 내역을 관리합니다.",
}

// --- Mock Data (화면 확인용) ---
const MOCK_QUOTES = [
  { id: "Q-2026-001", product: "Gibco FBS (500ml) 외 3건", vendor: "Thermo Fisher", date: "2026.01.16", status: "waiting", amount: 450000 },
  { id: "Q-2026-002", product: "Falcon 50ml Conical Tube", vendor: "Corning", date: "2026.01.15", status: "received", amount: 85000 },
  { id: "Q-2026-003", product: "Centrifuge 5424 R", vendor: "Eppendorf", date: "2026.01.14", status: "completed", amount: 3200000 },
  { id: "Q-2026-004", product: "PCR Master Mix", vendor: "Takara", date: "2026.01.10", status: "rejected", amount: 120000 },
  { id: "Q-2026-005", product: "Nitrile Gloves (M)", vendor: "Ansell", date: "2026.01.09", status: "completed", amount: 55000 },
]

export default function QuotesPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* 1. Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/dashboard" className="hover:text-primary">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">견적 관리</span>
      </div>

      {/* 2. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">견적 요청 관리</h2>
          <p className="text-muted-foreground mt-1">공급사에 요청한 견적 진행 상황을 실시간으로 확인하세요.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> 새 견적 요청
        </Button>
      </div>

      {/* 3. Filters */}
      <div className="flex items-center justify-between gap-4 bg-white p-1 rounded-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="견적 번호, 품목명 검색..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
           <Select defaultValue="all">
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="진행 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 보기</SelectItem>
              <SelectItem value="waiting">대기중</SelectItem>
              <SelectItem value="received">견적 도착</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4. Table */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[120px]">견적 번호</TableHead>
              <TableHead>품목 정보</TableHead>
              <TableHead>공급사</TableHead>
              <TableHead>요청일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">예상 금액</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_QUOTES.map((quote) => (
              <TableRow key={quote.id} className="hover:bg-slate-50/50 cursor-pointer">
                <TableCell className="font-medium text-slate-600">{quote.id}</TableCell>
                <TableCell>
                  <div className="font-medium">{quote.product}</div>
                </TableCell>
                <TableCell>{quote.vendor}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{quote.date}</TableCell>
                <TableCell>
                  {quote.status === 'waiting' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">대기중</Badge>}
                  {quote.status === 'received' && <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">견적 도착</Badge>}
                  {quote.status === 'completed' && <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">발주 완료</Badge>}
                  {quote.status === 'rejected' && <Badge variant="outline" className="text-slate-500">취소됨</Badge>}
                </TableCell>
                <TableCell className="text-right font-medium">
                  ₩ {quote.amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>상세 보기</DropdownMenuItem>
                      <DropdownMenuItem>견적서 다운로드</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">요청 취소</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
