/**
 * §11.229b #mobile-vendor-request-modal — 호영님 P0 모바일 운영 (send-only scope).
 *
 * useVendorRequestMutation — 모바일에서 견적을 vendor 에게 발송하는 mutation.
 *   server endpoint POST /api/quotes/[id]/vendor-requests (§11.229c 정합).
 *   body { vendors: [{ email, name? }], message?, expiresInDays?: number }.
 *   기존 line 248-268 Alert.alert + setTimeout fake success 의 진정한 wiring.
 *
 * canonical truth lock:
 *   - 서버 zod CreateVendorRequestsSchema (vendors min(1), email TLD blacklist).
 *   - vendor email 검증은 서버 책임 (모바일 client 0 validation).
 *   - onSuccess 시 quote / quotes / dashboard-summary invalidate.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api";

interface VendorRequestInput {
  quoteId: string;
  vendors: Array<{ email: string; name?: string }>;
  message?: string;
  expiresInDays?: number;
}

interface VendorRequestResponse {
  success: boolean;
  sentCount?: number;
  failures?: Array<{ email: string; reason: string }>;
}

export function useVendorRequestMutation() {
  const qc = useQueryClient();
  return useMutation<VendorRequestResponse, Error, VendorRequestInput>({
    mutationFn: async ({ quoteId, vendors, message, expiresInDays }) => {
      const res = await apiClient.post(`/api/quotes/${quoteId}/vendor-requests`, {
        vendors,
        message,
        expiresInDays: expiresInDays ?? 14,
      });
      return res.data;
    },
    onSuccess: (_, { quoteId }) => {
      // §11.229b — 견적 status PENDING → SENT 전환 자동 sync.
      //   quote-approval / quote / quotes / dashboard-summary 모두 갱신.
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["quote-approval", quoteId] });
    },
  });
}
