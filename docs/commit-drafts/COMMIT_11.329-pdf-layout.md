fix(pdf): §11.329 — 견적서/발주서 PDF 레이아웃 정정 (Pretendard swap 후 잘림/어긋남) (호영님 P0, 2026-05-30)

- contentWidth(499) 상수화 + 컬럼 좌표 COL 객체 정의 (하드코딩 제거).
- 표 헤더/데이터 width + right-align(수량/가격), 요청사유 full-width, 푸터 center, 페이지 넘김(ensureSpace).
- quote-request + po 동일 패턴. Pretendard 폰트(§11.326 lineage) 보존.
