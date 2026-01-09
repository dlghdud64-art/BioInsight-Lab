"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Wallet, TrendingDown, TrendingUp, Calendar } from "lucide-react";

interface Grant {
  id: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  team?: {
    id: string;
    name: string;
  };
  _count: {
    orders: number;
  };
}

interface GrantSummary {
  totalGrants: number;
  totalBudget: number;
  totalUsed: number;
  totalRemaining: number;
}

export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [summary, setSummary] = useState<GrantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    name: "",
    totalAmount: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  const fetchGrants = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/grants");
      if (!response.ok) throw new Error("Failed to fetch grants");
      const data = await response.json();
      setGrants(data.grants);
      setSummary(data.summary);
    } catch (error) {
      console.error("Error fetching grants:", error);
      toast.error("과제 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, []);

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.totalAmount) {
      toast.error("과제명과 총 예산은 필수입니다.");
      return;
    }

    try {
      const response = await fetch("/api/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          totalAmount: parseInt(formData.totalAmount),
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
          description: formData.description || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create grant");
      }

      toast.success("과제가 성공적으로 등록되었습니다.");
      setFormData({
        name: "",
        totalAmount: "",
        startDate: "",
        endDate: "",
        description: "",
      });
      setShowCreateForm(false);
      fetchGrants();
    } catch (error: any) {
      console.error("Error creating grant:", error);
      toast.error(error.message || "과제 등록에 실패했습니다.");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("ko-KR");
  };

  const calculateUsagePercent = (grant: Grant) => {
    const used = grant.totalAmount - grant.remainingAmount;
    return (used / grant.totalAmount) * 100;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">연구비 과제 관리</h1>
          <p className="text-slate-600 mt-1">
            연구비 원천(과제)을 등록하고 주문 시 차감할 수 있습니다.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          과제 등록
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 과제 수</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {summary.totalGrants}개
                </p>
              </div>
              <Wallet className="h-10 w-10 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">총 예산</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(summary.totalBudget)}
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-green-500" />
            </div>
          </Card>

          <Card className="p-6 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">사용 금액</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {formatCurrency(summary.totalUsed)}
                </p>
              </div>
              <TrendingDown className="h-10 w-10 text-red-500" />
            </div>
          </Card>

          <Card className="p-6 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">잔액</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {formatCurrency(summary.totalRemaining)}
                </p>
              </div>
              <Wallet className="h-10 w-10 text-blue-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card className="p-6 bg-white border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            새 과제 등록
          </h2>
          <form onSubmit={handleCreateGrant} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">과제명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="예: 삼성전자 산학협력과제"
                  required
                />
              </div>

              <div>
                <Label htmlFor="totalAmount">총 예산 (원) *</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, totalAmount: e.target.value })
                  }
                  placeholder="10000000"
                  required
                />
              </div>

              <div>
                <Label htmlFor="startDate">시작일</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="endDate">종료일</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="과제에 대한 추가 설명을 입력하세요."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                취소
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                등록하기
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Grants List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">과제 목록</h2>

        {grants.length === 0 ? (
          <Card className="p-12 text-center bg-white border border-slate-200">
            <Wallet className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">등록된 과제가 없습니다.</p>
            <p className="text-sm text-slate-500 mt-1">
              위의 "과제 등록" 버튼을 눌러 새 과제를 등록하세요.
            </p>
          </Card>
        ) : (
          grants.map((grant) => {
            const usagePercent = calculateUsagePercent(grant);
            const used = grant.totalAmount - grant.remainingAmount;

            return (
              <Card
                key={grant.id}
                className="p-6 bg-white border border-slate-200 hover:shadow-md transition-shadow"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {grant.name}
                      </h3>
                      {grant.description && (
                        <p className="text-sm text-slate-600 mt-1">
                          {grant.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-600">잔액</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(grant.remainingAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm text-slate-600 mb-1">
                      <span>사용률: {usagePercent.toFixed(1)}%</span>
                      <span>
                        {formatCurrency(used)} / {formatCurrency(grant.totalAmount)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          usagePercent > 90
                            ? "bg-red-500"
                            : usagePercent > 70
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <div className="flex gap-4 text-sm text-slate-600">
                      {grant.startDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {formatDate(grant.startDate)} ~{" "}
                            {formatDate(grant.endDate)}
                          </span>
                        </div>
                      )}
                      <div>주문 {grant._count.orders}건</div>
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded ${
                        grant.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {grant.isActive ? "활성" : "비활성"}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
