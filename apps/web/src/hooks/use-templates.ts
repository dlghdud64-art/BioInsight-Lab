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
export function useTemplate(id: string) {
  return useQuery<{ template: QuoteTemplate }>({
    queryKey: ["template", id],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${id}`);
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
    enabled: !!id,
  });
}

// 템플릿 생성
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: TemplateType;
      description?: string;
      columns: any;
      organizationId?: string;
      isDefault?: boolean;
      isPublic?: boolean;
    }) => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

// 템플릿 수정
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      columns?: any;
      isDefault?: boolean;
      isPublic?: boolean;
    }) => {
      const response = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update template");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["template", variables.id] });
    },
  });
}

// 템플릿 삭제
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}



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
export function useTemplate(id: string) {
  return useQuery<{ template: QuoteTemplate }>({
    queryKey: ["template", id],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${id}`);
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
    enabled: !!id,
  });
}

// 템플릿 생성
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: TemplateType;
      description?: string;
      columns: any;
      organizationId?: string;
      isDefault?: boolean;
      isPublic?: boolean;
    }) => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

// 템플릿 수정
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      columns?: any;
      isDefault?: boolean;
      isPublic?: boolean;
    }) => {
      const response = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update template");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["template", variables.id] });
    },
  });
}

// 템플릿 삭제
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}



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
export function useTemplate(id: string) {
  return useQuery<{ template: QuoteTemplate }>({
    queryKey: ["template", id],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${id}`);
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
    enabled: !!id,
  });
}

// 템플릿 생성
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: TemplateType;
      description?: string;
      columns: any;
      organizationId?: string;
      isDefault?: boolean;
      isPublic?: boolean;
    }) => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

// 템플릿 수정
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      columns?: any;
      isDefault?: boolean;
      isPublic?: boolean;
    }) => {
      const response = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update template");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["template", variables.id] });
    },
  });
}

// 템플릿 삭제
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}





