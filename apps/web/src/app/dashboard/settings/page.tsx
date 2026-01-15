"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Building2,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Upload,
  Settings,
  CreditCard,
  ArrowUp,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { useEffect } from "react";

interface ShippingAddress {
  id: string;
  recipientName: string;
  phone: string;
  address: string;
  detailAddress: string;
  postalCode: string;
  isDefault: boolean;
}

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
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // URL 파라미터에서 탭 값 가져오기 (기본값: "profile")
  const tabFromUrl = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // URL 파라미터 변경 시 탭 업데이트
  useEffect(() => {
    const tab = searchParams.get("tab") || "profile";
    setActiveTab(tab);
  }, [searchParams]);

  // 프로필 상태
  const [profileName, setProfileName] = useState(session?.user?.name || "");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 조직 상태
  const [organizationName, setOrganizationName] = useState("");

  // 배송지 상태
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    recipientName: "",
    phone: "",
    address: "",
    detailAddress: "",
    postalCode: "",
    isDefault: false,
  });

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

  // 조직 정보 조회
  const { data: organizationsData } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) return { organizations: [] };
      return response.json();
    },
    enabled: !!session,
  });

  const currentOrganization = organizationsData?.organizations?.[0];

  // 배송지 조회 (로컬 스토리지 또는 API)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAddresses = localStorage.getItem("shipping-addresses");
      if (savedAddresses) {
        try {
          setAddresses(JSON.parse(savedAddresses));
        } catch (error) {
          console.error("Failed to parse saved addresses", error);
        }
      }
    }
  }, []);

  // 프로필 업데이트
  const profileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; password?: string }) => {
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

  // 조직 이름 업데이트
  const organizationMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`/api/organizations/${currentOrganization?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Failed to update organization");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "조직 이름 업데이트 완료",
        description: "조직 이름이 성공적으로 변경되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "업데이트 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 배송지 추가/수정
  const handleSaveAddress = () => {
    if (!addressForm.recipientName || !addressForm.phone || !addressForm.address) {
      toast({
        title: "입력 오류",
        description: "필수 항목을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    let updatedAddresses: ShippingAddress[];

    if (editingAddress) {
      // 수정
      updatedAddresses = addresses.map((addr) =>
        addr.id === editingAddress.id
          ? { ...addressForm, id: editingAddress.id }
          : addressForm.isDefault ? { ...addr, isDefault: false } : addr
      );
    } else {
      // 추가
      const newAddress: ShippingAddress = {
        ...addressForm,
        id: `addr-${Date.now()}`,
      };
      updatedAddresses = addressForm.isDefault
        ? addresses.map((addr) => ({ ...addr, isDefault: false })).concat(newAddress)
        : addresses.concat(newAddress);
    }

    setAddresses(updatedAddresses);
    if (typeof window !== "undefined") {
      localStorage.setItem("shipping-addresses", JSON.stringify(updatedAddresses));
    }
    setIsAddressDialogOpen(false);
    setEditingAddress(null);
    setAddressForm({
      recipientName: "",
      phone: "",
      address: "",
      detailAddress: "",
      postalCode: "",
      isDefault: false,
    });
    toast({
      title: editingAddress ? "배송지 수정 완료" : "배송지 추가 완료",
      description: "배송지가 성공적으로 저장되었습니다.",
    });
  };

  // 배송지 삭제
  const handleDeleteAddress = (id: string) => {
    const updatedAddresses = addresses.filter((addr) => addr.id !== id);
    setAddresses(updatedAddresses);
    if (typeof window !== "undefined") {
      localStorage.setItem("shipping-addresses", JSON.stringify(updatedAddresses));
    }
    toast({
      title: "배송지 삭제 완료",
      description: "배송지가 삭제되었습니다.",
    });
  };

  // 배송지 편집 시작
  const handleEditAddress = (address: ShippingAddress) => {
    setEditingAddress(address);
    setAddressForm({
      recipientName: address.recipientName,
      phone: address.phone,
      address: address.address,
      detailAddress: address.detailAddress,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
    });
    setIsAddressDialogOpen(true);
  };

  // 새 배송지 추가 시작
  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({
      recipientName: "",
      phone: "",
      address: "",
      detailAddress: "",
      postalCode: "",
      isDefault: addresses.length === 0, // 첫 주소는 기본으로 설정
    });
    setIsAddressDialogOpen(true);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (profileName !== session?.user?.name) updates.name = profileName;
    if (profileEmail !== session?.user?.email) updates.email = profileEmail;
    if (newPassword && newPassword === confirmPassword) {
      updates.password = newPassword;
      updates.currentPassword = currentPassword;
    }
    if (Object.keys(updates).length > 0) {
      profileMutation.mutate(updates);
    }
  };

  const handleOrganizationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (organizationName && organizationName !== currentOrganization?.name) {
      organizationMutation.mutate(organizationName);
    }
  };

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

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
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="설정"
          description="계정, 조직, 배송지 정보를 관리하세요"
          icon={Settings}
        />

        <Tabs 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value);
            router.push(`/dashboard/settings${value !== "profile" ? `?tab=${value}` : ""}`);
          }} 
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">내 프로필</span>
              <span className="sm:hidden">프로필</span>
            </TabsTrigger>
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">조직 관리</span>
              <span className="sm:hidden">조직</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">구독 결제</span>
              <span className="sm:hidden">결제</span>
            </TabsTrigger>
            <TabsTrigger value="shipping" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">배송지 관리</span>
              <span className="sm:hidden">배송지</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: 프로필 */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>내 정보</CardTitle>
                <CardDescription>프로필 정보를 수정하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avatar">프로필 이미지</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center">
                        {session?.user?.image ? (
                          <img
                            src={session.user.image}
                            alt="Profile"
                            className="h-20 w-20 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-10 w-10 text-gray-400" />
                        )}
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        이미지 업로드
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={profileMutation.isPending}
                    className="w-full"
                  >
                    {profileMutation.isPending ? "저장 중..." : "저장"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>비밀번호 변경</CardTitle>
                <CardDescription>보안을 위해 정기적으로 비밀번호를 변경하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setIsPasswordDialogOpen(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  비밀번호 변경
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: 조직 설정 */}
          <TabsContent value="organization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>조직 정보</CardTitle>
                <CardDescription>조직 이름을 변경하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOrganizationSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">조직 이름</Label>
                    <Input
                      id="orgName"
                      value={organizationName || currentOrganization?.name || ""}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="조직 이름을 입력하세요"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={organizationMutation.isPending}
                    className="w-full"
                  >
                    {organizationMutation.isPending ? "저장 중..." : "저장"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>팀원 관리</CardTitle>
                <CardDescription>조직의 팀원을 초대하고 관리하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    팀원 초대
                  </Button>
                  <div className="space-y-2">
                    {currentOrganization?.members?.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{member.user?.name || member.user?.email}</p>
                          <p className="text-sm text-gray-500">{member.role}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    )) || (
                      <p className="text-sm text-gray-500 text-center py-4">
                        팀원이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: 구독 결제 */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>구독 및 결제</CardTitle>
                <CardDescription>현재 플랜을 확인하고 업그레이드하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* 현재 플랜 정보 */}
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">현재 플랜</h3>
                        <p className="text-sm text-gray-600">Free 플랜 이용 중입니다</p>
                      </div>
                      <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        Free
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>인벤토리 100개</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>엑셀 업로드</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>기본 검색</span>
                      </div>
                    </div>
                  </div>

                  {/* 업그레이드 버튼 */}
                  <div className="text-center space-y-4">
                    <p className="text-sm text-gray-600">
                      더 많은 기능이 필요하신가요? 플랜을 업그레이드하세요.
                    </p>
                    <Button
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => router.push("/pricing")}
                    >
                      <ArrowUp className="h-4 w-4 mr-2" />
                      플랜 업그레이드
                    </Button>
                  </div>

                  {/* 플랜 비교 링크 */}
                  <div className="pt-4 border-t">
                    <Link
                      href="/pricing"
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      모든 플랜 비교 보기 →
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: 배송지 관리 */}
          <TabsContent value="shipping" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>배송지 관리</CardTitle>
                <CardDescription>자주 사용하는 배송지를 등록하고 관리하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button onClick={handleAddAddress} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    새 배송지 추가
                  </Button>
                  <div className="space-y-3">
                    {addresses.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>등록된 배송지가 없습니다.</p>
                      </div>
                    ) : (
                      addresses.map((address) => (
                        <Card
                          key={address.id}
                          className={`${
                            address.isDefault
                              ? "border-blue-500 border-2 bg-blue-50/50"
                              : "border-gray-200"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold">{address.recipientName}</h3>
                                  {address.isDefault && (
                                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                      기본 배송지
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-1">{address.phone}</p>
                                <p className="text-sm text-gray-700">
                                  {address.postalCode && `[${address.postalCode}] `}
                                  {address.address} {address.detailAddress}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditAddress(address)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAddress(address.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 비밀번호 변경 다이얼로그 */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
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

        {/* 배송지 추가/수정 다이얼로그 */}
        <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? "배송지 수정" : "새 배송지 추가"}
              </DialogTitle>
              <DialogDescription>
                배송지 정보를 입력하세요
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientName">수령인 *</Label>
                  <Input
                    id="recipientName"
                    value={addressForm.recipientName}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, recipientName: e.target.value })
                    }
                    placeholder="수령인 이름"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">연락처 *</Label>
                  <Input
                    id="phone"
                    value={addressForm.phone}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, phone: e.target.value })
                    }
                    placeholder="010-1234-5678"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">우편번호</Label>
                <div className="flex gap-2">
                  <Input
                    id="postalCode"
                    value={addressForm.postalCode}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, postalCode: e.target.value })
                    }
                    placeholder="12345"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm">
                    주소 찾기
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">주소 *</Label>
                <Input
                  id="address"
                  value={addressForm.address}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, address: e.target.value })
                  }
                  placeholder="기본 주소"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="detailAddress">상세 주소</Label>
                <Input
                  id="detailAddress"
                  value={addressForm.detailAddress}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, detailAddress: e.target.value })
                  }
                  placeholder="상세 주소 (동/호수 등)"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={addressForm.isDefault}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, isDefault: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  기본 배송지로 설정
                </Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddressDialogOpen(false);
                    setEditingAddress(null);
                    setAddressForm({
                      recipientName: "",
                      phone: "",
                      address: "",
                      detailAddress: "",
                      postalCode: "",
                      isDefault: false,
                    });
                  }}
                >
                  취소
                </Button>
                <Button onClick={handleSaveAddress}>
                  {editingAddress ? "수정" : "추가"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

