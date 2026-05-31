fix(search): §11.335 #sourcing-search-catno — 소싱 검색 모바일 placeholder Cat.No 통일 (호영님 P1, 2026-06-01)

호영님 P1 §11.335 (GREEN) — 소싱 검색 Cat.No 지원. audit 결과 검색 인덱스·
카드 표시는 이미 구현됨 → 실제 gap = 모바일 검색 placeholder 누락뿐.

Truth Reconciliation (sandbox audit, §11.318/§11.326 표면불일치 학습 적용):
- SPEC 주장 "Cat.No 미지원/미표시"는 현재 sandbox 기준 부정확 (호영님 스크린샷 = 이전 배포본 가능성).
- 실제 상태:
  · 클라 필터(search/page.tsx:561) haystack 에 product.catalogNumber 이미 포함.
  · 서버 autocomplete(api/search/autocomplete:62) catalogNumber contains 검색 이미 존재.
  · 제품 카드(sourcing-result-row.tsx:154) `Cat. ${catalogNumber}` 이미 렌더 (없으면 미표시 = §11.318 환각 방지 정합).
  · 데스크탑 검색 placeholder(2978) "시약명·CAS·제조사·카탈로그 번호" 이미 통일.
- 유일 gap: 모바일 검색 placeholder(2734) "시약명·CAS·제조사" — 카탈로그 번호 누락.

Fix (search/page.tsx):
- 모바일 검색 placeholder "시약명·CAS·제조사" → "시약명·CAS·제조사·카탈로그 번호"
  (데스크탑·재고 검색과 통일).

canonical truth / 제약:
- 검색 로직·카드 렌더 변경 0 (이미 catalogNumber 지원). placeholder 텍스트만.
- §11.318 환각 방지 보존 (Cat.No 없는 제품은 미표시, 추측 X).
- §11.326 데이터모델 무관 (Cat.No = Product 마스터 필드, packSize 별개).

production effect:
- 모바일 소싱 검색창이 카탈로그 번호 검색 가능함을 명시 (기능은 이미 동작).
- 소싱 ↔ 재고 검색 placeholder 문구 일관.

검증 (sandbox):
- sentinel sourcing-search-catno-335.test.ts: placeholder 2+ 통일 + 옛 placeholder 제거 +
  클라/서버 catalogNumber 매칭 보존 + 카드 Cat. 렌더 보존. 전체 PASS.
- 파일 무결 brace/eof balanced (3081줄, HEAD 복원 후 Python 원자 치환 — Edit truncation 회피).
- 빌드/타입체크 = 호영님 env.

Out of Scope:
- 검색 인덱스/카드 신규 구현 (이미 존재). 본 batch 는 placeholder 통일만.
- Cat.No 정확일치 우선순위 랭킹 (별도 검토 — 현재 contains 부분일치).

Rollback path: git revert <SHA>
- placeholder 문구 원복.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/__tests__/regression/sourcing-search-catno-335.test.ts `
  docs/commit-drafts/COMMIT_11.335-sourcing-search-catno.md
git commit -F docs/commit-drafts/COMMIT_11.335-sourcing-search-catno.md
git push origin main
```

## Production smoke (호영님 env)
1. 모바일 소싱 검색창 placeholder 에 "카탈로그 번호" 노출 확인.
2. Cat.No(예: 25200-056) 검색 → 해당 제품 카드 노출 확인.
3. 제품 카드에 "Cat. 25200-056" 표시 확인.
4. Cat.No 없는 제품 → Cat. 미표시(환각 0) 확인.
