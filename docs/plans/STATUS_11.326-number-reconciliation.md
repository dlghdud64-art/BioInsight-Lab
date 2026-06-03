# §11.326 번호 정합 결정 (forward-only)

- **Status:** ✅ 결정 — 2026-06-01 (호영님 권장안 승인)
- **Type:** 거버넌스(번호 체계) 정합. 코드 변경 0.

## 배경
sandbox 내 §11.326 라벨이 두 의미로 혼용:
- **A. PDF 폰트/preferences 클러스터** — `PLAN_11.326-327-quote-pdf-preferences-403-cluster.md` + `COMMIT_11.326-phase2/3/4-*`(pdf-font-bundling / pdfkit-font-buffer).
- **B. 입고 데이터 모델** — `PLAN_11.326-phaseB-*` / `PLAN_11.326-receiving-packsize-*` + 코드 주석 수십 곳(LabelScannerModal / SmartReceivingScannerModal / inventory route / map-label-to-receiving) + sentinel docblock. **이미 prod migration(packSize/packUnit) applied + 다수 commit push 완료.**

## 충돌 평가 (사실)
- 두 트랙은 **파일·디렉토리 완전 분리**(PDF=`lib/*pdf*` / 입고=`inventory/*`). → git push 시 **머지 충돌 없음**. 혼동은 commit log 가독성 한정, 기능 리스크 0.
- B(입고)는 이미 §11.326으로 prod land. 소급 일괄 rename = 이미 push된 히스토리·migration 주석과 어긋남 → 오히려 추적성 악화.

## 결정 — 옵션 3 변형(forward-only)
- **과거 §11.326 라벨(A·B 모두) 그대로 유지** — 소급 rename 안 함.
- **앞으로의 입고 후속 트랙만 §11.328로 표기** — 호영님 이전 indication("입고 데이터 모델 → §11.328") 정합.
  - 단 직전 작업 `§11.326 v3 (po-mapping)`는 이미 §11.326 v3로 land/commit draft 작성됨 → 그대로 두되, **다음 입고 트랙부터 §11.328-xx** 사용.
- 본 채팅 PDF 폰트(A)는 활성 batch라 §11.326 유지.

## 실행
- 코드/PLAN/commit rename **없음**. 본 STATUS 문서가 단일 기준점.
- 향후 입고 관련 신규 SPEC = §11.328 시리즈로 시작.

## Rollback
- 문서 1개 추가뿐. revert = 파일 삭제.
