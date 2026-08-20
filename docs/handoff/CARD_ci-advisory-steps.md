# §ci-advisory-steps — advisory 스텝은 "RED 인데 통과" 다

**등재 2026-08-19** · §gate-script-silent-fail 처분 중 호영님 지적으로 분리

## 판정 — 선례가 아니라 **같은 부채**다

`labaxis-surface-guard.yml` 에 advisory 스텝이 2개 있다.
silent-fail 트랙에서 advisory 를 "선례" 로 인용하려 했으나 기각됐다:

```
advisory  = 위반을 찾았는데 exit 0 을 낸다
silent-fail = 위반을 못 찾았는데 exit 0 을 낸다
→ 원인은 다르고 **결과가 같다.** 둘 다 "체크는 초록인데 위반은 있다" 를 만든다
```

🛑 advisory 는 silent-fail 의 **워크플로 층 버전**이다.
   이 트랙에서 고치고 있는 바로 그것을 상위 층에서 재생산한다.

## 실측 (2026-08-19 · ripgrep 설치 직후)

```
check-api-surface-coverage       ══ 8 dead capability(ies) found ══   →  exit 0
                                 "(advisory mode — set LABAXIS_API_COVERAGE_BLOCK=1 to enforce)"
check-frontend-page-entry-coverage  미측정
```

**8건을 찾아놓고 통과시켰다.** 환경변수 하나로 block 전환이 되게 만들어뒀으나 아무도 안 켰다.

## 이 카드가 §gate-script-silent-fail 과 다른 점

```
silent-fail   검증이 대상에 안 닿았다        → 처방: "닿았음" 을 스스로 단언
advisory      검증이 닿았고 찾았는데 안 막았다 → 처방: **찾은 것을 통과시킬지 정한다**
```

후자는 기술 문제가 아니라 **정책 결정**이다. "점진적 도입" 이라는 의도는 정당했으나,
그 의도가 언제 끝나는지 적혀 있지 않아 무기한이 됐다(§11.60 등록 이후 계속 advisory).

## 착수 시 판정 (구현 전)

```
1  advisory 2개 각각의 위반 실측 — surface-coverage 8건 · page-entry-coverage 미측정
2  각각 판정:  (가) block 전환    위반을 먼저 처리해야 한다
              (나) 스텝 제거     안 막을 거면 초록을 만들지 말고 없앤다
              (다) 기한 명시     advisory 를 유지하되 종료일과 담당을 적는다
🛑 (다)를 고를 때만 advisory 가 정당하다. 기한 없는 advisory 는 "안 보는 체크" 가 된다.
   CI RED 시한부 조건과 같은 논리다 — 신호가 상시면 신호가 아니다.
```

## 관련

- `CARD_gate-script-silent-fail.md` — 원인은 다르고 결과가 같은 계열
- `CARD_suite-red-168.md` §범위 — 상시 RED 가 새 RED 를 묻는다
- 기준선: `baselines/gate-scripts-2026-08-19.md`
