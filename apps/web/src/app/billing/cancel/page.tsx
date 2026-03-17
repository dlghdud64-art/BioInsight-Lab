"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MainHeader } from "@/app/_components/main-header";
import { MainLayout } from "@/app/_components/main-layout";
import { MainFooter } from "@/app/_components/main-footer";

export default function BillingCancelPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="container mx-auto px-4 pt-14 py-8 md:py-16">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-red-100 p-3">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-red-900">
                결제가 취소됨
              </CardTitle>
              <CardDescription className="text-base mt-2">
                결제가 취소되었습니다. 언제든지 다시 시도할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-6">
                  결제 과정에서 문제가 발생했거나 취소하셨습니다.
                  <br />
                  필요하시면 다시 시도해주세요.
                </p>
                <Link href="/pricing">
                  <Button size="lg" className="w-full md:w-auto">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    요금제 보기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}

