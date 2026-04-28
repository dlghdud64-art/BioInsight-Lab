-- §11.97 #user-approval-policy-schema-add
-- User 모델에 운영 정책 3 필드 추가:
-- approvalLimit (BigInt) — 단일 건 승인 한도 (KRW)
-- costCenter (String) — 기본 Cost Center 코드
-- defaultLocation (String) — 기본 입고 위치
--
-- settings 페이지 (§11.87) 의 "운영 정책 미설정" 3 항목 backing source.
-- admin 변경 surface 는 별도 트랙 (#admin-user-approval-policy-set-surface).

ALTER TABLE "User" ADD COLUMN "approvalLimit" BIGINT;
ALTER TABLE "User" ADD COLUMN "costCenter" TEXT;
ALTER TABLE "User" ADD COLUMN "defaultLocation" TEXT;
