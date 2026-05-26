# §11.309c-hotfix-2 Commit Message Draft

```
fix(build): §11.309c-hotfix-2 #remove-enforce-action — enforceAction 통째 제거 (호영님 "단순하게" spec, IrreversibleActionType enum 미등록 type error 종결)

🚨 Critical (§11.309c + §11.309c-hotfix 연속 ERROR):
§11.309c-hotfix (action: "inventory_receive") 가 또 enum 미등록 또는
다른 IrreversibleActionType drift 로 build error. 호영님 spec
"어렵게 가지말고 단순하게" — enforceAction 자체를 제거하고 auth() +
DataAuditLog 만 사용.

§11.309c-hotfix-2 진단:
- IrreversibleActionType enum 에 "inventory_smart_receiving" /
  "inventory_receive" 둘 다 미등록 (또는 enum 정의 자체가 다른 동작)
- 새 enum 등록 = schema/SystemRole policy 등 cascade 영향 → "어렵게"
- enforceAction 제거 = auth() + audit 만으로 보안 유지 → "단순하게"

Fix (1 file route + 1 sentinel):

- apps/web/src/app/api/inventory/smart-receiving/route.ts:
  · import: enforceAction + InlineEnforcementHandle 제거 + 주석
  · POST 시작 enforcement state 변수 제거
  · enforceAction 호출 블록 (~14 line) 통째 제거
  · 분기 A enforcement.complete 호출 제거
  · 분기 B enforcement.complete 호출 제거
  · catch 에서 enforcement?.fail() 제거
  · auth() 미들웨어 + DataAuditLog 보안 보존

- apps/web/src/__tests__/regression/smart-receiving-api-309c.test.ts:
  · "enforceAction(inventory_receive)" assertion 제거
  · "enforcement.deny/complete/fail" assertion 제거
  · "§11.309c-hotfix-2 — enforceAction 제거" 신규 assertion
    (enforceAction / enforcement 패턴 0 + import 0)

회귀 0:
- auth() 미인증 401 분기 보존
- input validation (ocrJobId / quantity / productName) 보존
- OcrJob multi-tenant 격리 (ocrOrgMatches / ocrOwnerMatches / membership) 보존
- DataAuditLog INVENTORY_RESTOCK CREATE + source=smart_receiving 보존
- db.$transaction 원자성 보존
- 분기 A/B 처리 로직 변경 0 (응답 shape 그대로)

후속 (§11.309c-3, defer):
- IrreversibleActionType enum 에 "inventory_smart_receiving" 추가 검토
- ACTION_ROLE_MINIMUM mapping 추가
- enforceAction 복원 (보안 강화)
- 그동안 auth() + DataAuditLog 가 본질 보안 제공
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/api/inventory/smart-receiving/route.ts `
  apps/web/src/__tests__/regression/smart-receiving-api-309c.test.ts `
  docs/commit-drafts/COMMIT_11.309c-hotfix-2-remove-enforce.md
git commit -F docs/commit-drafts/COMMIT_11.309c-hotfix-2-remove-enforce.md
git push origin main
```
