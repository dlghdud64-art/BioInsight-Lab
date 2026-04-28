#!/usr/bin/env bash
#
# LabAxis Inventory Model Guard (§11.58 / #inventory-model-consolidation Phase 4)
#
# `UserInventory` 모델은 LabAxis ontology 상 "legacy receipt log"이며,
# 운영자 시야의 inventory master는 `ProductInventory` 입니다.
# Phase 1+2+3 으로 application code 의 모든 surface 를 ProductInventory
# 로 정렬한 뒤, 신규 `db.userInventory.*` 호출이 회귀하지 않도록 차단합니다.
#
# UserInventory 모델 자체 drop 은 별도 트랙
# (`#userInventory-schema-drop`, operator-shell migration trail) 이며,
# schema 가 살아있는 동안 application code 회귀를 막기 위한 가드입니다.
#
# 차단:
#   db.userInventory.findMany(...)
#   db.userInventory.create(...)
#   db.userInventory.upsert(...)
#   db.userInventory.delete(...)
#   tx.userInventory.* (transaction client)
#
# 허용:
#   - prisma/schema.prisma     ← 모델 정의 자체
#   - apps/web/prisma/migrations/**  ← 과거 마이그레이션
#   - 본 스크립트 자체 (메타 주석)
#
# Usage: scripts/check-no-userinventory-usage.sh
# Exit code: 0 = clean, 1 = violations found
#
# Local equivalent: 없음 (CI block only — pre-commit 은 dashboard scope 한정)

set -euo pipefail

VIOLATIONS=0
SRC_DIR="apps/web/src"

echo "═══ LabAxis UserInventory Usage Guard (§11.58) ═══"
echo ""

# 차단 패턴: (db|tx|prisma|client).userInventory.<method>
# Prisma client 호출 형태이므로 . userInventory . 형식만 잡으면 됨.
HITS=$(rg -n -t ts \
  '\b(db|tx|prisma|client)\.userInventory\.' \
  "$SRC_DIR" 2>/dev/null || true)

if [ -n "$HITS" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    REL_PATH=$(echo "$line" | sed "s|^${SRC_DIR}/||" | cut -d: -f1)
    LINE_NUM=$(echo "$line" | cut -d: -f2)
    SNIPPET=$(echo "$line" | cut -d: -f3- | sed 's/^[[:space:]]*//')
    echo "  ⛔ ${REL_PATH}:${LINE_NUM}"
    echo "       ${SNIPPET}"
    VIOLATIONS=$((VIOLATIONS + 1))
  done <<< "$HITS"
fi

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "══ ${VIOLATIONS} violation(s) found ══"
  echo ""
  echo "UserInventory 는 legacy receipt log 입니다."
  echo "운영자 시야의 inventory master 는 ProductInventory 를 사용하세요."
  echo ""
  echo "마이그레이션 가이드:"
  echo "  db.userInventory.findMany({ where: {…} })"
  echo "    → db.productInventory.findMany({ where: {…}, include: { product: true } })"
  echo ""
  echo "  db.userInventory.create({ data: { productName, quantity, … } })"
  echo "    → DELIVERED transition 에서 runDeliveryInventorySync({ tx, orderId })"
  echo "       (apps/web/src/lib/inventory/delivery-sync.ts)"
  echo ""
  echo "See ADR-002 §11.56 (PO delivery wiring) / §11.58 (#inventory-model-consolidation)."
  echo ""
  exit 1
else
  echo "✅ No db.userInventory.* usage detected in apps/web/src/**"
  exit 0
fi
