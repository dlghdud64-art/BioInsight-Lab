"use client";

import { useState } from "react";
import { Search, Share2, Building2, Handshake, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface SharedReagent {
  id: number;
  lab: string;
  name: string;
  catNo: string;
  available: string;
}

export default function CollaborationPage() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReagent, setSelectedReagent] = useState<SharedReagent | null>(null);
  const [qty, setQty] = useState("");
  const [purpose, setPurpose] = useState("");
  const [compensation, setCompensation] = useState<string>("");

  const sharedReagents: SharedReagent[] = [
    {
      id: 1,
      lab: "분자생물학 제2연구실",
      name: "Taq DNA Polymerase (500U)",
      catNo: "M0267",
      available: "대여 가능 (최대 50U)",
    },
    {
      id: 2,
      lab: "세포치료제 1팀",
      name: "Corning Matrigel Matrix",
      catNo: "354234",
      available: "소량 분주 가능 (최대 2ml)",
    },
    {
      id: 3,
      lab: "단백질공학 연구실",
      name: "Anti-CD4 Antibody",
      catNo: "ab133616",
      available: "대여 가능 (1 vial)",
    },
    {
      id: 4,
      lab: "공통 기기실",
      name: "Ethanol (100%)",
      catNo: "E7023",
      available: "자유 사용 (기록 필수)",
    },
  ];

  const handleOpenModal = (item: SharedReagent) => {
    setSelectedReagent(item);
    setQty("");
    setPurpose("");
    setCompensation("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReagent(null);
    setQty("");
    setPurpose("");
    setCompensation("");
  };

  const handleRequest = () => {
    toast({
      title: "요청이 전송되었습니다",
      description:
        "해당 랩실 책임자에게 요청이 전송되었습니다. 승인 시 재고 변동 내역이 시스템에 영구 기록됩니다.",
    });
    handleCloseModal();
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-col space-y-2 mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          협업 네트워크
        </h2>
        <p className="text-muted-foreground">
          기관 내 다른 랩실의 잉여 시약을 검색하고 대여/분주를 요청하세요.
        </p>
      </div>

      {/* 검색 영역 */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <Input
          placeholder="필요한 시약명, 제조사, 카탈로그 번호를 검색하세요..."
          className="pl-10 h-14 text-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 shadow-sm"
        />
      </div>

      {/* 공유 시약 리스트 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center">
          <Share2 className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          현재 대여/공유 가능한 시약
        </h3>

        <div className="grid gap-4">
          {sharedReagents.map((item) => (
            <Card
              key={item.id}
              className="border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-normal"
                    >
                      <Building2 className="w-3 h-3 mr-1" />
                      {item.lab}
                    </Badge>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                      {item.available}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {item.name}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                    Cat.No: {item.catNo}
                  </p>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleOpenModal(item)}
                >
                  <Handshake className="w-4 h-4 mr-2" />
                  협업/대여 요청
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 요청 모달 */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>시약 대여 및 협업 요청</DialogTitle>
            <DialogDescription>
              {selectedReagent?.lab}에 <strong>{selectedReagent?.name}</strong> 대여를 요청합니다.
              모든 내역은 시스템에 기록됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="qty">
                필요 수량 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="qty"
                placeholder="예: 2ml 분주 또는 1 vial 대여"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="purpose">사용 목적 및 프로젝트 명</Label>
              <Input
                id="purpose"
                placeholder="예: 정부과제 예비 실험용"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>반환/보상 약속</Label>
              <Select value={compensation} onValueChange={setCompensation}>
                <SelectTrigger>
                  <SelectValue placeholder="조건을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="return">동일 시약 발주 후 반환</SelectItem>
                  <SelectItem value="trade">다른 잉여 시약으로 교환</SelectItem>
                  <SelectItem value="free">단순 소량 분주 요청</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              취소
            </Button>
            <Button onClick={handleRequest} className="bg-blue-600 hover:bg-blue-700">
              <Send className="w-4 h-4 mr-2" />
              요청서 전송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
