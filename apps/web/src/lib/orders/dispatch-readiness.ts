type VendorLike = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type OrderLike = {
  id?: string | null;
  orderNumber?: string | null;
  vendorId?: string | null;
  totalAmount?: number | null;
  items?: unknown[] | null;
  vendor?: VendorLike | null;
};

export type OrderDispatchReadiness = {
  supplierId: string | null;
  contactId: string | null;
  missingContactReason: "supplier_not_selected" | "missing_supplier_contact" | null;
  canSendToSupplier: boolean;
  sendBlockedReason: string | null;
  preview: {
    orderId: string | null;
    orderNumber: string | null;
    supplierName: string | null;
    supplierEmail: string | null;
    itemCount: number;
    totalAmount: number | null;
  };
};

export function buildOrderDispatchReadiness(order: OrderLike): OrderDispatchReadiness {
  const supplierId = order.vendorId ?? order.vendor?.id ?? null;
  const supplierEmail = order.vendor?.email?.trim() || null;
  const missingContactReason = !supplierId
    ? "supplier_not_selected"
    : !supplierEmail
      ? "missing_supplier_contact"
      : null;

  return {
    supplierId,
    contactId: supplierEmail ? supplierId : null,
    missingContactReason,
    canSendToSupplier: missingContactReason === null,
    sendBlockedReason: missingContactReason,
    preview: {
      orderId: order.id ?? null,
      orderNumber: order.orderNumber ?? null,
      supplierName: order.vendor?.name ?? null,
      supplierEmail,
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      totalAmount: order.totalAmount ?? null,
    },
  };
}

export function summarizeOrderDispatchReadiness(orders: OrderLike[]) {
  const readiness = orders.map(buildOrderDispatchReadiness);
  const firstBlocked = readiness.find((item) => !item.canSendToSupplier);
  const firstReady = readiness.find((item) => item.canSendToSupplier);
  const primary = firstBlocked ?? firstReady ?? null;

  return {
    supplierId: primary?.supplierId ?? null,
    contactId: primary?.contactId ?? null,
    missingContactReason: primary?.missingContactReason ?? (orders.length === 0 ? "order_not_created" : null),
    canSendToSupplier: readiness.length > 0 && readiness.every((item) => item.canSendToSupplier),
    sendableCount: readiness.filter((item) => item.canSendToSupplier).length,
    blockedCount: readiness.filter((item) => !item.canSendToSupplier).length,
  };
}
