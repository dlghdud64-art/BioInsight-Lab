"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import {
  User,
  Upload,
  Lock,
  Sun,
  Moon,
  Monitor,
  Bell,
  Mail,
  Shield,
} from "lucide-react";

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
  const [profileBio, setProfileBio] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  // 알림 설정 상태 (Mock)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState(true);

  // 테마 설정 (next-themes)
  const { theme, setTheme } = useTheme();

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

  // 아바타 초기값 생성
  const getInitials = () => {
    if (session?.user?.name) {
      return session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return session?.user?.email?.[0].toUpperCase() || "U";
  };

  return (
    <div className="w-full px-4 md:px-6 py-6 pt-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 페이지 헤더 */}
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold tracking-tight">설정</h2>
          <p className="text-muted-foreground">계정 및 환경설정을 관리합니다.</p>
        </div>
        
        <Separator className="my-6" />

        {/* Tabs 구조 */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">프로필</TabsTrigger>
            <TabsTrigger value="account">계정</TabsTrigger>
            <TabsTrigger value="notifications">알림</TabsTrigger>
            <TabsTrigger value="display">디스플레이</TabsTrigger>
          </TabsList>

          {/* 1. 프로필 탭 */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>내 정보</CardTitle>
                <CardDescription>공개적으로 표시되는 프로필 정보입니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  {/* 아바타 영역 */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || "User"} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-lg font-semibold">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <Button type="button" variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      사진 변경
                    </Button>
                  </div>

                  {/* 폼 영역 */}
                  <div className="grid gap-2 max-w-md">
                    <Label htmlFor="name">이름</Label>
                    <Input
                      id="name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="이름을 입력하세요"
                    />
                  </div>

                  <div className="grid gap-2 max-w-md">
                    <Label htmlFor="bio">소개</Label>
                    <Textarea
                      id="bio"
                      value={profileBio}
                      onChange={(e) => setProfileBio(e.target.value)}
                      placeholder="자기소개를 입력하세요"
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-2 max-w-md">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      value={profileUrl}
                      onChange={(e) => setProfileUrl(e.target.value)}
                      placeholder="https://example.com"
                      type="url"
                    />
                  </div>
                </form>
              </CardContent>
              <CardFooter>
                <Button onClick={handleProfileSubmit} disabled={profileMutation.isPending}>
                  {profileMutation.isPending ? "저장 중..." : "변경사항 저장"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* 2. 계정 탭 */}
          <TabsContent value="account" className="space-y-4">
            {/* 이메일 카드 */}
            <Card>
              <CardHeader>
                <CardTitle>이메일 주소</CardTitle>
                <CardDescription>계정에 연결된 이메일 주소입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 max-w-md">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileEmail}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 비밀번호 변경 카드 */}
            <Card>
              <CardHeader>
                <CardTitle>비밀번호</CardTitle>
                <CardDescription>계정 보안을 위해 주기적으로 비밀번호를 변경하세요.</CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription className="text-red-600/80">
                  계정을 삭제하면 되돌릴 수 없습니다. 신중하게 결정하세요.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="destructive">
                  계정 삭제
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* 3. 알림 탭 */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>알림 설정</CardTitle>
                <CardDescription>이메일 알림 수신 설정을 관리하세요.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="email-notifications" className="text-base font-medium">
                        이메일 알림
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      중요한 업데이트 및 활동 알림을 이메일로 받습니다.
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="marketing-emails" className="text-base font-medium">
                        마케팅 수신 동의
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      새로운 기능, 팁, 프로모션 정보를 받습니다.
                    </p>
                  </div>
                  <Switch
                    id="marketing-emails"
                    checked={marketingEmails}
                    onCheckedChange={setMarketingEmails}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="security-alerts" className="text-base font-medium">
                        보안 알림
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      로그인 시도 및 보안 관련 중요한 알림을 받습니다.
                    </p>
                  </div>
                  <Switch
                    id="security-alerts"
                    checked={securityAlerts}
                    onCheckedChange={setSecurityAlerts}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 4. 디스플레이 탭 */}
          <TabsContent value="display" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>테마 설정</CardTitle>
                <CardDescription>앱의 색상 테마를 선택하세요.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      theme === "light"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                    }`}
                  >
                    <Sun className={`h-6 w-6 ${theme === "light" ? "text-blue-600" : "text-slate-400"}`} />
                    <span className={`text-sm font-medium ${theme === "light" ? "text-blue-600" : "text-slate-700 dark:text-slate-300"}`}>
                      라이트
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      theme === "dark"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                    }`}
                  >
                    <Moon className={`h-6 w-6 ${theme === "dark" ? "text-blue-600" : "text-slate-400"}`} />
                    <span className={`text-sm font-medium ${theme === "dark" ? "text-blue-600" : "text-slate-700 dark:text-slate-300"}`}>
                      다크
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      theme === "system"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                    }`}
                  >
                    <Monitor className={`h-6 w-6 ${theme === "system" ? "text-blue-600" : "text-slate-400"}`} />
                    <span className={`text-sm font-medium ${theme === "system" ? "text-blue-600" : "text-slate-700 dark:text-slate-300"}`}>
                      시스템
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
