"use client";

import { AdminSidebar } from "../_components/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="flex min-h-screen bg-pg">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="bg-pn border-b border-bd px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-100">설정</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">시스템 설정을 관리합니다.</p>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <RefreshCw className="h-3 w-3" />새로 고침
            </Button>
          </div>
        </div>
        <div className="flex-1 p-5">
          <div className="bg-pn border border-bd rounded-lg py-16 text-center">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-el mb-3">
              <Settings className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">시스템 설정</p>
            <p className="text-xs text-slate-400 mt-1">서비스 구성, 알림 설정, API 키 관리 등의 설정이 여기에 표시됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
