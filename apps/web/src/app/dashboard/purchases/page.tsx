"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Download, Calendar as CalendarIcon, Filter, FileText, ChevronRight,
  Receipt, Plus, Search, Package, Hash, DollarSign, CircleDollarSign,
  ShoppingCart, TrendingUp, TrendingDown, AlertTriangle, BarChart2,
  RefreshCw, Store, ArrowUpRight, CreditCard, Building2,
  Repeat, AlertCircle, CheckCircle2, PackageCheck, ClipboardList,
  ListFilter, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/app/_components/page-header";
import { CsvUploadTab } from "@/components/purchases/csv-upload-tab";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ko } from "date-fns/locale";
import { getGuestKey } from "@/lib/guest-key";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PurchasesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("month");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [customDateRange, setCustomDateRange] = useState<{ from: string; to: string } | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(undefined);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // 구매 내역 등록 폼 상태
  const [vendorName, setVendorName] = useState("");
  const [category, setCategory] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KRW");
  const [importResult, setImportResult] = useState<{ total: number; success: number; errors: { row: number; message: string }[] } | null>(null);
  const [tsvParseErrors, setTsvParseErrors] = useState<{ row: number; message: string }[]>([]);

  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      const data = await response.json();
      return data.organizations || [];
    },
    enabled: !!session,
  });

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "month":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "year":
        return { from: startOfYear(now), to: endOfYear(now) };
      case "all":
        return { from: new Date(2020, 0, 1), to: now };
      default:
        return { from: startOfMonth(now), to: endOfMonth(now) };
    }
  };

  const { from, to } = getDateRange();

  const guestKey = getGuestKey();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["purchase-summary", session?.user?.id, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const headers: Record<string, string> = {};
      if (guestKey) headers["x-guest-key"] = guestKey;
      const response = await fetch(`/api/purchases/summary?${params}`, { headers });
      if (!response.ok) throw new Error("Failed to fetch purchase summary");
      return response.json();
    },
    enabled: !!session,
  });

  // TSV/CSV 파싱 함수 (행별 에러 추적)
  const parseTsvToRows = (text: string): { rows: any[]; errors: { row: number; message: string }[] } => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("최소 2줄 이상 필요합니다 (헤더 + 데이터)");
    }

    // 헤더 파싱
    const headerLine = lines[0];
    const delimiter = headerLine.includes("\t") ? "\t" : ",";
    const headers = headerLine.split(delimiter).map((h) => h.trim());

    // 컬럼 매핑 (한글/영문 헤더 지원)
    const columnMap: Record<string, string> = {
      "구매일": "purchasedAt", "purchasedAt": "purchasedAt", "date": "purchasedAt",
      "벤더": "vendorName", "vendorName": "vendorName", "vendor": "vendorName",
      "카테고리": "category", "category": "category",
      "품목명": "itemName", "itemName": "itemName", "item": "itemName", "품목": "itemName",
      "수량": "qty", "qty": "qty", "quantity": "qty",
      "단가": "unitPrice", "unitPrice": "unitPrice", "price": "unitPrice",
      "금액": "amount", "amount": "amount", "total": "amount",
      "통화": "currency", "currency": "currency",
      "카탈로그번호": "catalogNumber", "catalogNumber": "catalogNumber", "catalog": "catalogNumber",
      "단위": "unit", "unit": "unit",
    };

    const mappedHeaders = headers.map((h) => columnMap[h] || h.toLowerCase());

    const rows: any[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // 빈 줄 건너뛰기

      const values = line.split(delimiter).map((v) => v.trim());
      if (values.length !== headers.length) {
        errors.push({ row: i + 1, message: `컬럼 수 불일치 (기대: ${headers.length}, 실제: ${values.length})` });
        continue;
      }

      const row: any = {};
      headers.forEach((_header, idx) => {
        const mappedKey = mappedHeaders[idx];
        const value = values[idx];

        if (mappedKey === "qty" || mappedKey === "unitPrice" || mappedKey === "amount") {
          row[mappedKey] = value ? parseInt(value.replace(/,/g, "")) : undefined;
        } else {
          row[mappedKey] = value || undefined;
        }
      });

      // 필수 필드 확인
      const missing: string[] = [];
      if (!row.purchasedAt) missing.push("구매일");
      if (!row.vendorName) missing.push("벤더");
      if (!row.itemName) missing.push("품목명");
      if (!row.qty) missing.push("수량");

      if (missing.length > 0) {
        errors.push({ row: i + 1, message: `필수 필드 누락: ${missing.join(", ")}` });
      } else {
        rows.push(row);
      }
    }

    return { rows, errors };
  };

  // 구매 내역 등록 Mutation
  const createPurchaseMutation = useMutation({
    mutationFn: async (data: {
      purchase_date: string;
      vendor_name: string;
      product_name: string;
      category?: string;
      quantity: number;
      unit_price: number;
      currency: string;
      total_amount: number;
    }) => {
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create purchase");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
      toast({
        title: "구매 내역이 등록되었습니다.",
        description: "구매 내역이 성공적으로 저장되었습니다.",
      });
      // 폼 초기화
      setPurchaseDate(undefined);
      setVendorName("");
      setCategory("");
      setItemName("");
      setQuantity("");
      setUnitPrice("");
      setAmount("");
      setCurrency("KRW");
    },
    onError: (error: Error) => {
      toast({
        title: "저장 실패",
        description: error.message || "다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  // 구매 내역 등록 핸들러
  const handlePurchaseSubmit = async () => {
    // 유효성 검사
    if (!purchaseDate || !vendorName || !itemName) {
      toast({
        title: "필수 정보를 입력해주세요.",
        description: "구매일, 벤더명, 품목명은 필수입니다.",
        variant: "destructive",
      });
      return;
    }

    // 숫자 변환 (콤마 제거)
    const cleanQuantity = quantity ? Number(String(quantity).replace(/,/g, "")) : 0;
    const cleanUnitPrice = unitPrice ? Number(String(unitPrice).replace(/,/g, "")) : 0;
    const cleanAmount = amount ? Number(String(amount).replace(/,/g, "")) : 0;

    // 총액 계산 (금액이 없으면 수량 * 단가로 계산)
    const calculatedTotal = cleanQuantity * cleanUnitPrice;
    const finalTotal = cleanAmount || calculatedTotal;

    if (finalTotal <= 0) {
      toast({
        title: "금액 오류",
        description: "금액 또는 수량과 단가를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      purchase_date: format(purchaseDate, "yyyy-MM-dd"),
      vendor_name: vendorName,
      product_name: itemName,
      category: category || undefined,
      quantity: cleanQuantity,
      unit_price: cleanUnitPrice,
      currency: currency,
      total_amount: finalTotal,
    };

    createPurchaseMutation.mutate(payload);
  };

  const importMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const response = await fetch("/api/purchases/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-key": guestKey,
        },
        body: JSON.stringify({ rows }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import");
      }
      return response.json();
    },
    onSuccess: (data, _vars, _ctx) => {
      const result = {
        total: (data.successRows ?? 0) + (data.errorRows ?? 0),
        success: data.successRows ?? 0,
        errors: (data.errorSample ?? []) as { row: number; message: string }[],
      };
      setImportResult(result);
      toast({
        title: `${result.success}건 등록 완료`,
        description: result.errors.length > 0 ? `${result.errors.length}건 실패` : "전체 성공",
        variant: result.errors.length > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
      queryClient.invalidateQueries({ queryKey: ["purchases-list"] });
    },
    onError: (error: Error) => {
      toast({
        title: "가져오기 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!csvText.trim()) {
      toast({ title: "데이터를 붙여넣어 주세요.", variant: "destructive" });
      return;
    }

    setImportResult(null);
    setTsvParseErrors([]);

    try {
      const { rows, errors } = parseTsvToRows(csvText);
      setTsvParseErrors(errors);

      if (rows.length === 0) {
        toast({
          title: "유효한 행이 없습니다",
          description: errors.length > 0 ? `${errors.length}건 파싱 에러` : "데이터를 확인해 주세요.",
          variant: "destructive",
        });
        return;
      }
      importMutation.mutate(rows);
    } catch (error: any) {
      toast({ title: "파싱 오류", description: error.message, variant: "destructive" });
    }
  };

  // 전 서비스 원화(KRW) 통일: currency 값에 관계없이 항상 ₩ 원화로 표시
  const formatCurrency = (amount: number | null | undefined, _currency?: string) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) {
      return "₩0";
    }
    const safeAmount = Number(amount);
    if (isNaN(safeAmount) || safeAmount < 0) {
      return "₩0";
    }
    return "₩" + new Intl.NumberFormat("ko-KR").format(safeAmount);
  };

  // 구매 내역 리스트 조회
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ["purchases-list", session?.user?.id, dateRange, customDateRange],
    queryFn: async () => {
      const dateFrom = customDateRange?.from || from.toISOString();
      const dateTo = customDateRange?.to || to.toISOString();
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
      });
      const headers: Record<string, string> = {};
      if (guestKey) headers["x-guest-key"] = guestKey;
      const response = await fetch(`/api/purchases?${params}`, { headers });
      if (!response.ok) throw new Error("Failed to fetch purchases");
      return response.json();
    },
    enabled: !!session,
  });

  // 필터링된 구매 내역
  const filteredPurchases = useMemo(() => {
    if (!purchasesData?.items) return [];
    let filtered = purchasesData.items;

    // 검색 필터 (품목명)
    if (searchQuery) {
      filtered = filtered.filter((purchase: any) =>
        purchase.itemName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 공급사 필터
    if (selectedVendor !== "all") {
      filtered = filtered.filter((purchase: any) =>
        purchase.vendorName === selectedVendor
      );
    }

    return filtered;
  }, [purchasesData?.items, searchQuery, selectedVendor]);

  // 고유한 공급사 목록
  const uniqueVendors = useMemo(() => {
    if (!purchasesData?.items) return [];
    const vendors = new Set(purchasesData.items.map((p: any) => p.vendorName).filter(Boolean));
    return Array.from(vendors).sort() as string[];
  }, [purchasesData?.items]);

  // ── 카테고리 라벨 매핑 ──
  const CATEGORY_LABEL_MAP: Record<string, string> = {
    REAGENT: "시약", REAGENTS: "시약", TOOL: "장비", TOOLS: "장비",
    EQUIPMENT: "장비", CONSUMABLE: "소모품", CONSUMABLES: "소모품",
    RAW_MATERIAL: "원자재", GLASSWARE: "유리기구", CHEMICAL: "화학물질",
    CHEMICALS: "화학물질", MEDIA: "배지", BUFFER: "완충용액", OTHER: "기타", ETC: "기타",
  };
  const getCategoryLabel = (raw: string | null | undefined): string => {
    if (!raw) return "미분류";
    return CATEGORY_LABEL_MAP[raw.toUpperCase()] ?? raw;
  };

  // ── 증빙 체크리스트 상태 (useMemo 의존성보다 앞에 선언) ──
  const [evidenceChecklist, setEvidenceChecklist] = useState<Record<string, Record<string, boolean>>>({});

  // ── 증빙 체크리스트 항목 ──
  const EVIDENCE_ITEMS = [
    { key: "quotation", label: "견적서 존재 여부" },
    { key: "transaction", label: "거래명세서 존재 여부" },
    { key: "taxInvoice", label: "세금계산서 존재 여부" },
    { key: "amountMatch", label: "발주 금액 일치 여부" },
    { key: "receivingConfirm", label: "입고 확인 여부" },
  ];

  const getEvidenceCompletionCount = (purchaseId: string) => {
    const checks = evidenceChecklist[purchaseId] || {};
    return Object.values(checks).filter(Boolean).length;
  };

  // ── 이중 상태 체계: 구매 상태 + 후속 처리 상태 ──
  const getDualStatus = (purchase: any) => {
    const days = Math.floor((Date.now() - new Date(purchase.purchasedAt).getTime()) / 86400000);
    const amount = purchase.amount || 0;
    const purchaseId = purchase.id;
    const completedCount = getEvidenceCompletionCount(purchaseId);
    const totalItems = EVIDENCE_ITEMS.length;

    // 구매 상태
    const purchaseStatus = days <= 7
      ? { label: "입고 대기", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800" }
      : { label: "구매 완료", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" };

    // 후속 처리 상태
    let followUpStatus: { label: string; className: string; action?: string } | null = null;

    if (amount >= 2000000 && days <= 14) {
      if (completedCount === 0) {
        followUpStatus = { label: "증빙 업로드 필요", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800", action: "증빙 파일 등록" };
      } else if (completedCount < totalItems) {
        followUpStatus = { label: "증빙 검토 필요", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800", action: "회계팀 전달" };
      } else {
        followUpStatus = { label: "정산 완료", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" };
      }
    }

    if (!followUpStatus && days > 7 && days <= 14) {
      followUpStatus = { label: "재고 반영 필요", className: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-800", action: "재고로 반영" };
    }

    return { purchaseStatus, followUpStatus };
  };

  // 하위 호환: getOperationalStatus를 getDualStatus 기반으로 유지
  const getOperationalStatus = (purchase: any) => {
    const { purchaseStatus, followUpStatus } = getDualStatus(purchase);
    return followUpStatus || purchaseStatus;
  };

  // ── 반복 구매 품목 감지 ──
  const repeatPurchaseMap = useMemo(() => {
    if (!purchasesData?.items) return new Map<string, number>();
    const countMap = new Map<string, number>();
    for (const p of purchasesData.items) {
      const key = (p.itemName || "").toLowerCase();
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }
    return countMap;
  }, [purchasesData?.items]);

  // ── 운영 KPI 계산 ──
  const operationalKPIs = useMemo(() => {
    const items = purchasesData?.items || [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;

    // 이번 달 발주 건수
    const thisMonth = new Date();
    const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).getTime();
    const thisMonthOrders = items.filter((p: any) => new Date(p.purchasedAt).getTime() >= monthStart).length;

    // 반복 구매 품목 수
    const repeatItems = Array.from(repeatPurchaseMap.entries()).filter(([, count]) => count >= 2);
    const topRepeatItem = repeatItems.sort((a, b) => b[1] - a[1])[0];

    // 공급사 집중도 (상위 1개 공급사 비중)
    const vendorAmounts: Record<string, number> = {};
    let totalAmount = 0;
    for (const p of items) {
      const v = p.vendorName || "미등록";
      vendorAmounts[v] = (vendorAmounts[v] || 0) + (p.amount || 0);
      totalAmount += p.amount || 0;
    }
    const topVendorEntry = Object.entries(vendorAmounts).sort((a, b) => b[1] - a[1])[0];
    const vendorConcentration = topVendorEntry && totalAmount > 0
      ? Math.round((topVendorEntry[1] / totalAmount) * 100)
      : 0;

    // 최근 30일 고액 구매 (200만원 이상)
    const highValueRecent = items.filter(
      (p: any) => new Date(p.purchasedAt).getTime() >= thirtyDaysAgo && (p.amount || 0) >= 2000000
    ).length;

    // 후속 처리 필요 건: 증빙 + 재고 반영 구분
    let evidenceNeededCount = 0;
    let inventoryNeededCount = 0;
    for (const p of items) {
      const days = Math.floor((now - new Date(p.purchasedAt).getTime()) / 86400000);
      const amt = p.amount || 0;
      if (amt >= 2000000 && days <= 14) {
        const completed = getEvidenceCompletionCount(p.id);
        if (completed < EVIDENCE_ITEMS.length) evidenceNeededCount++;
      }
      if (days > 7 && days <= 14) inventoryNeededCount++;
    }

    return {
      thisMonthOrders,
      repeatItemCount: repeatItems.length,
      topRepeatItem: topRepeatItem ? { name: topRepeatItem[0], count: topRepeatItem[1] } : null,
      vendorConcentration,
      topVendorName: topVendorEntry?.[0] || "-",
      highValueRecent,
      pendingActions: evidenceNeededCount + inventoryNeededCount,
      evidenceNeededCount,
      inventoryNeededCount,
    };
  }, [purchasesData?.items, repeatPurchaseMap, evidenceChecklist]);

  // ── 고유 카테고리 목록 ──
  const uniqueCategories = useMemo(() => {
    if (!purchasesData?.items) return [];
    const cats = new Set(purchasesData.items.map((p: any) => p.category).filter(Boolean));
    return Array.from(cats).sort() as string[];
  }, [purchasesData?.items]);

  // ── 상태 필터 ──
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // 필터 재정의 (기존 filteredPurchases 대체)
  const enhancedFilteredPurchases = useMemo(() => {
    let filtered = filteredPurchases;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((p: any) => p.category === selectedCategory);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((p: any) => {
        const { purchaseStatus, followUpStatus } = getDualStatus(p);
        return purchaseStatus.label === selectedStatus || followUpStatus?.label === selectedStatus;
      });
    }

    return filtered;
  }, [filteredPurchases, selectedCategory, selectedStatus, evidenceChecklist]);

  // 활성 필터 개수 (모바일 필터 바 표시용)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (customDateRange) count++;
    if (selectedVendor !== "all") count++;
    if (selectedCategory !== "all") count++;
    if (selectedStatus !== "all") count++;
    return count;
  }, [searchQuery, customDateRange, selectedVendor, selectedCategory, selectedStatus]);

  // DataTable 컬럼 정의
  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: "purchasedAt",
      header: "거래일자",
      cell: ({ row }) => {
        const date = row.original.purchasedAt;
        return (
          <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {date ? format(new Date(date), "yyyy.MM.dd") : "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "itemName",
      header: "품목명",
      cell: ({ row }) => {
        const item = row.original;
        const key = (item.itemName || "").toLowerCase();
        const count = repeatPurchaseMap.get(key) || 0;
        return (
          <div className="flex flex-col gap-0.5 max-w-[180px]">
            <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{item.itemName || "-"}</span>
            <div className="flex items-center gap-1.5">
              {item.catalogNumber && (
                <span className="text-[11px] text-slate-400 font-mono">{item.catalogNumber}</span>
              )}
              {count >= 2 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-blue-200 text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400">
                  <Repeat className="h-2.5 w-2.5 mr-0.5" />{count}회
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "vendorName",
      header: "공급사",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{row.original.vendorName || "-"}</span>
      ),
    },
    {
      accessorKey: "category",
      header: "분류",
      cell: ({ row }) => {
        const cat = row.original.category;
        return (
          <span className="text-xs text-slate-500 dark:text-slate-400">{getCategoryLabel(cat)}</span>
        );
      },
    },
    {
      accessorKey: "qty",
      header: "수량",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {item.qty || 0} {item.unit || ""}
          </span>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "총액",
      cell: ({ row }) => {
        const amount = row.original.amount;
        return <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{formatCurrency(amount)}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "상태",
      cell: ({ row }) => {
        const { purchaseStatus, followUpStatus } = getDualStatus(row.original);
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold whitespace-nowrap ${purchaseStatus.className}`}>
              {purchaseStatus.label}
            </Badge>
            {followUpStatus && (
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold whitespace-nowrap ${followUpStatus.className}`}>
                {followUpStatus.label}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const purchase = row.original;
        const { followUpStatus } = getDualStatus(purchase);
        if (!followUpStatus?.action) return null;
        return (
          <div className="flex items-center gap-1">
            {followUpStatus.action === "재고로 반영" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30 gap-1 whitespace-nowrap"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/inventory?purchase-receiving=${purchase.id}`);
                }}
              >
                <PackageCheck className="h-3 w-3" />
                재고 반영
              </Button>
            )}
            {(followUpStatus.action === "증빙 파일 등록" || followUpStatus.action === "회계팀 전달") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 gap-1 whitespace-nowrap"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedRowId(expandedRowId === purchase.id ? null : purchase.id);
                }}
              >
                <ClipboardList className="h-3 w-3" />
                증빙 확인
              </Button>
            )}
          </div>
        );
      },
    },
  ], [repeatPurchaseMap, evidenceChecklist, expandedRowId]);

  return (
    <div className="p-4 md:p-8 pt-6 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ══ 1. 페이지 헤더 ══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            구매 운영
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            구매 이력을 확인하고, 재구매·재고·공급사·리포트로 이어지는 후속 조치를 바로 처리하세요.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={() => setIsImportDialogOpen(true)}
            size="sm"
            className="h-8 text-xs gap-1.5 font-medium bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            내역 등록
          </Button>
          <Link href="/dashboard/analytics">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
              <BarChart2 className="h-3.5 w-3.5" />
              구매 리포트
            </Button>
          </Link>
        </div>
      </div>

      {/* Purchase Summary - 로그인 유저 또는 guestKey 보유 시 표시 */}
      {(!!session || !!guestKey) && (
        <>
          {/* ══ 2. 운영 KPI 카드 ══ */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 이번 달 발주 */}
            <div className="rounded-xl border border-slate-200/60 bg-white dark:bg-[#161d2f] dark:border-slate-800/50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">이번 달 발주</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {summaryLoading ? "..." : `${operationalKPIs.thisMonthOrders}건`}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {summaryLoading ? "-" : formatCurrency(summary?.summary?.currentMonthSpending || 0)}
              </p>
            </div>

            {/* 반복 구매 품목 */}
            <div className="rounded-xl border border-slate-200/60 bg-white dark:bg-[#161d2f] dark:border-slate-800/50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">반복 구매</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {summaryLoading ? "..." : `${operationalKPIs.repeatItemCount}개`}
              </div>
              <p className="text-xs text-slate-400 mt-1 truncate">
                {operationalKPIs.topRepeatItem
                  ? `최다: ${operationalKPIs.topRepeatItem.name}`
                  : "반복 구매 없음"}
              </p>
            </div>

            {/* 공급사 집중도 */}
            <div className={`rounded-xl border p-4 shadow-sm ${
              operationalKPIs.vendorConcentration >= 70
                ? "border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900/30"
                : "border-slate-200/60 bg-white dark:bg-[#161d2f] dark:border-slate-800/50"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">공급사 집중도</span>
              </div>
              <div className={`text-xl font-bold ${
                operationalKPIs.vendorConcentration >= 70
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-slate-900 dark:text-slate-100"
              }`}>
                {summaryLoading ? "..." : `${operationalKPIs.vendorConcentration}%`}
              </div>
              <p className="text-xs text-slate-400 mt-1 truncate">
                {operationalKPIs.topVendorName}
              </p>
            </div>

            {/* 고액 구매 */}
            <div className="rounded-xl border border-slate-200/60 bg-white dark:bg-[#161d2f] dark:border-slate-800/50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">고액 구매</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {summaryLoading ? "..." : `${operationalKPIs.highValueRecent}건`}
              </div>
              <p className="text-xs text-slate-400 mt-1">최근 30일 · 200만원 이상</p>
            </div>

            {/* 후속 처리 필요 */}
            <div className={`rounded-xl border p-4 shadow-sm ${
              operationalKPIs.pendingActions > 0
                ? "border-blue-200/60 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-900/30"
                : "border-slate-200/60 bg-white dark:bg-[#161d2f] dark:border-slate-800/50"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">후속 처리 필요</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {summaryLoading ? "..." : `${operationalKPIs.pendingActions}건`}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {operationalKPIs.evidenceNeededCount > 0 && `증빙 ${operationalKPIs.evidenceNeededCount}건`}
                {operationalKPIs.evidenceNeededCount > 0 && operationalKPIs.inventoryNeededCount > 0 && " · "}
                {operationalKPIs.inventoryNeededCount > 0 && `재고 ${operationalKPIs.inventoryNeededCount}건`}
                {operationalKPIs.pendingActions === 0 && "처리 완료"}
              </p>
            </div>
          </div>

          {/* ══ 3. 통합 필터 바 (Desktop) ══ */}
          <Card className="hidden md:block rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* 검색 */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="품목명, 카탈로그 번호 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700"
                  />
                </div>
                {/* 필터 그룹 */}
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                  <DateRangePicker
                    startDate={customDateRange?.from}
                    endDate={customDateRange?.to}
                    onDateChange={(from: string, to: string) => setCustomDateRange({ from, to })}
                  />
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger className="w-[140px] h-9 text-xs">
                      <SelectValue placeholder="공급사" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 공급사</SelectItem>
                      {uniqueVendors.map((vendor) => (
                        <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[110px] h-9 text-xs">
                      <SelectValue placeholder="분류" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 분류</SelectItem>
                      {uniqueCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[130px] h-9 text-xs">
                      <SelectValue placeholder="상태" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 상태</SelectItem>
                      <SelectItem value="입고 대기">입고 대기</SelectItem>
                      <SelectItem value="구매 완료">구매 완료</SelectItem>
                      <SelectItem value="증빙 업로드 필요">증빙 업로드 필요</SelectItem>
                      <SelectItem value="증빙 검토 필요">증빙 검토 필요</SelectItem>
                      <SelectItem value="재고 반영 필요">재고 반영 필요</SelectItem>
                      <SelectItem value="정산 완료">정산 완료</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ══ 3-M. 모바일 필터 요약 바 + 바텀 시트 ══ */}
          <div className="md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="품목명 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs flex-shrink-0 relative"
                onClick={() => setMobileFilterOpen(true)}
              >
                <ListFilter className="h-3.5 w-3.5" />
                필터
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>

            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetContent side="bottom" className="h-auto max-h-[75vh] rounded-t-2xl px-4 pb-6">
                <SheetHeader className="pb-3">
                  <SheetTitle className="text-base">필터</SheetTitle>
                  <SheetDescription className="text-xs text-slate-500">
                    조건을 설정하여 구매 내역을 필터링합니다.
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-4">
                  {/* 기간 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">기간</label>
                    <DateRangePicker
                      startDate={customDateRange?.from}
                      endDate={customDateRange?.to}
                      onDateChange={(from: string, to: string) => setCustomDateRange({ from, to })}
                    />
                  </div>

                  {/* 공급사 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">공급사</label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="공급사" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 공급사</SelectItem>
                        {uniqueVendors.map((vendor) => (
                          <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 분류 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">분류</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="분류" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 분류</SelectItem>
                        {uniqueCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 상태 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">상태</label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="상태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 상태</SelectItem>
                        <SelectItem value="입고 대기">입고 대기</SelectItem>
                        <SelectItem value="구매 완료">구매 완료</SelectItem>
                        <SelectItem value="증빙 업로드 필요">증빙 업로드 필요</SelectItem>
                        <SelectItem value="증빙 검토 필요">증빙 검토 필요</SelectItem>
                        <SelectItem value="재고 반영 필요">재고 반영 필요</SelectItem>
                        <SelectItem value="정산 완료">정산 완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 적용/초기화 */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-10 text-sm"
                      onClick={() => {
                        setSearchQuery("");
                        setCustomDateRange(null);
                        setSelectedVendor("all");
                        setSelectedCategory("all");
                        setSelectedStatus("all");
                      }}
                    >
                      초기화
                    </Button>
                    <Button
                      className="flex-1 h-10 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => setMobileFilterOpen(false)}
                    >
                      적용
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* ══ 4. 구매 내역 ══ */}
          {purchasesLoading ? (
            <Card className="rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
              <CardContent className="flex items-center justify-center py-16">
                <p className="text-sm text-slate-400">구매 내역을 불러오는 중...</p>
              </CardContent>
            </Card>
          ) : enhancedFilteredPurchases.length > 0 ? (
            <>
              {/* Desktop: DataTable */}
              <Card className="hidden md:block rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f] overflow-hidden">
                <CardHeader className="p-4 pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">구매 내역</CardTitle>
                      <CardDescription className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        총 {enhancedFilteredPurchases.length}건
                        {selectedVendor !== "all" && ` · ${selectedVendor}`}
                        {selectedStatus !== "all" && ` · ${selectedStatus}`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-3">
                  <DataTable
                    columns={columns}
                    data={enhancedFilteredPurchases}
                    searchKey="itemName"
                    searchPlaceholder="품명 검색"
                  />
                </CardContent>
              </Card>

              {/* Mobile: Card list */}
              <div className="md:hidden space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    총 {enhancedFilteredPurchases.length}건
                    {selectedVendor !== "all" && ` · ${selectedVendor}`}
                    {selectedStatus !== "all" && ` · ${selectedStatus}`}
                  </p>
                </div>
                {enhancedFilteredPurchases.map((purchase: any) => {
                  const { purchaseStatus, followUpStatus } = getDualStatus(purchase);
                  const repeatKey = (purchase.itemName || "").toLowerCase();
                  const repeatCount = repeatPurchaseMap.get(repeatKey) || 0;
                  return (
                    <div
                      key={purchase.id}
                      className="rounded-xl border border-slate-200/60 dark:border-slate-800/50 bg-white dark:bg-[#161d2f] p-3.5 shadow-sm"
                    >
                      {/* Row 1: 품목명 */}
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200 break-words">
                        {purchase.itemName || "-"}
                      </p>

                      {/* Row 2: 카탈로그번호 · 거래일 */}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {purchase.catalogNumber && <span className="font-mono">{purchase.catalogNumber} · </span>}
                        {purchase.purchasedAt ? format(new Date(purchase.purchasedAt), "yyyy.MM.dd") : "-"}
                      </p>

                      {/* Row 3: 공급사 */}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
                        {purchase.vendorName || "-"}
                      </p>

                      {/* Row 4: 금액 · 반복 구매 */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                          {formatCurrency(purchase.amount)}
                        </span>
                        {repeatCount >= 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-200 text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400">
                            <Repeat className="h-2.5 w-2.5 mr-0.5" />반복 {repeatCount}회
                          </Badge>
                        )}
                      </div>

                      {/* Row 5: 상태 배지 */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold ${purchaseStatus.className}`}>
                          {purchaseStatus.label}
                        </Badge>
                        {followUpStatus && (
                          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold ${followUpStatus.className}`}>
                            {followUpStatus.label}
                          </Badge>
                        )}
                      </div>

                      {/* Row 6: 상세 보기 / 액션 */}
                      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        {followUpStatus?.action === "재고로 반영" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30 gap-1"
                            onClick={() => router.push(`/dashboard/inventory?purchase-receiving=${purchase.id}`)}
                          >
                            <PackageCheck className="h-3 w-3" />
                            재고 반영
                          </Button>
                        )}
                        {(followUpStatus?.action === "증빙 파일 등록" || followUpStatus?.action === "회계팀 전달") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 gap-1"
                            onClick={() => setExpandedRowId(expandedRowId === purchase.id ? null : purchase.id)}
                          >
                            <ClipboardList className="h-3 w-3" />
                            증빙 확인
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-slate-500 hover:text-slate-700 gap-1 ml-auto"
                          onClick={() => setExpandedRowId(expandedRowId === purchase.id ? null : purchase.id)}
                        >
                          <Eye className="h-3 w-3" />
                          상세 보기
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
              <CardContent className="flex flex-col items-center justify-center py-14">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">구매 내역이 없습니다</h3>
                <p className="text-xs text-slate-400 mb-5">내역을 등록하면 운영 인사이트를 확인할 수 있습니다.</p>
                <Button
                  onClick={() => setIsImportDialogOpen(true)}
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  내역 등록하기
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ══ 4-1. 증빙 체크리스트 패널 ══ */}
          {expandedRowId && (() => {
            const selectedPurchase = enhancedFilteredPurchases.find((p: any) => p.id === expandedRowId);
            if (!selectedPurchase) return null;
            const checks = evidenceChecklist[expandedRowId] || {};
            const completedCount = Object.values(checks).filter(Boolean).length;
            return (
              <Card className="rounded-xl border-amber-200/60 dark:border-amber-800/50 shadow-sm bg-amber-50/30 dark:bg-amber-950/10">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        증빙 체크리스트
                      </CardTitle>
                      <CardDescription className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                        {selectedPurchase.itemName} · {formatCurrency(selectedPurchase.amount)} · {completedCount}/{EVIDENCE_ITEMS.length} 완료
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400" onClick={() => setExpandedRowId(null)}>
                      닫기
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="space-y-2">
                    {EVIDENCE_ITEMS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="flex items-center gap-3 w-full p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30 bg-white dark:bg-slate-900 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors text-left"
                        onClick={() => {
                          setEvidenceChecklist((prev) => ({
                            ...prev,
                            [expandedRowId]: {
                              ...(prev[expandedRowId] || {}),
                              [item.key]: !(prev[expandedRowId]?.[item.key]),
                            },
                          }));
                        }}
                      >
                        <span
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            checks[item.key]
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {checks[item.key] && <CheckCircle2 className="h-3 w-3" />}
                        </span>
                        <span className={`text-sm ${checks[item.key] ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ══ 5. 구매 운영 후속 조치 ══ */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-900/30 p-4">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
              후속 조치 바로가기
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Link href="/dashboard/analytics">
                <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium transition-colors">
                  <BarChart2 className="h-3.5 w-3.5 text-slate-500" />
                  구매 리포트
                </Button>
              </Link>
              <Link href="/dashboard/budget">
                <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium transition-colors">
                  <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                  예산 관리
                </Button>
              </Link>
              <Link href="/dashboard/inventory">
                <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium transition-colors">
                  <Package className="h-3.5 w-3.5 text-slate-500" />
                  재고 현황
                </Button>
              </Link>
              <Link href="/dashboard/analytics">
                <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium transition-colors">
                  <Store className="h-3.5 w-3.5 text-slate-500" />
                  벤더 비교 분석
                </Button>
              </Link>
            </div>
          </div>

          {/* Import Sheet (내역 등록 패널) */}
          <Sheet open={isImportDialogOpen} onOpenChange={(open: boolean) => {
            setIsImportDialogOpen(open);
            if (!open) { setImportResult(null); setTsvParseErrors([]); }
          }}>
            <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  구매 내역 등록
                </SheetTitle>
                <SheetDescription>
                  건별 직접 입력, 엑셀 복사 붙여넣기, CSV 파일 업로드 중 선택하세요.
                </SheetDescription>
              </SheetHeader>
              <Tabs defaultValue="simple-form" className="w-full" onValueChange={() => { setImportResult(null); setTsvParseErrors([]); }}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="simple-form" className="gap-1.5 text-xs">
                    <Receipt className="h-3.5 w-3.5" />
                    간편 입력
                  </TabsTrigger>
                  <TabsTrigger value="tsv-paste" className="gap-1.5 text-xs">
                    <ClipboardList className="h-3.5 w-3.5" />
                    TSV 붙여넣기
                  </TabsTrigger>
                  <TabsTrigger value="csv-upload" className="gap-1.5 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    CSV 업로드
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Simple Form — 건별 직접 입력 */}
                <TabsContent value="simple-form" className="space-y-4 pt-2">
                  <p className="text-xs text-slate-500">1건씩 빠르게 등록합니다. <span className="text-red-500">*</span> 표시는 필수 항목입니다.</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="purchasedAt">구매일 <span className="text-red-500">*</span></Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !purchaseDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {purchaseDate ? (
                              format(purchaseDate, "yyyy년 M월 d일", { locale: ko })
                            ) : (
                              <span>날짜를 선택하세요</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={purchaseDate}
                            onSelect={setPurchaseDate}
                            autoFocus
                            locale={ko}
                            captionLayout="dropdown"
                            fromYear={2015}
                            toYear={2030}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vendorName">벤더 <span className="text-red-500">*</span></Label>
                      <Input
                        id="vendorName"
                        placeholder="Sigma-Aldrich"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">카테고리</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger id="category">
                          <SelectValue placeholder="선택..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">선택 안함</SelectItem>
                          <SelectItem value="REAGENT">시약</SelectItem>
                          <SelectItem value="EQUIPMENT">장비</SelectItem>
                          <SelectItem value="TOOL">도구</SelectItem>
                          <SelectItem value="RAW_MATERIAL">원자재</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="itemName">품목명 <span className="text-red-500">*</span></Label>
                      <Input
                        id="itemName"
                        placeholder="Acetone, ACS grade"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qty">수량 <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        id="qty"
                        placeholder="10"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unitPrice">단가</Label>
                      <Input
                        type="number"
                        id="unitPrice"
                        placeholder="50000"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">금액 <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        id="amount"
                        placeholder="500000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">통화</Label>
                      <div id="currency" className="flex h-10 w-full rounded-md border border-input bg-slate-50 px-3 py-2 text-sm text-slate-600 items-center">
                        ₩ 원화 (KRW)
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handlePurchaseSubmit}
                    disabled={createPurchaseMutation.isPending || !purchaseDate || !vendorName.trim() || !itemName.trim()}
                  >
                    {createPurchaseMutation.isPending ? (
                      <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />저장 중...</>
                    ) : (
                      <><Plus className="mr-2 h-4 w-4" />등록</>
                    )}
                  </Button>
                </TabsContent>

                {/* Tab 2: TSV Paste — 엑셀 복사 붙여넣기 */}
                <TabsContent value="tsv-paste" className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">엑셀에서 행을 선택해 복사(Ctrl+C)한 뒤 아래에 붙여넣기(Ctrl+V)하세요.</p>

                    {/* 예시 데이터 (TSV 실제 형식) */}
                    <div className="rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-600">예시 형식 (탭 또는 쉼표 구분)</span>
                        <Badge variant="outline" className="text-[10px] h-5">필수: 구매일, 벤더, 품목명, 수량</Badge>
                      </div>
                      <pre className="p-3 text-[11px] font-mono text-slate-600 overflow-x-auto leading-relaxed">
{`구매일\t벤더\t카테고리\t품목명\t수량\t단가\t통화
2026-01-15\tSigma-Aldrich\tREAGENT\tAcetone, ACS\t2\t15000\tKRW
2026-01-20\tThermo Fisher\tEQUIPMENT\tCentrifuge\t1\t2000000\tKRW`}
                      </pre>
                    </div>

                    <Textarea
                      placeholder={`구매일\t벤더\t카테고리\t품목명\t수량\t단가\t통화\n2026-03-01\tSigma-Aldrich\tREAGENT\tEthanol\t5\t12000\tKRW`}
                      value={csvText}
                      onChange={(e) => { setCsvText(e.target.value); setTsvParseErrors([]); setImportResult(null); }}
                      rows={8}
                      className="font-mono text-xs whitespace-pre min-h-[180px]"
                    />

                    {/* 행별 파싱 에러 테이블 */}
                    {tsvParseErrors.length > 0 && (
                      <div className="rounded-md border border-red-200 bg-red-50 overflow-hidden">
                        <div className="px-3 py-1.5 bg-red-100 border-b border-red-200 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                          <span className="text-xs font-medium text-red-700">{tsvParseErrors.length}건 파싱 에러</span>
                        </div>
                        <div className="max-h-[120px] overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-red-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-1 text-left font-medium text-red-600 w-16">행 번호</th>
                                <th className="px-3 py-1 text-left font-medium text-red-600">오류 내용</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tsvParseErrors.map((err, i) => (
                                <tr key={i} className="border-t border-red-100">
                                  <td className="px-3 py-1 text-red-700 font-mono">{err.row}</td>
                                  <td className="px-3 py-1 text-red-600">{err.message}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 가져오기 결과 요약 */}
                    {importResult && (
                      <div className={cn(
                        "rounded-md border p-3 flex items-center gap-3",
                        importResult.errors.length > 0
                          ? "border-amber-200 bg-amber-50"
                          : "border-green-200 bg-green-50"
                      )}>
                        {importResult.errors.length > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        )}
                        <div className="text-xs">
                          <span className="font-medium">
                            전체 {importResult.total}건 중 {importResult.success}건 성공
                          </span>
                          {importResult.errors.length > 0 && (
                            <span className="text-red-600 ml-1">/ {importResult.errors.length}건 실패</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={!csvText.trim() || importMutation.isPending}
                    className="w-full"
                  >
                    {importMutation.isPending ? (
                      <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />처리 중...</>
                    ) : (
                      <><FileText className="mr-2 h-4 w-4" />가져오기</>
                    )}
                  </Button>
                </TabsContent>

                {/* Tab 3: CSV Upload — 파일 업로드 */}
                <TabsContent value="csv-upload" className="pt-2">
                  <p className="text-xs text-slate-500 mb-3">
                    .csv 파일을 업로드하고 컬럼을 매핑합니다. 최대 5MB, UTF-8 인코딩 권장.
                  </p>
                  <CsvUploadTab
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
                      queryClient.invalidateQueries({ queryKey: ["purchases-list"] });
                      setIsImportDialogOpen(false);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
