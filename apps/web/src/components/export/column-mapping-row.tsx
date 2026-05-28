"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface ColumnMapping {
  id: string;
  erpColumnName: string;
  appDataField: string;
}

interface ColumnMappingRowProps {
  mapping: ColumnMapping;
  onUpdate: (id: string, field: keyof ColumnMapping, value: string) => void;
  onRemove: (id: string) => void;
  availableFields: Array<{ value: string; label: string }>;
}

export function ColumnMappingRow({
  mapping,
  onUpdate,
  onRemove,
  availableFields,
}: ColumnMappingRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Input
          placeholder="ERP 컬럼명 (예: SAP Code)"
          value={mapping.erpColumnName}
          onChange={(e) => onUpdate(mapping.id, "erpColumnName", e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">→</span>
      </div>
      <div className="flex-1">
        <Select
          value={mapping.appDataField}
          onValueChange={(value) => onUpdate(mapping.id, "appDataField", value)}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="앱 데이터 필드 선택" />
          </SelectTrigger>
          <SelectContent>
            {availableFields.map((field) => (
              <SelectItem key={field.value} value={field.value}>
                {field.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(mapping.id)}
        className="flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

