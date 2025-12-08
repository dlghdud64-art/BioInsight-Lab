"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Package, Building2, FileText, Search } from "lucide-react";
import { useState } from "react";
import { USER_ROLES, PRODUCT_CATEGORIES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // 통계 조회
  const { data: statsData } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const stats = statsData?.stats;

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
    router.push("/auth/signin?callbackUrl=/dashboard/admin");
    return null;
  }

  // 관리자 권한 확인은 서버에서 처리됨

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">관리자 대시보드</h1>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  사용자
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.users.total}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  최근 30일: +{stats.users.recent}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  제품
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.products.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  벤더
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.vendors.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  견적
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.quotes.total}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  최근 30일: +{stats.quotes.recent}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              사용자 관리
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              제품 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersManagementTab />
          </TabsContent>

          <TabsContent value="products">
            <ProductsManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function UsersManagementTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users = data?.users || [];
  const totalPages = data?.totalPages || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>사용자 관리</CardTitle>
        <CardDescription>사용자 목록을 조회하고 역할을 변경할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이메일 또는 이름으로 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="역할 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {Object.entries(USER_ROLES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">로딩 중...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">사용자가 없습니다</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">이메일</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">이름</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">역할</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">활동</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">가입일</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: any) => (
                    <tr key={user.id} className="border-t">
                      <td className="px-4 py-2 text-sm">{user.email}</td>
                      <td className="px-4 py-2 text-sm">{user.name || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {USER_ROLES[user.role as keyof typeof USER_ROLES]}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        견적: {user._count.quotes}, 즐겨찾기: {user._count.favorites}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={user.role}
                          onValueChange={(role) =>
                            updateRoleMutation.mutate({ userId: user.id, role })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(USER_ROLES).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <span className="flex items-center px-4">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsManagementTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", page, search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);

      const response = await fetch(`/api/admin/products?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const products = data?.products || [];
  const totalPages = data?.totalPages || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>제품 관리</CardTitle>
        <CardDescription>제품 목록을 조회하고 관리할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="제품명으로 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">로딩 중...</p>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">제품이 없습니다</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">제품명</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">브랜드</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">카테고리</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">공급사</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">활동</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product: any) => (
                    <tr key={product.id} className="border-t">
                      <td className="px-4 py-2 text-sm">{product.name}</td>
                      <td className="px-4 py-2 text-sm">{product.brand || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {product.vendors?.length || 0}개
                      </td>
                      <td className="px-4 py-2 text-sm">
                        즐겨찾기: {product._count.favorites}, 비교: {product._count.comparisons}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/products/${product.id}`} target="_blank">
                              보기
                            </a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <span className="flex items-center px-4">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}




import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Package, Building2, FileText, Search } from "lucide-react";
import { useState } from "react";
import { USER_ROLES, PRODUCT_CATEGORIES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // 통계 조회
  const { data: statsData } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const stats = statsData?.stats;

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
    router.push("/auth/signin?callbackUrl=/dashboard/admin");
    return null;
  }

  // 관리자 권한 확인은 서버에서 처리됨

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">관리자 대시보드</h1>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  사용자
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.users.total}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  최근 30일: +{stats.users.recent}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  제품
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.products.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  벤더
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.vendors.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  견적
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.quotes.total}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  최근 30일: +{stats.quotes.recent}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              사용자 관리
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              제품 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersManagementTab />
          </TabsContent>

          <TabsContent value="products">
            <ProductsManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function UsersManagementTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users = data?.users || [];
  const totalPages = data?.totalPages || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>사용자 관리</CardTitle>
        <CardDescription>사용자 목록을 조회하고 역할을 변경할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이메일 또는 이름으로 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="역할 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {Object.entries(USER_ROLES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">로딩 중...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">사용자가 없습니다</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">이메일</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">이름</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">역할</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">활동</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">가입일</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: any) => (
                    <tr key={user.id} className="border-t">
                      <td className="px-4 py-2 text-sm">{user.email}</td>
                      <td className="px-4 py-2 text-sm">{user.name || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {USER_ROLES[user.role as keyof typeof USER_ROLES]}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        견적: {user._count.quotes}, 즐겨찾기: {user._count.favorites}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={user.role}
                          onValueChange={(role) =>
                            updateRoleMutation.mutate({ userId: user.id, role })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(USER_ROLES).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <span className="flex items-center px-4">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsManagementTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", page, search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);

      const response = await fetch(`/api/admin/products?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const products = data?.products || [];
  const totalPages = data?.totalPages || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>제품 관리</CardTitle>
        <CardDescription>제품 목록을 조회하고 관리할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="제품명으로 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">로딩 중...</p>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">제품이 없습니다</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">제품명</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">브랜드</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">카테고리</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">공급사</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">활동</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product: any) => (
                    <tr key={product.id} className="border-t">
                      <td className="px-4 py-2 text-sm">{product.name}</td>
                      <td className="px-4 py-2 text-sm">{product.brand || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {product.vendors?.length || 0}개
                      </td>
                      <td className="px-4 py-2 text-sm">
                        즐겨찾기: {product._count.favorites}, 비교: {product._count.comparisons}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/products/${product.id}`} target="_blank">
                              보기
                            </a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <span className="flex items-center px-4">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}




import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Package, Building2, FileText, Search } from "lucide-react";
import { useState } from "react";
import { USER_ROLES, PRODUCT_CATEGORIES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // 통계 조회
  const { data: statsData } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const stats = statsData?.stats;

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
    router.push("/auth/signin?callbackUrl=/dashboard/admin");
    return null;
  }

  // 관리자 권한 확인은 서버에서 처리됨

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">관리자 대시보드</h1>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  사용자
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.users.total}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  최근 30일: +{stats.users.recent}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  제품
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.products.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  벤더
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.vendors.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  견적
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.quotes.total}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  최근 30일: +{stats.quotes.recent}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              사용자 관리
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              제품 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersManagementTab />
          </TabsContent>

          <TabsContent value="products">
            <ProductsManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function UsersManagementTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users = data?.users || [];
  const totalPages = data?.totalPages || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>사용자 관리</CardTitle>
        <CardDescription>사용자 목록을 조회하고 역할을 변경할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이메일 또는 이름으로 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="역할 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {Object.entries(USER_ROLES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">로딩 중...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">사용자가 없습니다</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">이메일</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">이름</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">역할</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">활동</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">가입일</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: any) => (
                    <tr key={user.id} className="border-t">
                      <td className="px-4 py-2 text-sm">{user.email}</td>
                      <td className="px-4 py-2 text-sm">{user.name || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {USER_ROLES[user.role as keyof typeof USER_ROLES]}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        견적: {user._count.quotes}, 즐겨찾기: {user._count.favorites}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={user.role}
                          onValueChange={(role) =>
                            updateRoleMutation.mutate({ userId: user.id, role })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(USER_ROLES).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <span className="flex items-center px-4">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsManagementTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", page, search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);

      const response = await fetch(`/api/admin/products?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const products = data?.products || [];
  const totalPages = data?.totalPages || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>제품 관리</CardTitle>
        <CardDescription>제품 목록을 조회하고 관리할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="제품명으로 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">로딩 중...</p>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">제품이 없습니다</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">제품명</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">브랜드</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">카테고리</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">공급사</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">활동</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product: any) => (
                    <tr key={product.id} className="border-t">
                      <td className="px-4 py-2 text-sm">{product.name}</td>
                      <td className="px-4 py-2 text-sm">{product.brand || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {product.vendors?.length || 0}개
                      </td>
                      <td className="px-4 py-2 text-sm">
                        즐겨찾기: {product._count.favorites}, 비교: {product._count.comparisons}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/products/${product.id}`} target="_blank">
                              보기
                            </a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <span className="flex items-center px-4">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}





