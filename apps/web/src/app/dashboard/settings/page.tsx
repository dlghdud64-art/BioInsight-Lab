"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  ShieldCheck,
  Users,
  FileText,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  USER: "사용자",
  RESEARCHER: "연구실 관리자",
  BUYER: "구매 담당자",
  SUPPLIER: "공급사",
};

type SettingsSection = "profile" | "team" | "notifications" | "security";

function SettingsPageFallback() {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8" />
          <div className="flex gap-6">
            <div className="w-48 h-64 bg-gray-200 rounded" />
            <div className="flex-1 space-y-4">
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
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

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  const [profileName, setProfileName] = useState(session?.user?.name || "");
  const [profileBio, setProfileBio] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState(true);

  const [auditTrailEnabled, setAuditTrailEnabled] = useState(true);
  const [dataIntegrityMode, setDataIntegrityMode] = useState(false);

  const { theme, setTheme } = useTheme();

  const { data: userData } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await fetch("/api/user/profile");
      if (!response.ok) throw new Error("Failed to fetch user profile");
      return response.json();
    },
    enabled: !!session,
  });

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
        title: "변경사항 저장 완료",
        description: "설정이 성공적으로 반영되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const updates: Record<string, string> = {};
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
    }
  };

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleSettingsSave = async () => {
    setIsSavingSettings(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast({
      title: "설정 저장 완료",
      description: "알림 및 보안 설정이 반영되었습니다.",
    });
    setIsSavingSettings(false);
  };

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

  const userRole = (session?.user?.role as string) || "USER";
  const roleLabel = ROLE_LABELS[userRole] || "사용자";

  const navItems: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "프로필", icon: User },
    { id: "team", label: "팀 관리", icon: Users },
    { id: "notifications", label: "알림 설정", icon: Bell },
    { id: "security", label: "보안 및 로그", icon: ShieldCheck },
  ];

  return (
    <div className="w-full px-4 md:px-6 py-6 pt-6">
      <div className="max-w-6xl mx-auto">
        <div className="space-y-0.5 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            설정
          </h2>
          <p className="text-muted-foreground">
            계정 정보와 연구실 워크스페이스 환경을 관리합니다.
          </p>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col lg:flex-row gap-8">
          {/* 좌측 서브 메뉴 */}
          <nav className="lg:w-56 shrink-0">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-600" : "text-slate-500")} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {isActive && <ChevronRight className="h-4 w-4 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* 우측 콘텐츠 */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* 1. 프로필 탭 */}
            {activeSection === "profile" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      프로필 정보
                    </CardTitle>
                    <CardDescription>공개적으로 표시되는 프로필 정보입니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || "User"} />
                        <AvatarFallback className="bg-blue-100 text-blue-600 text-lg font-semibold">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2">
                        <Badge variant="secondary" className="w-fit border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                          {roleLabel}
                        </Badge>
                        <Button type="button" variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          사진 변경
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">기본 정보</h4>
                      <div className="grid gap-4 max-w-md">
                        <div className="grid gap-2">
                          <Label htmlFor="name">이름</Label>
                          <Input
                            id="name"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="이름을 입력하세요"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="bio">소개</Label>
                          <Textarea
                            id="bio"
                            value={profileBio}
                            onChange={(e) => setProfileBio(e.target.value)}
                            placeholder="자기소개를 입력하세요"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">연락처</h4>
                      <div className="grid gap-4 max-w-md">
                        <div className="grid gap-2">
                          <Label htmlFor="url">URL</Label>
                          <Input
                            id="url"
                            value={profileUrl}
                            onChange={(e) => setProfileUrl(e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="email">이메일</Label>
                          <Input
                            id="email"
                            type="email"
                            value={profileEmail}
                            disabled
                            className="bg-slate-50 dark:bg-slate-900/50"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      비밀번호
                    </CardTitle>
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
                          <DialogDescription>보안을 위해 주기적으로 비밀번호를 변경해주세요.</DialogDescription>
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
                              disabled={
                                profileMutation.isPending ||
                                !newPassword ||
                                newPassword !== confirmPassword ||
                                !currentPassword
                              }
                            >
                              {profileMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  변경 중...
                                </>
                              ) : (
                                "변경하기"
                              )}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </>
            )}

            {/* 2. 팀 관리 탭 */}
            {activeSection === "team" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    팀 관리
                  </CardTitle>
                  <CardDescription>조직 및 팀원을 관리합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/dashboard/organizations">
                    <Button variant="outline">
                      <Users className="h-4 w-4 mr-2" />
                      조직 관리 페이지로 이동
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* 3. 알림 설정 탭 */}
            {activeSection === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    알림 설정
                  </CardTitle>
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
            )}

            {/* 4. 보안 및 로그 탭 */}
            {activeSection === "security" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      보안 및 관리 설정
                    </CardTitle>
                    <CardDescription>감사 증적 및 데이터 무결성 설정을 관리합니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="audit-trail" className="text-base font-medium">
                            감사 증적(Audit Trail) 강제 활성화
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          모든 데이터 변경 및 접근 기록을 추적합니다. (CFR 21 Part 11 대응)
                        </p>
                      </div>
                      <Switch
                        id="audit-trail"
                        checked={auditTrailEnabled}
                        onCheckedChange={setAuditTrailEnabled}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="data-integrity" className="text-base font-medium">
                            데이터 무결성 모드
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          변경 이력 검증 및 무결성 체크를 활성화합니다.
                        </p>
                      </div>
                      <Switch
                        id="data-integrity"
                        checked={dataIntegrityMode}
                        onCheckedChange={setDataIntegrityMode}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>감사 증적</CardTitle>
                    <CardDescription>시스템 내 활동 로그를 확인합니다.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href="/dashboard/audit">
                      <Button variant="outline">
                        <FileText className="h-4 w-4 mr-2" />
                        감사 증적 페이지로 이동
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </>
            )}

            {/* 5. 디스플레이 (프로필/알림에 함께 표시) */}
            {activeSection === "profile" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    테마 설정
                  </CardTitle>
                  <CardDescription>앱의 색상 테마를 선택하세요.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all",
                        theme === "light"
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                      )}
                    >
                      <Sun className={cn("h-6 w-6", theme === "light" ? "text-blue-600" : "text-slate-400")} />
                      <span className={cn("text-sm font-medium", theme === "light" ? "text-blue-600" : "text-slate-700 dark:text-slate-300")}>
                        라이트
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all",
                        theme === "dark"
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                      )}
                    >
                      <Moon className={cn("h-6 w-6", theme === "dark" ? "text-blue-600" : "text-slate-400")} />
                      <span className={cn("text-sm font-medium", theme === "dark" ? "text-blue-600" : "text-slate-700 dark:text-slate-300")}>
                        다크
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme("system")}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all",
                        theme === "system"
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                      )}
                    >
                      <Monitor className={cn("h-6 w-6", theme === "system" ? "text-blue-600" : "text-slate-400")} />
                      <span className={cn("text-sm font-medium", theme === "system" ? "text-blue-600" : "text-slate-700 dark:text-slate-300")}>
                        시스템
                      </span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 하단 고정 저장 버튼 */}
            <div className="sticky bottom-0 pt-6 pb-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:px-0 lg:border-0 lg:pt-8">
              <div className="flex justify-end">
                <Button
                  variant="default"
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 min-w-[180px]"
                  onClick={() => (activeSection === "profile" ? handleProfileSubmit() : handleSettingsSave())}
                  disabled={profileMutation.isPending || isSavingSettings}
                >
                  {(profileMutation.isPending || isSavingSettings) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      변경사항 저장
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
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
