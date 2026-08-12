# UI Consistency Guide

BioInsight Lab v3.8의 디자인 일관성 가이드입니다.

## 📐 Spacing Standards

### Padding
```tsx
// Card 내부
className="p-4"

// Table Cell
className="p-3"

// Section/Content
className="px-4 py-6"

// Header
className="px-6 py-4"
```

### Gap
```tsx
// 기본 Gap (flex/grid)
className="gap-4"

// 작은 Gap (인라인 요소)
className="gap-2"

// 큰 Gap (섹션 사이)
className="gap-6"
```

## 🎨 Container Styles

### Card
```tsx
className="bg-white border border-slate-200 shadow-sm"
```

### Table Container
```tsx
className="bg-white border border-slate-200 shadow-sm"
```

### Sidebar
```tsx
className="w-64 bg-white border-r border-slate-200 min-h-screen"
```

## 📱 Mobile Responsiveness

### Table Wrapper
테이블이 포함된 모든 페이지는 모바일 스크롤을 위해 wrapper를 추가:

```tsx
<div className="overflow-x-auto">
  <Table>
    {/* ... */}
  </Table>
</div>
```

### Grid Responsive
```tsx
// 카드 그리드
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// Stats Cards
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
```

### Button Groups (Mobile)
```tsx
// 모바일에서 세로 배치
className="flex flex-col sm:flex-row gap-3"
```

## 🎭 Empty States

### 사용법
```tsx
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

<EmptyState
  icon={FileText}
  title="항목이 없습니다"
  description="새로운 항목을 추가해보세요."
  action={<Button>항목 추가</Button>}
/>
```

### 공통 메시지
```tsx
import { EMPTY_STATES } from "@/lib/constants/ui";

// 검색 결과 없음
EMPTY_STATES.NO_RESULTS

// 항목 없음
EMPTY_STATES.NO_ITEMS

// 요청 없음
EMPTY_STATES.NO_REQUESTS
```

## ⏳ Loading States

### Skeleton Loader
```tsx
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

// Card 타입
<LoadingSkeleton type="card" count={3} />

// Table 타입
<LoadingSkeleton type="table" count={5} />

// List 타입
<LoadingSkeleton type="list" count={4} />
```

### Spinner
```tsx
import { Loader2 } from "lucide-react";

<div className="flex items-center justify-center py-12">
  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
</div>
```

## 📝 Text & Typography

### Heading
```tsx
// Page Title
className="text-xl font-bold text-slate-900"

// Section Title
className="font-semibold text-slate-900"

// Card Title
className="font-semibold text-slate-900 text-sm"
```

### Body Text
```tsx
// Primary
className="text-sm text-slate-900"

// Secondary
className="text-sm text-slate-600"

// Muted
className="text-xs text-slate-500"
```

## 🎯 Interactive Elements

### Button Sizes
```tsx
// Default
<Button size="default">버튼</Button>

// Small (테이블 액션)
<Button size="sm">액션</Button>

// Large (Primary CTA)
<Button size="lg">시작하기</Button>
```

### Badge Variants
```tsx
// Status
<Badge variant="default">활성</Badge>
<Badge variant="secondary">대기</Badge>
<Badge variant="destructive">오류</Badge>
<Badge variant="outline">정보</Badge>
```

## 🚨 Error Handling

### Toast Messages
```tsx
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/lib/constants/ui";

// Success
toast({
  title: "성공",
  description: SUCCESS_MESSAGES.SAVED,
});

// Error
toast({
  title: "오류",
  description: ERROR_MESSAGES.GENERIC,
  variant: "destructive",
});
```

### No Console.log in Production
❌ 프로덕션 코드에서 사용 금지:
- `console.log()`
- `console.error()` (사용자 에러 처리용)
- `console.warn()`

✅ 대신 사용:
- Toast notifications
- Error boundaries
- Logging service (for API routes)

## 🎨 Color System

### Text Colors
```tsx
// Primary text
text-slate-900

// Secondary text
text-slate-600

// Muted text
text-slate-500

// Light text (on dark bg)
text-slate-50
```

### Background Colors
```tsx
// Page background
bg-slate-50

// Card/Panel
bg-white

// Sidebar (Admin)
bg-slate-900

// Hover state
hover:bg-slate-50
```

### Border Colors
```tsx
// Default
border-slate-200

// Hover
hover:border-slate-300

// Focus
focus:border-blue-500
```

## 📦 Component Import Order

```tsx
// 1. React & Next.js
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// 2. External libraries
import { useQuery } from "@tanstack/react-query";

// 3. Internal UI components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// 4. Feature components
import { ProductCard } from "@/components/search/product-card";

// 5. Hooks & Utils
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// 6. Icons
import { Search, FileText } from "lucide-react";

// 7. Types
import type { Product } from "@/types";
```

## ✅ Checklist

새로운 페이지/컴포넌트 추가 시:

- [ ] Spacing 표준 (p-4, gap-4) 준수
- [ ] Empty State 추가
- [ ] Loading State (Skeleton/Spinner) 추가
- [ ] Mobile responsive (sm:, md:, lg: breakpoints)
- [ ] Table에 overflow-x-auto 적용
- [ ] console.log 제거
- [ ] Toast로 에러 처리
- [ ] 일관된 색상 사용 (slate 계열)
- [ ] shadcn/ui 컴포넌트 사용

