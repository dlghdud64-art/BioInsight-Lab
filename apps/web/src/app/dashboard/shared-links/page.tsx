"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Trash2, Eye, Calendar, Link as LinkIcon, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";

export default function SharedLinksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["shared-links"],
    queryFn: async () => {
      const response = await fetch("/api/shared-links");
      if (!response.ok) throw new Error("Failed to fetch shared links");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const updateMutation = useMutation({
    mutationFn: async ({ publicId, data }: { publicId: string; data: any }) => {
      const response = await fetch(`/api/shared-lists/${publicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update link");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links"] });
      setEditingLink(null);
      setNewExpiresAt("");
      toast({
        title: "업데이트 완료",
        description: "공유 링크가 업데이트되었습니다.",
      });
    },
  });

  const handleCopyLink = async (publicId: string) => {
    const shareUrl = `${window.location.origin}/shared-list/${publicId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "링크 복사 완료",
        description: "공유 링크가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "링크 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = (publicId: string, currentStatus: boolean) => {
    updateMutation.mutate({
      publicId,
      data: { isActive: !currentStatus },
    });
  };

  const handleBulkToggleActive = (isActive: boolean) => {
    selectedLinks.forEach((publicId) => {
      updateMutation.mutate({
        publicId,
        data: { isActive },
      });
    });
    setSelectedLinks([]);
  };

  const handleBulkDelete = async () => {
    if (selectedLinks.length === 0) return;
    if (!confirm(`선택한 ${selectedLinks.length}개의 링크를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch("/api/shared-lists/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicIds: selectedLinks }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete shared lists");
      }

      const result = await response.json();
      toast({
        title: "삭제 완료",
        description: `${result.deleted}개의 링크가 삭제되었습니다.`,
      });

      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["shared-links"] });
    } catch (error: any) {
      toast({
        title: "삭제 실패",
        description: error.message || "링크 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectLink = (publicId: string) => {
    setSelectedLinks((prev) =>
      prev.includes(publicId)
        ? prev.filter((id) => id !== publicId)
        : [...prev, publicId]
    );
  };

  const selectAllLinks = () => {
    setSelectedLinks(sharedLinks.map((link: any) => link.publicId));
  };

  const clearSelection = () => {
    setSelectedLinks([]);
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard/shared-links");
  //   return null;
  // }

  const sharedLinks = data?.sharedLinks || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-7xl mx-auto">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-3xl font-bold">공유 링크 관리</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            생성한 공유 링크를 관리하고 비활성화할 수 있습니다.
          </p>
        </div>

        {isLoading ? (
          <Card className="p-3 md:p-6">
            <CardContent className="px-0 pt-0 pb-0 py-8 md:py-12 text-center">
              <p className="text-xs md:text-sm text-muted-foreground">로딩 중...</p>
            </CardContent>
          </Card>
        ) : sharedLinks.length === 0 ? (
          <Card className="p-3 md:p-6">
            <CardContent className="px-0 pt-0 pb-0 py-8 md:py-12 text-center">
              <LinkIcon className="h-8 w-8 md:h-12 md:w-12 mx-auto text-muted-foreground mb-3 md:mb-4" />
              <p className="text-xs md:text-sm text-muted-foreground">생성된 공유 링크가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-3 md:p-6">
            <CardHeader className="px-0 pt-0 pb-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
                <div>
                  <CardTitle className="text-sm md:text-lg">공유 링크 목록</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    총 {sharedLinks.length}개의 공유 링크
                  </CardDescription>
                </div>
                {selectedLinks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-2 w-full md:w-auto">
                    <span className="text-xs md:text-sm text-muted-foreground">
                      선택된 {selectedLinks.length}개
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkToggleActive(true)}
                      className="text-xs md:text-sm h-7 md:h-9"
                    >
                      활성화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkToggleActive(false)}
                      className="text-xs md:text-sm h-7 md:h-9"
                    >
                      비활성화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelection}
                      className="text-xs md:text-sm h-7 md:h-9"
                    >
                      선택 해제
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 md:w-12">
                        <Checkbox
                          checked={selectedLinks.length === sharedLinks.length && sharedLinks.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllLinks();
                            } else {
                              clearSelection();
                            }
                          }}
                          className="h-3.5 w-3.5 md:h-4 md:w-4"
                        />
                      </TableHead>
                      <TableHead className="text-xs md:text-sm">제목</TableHead>
                      <TableHead className="text-xs md:text-sm hidden md:table-cell">생성일</TableHead>
                      <TableHead className="text-xs md:text-sm hidden lg:table-cell">만료일</TableHead>
                      <TableHead className="text-xs md:text-sm hidden lg:table-cell">조회 수</TableHead>
                      <TableHead className="text-xs md:text-sm">상태</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedLinks.map((link: any) => {
                      const shareUrl = `${window.location.origin}/shared-list/${link.publicId}`;
                      const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                      const isActive = link.isActive && !isExpired;

                      const isSelected = selectedLinks.includes(link.publicId);

                      return (
                        <TableRow key={link.id} className={isSelected ? "bg-slate-50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectLink(link.publicId)}
                              className="h-3.5 w-3.5 md:h-4 md:w-4"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-xs md:text-sm min-w-[120px]">
                            <div className="truncate">{link.title}</div>
                            <div className="md:hidden text-[10px] text-muted-foreground mt-0.5">
                              {new Date(link.createdAt).toLocaleDateString("ko-KR")}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs md:text-sm hidden md:table-cell">
                            {new Date(link.createdAt).toLocaleDateString("ko-KR")}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm hidden lg:table-cell">
                            {link.expiresAt ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className={isExpired ? "text-red-600 font-medium" : ""}>
                                  {new Date(link.expiresAt).toLocaleDateString("ko-KR")}
                                </span>
                                {isExpired && (
                                  <Badge variant="destructive" className="ml-1 text-[9px] md:text-[10px]">
                                    만료
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">만료 없음</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm hidden lg:table-cell">
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                              {link.viewCount || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive" className="text-[10px] md:text-xs">만료됨</Badge>
                            ) : !link.isActive ? (
                              <Badge variant="secondary" className="text-[10px] md:text-xs">비활성화</Badge>
                            ) : (
                              <Badge variant="default" className="text-[10px] md:text-xs">활성</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 md:gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyLink(link.publicId)}
                                className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3"
                              >
                                <Copy className="h-3 w-3 mr-0 md:mr-1" />
                                <span className="hidden sm:inline">복사</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(shareUrl, "_blank")}
                                className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3"
                              >
                                <ExternalLink className="h-3 w-3 mr-0 md:mr-1" />
                                <span className="hidden sm:inline">보기</span>
                              </Button>
                              <div className="flex items-center gap-1 md:gap-2">
                                <input
                                  type="checkbox"
                                  id={`toggle-${link.id}`}
                                  checked={link.isActive}
                                  onChange={() => handleToggleActive(link.publicId, link.isActive)}
                                  disabled={updateMutation.isPending}
                                  className="h-3.5 w-3.5 md:h-4 md:w-4"
                                />
                                <Label htmlFor={`toggle-${link.id}`} className="text-[10px] md:text-xs cursor-pointer">
                                  활성
                                </Label>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}