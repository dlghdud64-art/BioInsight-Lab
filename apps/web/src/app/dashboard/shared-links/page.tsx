"use client";

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
    const shareUrl = `${window.location.origin}/share/${publicId}`;
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

    // 일괄 삭제는 API에 추가 필요, 일단 개별 삭제로 처리
    // TODO: 일괄 삭제 API 추가
    toast({
      title: "일괄 삭제",
      description: "일괄 삭제 기능은 준비 중입니다.",
    });
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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard/shared-links");
    return null;
  }

  const sharedLinks = data?.sharedLinks || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">공유 링크 관리</h1>
          <p className="text-muted-foreground mt-1">
            생성한 공유 링크를 관리하고 비활성화할 수 있습니다.
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">로딩 중...</p>
            </CardContent>
          </Card>
        ) : sharedLinks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">생성된 공유 링크가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>공유 링크 목록</CardTitle>
                  <CardDescription>
                    총 {sharedLinks.length}개의 공유 링크
                  </CardDescription>
                </div>
                {selectedLinks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      선택된 {selectedLinks.length}개
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkToggleActive(true)}
                    >
                      활성화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkToggleActive(false)}
                    >
                      비활성화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelection}
                    >
                      선택 해제
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedLinks.length === sharedLinks.length && sharedLinks.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllLinks();
                            } else {
                              clearSelection();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>생성일</TableHead>
                      <TableHead>만료일</TableHead>
                      <TableHead>조회 수</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedLinks.map((link: any) => {
                      const shareUrl = `${window.location.origin}/share/${link.publicId}`;
                      const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                      const isActive = link.isActive && !isExpired;

                      const isSelected = selectedLinks.includes(link.publicId);

                      return (
                        <TableRow key={link.id} className={isSelected ? "bg-slate-50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectLink(link.publicId)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{link.title}</TableCell>
                          <TableCell>
                            {new Date(link.createdAt).toLocaleDateString("ko-KR")}
                          </TableCell>
                          <TableCell>
                            {link.expiresAt ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className={isExpired ? "text-red-600 font-medium" : ""}>
                                  {new Date(link.expiresAt).toLocaleDateString("ko-KR")}
                                </span>
                                {isExpired && (
                                  <Badge variant="destructive" className="ml-2 text-[10px]">
                                    만료됨
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">만료 없음</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                              {link.viewCount || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive">만료됨</Badge>
                            ) : !link.isActive ? (
                              <Badge variant="secondary">비활성화</Badge>
                            ) : (
                              <Badge variant="default">활성</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyLink(link.publicId)}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                복사
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(shareUrl, "_blank")}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                보기
                              </Button>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`toggle-${link.id}`}
                                  checked={link.isActive}
                                  onChange={() => handleToggleActive(link.publicId, link.isActive)}
                                  disabled={updateMutation.isPending}
                                  className="h-4 w-4"
                                />
                                <Label htmlFor={`toggle-${link.id}`} className="text-xs cursor-pointer">
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
  );
}


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
    const shareUrl = `${window.location.origin}/share/${publicId}`;
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

    // 일괄 삭제는 API에 추가 필요, 일단 개별 삭제로 처리
    // TODO: 일괄 삭제 API 추가
    toast({
      title: "일괄 삭제",
      description: "일괄 삭제 기능은 준비 중입니다.",
    });
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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard/shared-links");
    return null;
  }

  const sharedLinks = data?.sharedLinks || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">공유 링크 관리</h1>
          <p className="text-muted-foreground mt-1">
            생성한 공유 링크를 관리하고 비활성화할 수 있습니다.
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">로딩 중...</p>
            </CardContent>
          </Card>
        ) : sharedLinks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">생성된 공유 링크가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>공유 링크 목록</CardTitle>
                  <CardDescription>
                    총 {sharedLinks.length}개의 공유 링크
                  </CardDescription>
                </div>
                {selectedLinks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      선택된 {selectedLinks.length}개
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkToggleActive(true)}
                    >
                      활성화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkToggleActive(false)}
                    >
                      비활성화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelection}
                    >
                      선택 해제
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedLinks.length === sharedLinks.length && sharedLinks.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllLinks();
                            } else {
                              clearSelection();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>생성일</TableHead>
                      <TableHead>만료일</TableHead>
                      <TableHead>조회 수</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedLinks.map((link: any) => {
                      const shareUrl = `${window.location.origin}/share/${link.publicId}`;
                      const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                      const isActive = link.isActive && !isExpired;

                      const isSelected = selectedLinks.includes(link.publicId);

                      return (
                        <TableRow key={link.id} className={isSelected ? "bg-slate-50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectLink(link.publicId)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{link.title}</TableCell>
                          <TableCell>
                            {new Date(link.createdAt).toLocaleDateString("ko-KR")}
                          </TableCell>
                          <TableCell>
                            {link.expiresAt ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className={isExpired ? "text-red-600 font-medium" : ""}>
                                  {new Date(link.expiresAt).toLocaleDateString("ko-KR")}
                                </span>
                                {isExpired && (
                                  <Badge variant="destructive" className="ml-2 text-[10px]">
                                    만료됨
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">만료 없음</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                              {link.viewCount || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive">만료됨</Badge>
                            ) : !link.isActive ? (
                              <Badge variant="secondary">비활성화</Badge>
                            ) : (
                              <Badge variant="default">활성</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyLink(link.publicId)}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                복사
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(shareUrl, "_blank")}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                보기
                              </Button>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`toggle-${link.id}`}
                                  checked={link.isActive}
                                  onChange={() => handleToggleActive(link.publicId, link.isActive)}
                                  disabled={updateMutation.isPending}
                                  className="h-4 w-4"
                                />
                                <Label htmlFor={`toggle-${link.id}`} className="text-xs cursor-pointer">
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
  );
}


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
    const shareUrl = `${window.location.origin}/share/${publicId}`;
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

    // 일괄 삭제는 API에 추가 필요, 일단 개별 삭제로 처리
    // TODO: 일괄 삭제 API 추가
    toast({
      title: "일괄 삭제",
      description: "일괄 삭제 기능은 준비 중입니다.",
    });
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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard/shared-links");
    return null;
  }

  const sharedLinks = data?.sharedLinks || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">공유 링크 관리</h1>
          <p className="text-muted-foreground mt-1">
            생성한 공유 링크를 관리하고 비활성화할 수 있습니다.
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">로딩 중...</p>
            </CardContent>
          </Card>
        ) : sharedLinks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">생성된 공유 링크가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>공유 링크 목록</CardTitle>
                  <CardDescription>
                    총 {sharedLinks.length}개의 공유 링크
                  </CardDescription>
                </div>
                {selectedLinks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      선택된 {selectedLinks.length}개
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkToggleActive(true)}
                    >
                      활성화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkToggleActive(false)}
                    >
                      비활성화
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelection}
                    >
                      선택 해제
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedLinks.length === sharedLinks.length && sharedLinks.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllLinks();
                            } else {
                              clearSelection();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>생성일</TableHead>
                      <TableHead>만료일</TableHead>
                      <TableHead>조회 수</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedLinks.map((link: any) => {
                      const shareUrl = `${window.location.origin}/share/${link.publicId}`;
                      const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                      const isActive = link.isActive && !isExpired;

                      const isSelected = selectedLinks.includes(link.publicId);

                      return (
                        <TableRow key={link.id} className={isSelected ? "bg-slate-50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectLink(link.publicId)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{link.title}</TableCell>
                          <TableCell>
                            {new Date(link.createdAt).toLocaleDateString("ko-KR")}
                          </TableCell>
                          <TableCell>
                            {link.expiresAt ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className={isExpired ? "text-red-600 font-medium" : ""}>
                                  {new Date(link.expiresAt).toLocaleDateString("ko-KR")}
                                </span>
                                {isExpired && (
                                  <Badge variant="destructive" className="ml-2 text-[10px]">
                                    만료됨
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">만료 없음</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                              {link.viewCount || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive">만료됨</Badge>
                            ) : !link.isActive ? (
                              <Badge variant="secondary">비활성화</Badge>
                            ) : (
                              <Badge variant="default">활성</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyLink(link.publicId)}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                복사
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(shareUrl, "_blank")}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                보기
                              </Button>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`toggle-${link.id}`}
                                  checked={link.isActive}
                                  onChange={() => handleToggleActive(link.publicId, link.isActive)}
                                  disabled={updateMutation.isPending}
                                  className="h-4 w-4"
                                />
                                <Label htmlFor={`toggle-${link.id}`} className="text-xs cursor-pointer">
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
  );
}

