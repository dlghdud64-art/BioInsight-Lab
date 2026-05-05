-- #mobile-push-notification Phase 1 server — Device 모델 추가
--
-- mobile push token 저장. mobile (Expo) 가 registerForPushNotifications 후
-- /api/devices/register POST 호출 → 동일 token 재등록 시 upsert.

CREATE TABLE "Device" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "pushToken"  TEXT NOT NULL,
  "platform"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Device_pushToken_key" ON "Device"("pushToken");
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

ALTER TABLE "Device"
  ADD CONSTRAINT "Device_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
