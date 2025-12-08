"use client";

import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ArrowLeft, Brain, FileText } from "lucide-react";
import Link from "next/link";

export function AnalysisPanel() {
  const {
    searchQuery,
    protocolText,
    setProtocolText,
    queryAnalysis,
    protocolAnalysis,
    isExtracting,
    runProtocolAnalysis,
  } = useTestFlow();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800">검색어/쿼리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
            {searchQuery || "검색어가 없습니다"}
          </div>
          <Link href="/test/search">
            <Button variant="outline" className="w-full text-xs">
              <ArrowLeft className="h-3 w-3 mr-2" />
              다시 검색하기
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800">
            프로토콜 / 데이터시트 텍스트
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            PDF에서 복사한 텍스트를 붙여넣으세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="protocol-text" className="text-xs font-medium">
              텍스트 입력
            </Label>
            <Textarea
              id="protocol-text"
              value={protocolText}
              onChange={(e) => setProtocolText(e.target.value)}
              placeholder="프로토콜 또는 데이터시트 텍스트를 붙여넣으세요..."
              rows={8}
              className="text-sm"
            />
          </div>
          <Button
            onClick={runProtocolAnalysis}
            disabled={!protocolText || isExtracting}
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isExtracting ? "분석 중..." : "필드 추출 실행"}
          </Button>
          <p className="text-xs text-slate-500">
            * paste-only 모드: 파일 업로드 없이 텍스트만 전송됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalysisResults() {
  // 이 컴포넌트는 더 이상 사용되지 않음
  // 검색어 분석 결과는 SearchAnalysisCard로 분리됨
  return null;
}


import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ArrowLeft, Brain, FileText } from "lucide-react";
import Link from "next/link";

export function AnalysisPanel() {
  const {
    searchQuery,
    protocolText,
    setProtocolText,
    queryAnalysis,
    protocolAnalysis,
    isExtracting,
    runProtocolAnalysis,
  } = useTestFlow();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800">검색어/쿼리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
            {searchQuery || "검색어가 없습니다"}
          </div>
          <Link href="/test/search">
            <Button variant="outline" className="w-full text-xs">
              <ArrowLeft className="h-3 w-3 mr-2" />
              다시 검색하기
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800">
            프로토콜 / 데이터시트 텍스트
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            PDF에서 복사한 텍스트를 붙여넣으세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="protocol-text" className="text-xs font-medium">
              텍스트 입력
            </Label>
            <Textarea
              id="protocol-text"
              value={protocolText}
              onChange={(e) => setProtocolText(e.target.value)}
              placeholder="프로토콜 또는 데이터시트 텍스트를 붙여넣으세요..."
              rows={8}
              className="text-sm"
            />
          </div>
          <Button
            onClick={runProtocolAnalysis}
            disabled={!protocolText || isExtracting}
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isExtracting ? "분석 중..." : "필드 추출 실행"}
          </Button>
          <p className="text-xs text-slate-500">
            * paste-only 모드: 파일 업로드 없이 텍스트만 전송됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalysisResults() {
  // 이 컴포넌트는 더 이상 사용되지 않음
  // 검색어 분석 결과는 SearchAnalysisCard로 분리됨
  return null;
}


import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ArrowLeft, Brain, FileText } from "lucide-react";
import Link from "next/link";

export function AnalysisPanel() {
  const {
    searchQuery,
    protocolText,
    setProtocolText,
    queryAnalysis,
    protocolAnalysis,
    isExtracting,
    runProtocolAnalysis,
  } = useTestFlow();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800">검색어/쿼리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
            {searchQuery || "검색어가 없습니다"}
          </div>
          <Link href="/test/search">
            <Button variant="outline" className="w-full text-xs">
              <ArrowLeft className="h-3 w-3 mr-2" />
              다시 검색하기
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800">
            프로토콜 / 데이터시트 텍스트
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            PDF에서 복사한 텍스트를 붙여넣으세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="protocol-text" className="text-xs font-medium">
              텍스트 입력
            </Label>
            <Textarea
              id="protocol-text"
              value={protocolText}
              onChange={(e) => setProtocolText(e.target.value)}
              placeholder="프로토콜 또는 데이터시트 텍스트를 붙여넣으세요..."
              rows={8}
              className="text-sm"
            />
          </div>
          <Button
            onClick={runProtocolAnalysis}
            disabled={!protocolText || isExtracting}
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isExtracting ? "분석 중..." : "필드 추출 실행"}
          </Button>
          <p className="text-xs text-slate-500">
            * paste-only 모드: 파일 업로드 없이 텍스트만 전송됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalysisResults() {
  // 이 컴포넌트는 더 이상 사용되지 않음
  // 검색어 분석 결과는 SearchAnalysisCard로 분리됨
  return null;
}

