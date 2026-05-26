# §11.309a-hotfix Commit Message Draft (ParsedQuoteVendor shape 정합)

```
fix(build): §11.309a-hotfix #parsed-quote-vendor-shape — claude-structurer invoice 분기 vendor 객체 shape 정합 (Vercel TS type error 2 deployment ERROR 해결)

🚨 Critical (§11.309a + §11.306c 2 deployment 연속 ERROR):
호영님이 §11.309a + §11.306c push 후 Vercel 2 deployment 모두 같은
type error 로 fail (§11.306c 는 §11.309a 위에 쌓여 같은 root cause).

Vercel build log:
  ./src/lib/ocr/claude-structurer.ts:287:35
  Type error: Object literal may only specify known properties,
  and 'businessNumber' does not exist in type 'ParsedQuoteVendor'.

진단:
§11.309a 에서 structureInvoiceWithClaude 함수 의 vendor fallback 객체
shape 가 gemini-quote-parser.ts:64-69 의 실제 ParsedQuoteVendor type
정의와 불일치.

실제 ParsedQuoteVendor (gemini-quote-parser.ts:64-69):
  - name: string | null
  - contactPerson: string | null
  - email: string | null
  - phone: string | null

§11.309a 작성 시 잘못 사용한 shape:
  - name: string (빈 string)        ← name 은 nullable
  - businessNumber: null            ← type 에 부재
  - contactEmail: null              ← email 이 정확
  - contactPhone: null              ← phone 이 정확

Fix (1 file, 2 위치 + INVOICE_STRUCTURE_PROMPT vendor block):

- apps/web/src/lib/ocr/claude-structurer.ts:
  · INVOICE_STRUCTURE_PROMPT vendor JSON shape 정합:
    - "name": null 허용 명시 (이전 empty string)
    - "businessNumber" 제거 → "contactPerson" 추가
    - "contactEmail" → "email"
    - "contactPhone" → "phone"
  · structureInvoiceWithClaude vendor fallback (line 287) 정합:
    - name: null / contactPerson: null / email: null / phone: null
  · structureInvoiceWithClaude catch fallback (line 293) 정합:
    - 동일 shape

회귀 0:
- ParsedQuoteVendor type 정의 변경 0 (gemini-quote-parser.ts 보존)
- structureWithClaude (라벨) 함수 변경 0
- ClaudeStructureInvoiceResult interface 변경 0
- 기존 §11.290 family OcrJob / OcrResult / image-storage 변경 0
- §11.309a sentinel (smart-receiving-schema-claude-invoice-309a) 회귀 0
  (vendor shape 검증은 sentinel 외 type checker 가 강제)

호영님 production effect:
1. Vercel build PASS — type error 해소
2. §11.309a (schema + Claude invoice 분기) production 활성
3. §11.306c (재고 위험 dot 제거) production 활성 (§11.309a 위에 쌓여 동시 해결)
4. Anthropic API 호출 0 (caller 추가 §11.309c 까지 cost 0)

Rollback path: git revert <SHA>
- 1 file 복원 — vendor fallback shape 회귀 → 다시 type error
```

## Push

```powershell
git add apps/web/src/lib/ocr/claude-structurer.ts `
  docs/commit-drafts/COMMIT_11.309a-hotfix-vendor-shape.md

git commit -F docs/commit-drafts/COMMIT_11.309a-hotfix-vendor-shape.md
git push origin main
```

## Production smoke

1. Vercel build PASS (Failed to compile 0)
2. §11.309a + §11.306c 동시 production 활성
3. /dashboard/inventory 모바일 view "위험" Badge 좌측 dot 0 (§11.306c)
4. /dashboard/inventory + /dashboard 진입점 [📷 스마트 입고] 정상 동작 (§11.308a)
5. DB schema InventoryRestock 새 컬럼 (ocrJobId / extractedData) 존재 (§11.309a)
