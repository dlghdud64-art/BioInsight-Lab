"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Upload,
  Lock,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";


// Fallback component for Suspense
function SettingsPageFallback() {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPageContent() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 프로필 상태
  const [profileName, setProfileName] = useState(session?.user?.name || "");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  // 사용자 정보 조회
  const { data: userData } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await fetch("/api/user/profile");
      if (!response.ok) throw new Error("Failed to fetch user profile");
      return response.json();
    },
    enabled: !!session,
  });

  // 프로필 업데이트
  const profileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; password?: string; currentPassword?: string }) => {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "프로필 업데이트 완료",
        description: "프로필 정보가 성공적으로 업데이트되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "업데이트 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (profileName !== session?.user?.name) updates.name = profileName;
    if (profileEmail !== session?.user?.email) updates.email = profileEmail;
    if (Object.keys(updates).length > 0) {
      profileMutation.mutate(updates);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword === confirmPassword && currentPassword) {
      profileMutation.mutate({
        password: newPassword,
        currentPassword: currentPassword,
      });
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="w-full px-4 md:px-6 py-6 pt-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h3 className="text-lg font-medium text-slate-900">설정</h3>
          <p className="text-sm text-muted-foreground mt-1">
            내 계정 정보를 관리하세요.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>내 정보</CardTitle>
            <CardDescription>프로필 사진과 이름을 수정할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Section A: 기본 정보 */}
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="avatar">프로필 이미지</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center">
                    {session?.user?.image ? (
                      <img
                        src={session.user.image}
                        alt="Profile"
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-10 w-10 text-slate-400" />
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    이미지 업로드
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="이름을 입력하세요"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  disabled
                  className="bg-slate-50"
                />
              </div>
              <Button
                type="submit"
                disabled={profileMutation.isPending}
                className="w-full"
              >
                {profileMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </form>

            <Separator className="my-6" />

            {/* Section B: 보안 (Security) */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-900">로그인 및 보안</h4>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">비밀번호</p>
                  <p className="text-sm text-muted-foreground">
                    주기적으로 비밀번호를 변경하여 계정을 보호하세요.
                  </p>
                </div>
                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Lock className="h-4 w-4 mr-2" />
                      비밀번호 변경
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>비밀번호 변경</DialogTitle>
                      <DialogDescription>
                        보안을 위해 주기적으로 비밀번호를 변경해주세요.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="dialogCurrentPassword">현재 비밀번호</Label>
                        <Input
                          id="dialogCurrentPassword"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="현재 비밀번호를 입력하세요"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dialogNewPassword">새 비밀번호</Label>
                        <Input
                          id="dialogNewPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="새 비밀번호를 입력하세요"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dialogConfirmPassword">비밀번호 확인</Label>
                        <Input
                          id="dialogConfirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="새 비밀번호를 다시 입력하세요"
                          required
                        />
                      </div>
                      {newPassword && newPassword !== confirmPassword && (
                        <p className="text-sm text-red-500">비밀번호가 일치하지 않습니다.</p>
                      )}
                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsPasswordDialogOpen(false);
                            setCurrentPassword("");
                            setNewPassword("");
                            setConfirmPassword("");
                          }}
                        >
                          취소
                        </Button>
                        <Button
                          type="submit"
                          disabled={profileMutation.isPending || !newPassword || newPassword !== confirmPassword || !currentPassword}
                        >
                          {profileMutation.isPending ? "변경 중..." : "변경하기"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}

