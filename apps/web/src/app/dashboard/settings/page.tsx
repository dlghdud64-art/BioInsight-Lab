"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
  Users,
  Loader2,
  ChevronRight,
  Package,
  Wallet,
  BarChart3,
  Phone,
  CreditCard,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  USER: "사용자",
  RESEARCHER: "연구실 관리자",
  BUYER: "구매 담당자",
  SUPPLIER: "공급사",
};

type SettingsSection = "profile" | "team" | "notifications" | "billing";

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
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  const [profileName, setProfileName] = useState(session?.user?.name || "");
  const [profileBio, setProfileBio] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [countryCode, setCountryCode] = useState("+82");
  const [profilePhone, setProfilePhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [budgetOverrunAlerts, setBudgetOverrunAlerts] = useState(true);
  const [weeklyReportEmails, setWeeklyReportEmails] = useState(false);

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

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "billing") setActiveSection("billing");
  }, [searchParams]);

  useEffect(() => {
    if (userData?.phone && typeof userData.phone === "string") {
      const match = userData.phone.match(/^(\+\d+)\s*(.*)$/);
      if (match) {
        setCountryCode(match[1]);
        setProfilePhone(match[2].trim());
      } else {
        setProfilePhone(userData.phone);
      }
    }
  }, [userData?.phone]);

  const { data: orgsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
    enabled: !!session,
  });

  const currentOrgId = orgsData?.organizations?.[0]?.id;

  const { data: membersData } = useQuery({
    queryKey: ["organization-members", currentOrgId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${currentOrgId}/members`);
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
    enabled: !!session && !!currentOrgId,
  });

  const { data: billingData, isLoading: billingLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const response = await fetch("/api/billing");
      if (!response.ok) throw new Error("Failed to fetch billing");
      return response.json();
    },
    enabled: activeSection === "billing",
  });

  const members = membersData?.members || [];
  const currentOrgName = orgsData?.organizations?.[0]?.name || "우리 연구실";

  const roleUpdateMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await fetch(`/api/organizations/${currentOrgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update role");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "권한이 변경되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["organization-members", currentOrgId] });
    },
    onError: (error: Error) => {
      toast({ title: "권한 변경 실패", description: error.message, variant: "destructive" });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; phone?: string; password?: string; currentPassword?: string }) => {
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

  const savedPhone = userData?.phone;
  const fullPhone = profilePhone.trim() ? `${countryCode} ${profilePhone.trim()}` : "";

  const handleProfileSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const updates: Record<string, string> = {};
    if (profileName !== session?.user?.name) updates.name = profileName;
    if (profileEmail !== session?.user?.email) updates.email = profileEmail;
    if (fullPhone !== (savedPhone || "")) updates.phone = fullPhone;
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

  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  const handleNotificationSave = async () => {
    setIsSavingNotifications(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast({
      title: "설정 저장 완료",
      description: "알림 설정이 반영되었습니다.",
    });
    setIsSavingNotifications(false);
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
  const isAdmin = userRole === "ADMIN";

  const navItems: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "프로필", icon: User },
    { id: "team", label: "팀 관리", icon: Users },
    { id: "notifications", label: "알림 설정", icon: Bell },
    { id: "billing", label: "청구 및 구독", icon: CreditCard },
  ];

  type TeamRoleValue = "admin" | "researcher" | "guest";

  const mapBackendRoleToDisplay = (role: string): TeamRoleValue => {
    if (role === "ADMIN") return "admin";
    if (role === "APPROVER" || role === "REQUESTER") return "researcher";
    return "guest"; // VIEWER, 기타
  };

  const mapDisplayToBackendRole = (value: TeamRoleValue): string => {
    if (value === "admin") return "ADMIN";
    if (value === "researcher") return "APPROVER"; // APPROVER: 견적 승인 권한 (연구원)
    return "VIEWER"; // guest
  };

  const [teamRoles, setTeamRoles] = useState<Record<string, TeamRoleValue>>({});
  const [isTeamDirty, setIsTeamDirty] = useState(false);
  const [isSavingTeam, setIsSavingTeam] = useState(false);

  useEffect(() => {
    if (members?.length) {
      const initial: Record<string, TeamRoleValue> = {};
      members.forEach((member: { id: string; role: string }) => {
        initial[member.id] = mapBackendRoleToDisplay(member.role);
      });
      setTeamRoles(initial);
      setIsTeamDirty(false);
    }
  }, [members]);

  const handleTeamSave = async () => {
    if (!members?.length) return;

    const changes = members.filter((member: { id: string; role: string }) => {
      const currentDisplay = mapBackendRoleToDisplay(member.role);
      const selected = teamRoles[member.id] ?? currentDisplay;
      return selected !== currentDisplay;
    });

    if (changes.length === 0) {
      setIsTeamDirty(false);
      return;
    }

    setIsSavingTeam(true);
    try {
      for (const member of changes) {
        const displayRole = teamRoles[member.id] ?? mapBackendRoleToDisplay(member.role);
        const backendRole = mapDisplayToBackendRole(displayRole);
        // @ts-ignore mutateAsync는 런타임에서 지원됩니다.
        await roleUpdateMutation.mutateAsync({ memberId: member.id, role: backendRole });
      }
      setIsTeamDirty(false);
    } finally {
      setIsSavingTeam(false);
    }
  };

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
              <div className="animate-in fade-in-50 duration-300 space-y-6">
                <Card className="shadow-sm border-slate-200 dark:border-slate-700">
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

                    <div className="space-y-6">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">기본 정보</h4>
                      <div className="grid gap-6 max-w-md">
                        <div className="grid gap-2">
                          <Label htmlFor="name" className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <User className="h-4 w-4 text-slate-400" />
                            이름
                          </Label>
                          <Input
                            id="name"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="이름을 입력하세요"
                            className="border-slate-200 dark:border-slate-700 focus:ring-blue-600"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="phone" className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <Phone className="h-4 w-4 text-slate-400" />
                            휴대폰 번호
                          </Label>
                          <div className="flex gap-2">
                            <Select value={countryCode} onValueChange={setCountryCode}>
                              <SelectTrigger className="w-[100px] border-slate-200 dark:border-slate-700">
                                <SelectValue placeholder="국가" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="+82">KR (+82)</SelectItem>
                                <SelectItem value="+1">US (+1)</SelectItem>
                                <SelectItem value="+81">JP (+81)</SelectItem>
                                <SelectItem value="+86">CN (+86)</SelectItem>
                                <SelectItem value="+44">UK (+44)</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              id="phone"
                              value={profilePhone}
                              onChange={(e) => setProfilePhone(e.target.value)}
                              placeholder="010-0000-0000"
                              className="flex-1 border-slate-200 dark:border-slate-700 focus:ring-blue-600"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            긴급 알림 및 본인 확인용으로 사용됩니다.
                          </p>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="bio">소개</Label>
                          <Textarea
                            id="bio"
                            value={profileBio}
                            onChange={(e) => setProfileBio(e.target.value)}
                            placeholder="자기소개를 입력하세요"
                            rows={3}
                            className="border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-6">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">연락처</h4>
                      <div className="grid gap-6 max-w-md">
                        <div className="grid gap-2">
                          <Label htmlFor="url">URL</Label>
                          <Input
                            id="url"
                            value={profileUrl}
                            onChange={(e) => setProfileUrl(e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                            className="border-slate-200 dark:border-slate-700"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="email" className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <Mail className="h-4 w-4 text-slate-400" />
                            이메일
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={profileEmail}
                            disabled
                            className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-slate-700">
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
              </div>
            )}

            {/* 2. 팀 관리 탭 */}
            {activeSection === "team" && (
              <div className="animate-in fade-in-50 duration-300">
                <Card className="overflow-hidden shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Users className="h-5 w-5" />
                      팀 권한 관리
                    </CardTitle>
                    <CardDescription className="text-muted-foreground dark:text-slate-400">
                      {currentOrgName} 멤버들의 시스템 접근 권한을 이 자리에서 바로 조정합니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        팀원 목록
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        팀원별로 역할을 선택한 뒤 하단의 변경사항 저장 버튼을 눌러 반영합니다.
                      </p>
                    </div>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/60 max-h-[400px] overflow-y-auto">
                      {members.length === 0 ? (
                        <div className="p-6 text-sm text-slate-500 dark:text-slate-400 text-center w-full">
                          아직 초대된 팀원이 없습니다.
                        </div>
                      ) : (
                        members.map((member: { id: string; user: { id: string; name: string | null; email: string } | null; role: string }) => {
                          const name = member.user?.name || member.user?.email || "알 수 없음";
                          const email = member.user?.email || "";
                          const initial = name?.charAt(0)?.toUpperCase() || "?";
                          const currentDisplayRole = mapBackendRoleToDisplay(member.role);
                          const selectedRole = teamRoles[member.id] ?? currentDisplayRole;

                          return (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-4 border-b last:border-0 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700 flex-shrink-0">
                                  <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-semibold dark:bg-slate-700 dark:text-slate-200">
                                    {initial}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                                    {name}
                                  </span>
                                  {email && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                                      {email}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Select
                                value={selectedRole}
                                onValueChange={(v: TeamRoleValue) => {
                                  setTeamRoles((prev) => ({
                                    ...prev,
                                    [member.id]: v,
                                  }));
                                  setIsTeamDirty(true);
                                }}
                                disabled={roleUpdateMutation.isPending || isSavingTeam}
                              >
                                <SelectTrigger className="w-[130px] h-9 text-xs font-medium flex-shrink-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">관리자</SelectItem>
                                  <SelectItem value="researcher">연구원</SelectItem>
                                  <SelectItem value="guest">게스트</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                  {/* 카드 내부 통합 저장 버튼: 팀원이 있을 때만 노출 */}
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex justify-end">
                    {members.length > 0 && (
                      <Button
                        size="lg"
                        className="antialiased bg-blue-600 hover:bg-blue-700 text-white font-bold px-8"
                        onClick={handleTeamSave}
                        disabled={!isTeamDirty || roleUpdateMutation.isPending || isSavingTeam}
                      >
                        {roleUpdateMutation.isPending || isSavingTeam ? (
                          "저장 중..."
                        ) : (
                          "변경사항 저장"
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* 3. 알림 설정 탭 */}
            {activeSection === "notifications" && (
              <div className="animate-in fade-in-50 duration-300 space-y-6">
                <Card className="shadow-sm border-slate-200 dark:border-slate-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Bell className="h-5 w-5" />
                      알림 설정
                    </CardTitle>
                    <CardDescription className="text-muted-foreground dark:text-slate-400">
                      이메일 및 앱 내 알림 수신 설정을 관리하세요.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="low-stock-alerts" className="text-base font-medium text-slate-900 dark:text-white">
                            재고 부족 알림
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">
                          재고가 부족한 품목에 대해 즉시 알림을 받습니다.
                        </p>
                      </div>
                      <Switch
                        id="low-stock-alerts"
                        checked={lowStockAlerts}
                        onCheckedChange={setLowStockAlerts}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="budget-overrun-alerts" className="text-base font-medium text-slate-900 dark:text-white">
                            예산 초과 알림
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">
                          예산 사용률이 80%를 초과하거나 초과 시 알림을 받습니다.
                        </p>
                      </div>
                      <Switch
                        id="budget-overrun-alerts"
                        checked={budgetOverrunAlerts}
                        onCheckedChange={setBudgetOverrunAlerts}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="weekly-report-emails" className="text-base font-medium text-slate-900 dark:text-white">
                            주간 리포트 수신
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">
                          매주 요약 리포트를 이메일로 받습니다.
                        </p>
                      </div>
                      <Switch
                        id="weekly-report-emails"
                        checked={weeklyReportEmails}
                        onCheckedChange={setWeeklyReportEmails}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="email-notifications" className="text-base font-medium text-slate-900 dark:text-white">
                            이메일 알림
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">
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
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="security-alerts" className="text-base font-medium text-slate-900 dark:text-white">
                            보안 알림
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">
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
              </div>
            )}

            {/* 4. 청구 및 구독 탭 */}
            {activeSection === "billing" && (
              <div className="animate-in fade-in-50 duration-300 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">구독 현황</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 antialiased"
                    onClick={() => router.push("/dashboard/settings/plans")}
                  >
                    플랜 변경
                  </Button>
                </div>

                {billingLoading ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="overflow-hidden border-slate-200 dark:border-slate-800 dark:bg-slate-900">
                        <CardHeader className="pb-2">
                          <Skeleton className="h-4 w-24 rounded dark:bg-slate-800" />
                          <Skeleton className="h-8 w-32 mt-2 rounded dark:bg-slate-800" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Skeleton className="h-5 w-16 rounded dark:bg-slate-800" />
                          <Skeleton className="h-4 w-full rounded dark:bg-slate-800" />
                        </CardContent>
                      </Card>
                      <Card className="overflow-hidden border-slate-200 dark:border-slate-800 dark:bg-slate-900">
                        <CardHeader className="pb-2">
                          <Skeleton className="h-4 w-24 rounded dark:bg-slate-800" />
                          <Skeleton className="h-8 w-28 mt-2 rounded dark:bg-slate-800" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Skeleton className="h-5 w-20 rounded dark:bg-slate-800" />
                          <Skeleton className="h-4 w-3/4 rounded dark:bg-slate-800" />
                        </CardContent>
                      </Card>
                    </div>
                    <Card className="overflow-hidden border-slate-200 dark:border-slate-800 dark:bg-slate-900">
                      <CardHeader>
                        <Skeleton className="h-6 w-24 rounded dark:bg-slate-800" />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 w-full rounded dark:bg-slate-800" />
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const subscription = billingData?.subscription || {
                        plan: "FREE",
                        status: "active",
                        currentPeriodEnd: null as string | null,
                      };
                      const planInfo = (billingData?.planInfo as Record<string, { nameKo: string; priceDisplay?: string }>) || {};
                      const planKey = (subscription?.plan && ["FREE", "TEAM", "ORGANIZATION"].includes(subscription.plan) ? subscription.plan : "FREE") as string;
                      const displayName = planInfo[planKey]?.nameKo ?? "무료";
                      const priceDisplay = planInfo[planKey]?.priceDisplay ?? "";
                      const invoices = billingData?.invoices ?? [];
                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-blue-500/30 dark:border-blue-500/30">
                              <CardHeader className="pb-2">
                                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                                  현재 플랜
                                </CardDescription>
                                <CardTitle className="text-2xl text-slate-900 dark:text-slate-200 antialiased">
                                  {displayName}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                                    Active
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 antialiased">
                                  다음 결제일: {subscription?.currentPeriodEnd
                                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
                                    : "-"}
                                  {priceDisplay ? ` (${priceDisplay})` : ""}
                                </p>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">결제 이력</h3>
                            <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden">
                              <div className="overflow-x-auto">
                                <Table className="dark:bg-slate-900 min-w-[500px]">
                                  <TableHeader>
                                    <TableRow className="dark:border-slate-800/50 dark:hover:bg-slate-900">
                                    <TableHead className="text-slate-900 dark:text-slate-200">날짜</TableHead>
                                    <TableHead className="text-slate-900 dark:text-slate-200">항목</TableHead>
                                    <TableHead className="text-slate-900 dark:text-slate-200">금액</TableHead>
                                    <TableHead className="text-right text-slate-900 dark:text-slate-200">영수증</TableHead>
                                  </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {invoices.length === 0 ? (
                                      <TableRow className="dark:border-slate-800/50">
                                        <TableCell colSpan={4} className="text-center py-12 text-slate-500 dark:text-slate-400">
                                          결제 내역이 없습니다.
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      invoices.map((invoice: { id: string; paidAt?: string; periodStart?: string; description?: string; amountDue?: number; amountPaid?: number; invoicePdfUrl?: string }) => (
                                        <TableRow key={invoice.id} className="dark:border-slate-800/50 dark:hover:bg-slate-800/50">
                                          <TableCell className="text-slate-900 dark:text-slate-200">
                                            {invoice.paidAt
                                              ? new Date(invoice.paidAt).toLocaleDateString("ko-KR")
                                              : invoice.periodStart
                                                ? new Date(invoice.periodStart).toLocaleDateString("ko-KR")
                                                : "-"}
                                          </TableCell>
                                          <TableCell className="text-slate-900 dark:text-slate-200">{invoice.description || "구독 결제"}</TableCell>
                                          <TableCell className="text-slate-900 dark:text-slate-200">
                                            {(invoice.amountPaid ?? invoice.amountDue ?? 0).toLocaleString("ko-KR")}원
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="text-slate-600 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
                                              disabled={!invoice.invoicePdfUrl}
                                              onClick={() => {
                                                if (invoice.invoicePdfUrl) {
                                                  window.open(invoice.invoicePdfUrl, "_blank");
                                                } else {
                                                  toast({
                                                    title: "영수증",
                                                    description: "PDF 영수증은 결제 시스템 연동 후 이용 가능합니다.",
                                                  });
                                                }
                                              }}
                                            >
                                              <Receipt className="h-4 w-4 mr-1" />
                                              다운로드
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </Card>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* 5. 디스플레이 (프로필에 함께 표시) */}
            {activeSection === "profile" && (
              <Card className="shadow-sm border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
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

            {/* 하단 고정 저장 버튼 (청구·구독 탭 미표시, 팀 탭은 카드 내부 버튼 사용) */}
            {activeSection !== "billing" && activeSection !== "team" && (
              <div className="sticky bottom-0 pt-6 pb-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/50 -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:px-0 lg:border-0 lg:pt-8">
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full md:w-auto px-10 bg-blue-600 hover:bg-blue-700 text-white font-bold antialiased"
                    onClick={() => {
                      if (activeSection === "profile") {
                        handleProfileSubmit();
                      } else {
                        handleNotificationSave();
                      }
                    }}
                    disabled={
                      profileMutation.isPending ||
                      isSavingNotifications
                    }
                  >
                    {(profileMutation.isPending || isSavingNotifications) ? (
                      "저장 중..."
                    ) : (
                      "변경사항 저장"
                    )}
                  </Button>
                </div>
              </div>
            )}
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
