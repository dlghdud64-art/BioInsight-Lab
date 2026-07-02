# 모바일 리디자인 목업본 (prototype-first)

호영님 2026-07-02 결정: 라이브 route 직접 수정 대신 **정적 HTML 목업본을 따로 보관**(리뷰용). canonical 데이터 wiring 위험 회피 후 통합.

## 파일
- `01_dashboard_mobile.html` — 메인 대시보드 (업로드 원본 그대로)
- `02_quotes_mobile.html` — 견적 관리 (**재해석 적용**)
- `03_inventory_mobile.html` — 재고 관리 (**재해석 적용**)
- `04_inbound_mobile.html` + `assets/inbound-mobile.jsx`·`css` — 입고 관리(문서 게이트 큐). React/babel, http 서빙 필요(file:// CORS). 제약 위반 없음(AI 배지·no-op 0).

## 적용된 재해석 (목업 정본이나 hard 제품원칙 우선 — 호영님 승인)
1. **02**: "지금 할 일 · AI 추천" → "지금 할 일 · 우선 처리". AI glow(radial)·pulse 애니메이션 제거. 온톨로지=contextual 우선 액션 배너(AI/chatbot badge 금지 원칙).
2. **03**: 우선순위 원칙 문서화 — expired lot(qty>0) 폐기 > critical-low 재발주 > 만료 임박 > 정상. 배너는 object-scoped(BCP)로 한정, 만료 임박 amber blocker 톤 유지.

## 통합(라이브 반영)은 별도
`docs/plans/PLAN_mobile-redesign.md` = 추후 라이브 route 통합 로드맵(현재 deferred). 통합 착수 시 surface별 최소 diff + sentinel + 승인 게이트.

## 참고: 라이브 통합 상태
이 4종 시안은 **이미 라이브 반영됨**(§web-mobile-reskin-fidelity, 2026-07-01 — 견적 7aea648·재고 2e73063c·입고 46fdd173·ce01fb02). 본 docs/mockups/ 는 라이브 디자인의 **레퍼런스 아카이브 + 재해석(02/03) 기록**.
