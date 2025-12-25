"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OrganizationRole } from "@prisma/client";
import {
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  ExternalLink,
  Shield,
  Loader2,
  X,
} from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { getRuleDescription, type ComplianceLinkRules } from "@/lib/compliance-links";
import { useSearchParams } from "next/navigation";

export default function ComplianceLinksPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    searchParams.get("org") || ""
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ComplianceLink | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; linkId?: string }>({
    open: false,
  });

  // 폼 상태
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    description: "",
    priority: 0,
    enabled: true,
    linkType: "official" as "official" | "organization",
    tags: [] as string[],
    rules: {
      hazardCodesAny: [] as string[],
      pictogramsAny: [] as string[],
      categoryIn: [] as string[],
      missingSds: undefined as boolean | undefined,
    } as ComplianceLinkRules,
  });

  // 조직 목록 조회
  const { data: organizationsData } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) return { organizations: [] };
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const organizations = organizationsData?.organizations || [];
  const currentOrg = organizations.find(
    (org: any) => org.id === selectedOrgId || (!selectedOrgId && org.id)
  ) || organizations[0];

  // 현재 사용자의 역할 확인
  const currentMembership = currentOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id
  );
  const isAdmin =
    session?.user?.role === "ADMIN" ||
    currentMembership?.role === OrganizationRole.ADMIN ||
    currentMembership?.role === OrganizationRole.VIEWER;

  // Compliance Links 조회 (관리자용 - 모든 링크 포함)
  const { data: linksData, isLoading } = useQuery({
    queryKey: ["compliance-links-admin", currentOrg?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("includeDisabled", "true"); // 비활성화된 링크도 포함
      if (currentOrg?.id) {
        params.append("organizationId", currentOrg.id);
      }
      const response = await fetch(`/api/compliance-links?${params}`);
      if (!response.ok) throw new Error("Failed to fetch compliance links");
      return response.json();
    },
    enabled: !!currentOrg?.id && status === "authenticated",
  });

  const links = (linksData?.links || []) as ComplianceLink[];

  // 링크 생성/수정
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = editingLink
        ? `/api/compliance-links/${editingLink.id}`
        : "/api/compliance-links";
      const method = editingLink ? "PATCH" : "POST";

      const payload = {
        ...data,
        organizationId: data.linkType === "organization" ? currentOrg?.id : null,
        rules: Object.keys(data.rules).length > 0 ? data.rules : null,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save link");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-links-admin", currentOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ["compliance-links"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingLink ? "링크 수정 완료" : "링크 추가 완료",
        description: "규제/절차 링크가 저장되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 링크 삭제
  const deleteMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const response = await fetch(`/api/compliance-links/${linkId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete link");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-links-admin", currentOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ["compliance-links"] });
      setDeleteConfirm({ open: false });
      toast({
        title: "링크 삭제 완료",
        description: "규제/절차 링크가 삭제되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      url: "",
      description: "",
      priority: 0,
      enabled: true,
      linkType: "official",
      tags: [],
      rules: {
        hazardCodesAny: [],
        pictogramsAny: [],
        categoryIn: [],
        missingSds: undefined,
      },
    });
    setEditingLink(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (link: ComplianceLink) => {
    setEditingLink(link);
    setFormData({
      title: link.title,
      url: link.url,
      description: link.description || "",
      priority: link.priority,
      enabled: link.enabled,
      linkType: link.linkType,
      tags: (link.tags as string[]) || [],
      rules: (link.rules as ComplianceLinkRules) || {
        hazardCodesAny: [],
        pictogramsAny: [],
        categoryIn: [],
        missingSds: undefined,
      },
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (linkId: string) => {
    setDeleteConfirm({ open: true, linkId });
  };

  const confirmDelete = () => {
    if (deleteConfirm.linkId) {
      deleteMutation.mutate(deleteConfirm.linkId);
    }
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.url.trim()) {
      toast({
        title: "입력 오류",
        description: "제목과 URL은 필수입니다.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(formData);
  };

  // Rules 빌더 헬퍼
  const updateRule = (key: keyof ComplianceLinkRules, value: any) => {
    setFormData({
      ...formData,
      rules: {
        ...formData.rules,
        [key]: value,
      },
    });
  };

  const addHazardCode = () => {
    const input = document.getElementById("hazard-code-input") as HTMLInputElement;
    if (input && input.value.trim()) {
      const code = input.value.trim().toUpperCase();
      if (!formData.rules.hazardCodesAny?.includes(code)) {
        updateRule("hazardCodesAny", [...(formData.rules.hazardCodesAny || []), code]);
      }
      input.value = "";
    }
  };

  const removeHazardCode = (code: string) => {
    updateRule(
      "hazardCodesAny",
      formData.rules.hazardCodesAny?.filter((c) => c !== code) || []
    );
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
              <div className="text-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-900">
                        관리자 권한이 필요합니다
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        규제/절차 링크 관리는 admin 또는 safety_admin 역할만 가능합니다.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <PageHeader
                  title="규제/절차 링크 관리"
                  description="제품 상세 페이지에 표시될 규제 및 절차 링크를 관리합니다."
                  icon={Shield}
                  iconColor="text-blue-600"
                />
                <Button onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  링크 추가
                </Button>
              </div>

              {/* 워크스페이스 선택 */}
              {organizations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">워크스페이스 선택</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WorkspaceSwitcher
                      currentOrganizationId={selectedOrgId}
                      onOrganizationChange={setSelectedOrgId}
                      showActions={false}
                    />
                  </CardContent>
                </Card>
              )}

              {/* 링크 목록 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">링크 목록</CardTitle>
                  <CardDescription className="text-xs">
                    총 {links.length}개의 링크가 있습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : links.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>등록된 링크가 없습니다.</p>
                      <Button onClick={handleAdd} className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        첫 번째 링크 추가하기
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>제목</TableHead>
                          <TableHead>타입</TableHead>
                          <TableHead>활성화</TableHead>
                          <TableHead>우선순위</TableHead>
                          <TableHead>규칙 요약</TableHead>
                          <TableHead className="text-right">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {links.map((link) => (
                          <TableRow key={link.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{link.title}</span>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              {link.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {link.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  link.linkType === "official" ? "default" : "secondary"
                                }
                              >
                                {link.linkType === "official" ? "공식 링크" : "조직 절차"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={link.enabled ? "default" : "secondary"}>
                                {link.enabled ? "활성" : "비활성"}
                              </Badge>
                            </TableCell>
                            <TableCell>{link.priority}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {link.rules ? getRuleDescription(link.rules) : "모든 제품"}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(link)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    수정
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(link.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    삭제
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* 링크 추가/수정 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLink ? "링크 수정" : "링크 추가"}</DialogTitle>
            <DialogDescription>
              규제/절차 링크를 추가하거나 수정합니다. 규칙을 설정하면 특정 조건의 제품에만 표시됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">제목 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="예: 위험물 취급 절차"
                />
              </div>

              <div>
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com/procedure"
                />
              </div>

              <div>
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="링크에 대한 간단한 설명"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="linkType">링크 타입</Label>
                  <Select
                    value={formData.linkType}
                    onValueChange={(value: "official" | "organization") =>
                      setFormData({ ...formData, linkType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="official">공식 링크</SelectItem>
                      <SelectItem value="organization">우리 조직 절차</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">우선순위</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label>활성화</Label>
              </div>
            </div>

            {/* Rules 빌더 */}
            <div className="space-y-4 pt-4 border-t">
              <div className="text-sm font-semibold">표시 규칙 (간단 모드)</div>
              <p className="text-xs text-muted-foreground">
                규칙을 설정하면 해당 조건을 만족하는 제품에만 링크가 표시됩니다.
              </p>

              {/* Hazard Codes */}
              <div>
                <Label>위험 코드 (Hazard Codes)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="hazard-code-input"
                    placeholder="예: H300, H314"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addHazardCode();
                      }
                    }}
                  />
                  <Button type="button" onClick={addHazardCode} variant="outline">
                    추가
                  </Button>
                </div>
                {formData.rules.hazardCodesAny && formData.rules.hazardCodesAny.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.rules.hazardCodesAny.map((code) => (
                      <Badge key={code} variant="secondary" className="gap-1">
                        {code}
                        <button
                          onClick={() => removeHazardCode(code)}
                          className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Pictograms */}
              <div>
                <Label>피크토그램 (Pictograms)</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (
                      value &&
                      !formData.rules.pictogramsAny?.includes(value)
                    ) {
                      updateRule("pictogramsAny", [
                        ...(formData.rules.pictogramsAny || []),
                        value,
                      ]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="피크토그램 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrosive">corrosive</SelectItem>
                    <SelectItem value="skull">skull</SelectItem>
                    <SelectItem value="exclamation">exclamation</SelectItem>
                    <SelectItem value="flame">flame</SelectItem>
                    <SelectItem value="environment">environment</SelectItem>
                  </SelectContent>
                </Select>
                {formData.rules.pictogramsAny && formData.rules.pictogramsAny.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.rules.pictogramsAny.map((pictogram) => (
                      <Badge key={pictogram} variant="secondary" className="gap-1">
                        {pictogram}
                        <button
                          onClick={() =>
                            updateRule(
                              "pictogramsAny",
                              formData.rules.pictogramsAny?.filter((p) => p !== pictogram) || []
                            )
                          }
                          className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <Label>카테고리</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !formData.rules.categoryIn?.includes(value)) {
                      updateRule("categoryIn", [
                        ...(formData.rules.categoryIn || []),
                        value,
                      ]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.rules.categoryIn && formData.rules.categoryIn.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.rules.categoryIn.map((category) => (
                      <Badge key={category} variant="secondary" className="gap-1">
                        {PRODUCT_CATEGORIES[category as keyof typeof PRODUCT_CATEGORIES] || category}
                        <button
                          onClick={() =>
                            updateRule(
                              "categoryIn",
                              formData.rules.categoryIn?.filter((c) => c !== category) || []
                            )
                          }
                          className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing SDS */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.rules.missingSds === true}
                  onCheckedChange={(checked) =>
                    updateRule("missingSds", checked ? true : undefined)
                  }
                />
                <Label>SDS 없는 제품만 표시</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                "저장"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, linkId: deleteConfirm.linkId })}
        title="링크 삭제 확인"
        description="정말로 이 링크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

