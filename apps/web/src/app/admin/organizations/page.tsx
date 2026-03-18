"use client";

import { AdminSidebar } from "../_components/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Building2, Plus, RefreshCw, ArrowRight } from "lucide-react";

export default function AdminOrganizationsPage() {
  return (
    <div className="flex min-h-screen bg-pg">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="bg-pn border-b border-bd px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-100">조직 관리</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">등록된 조직을 관리하고 승인합니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <RefreshCw className="h-3 w-3" />새로 고침
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700">
                <Plus className="h-3 w-3" />조직 생성
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 p-5">
          <div className="bg-pn border border-bd rounded-lg py-16 text-center">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-el mb-3">
              <Building2 className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">등록된 조직이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">새 조직을 생성하거나 가입 요청을 확인할 수 있습니다.</p>
            <Button size="sm" variant="ghost" className="mt-3 text-xs text-blue-600 gap-1">
              조직 생성하기 <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
