fix(api): §11.309a ocrJobId comment-out — migration pending (build gate 해소)

InventoryRestock.ocrJobId 필드가 Prisma schema 에는 있으나 migration 미적용.
pre-push next build 타입 에러 해소 위해 ocrJobId 라인 주석 처리.

TODO: prisma migrate deploy 후 주석 해제 (§11.309c-3 scope).

Production effect: OCR 입고 기록 시 ocrJobId 저장 안 됨 (extractedData 는 유지).
Rollback path: git revert + git push.