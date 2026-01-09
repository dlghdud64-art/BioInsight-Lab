# Grant Integration Instructions

Order 생성 폼에 Grant 선택 기능을 추가하기 위한 수정 가이드입니다.

## 수정할 파일: `src/app/quotes/[id]/page.tsx`

### 1. Import 추가 (파일 상단)

```typescript
import { GrantSelector } from "@/components/grant-selector";
```

### 2. orderForm state 수정 (약 81번째 줄)

**기존:**
```typescript
const [orderForm, setOrderForm] = useState({
  expectedDelivery: "",
  paymentMethod: "",
  notes: "",
});
```

**변경 후:**
```typescript
const [orderForm, setOrderForm] = useState({
  grantId: "",
  expectedDelivery: "",
  paymentMethod: "",
  notes: "",
});
```

### 3. createOrderMutation 수정 (약 164-178번째 줄)

**기존:**
```typescript
mutationFn: async (orderData: {
  expectedDelivery?: string;
  paymentMethod?: string;
  notes?: string;
}) => {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId,
      expectedDelivery: orderData.expectedDelivery || undefined,
      notes: orderData.notes || (orderData.paymentMethod
        ? `결제 방식: ${orderData.paymentMethod}${orderData.notes ? `\n\n전달 사항:\n${orderData.notes}` : ""}`
        : orderData.notes || undefined),
    }),
  });
```

**변경 후:**
```typescript
mutationFn: async (orderData: {
  grantId?: string;
  expectedDelivery?: string;
  paymentMethod?: string;
  notes?: string;
}) => {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId,
      grantId: orderData.grantId || undefined,
      expectedDelivery: orderData.expectedDelivery || undefined,
      notes: orderData.notes || (orderData.paymentMethod
        ? `결제 방식: ${orderData.paymentMethod}${orderData.notes ? `\n\n전달 사항:\n${orderData.notes}` : ""}`
        : orderData.notes || undefined),
    }),
  });
```

### 4. 주문 다이얼로그에 GrantSelector 추가 (약 879-925번째 줄)

**paymentMethod Select 바로 다음에 추가:**

```typescript
<div className="space-y-2">
  <Label htmlFor="paymentMethod">
    결제 방식 <span className="text-muted-foreground text-xs">(선택)</span>
  </Label>
  <Select
    value={orderForm.paymentMethod}
    onValueChange={(value) =>
      setOrderForm({ ...orderForm, paymentMethod: value })
    }
  >
    {/* ... 기존 내용 ... */}
  </Select>
</div>

{/* 🆕 여기에 GrantSelector 추가 */}
<GrantSelector
  value={orderForm.grantId}
  onChange={(grantId) =>
    setOrderForm({ ...orderForm, grantId })
  }
  orderAmount={quoteData?.totalAmount || 0}
/>

<div className="space-y-2">
  <Label htmlFor="orderNotes">전달 사항 <span className="text-muted-foreground text-xs">(선택)</span></Label>
  {/* ... 기존 내용 ... */}
</div>
```

### 5. 주문 접수 버튼 onClick 수정 (약 942-947번째 줄)

**기존:**
```typescript
onClick={() => {
  createOrderMutation.mutate({
    expectedDelivery: orderForm.expectedDelivery || undefined,
    paymentMethod: orderForm.paymentMethod || undefined,
    notes: orderForm.notes || undefined,
  });
}}
```

**변경 후:**
```typescript
onClick={() => {
  createOrderMutation.mutate({
    grantId: orderForm.grantId || undefined,
    expectedDelivery: orderForm.expectedDelivery || undefined,
    paymentMethod: orderForm.paymentMethod || undefined,
    notes: orderForm.notes || undefined,
  });
}}
```

### 6. 다이얼로그 취소 시 state 초기화 수정 (약 930-935번째 줄)

**기존:**
```typescript
setOrderForm({
  expectedDelivery: "",
  paymentMethod: "",
  notes: "",
});
```

**변경 후:**
```typescript
setOrderForm({
  grantId: "",
  expectedDelivery: "",
  paymentMethod: "",
  notes: "",
});
```

## 완료 확인

모든 수정을 완료한 후:
1. 파일 저장
2. 개발 서버 재시작 (필요시)
3. 주문 요청 다이얼로그에서 "연구비 과제" 선택 옵션이 표시되는지 확인
4. Grant를 선택하여 주문 생성 테스트

## 주의사항

- GrantSelector 컴포넌트는 이미 생성되어 있습니다 (`src/components/grant-selector.tsx`)
- 백엔드 API는 이미 grantId를 처리할 수 있도록 수정되었습니다
- Grant 선택은 선택사항이며, 선택하지 않으면 기존 UserBudget이 사용됩니다
