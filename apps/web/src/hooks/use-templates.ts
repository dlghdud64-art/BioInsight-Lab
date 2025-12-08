import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TemplateType } from "@/lib/constants";

export interface QuoteTemplate {
  id: string;
  name: string;
  type: TemplateType;
  description?: string;
  columns: any;
  isDefault: boolean;
  isPublic: boolean;
  organizationId?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  organization?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

// 템플릿 목록 조회
export function useTemplates(type?: TemplateType, organizationId?: string) {
  return useQuery<{ templates: QuoteTemplate[] }>({
    queryKey: ["templates", type, organizationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (organizationId) params.set("organizationId", organizationId);

      const response = await fetch(`/api/templates?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });
}

// 템플릿 조회