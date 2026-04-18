/**
 * P1 Closeout — Recovery Diagnostics
 *
 * Detects crash/retry residue: stale locks, partial recovery state,
 * critical lock residue, incomplete canonical chains.
 */

import { detectStaleLocks } from "../persistence/lock-manager";
import { getRecoveryStatus } from "./recovery-coordinator";
import { getPersistenceAdapters } from "../persistence/bootstrap";
import { logBridgeFailure } from "../persistence/bridge-logger";
import { buildTimelineFromRepo } from "../observability/canonical-event-schema";

export interface RecoveryDiagnostic {
  category: "STALE_LOCK" | "PARTIAL_RECOVERY" | "LOCK_RESIDUE" | "INCOMPLETE_CANONICAL_CHAIN";
  reasonCode: string;
  detail: string;
  severity: "WARNING" | "ERROR";
}

export interface DiagnosticReport {
  timestamp: Date;
  diagnostics: RecoveryDiagnostic[];
  healthStatus: "CLEAN" | "RESIDUE_DETECTED" | "CRITICAL_RESIDUE";
}

export async function runRecoveryDiagnostics(
  correlationId?: string
): Promise<DiagnosticReport> {
  var diagnostics: RecoveryDiagnostic[] = [];
  var now = new Date();

  // 1. Stale recovery locks
  try {
    var staleLocks = await detectStaleLocks(0);
    var recoveryStale = staleLocks.filter(function (l) {
      return l.targetType === "INCIDENT_LOCKDOWN_RECOVERY";
    });
    for (var i = 0; i < recoveryStale.length; i++) {
      diagnostics.push({
        category: "STALE_LOCK",
        reasonCode: "STALE_RECOVERY_LOCK",
        detail: "stale recovery lock: " + recoveryStale[i].lockKey + " owner=" + recoveryStale[i].lockOwner,
        severity: "ERROR",
      });
    }
  } catch (_err) {
    // lock store unavailable
  }

  // 2. Partial recovery state — repository-first with memory fallback
  try {
    var adapters = getPersistenceAdapters();
    var activeRecord = await adapters.recoveryRecord.findActiveRecovery();
    if (activeRecord) {
      diagnostics.push({
        category: "PARTIAL_RECOVERY",
        reasonCode: "RECOVERY_IN_PROGRESS_WITHOUT_COMPLETION",
        detail: "recovery " + activeRecord.recoveryId + " in state " + activeRecord.recoveryState + " without completedAt (source=REPOSITORY)",
        severity: "WARNING",
      });
    }
  } catch (_repoErr) {
    // Repository unavailable — fallback to memory shim
    try {
      var record = getRecoveryStatus();
      if (record) {
        var terminalStates = ["RECOVERY_RESTORED", "RECOVERY_FAILED", "RECOVERY_ESCALATED"];
        if (terminalStates.indexOf(record.currentState) === -1 && !record.completedAt) {
          logBridgeFailure("recovery-diagnostics", "PARTIAL_RECOVERY:fallback", "using memory shim");
          diagnostics.push({
            category: "PARTIAL_RECOVERY",
            reasonCode: "RECOVERY_IN_PROGRESS_WITHOUT_COMPLETION",
            detail: "recovery " + record.recoveryId + " in state " + record.currentState + " without completedAt (source=MEMORY_FALLBACK)",
            severity: "WARNING",
          });
        }
      }
    } catch (_memErr) {
      // coordinator unavailable
    }
  }

  // 3. Critical lock residue (CANONICAL_BASELINE or AUTHORITY_LINE stale)
  try {
    var allStale = await detectStaleLocks(0);
    var criticalStale = allStale.filter(function (l) {
      return l.targetType === "CANONICAL_BASELINE" || l.targetType === "AUTHORITY_LINE";
    });
    for (var j = 0; j < criticalStale.length; j++) {
      diagnostics.push({
        category: "LOCK_RESIDUE",
        reasonCode: "CRITICAL_LOCK_RESIDUE",
        detail: "critical stale lock: " + criticalStale[j].lockKey + " type=" + criticalStale[j].targetType,
        severity: "ERROR",
      });
    }
  } catch (_err) {
    // lock store unavailable
  }

  // 4. Incomplete canonical chain
  if (correlationId) {
    try {
      var timeline = await buildTimelineFromRepo(correlationId);
      if (timeline.reconstructionStatus === "BROKEN_CHAIN" && timeline.orderedEvents.length > 0) {
        diagnostics.push({
          category: "INCOMPLETE_CANONICAL_CHAIN",
          reasonCode: "CANONICAL_CHAIN_BROKEN",
          detail: "broken chain for correlationId=" + correlationId + " missing=" + timeline.missingHops.join(","),
          severity: "ERROR",
        });
      }
    } catch (_err) {
      // canonical module unavailable
    }
  }

  // Determine health status
  var hasError = diagnostics.some(function (d) { return d.severity === "ERROR"; });
  var hasWarning = diagnostics.some(function (d) { return d.severity === "WARNING"; });

  var healthStatus: "CLEAN" | "RESIDUE_DETECTED" | "CRITICAL_RESIDUE";
  if (hasError) {
    healthStatus = "CRITICAL_RESIDUE";
  } else if (hasWarning) {
    healthStatus = "RESIDUE_DETECTED";
  } else {
    healthStatus = "CLEAN";
  }

  return {
    timestamp: now,
    diagnostics: diagnostics,
    healthStatus: healthStatus,
  };
}
