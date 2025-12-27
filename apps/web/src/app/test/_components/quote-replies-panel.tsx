"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export function QuoteRepliesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          견적 회신
        </CardTitle>
        <CardDescription>
          벤더로부터 받은 견적 회신을 확인하세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">아직 받은 회신이 없습니다</p>
          <p className="text-xs mt-2">견적 요청을 보내면 이곳에서 회신을 확인할 수 있습니다</p>
        </div>
      </CardContent>
    </Card>
  );
}
