"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, AlertCircle } from "lucide-react";

interface Grant {
  id: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  isActive: boolean;
}

interface GrantSelectorProps {
  value: string;
  onChange: (grantId: string) => void;
  orderAmount: number;
}

export function GrantSelector({ value, onChange, orderAmount }: GrantSelectorProps) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGrants();
  }, []);

  const fetchGrants = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/grants?activeOnly=true");
      if (!response.ok) throw new Error("Failed to fetch grants");
      const data = await response.json();
      setGrants(data.grants);
    } catch (error) {
      console.error("Error fetching grants:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      notation: "compact",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const selectedGrant = grants.find((g) => g.id === value);
  const isInsufficientBudget = selectedGrant && selectedGrant.remainingAmount < orderAmount;

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>연구비 과제</Label>
        <div className="h-10 bg-slate-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="grant">
        연구비 과제 <span className="text-xs text-slate-500">(선택사항)</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="grant" className="w-full">
          <SelectValue placeholder="개인 예산 사용 (기본)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">개인 예산 사용</SelectItem>
          {grants.map((grant) => {
            const insufficient = grant.remainingAmount < orderAmount;
            return (
              <SelectItem
                key={grant.id}
                value={grant.id}
                disabled={insufficient}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-slate-500" />
                    <span>{grant.name}</span>
                  </div>
                  <div
                    className={`text-xs ml-4 ${
                      insufficient ? "text-red-600" : "text-slate-600"
                    }`}
                  >
                    {formatCurrency(grant.remainingAmount)}
                    {insufficient && " (잔액 부족)"}
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {selectedGrant && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Wallet className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-blue-900">{selectedGrant.name}</div>
              <div className="text-blue-700 mt-1">
                잔액: {formatCurrency(selectedGrant.remainingAmount)} / {formatCurrency(selectedGrant.totalAmount)}
              </div>
            </div>
          </div>
        </div>
      )}

      {isInsufficientBudget && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-red-900">과제 예산 부족</div>
              <div className="text-red-700 mt-1">
                이 과제의 잔액({formatCurrency(selectedGrant.remainingAmount)})이 주문 금액({formatCurrency(orderAmount)})보다 적습니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {grants.length === 0 && (
        <p className="text-xs text-slate-500 mt-1">
          등록된 과제가 없습니다. 개인 예산이 사용됩니다.
        </p>
      )}
    </div>
  );
}
