fix(sourcing) §11.367-2 #mobile-quote-bar-cta-clip — 모바일 소싱 견적 바 1차 CTA 잘림 해소 (호영님 P-라이브 2026-06-05)

호영님 spec(실기기 캡처): 모바일 소싱(/app/search) 하단 견적 바에서 "견적 요청"
버튼이 화면 밖으로 잘림("견적 [요…]").

root cause: 견적 바 행의 우측 그룹·가격 텍스트가 모두 shrink-0 + 가격 텍스트
whitespace-nowrap("견적 후 확정 · N건 가격 미정") → 좁은 폭에서 아무것도 안 줄어
가로 overflow → 최우측 CTA 가 잘림.

Fix(search/page.tsx 견적 바, 2곳):
- 우측 그룹: shrink-0 → min-w-0 (그룹 shrink 허용)
- 가격 텍스트(quote-bar-total): shrink-0 whitespace-nowrap → min-w-0 truncate
  (우선순위 낮은 가격이 먼저 말줄임)
- 🗑·견적요청 CTA 는 shrink-0 유지 → 절대 잘리지 않음 (§11.311 정합)

canonical truth/동작 불변(클래스만). dead button·no-op 0.

production effect: 360~375px 실기기에서 견적 요청 CTA 항상 완전 노출, 가격 텍스트 말줄임.

Out of scope: 비교 바 동일패턴 예방 / 터치타깃(h-8→44px) — 별도.

Rollback: search/page.tsx 2-class revert.
