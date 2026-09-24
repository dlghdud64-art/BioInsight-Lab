# QUEUE · 입고 문서 세트 판정 (필수문서 충족 여부)

- 상태: **미구현 · 제품 큐**
- 등록: 2026-09-24 (호영님 지시 — 「테스트 주석으로 끝내지 마십시오」)
- 필요 시점: **실주문 발송 구현 시** (발주 발송 전 문서 구비 확인)
- 관련 복원 지점: 발주 상세 본문 `c7796538` · 발송 워크벤치 `fe89d14c` 직전 · 오버레이 `96414c4e` 직전

---

## 왜 큐에 올리는가

이 판정은 **시드 세계에만 구현돼 있었다.** §po-seed-cutoff 2차(2026-09-24)에서 ops 시드 군집을
삭제하며 함께 사라졌고, 정본(`ReceivingDraft`) 축에는 **같은 판정이 없다.**

즉 "구현이 옮겨간 것" 이 아니라 **제품 요구사항 하나가 구현된 적 없이 사라진 것**이다.
발주 발송 전에 문서가 갖춰졌는지 확인하는 판정은 실제 구매 운영에 필요하다(호영님).
테스트 파일 주석에만 남기면 아무도 다시 찾지 못하므로 여기 적는다.

## 사라진 명제 (원문 · 삭제 전 구현)

`lib/ops-console/scenario-transition-runner.ts` — `deriveLineDocStatus` (삭제 커밋: 이 트랙의 시드 삭제 커밋)

```ts
export function deriveLineDocStatus(line: ReceivingLineReceiptContract): ReceivingDocumentStatus {
  if (line.documentStatus === 'not_required') return 'not_required';
  const lots = line.lotRecords;
  if (lots.length === 0) return line.documentStatus;
  const allCoa = lots.every((l) => l.coaAttached);
  const allMsds = lots.every((l) => l.msdsAttached);
  if (allCoa && allMsds) return 'complete';
  const anyDoc = lots.some((l) => l.coaAttached || l.msdsAttached || l.validationAttached || l.warrantyAttached);
  return anyDoc ? 'partial' : 'missing';
}
```

규칙을 말로 옮기면:

- 필수 세트 = **COA + MSDS** (라인의 모든 lot 이 둘 다 갖춰야 `complete`)
- 하나라도 붙어 있으면 `partial`, 아무것도 없으면 `missing`
- `not_required` 는 유지 (문서가 필요 없는 라인)
- lot 기록이 없으면 라인에 저장된 `documentStatus` 를 그대로 쓴다

검사하던 테스트(함께 은퇴): `lib/ops-console/__tests__/receiving-doc-attach-p2.test.ts`
  — 「COA+MSDS 모두 → complete · 일부 → partial · 무첨부 → missing · not_required 유지」
  — 「COA 첨부 후 MSDS 첨부하면 partial → complete」 · 「입력 그래프 불변」

## 지금 정본에는 무엇이 있는가 (2026-09-24 실측)

- `ReceivingDraft` 에는 문서 **목록**(`documents[]`)이 있고, 데스크톱 뷰모델이 그 목록으로
  「필수 조치」(COA 확보 등)를 만든다 — 그러나 **필수 세트 충족 여부를 판정하는 단일 함수는 없다.**
- 모바일 카드의 `missingDocs`(라인별 미첨부 문서 종류)는 입고안 계약에 그 필드가 없어 **빈 배열**이다
  (`lib/ops-console/mobile-receiving-from-drafts.ts` 자기 한계 3).

## 구현 시 확인할 것

1. 필수 세트의 정본을 정한다 — COA+MSDS 가 여전히 맞는지(품목 유형별로 다를 수 있다).
2. 판정 지점을 **한 곳**에 둔다(화면이 보여주는 수와 게이트가 판정하는 수가 같은 함수에서 나오도록).
3. 라인·lot 단위 축을 입고안 계약에 추가할지 결정한다(현재 없음 → `missingDocs` 가 비는 이유).
4. 발송 전 게이트로 쓸지, 표시만 할지 판정받는다(게이트면 fail-closed 아래 저장층도 함께 확인).
