"use client";

import { TestCard } from "./test-card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface ProtocolInputCardProps {
  protocolText: string;
  isExtracting?: boolean;
  onTextChange: (text: string) => void;
  onExtract: () => void;
}

export function ProtocolInputCard({
  protocolText,
  isExtracting = false,
  onTextChange,
  onExtract,
}: ProtocolInputCardProps) {

  return (
    <TestCard
      title="프로토콜 / 데이터시트 텍스트"
      subtitle="PDF에서 복사한 텍스트를 붙여넣고 필드 추출을 테스트합니다."
    >
      <Textarea
        value={protocolText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="프로토콜 또는 데이터시트 텍스트를 붙여넣으세요..."
        rows={6}
        className="text-sm"
      />
      <Button
        size="sm"
        className="w-full"
        onClick={onExtract}
        disabled={!protocolText || isExtracting}
      >
        <FileText className="h-4 w-4 mr-2" />
        {isExtracting ? "분석 중..." : "필드 추출 테스트"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        * paste-only 모드 테스트용 – 파일 자체는 서버로 전송하지 않습니다.
      </p>
    </TestCard>
  );
}


import { TestCard } from "./test-card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface ProtocolInputCardProps {
  protocolText: string;
  isExtracting?: boolean;
  onTextChange: (text: string) => void;
  onExtract: () => void;
}

export function ProtocolInputCard({
  protocolText,
  isExtracting = false,
  onTextChange,
  onExtract,
}: ProtocolInputCardProps) {

  return (
    <TestCard
      title="프로토콜 / 데이터시트 텍스트"
      subtitle="PDF에서 복사한 텍스트를 붙여넣고 필드 추출을 테스트합니다."
    >
      <Textarea
        value={protocolText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="프로토콜 또는 데이터시트 텍스트를 붙여넣으세요..."
        rows={6}
        className="text-sm"
      />
      <Button
        size="sm"
        className="w-full"
        onClick={onExtract}
        disabled={!protocolText || isExtracting}
      >
        <FileText className="h-4 w-4 mr-2" />
        {isExtracting ? "분석 중..." : "필드 추출 테스트"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        * paste-only 모드 테스트용 – 파일 자체는 서버로 전송하지 않습니다.
      </p>
    </TestCard>
  );
}


import { TestCard } from "./test-card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface ProtocolInputCardProps {
  protocolText: string;
  isExtracting?: boolean;
  onTextChange: (text: string) => void;
  onExtract: () => void;
}

export function ProtocolInputCard({
  protocolText,
  isExtracting = false,
  onTextChange,
  onExtract,
}: ProtocolInputCardProps) {

  return (
    <TestCard
      title="프로토콜 / 데이터시트 텍스트"
      subtitle="PDF에서 복사한 텍스트를 붙여넣고 필드 추출을 테스트합니다."
    >
      <Textarea
        value={protocolText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="프로토콜 또는 데이터시트 텍스트를 붙여넣으세요..."
        rows={6}
        className="text-sm"
      />
      <Button
        size="sm"
        className="w-full"
        onClick={onExtract}
        disabled={!protocolText || isExtracting}
      >
        <FileText className="h-4 w-4 mr-2" />
        {isExtracting ? "분석 중..." : "필드 추출 테스트"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        * paste-only 모드 테스트용 – 파일 자체는 서버로 전송하지 않습니다.
      </p>
    </TestCard>
  );
}

