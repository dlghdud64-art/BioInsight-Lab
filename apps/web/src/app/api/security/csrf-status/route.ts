/**
 * CSRF Rollout Status API
 *
 * GET /api/security/csrf-status
 *
 * 현재 CSRF enforcement 상태를 반환합니다.
 * ops_admin 전용 — rollout 전환 전 상태 확인용.
 *
 * 반환값:
 * - mode: report_only | soft_enforce | full_enforce
 * - registry: exempt/highRisk 수량
 * - telemetry: 최근 위반 건수 (in-memory)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveCsrfRolloutMode } from '@/lib/security/csrf-contract';
import { getRegistryStats } from '@/lib/security/csrf-route-registry';
import { getSecurityEventSummary } from '@/lib/security/event-provenance-engine';

const ALLOWED_ROLES = new Set(['admin', 'ops_admin', 'ADMIN', 'OPS_ADMIN']);

export async function GET(_req: NextRequest) {
  // 인증 + ops_admin/admin 역할 확인
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const userRole = (session.user as any).role || '';
  if (!ALLOWED_ROLES.has(userRole)) {
    return NextResponse.json(
      { error: '이 정보에 접근할 권한이 없습니다' },
      { status: 403 },
    );
  }

  const resolution = resolveCsrfRolloutMode();
  const mode = resolution.mode;
  const registryStats = getRegistryStats();

  // Telemetry summary (in-memory, 서버 재시작 시 초기화)
  let telemetry = { total: 0, csrfEvents: 0 };
  try {
    telemetry = getSecurityEventSummary();
  } catch {
    // getSecurityEventSummary가 없으면 기본값 사용
  }

  return NextResponse.json({
    csrf: {
      mode,
      // 🛑 §csrf-mode-unrecognized — 모드만 보면 "설정이 먹었는지" 를 알 수 없다.
      //   recognized=false 면 env 에 값은 있는데 인식되지 않아 report_only 로 떨어진 것이다.
      //   (원문 값은 싣지 않는다 — Vercel 에 sensitive 로 보관된 값이다)
      envConfig: {
        present: resolution.envPresent,
        recognized: resolution.recognized,
      },
      registry: {
        exempt: registryStats.exempt,
        highRisk: registryStats.highRisk,
        exemptReasons: registryStats.exemptReasons,
      },
      telemetry,
      rolloutGuide: {
        current: mode,
        next: mode === 'report_only' ? 'soft_enforce' : mode === 'soft_enforce' ? 'full_enforce' : 'done',
        envVar: 'LABAXIS_CSRF_MODE',
        steps: [
          'env에서 LABAXIS_CSRF_MODE=soft_enforce 설정',
          '배포 후 /api/security/csrf-status로 모드 확인',
          'telemetry에서 csrf 위반 건수 모니터링 (24~48시간)',
          'false positive 없으면 full_enforce로 전환',
        ],
      },
    },
  });
}
