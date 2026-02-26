"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Building2, Plus, Users, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function OrganizationsPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // 가상 저장 로직 (1초 딜레이 후 성공 처리)
  const handleCreateOrg = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "입력 필요",
        description: "조직 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // API 통신을 흉내 내는 1초 딜레이
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newOrg = {
      id: Date.now(),
      name: formData.name.trim(),
      description: formData.description.trim() || "새로 생성된 연구 조직입니다.",
      memberCount: 1,
      role: "최고 관리자",
      createdAt: new Date().toLocaleDateString("ko-KR"),
    };

    setOrganizations([newOrg, ...organizations]);
    toast({
      title: "조직 생성 완료",
      description: "새로운 조직이 성공적으로 생성되었습니다.",
    });

    setIsOpen(false);
    setIsLoading(false);
    setFormData({ name: "", description: "" });
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-6xl mx-auto w-full">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Building2 className="h-5 w-5" />
            <span className="font-semibold tracking-tight">조직 관리</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">조직 관리</h2>
          <p className="text-muted-foreground">
            조직을 생성하고 팀원들을 초대하여 함께 견적을 관리합니다.
          </p>
        </div>

        {organizations.length > 0 && (
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" /> 새 조직 만들기
          </Button>
        )}
      </div>

      {/* 조직 생성 모달 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>새 조직 만들기</DialogTitle>
            <DialogDescription>
              연구실이나 팀의 이름을 입력하여 새로운 워크스페이스를 만듭니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">
                조직 이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="org-name"
                placeholder="예: 생명공학연구소 1팀"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-desc">간단한 설명 (선택)</Label>
              <Input
                id="org-desc"
                placeholder="예: 단백질 구조 분석 프로젝트 팀"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              onClick={handleCreateOrg}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 생성 중...
                </>
              ) : (
                "조직 생성"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 메인 화면 (Empty State vs Card Grid) */}
      {organizations.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-24 shadow-sm border-slate-200 dark:border-slate-800">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-4 text-lg font-medium text-slate-600 dark:text-slate-400">
            소속된 조직이 없습니다
          </h3>
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" /> 새 조직 만들기
          </Button>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Card
              key={org.id}
              className="cursor-pointer border-slate-200 shadow-sm transition-shadow hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:hover:border-blue-800"
            >
              <CardHeader className="pb-3">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 font-bold text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                    {org.name.substring(0, 1)}
                  </div>
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {org.role}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{org.name}</CardTitle>
                <CardDescription className="line-clamp-1">
                  {org.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center rounded-md bg-slate-50 p-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Users className="mr-2 h-4 w-4 text-slate-400" />
                  팀원 {org.memberCount}명
                </div>
              </CardContent>
              <CardFooter className="mt-4 border-t border-slate-100 pt-0 dark:border-slate-800">
                <Button
                  variant="ghost"
                  className="mt-2 w-full text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
                >
                  관리 페이지로 이동 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
