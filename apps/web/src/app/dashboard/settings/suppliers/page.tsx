"use client";

/**
 * #user-supplier-registration Phase 4 — Settings 공급사 관리 surface.
 *
 * /dashboard/settings/suppliers — 조직 단위 거래처 (OrganizationVendor)
 * 등록 / 편집 / 삭제 + table view.
 *
 * canonical truth lock:
 *   - useQuery: GET /api/organization-vendors (current organization scope).
 *   - useMutation: POST / PATCH / DELETE (csrfFetch + invalidate).
 *   - Dialog single form (mode: "create" | "edit").
 *   - Empty state — 첫 거래처 등록 유도.
 *   - 한국어 라벨 + a11y.
 *   - dead-button 0 (mutation 실패 시 toast).
 */

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Loader2,
  Star,
  Users,
} from "lucide-react";

// ── Types ──
interface OrganizationVendor {
  id: string;
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string | null;
  notes: string | null;
  isPrimary: boolean;
  vendorId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string | null };
  vendor?: { id: string; name: string; country: string | null } | null;
}

interface VendorFormData {
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string;
  notes: string;
  isPrimary: boolean;
}

const EMPTY_FORM: VendorFormData = {
  vendorName: "",
  vendorEmail: "",
  vendorPhone: "",
  notes: "",
  isPrimary: false,
};

// ── Page ──
export default function SuppliersSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VendorFormData>(EMPTY_FORM);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ── Query ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["organization-vendors"],
    queryFn: async () => {
      const res = await fetch("/api/organization-vendors", { credentials: "include" });
      if (!res.ok) throw new Error("거래처 목록을 불러오지 못했습니다");
      return (await res.json()) as { vendors: OrganizationVendor[] };
    },
  });
  const vendors = useMemo(() => data?.vendors ?? [], [data]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (input: VendorFormData) => {
      const res = await csrfFetch("/api/organization-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: input.vendorName,
          vendorEmail: input.vendorEmail,
          vendorPhone: input.vendorPhone || null,
          notes: input.notes || null,
          isPrimary: input.isPrimary,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "거래처 등록에 실패했습니다");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "거래처 등록 완료", description: "공급사 목록에 추가되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["organization-vendors"] });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "등록 실패", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: VendorFormData }) => {
      const res = await csrfFetch(`/api/organization-vendors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: input.vendorName,
          vendorEmail: input.vendorEmail,
          vendorPhone: input.vendorPhone || null,
          notes: input.notes || null,
          isPrimary: input.isPrimary,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "거래처 수정에 실패했습니다");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "거래처 수정 완료", description: "변경사항이 저장되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["organization-vendors"] });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "수정 실패", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await csrfFetch(`/api/organization-vendors/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "거래처 삭제에 실패했습니다");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "거래처 삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["organization-vendors"] });
      setDeleteTargetId(null);
    },
    onError: (err: Error) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    },
  });

  // ── Handlers ──
  function openCreateDialog() {
    setDialogMode("create");
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(vendor: OrganizationVendor) {
    setDialogMode("edit");
    setEditingId(vendor.id);
    setFormData({
      vendorName: vendor.vendorName,
      vendorEmail: vendor.vendorEmail,
      vendorPhone: vendor.vendorPhone ?? "",
      notes: vendor.notes ?? "",
      isPrimary: vendor.isPrimary,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!formData.vendorName.trim() || !formData.vendorEmail.trim()) {
      toast({
        title: "입력 확인",
        description: "공급사 이름과 이메일은 필수 입력입니다.",
        variant: "destructive",
      });
      return;
    }
    if (dialogMode === "create") {
      createMutation.mutate(formData);
    } else if (editingId) {
      updateMutation.mutate({ id: editingId, input: formData });
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ── Render ──
  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
            공급사 관리
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            우리 조직의 거래처를 등록하면 견적 요청 시 자동으로 노출됩니다.
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          공급사 추가
        </Button>
      </div>

      {/* Loading / Error / Empty / List */}
      {isLoading && (
        <div className="rounded-xl border border-bd/80 bg-pn p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 text-center">
          <p className="text-sm text-red-700">거래처 목록을 불러오지 못했습니다</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["organization-vendors"] })}
            className="mt-3 h-8 text-xs"
          >
            다시 시도
          </Button>
        </div>
      )}

      {!isLoading && !isError && vendors.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-bd/80 bg-pn p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            등록된 공급사가 아직 없습니다
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            첫 거래처를 추가하면 견적 요청 시 자동으로 노출되어 발송 단계에서
            바로 선택할 수 있습니다.
          </p>
          <Button
            onClick={openCreateDialog}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            첫 공급사 추가
          </Button>
        </div>
      )}

      {!isLoading && !isError && vendors.length > 0 && (
        <div className="rounded-xl border border-bd/80 bg-pn overflow-hidden">
          <ul className="divide-y divide-bd/60">
            {vendors.map((vendor) => (
              <li key={vendor.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {vendor.vendorName}
                    </h3>
                    {vendor.isPrimary && (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1">
                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                        우선 거래처
                      </Badge>
                    )}
                    {vendor.vendor && (
                      <Badge variant="outline" className="text-[10px] text-slate-600">
                        {vendor.vendor.name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {vendor.vendorEmail}
                    </span>
                    {vendor.vendorPhone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {vendor.vendorPhone}
                      </span>
                    )}
                  </div>
                  {vendor.notes && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                      {vendor.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(vendor)}
                    className="h-8 text-xs"
                    aria-label={`${vendor.vendorName} 편집`}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    편집
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteTargetId(vendor.id)}
                    className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    aria-label={`${vendor.vendorName} 삭제`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "공급사 추가" : "공급사 편집"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              조직의 거래처 정보를 입력하세요. 견적 요청 시 자동으로 노출됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="vendorName" className="text-xs font-semibold text-slate-700">
                공급사 이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="vendorName"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="예: 바이오마트"
                disabled={isMutating}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendorEmail" className="text-xs font-semibold text-slate-700">
                이메일 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="vendorEmail"
                type="email"
                value={formData.vendorEmail}
                onChange={(e) => setFormData({ ...formData, vendorEmail: e.target.value })}
                placeholder="contact@biomart.co.kr"
                disabled={isMutating}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendorPhone" className="text-xs font-semibold text-slate-700">
                전화번호 <span className="text-slate-400 text-[10px] ml-1">(선택)</span>
              </Label>
              <Input
                id="vendorPhone"
                value={formData.vendorPhone}
                onChange={(e) => setFormData({ ...formData, vendorPhone: e.target.value })}
                placeholder="02-1234-5678"
                disabled={isMutating}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">
                메모 <span className="text-slate-400 text-[10px] ml-1">(선택)</span>
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="예: 신규 거래, 단가 협상 중"
                rows={2}
                disabled={isMutating}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-bd/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <Label htmlFor="isPrimary" className="text-xs font-medium text-slate-700 cursor-pointer">
                  우선 거래처로 표시
                </Label>
              </div>
              <Switch
                id="isPrimary"
                checked={formData.isPrimary}
                onCheckedChange={(checked) => setFormData({ ...formData, isPrimary: checked })}
                disabled={isMutating}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isMutating}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isMutating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isMutating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {dialogMode === "create" ? "등록" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>공급사 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 거래처를 삭제하시겠습니까? 견적 요청 시 더 이상 노출되지 않습니다.
              이미 발송된 견적 이력에는 영향이 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
