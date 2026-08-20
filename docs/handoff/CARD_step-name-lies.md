# §step-name-lies — 스텝 이름이 `(block)` 인데 기본값이 advisory 다

**등재 2026-08-19** · 게이트 기준선 측정 중 발견

## 실측

```
워크플로   - name: Run LabAxis API Orphan Caller Guard (block)
             env: LABAXIS_API_ORPHAN_CALLER_BLOCK: "1"
스크립트   if [ "${LABAXIS_API_ORPHAN_CALLER_BLOCK:-0}" = "1" ]; then exit 1
           else "(advisory mode …)" ; exit 0
```

**같은 스크립트가 두 결과를 낸다.** 로컬 실행은 advisory(exit 0), CI 는 block(exit 1).
스텝 이름의 `(block)` 은 **워크플로가 env 를 설정할 때만** 참이다.

🛑 실제로 오독이 났다: 로컬 측정에서 `5건 · exit 0` 을 보고 "통과" 로 기록할 뻔했다.
   CLAUDE.md §"러너 기준을 병기한다" 를 따라 조건을 같이 적어서 갈렸다 —
   **조항이 실제로 결함을 막은 사례**다.

## 같은 형태를 이 세션에서 이미 만났다

```
"발주 생성" 화면        Order 를 안 만든다 (PurchaseRecord 만)
"(block)" 스텝 이름     기본값은 advisory
"전면 제거" 커밋 제목    본문은 섹션 2개 unmount
```

이름·제목이 동작보다 넓다. 읽는 사람은 이름을 먼저 본다.

## 처방 후보

```
기본값을 block 으로 뒤집고 advisory 를 명시 opt-in 으로
  LABAXIS_*_ADVISORY=1 일 때만 exit 0, 기본은 exit 1
→ 이름과 동작이 어긋날 여지가 없어진다
🛑 다만 로컬 실행이 즉시 RED 가 되므로 **기준선 기록 이후에** 한다
   (baselines/gate-scripts-2026-08-19.md 로 이미 충족)
```

⚠️ 대상 2개: `check-api-orphan-caller.sh` · `check-no-tailwind-dark-class.sh`
   (둘 다 CI 가 env 로 block 을 켠다). advisory 2개는 `CARD_ci-advisory-steps.md` 소관 —
   그쪽은 CI 도 env 를 안 켜므로 성격이 다르다.

## 관련

- `CARD_ci-advisory-steps.md` — advisory 가 정당한가(정책)
- 이 카드 — 이름이 동작과 어긋나는가(표기)
- 두 카드는 겹치지 않는다. 하나는 "통과시킬지", 하나는 "뭐라고 부를지" 다.
