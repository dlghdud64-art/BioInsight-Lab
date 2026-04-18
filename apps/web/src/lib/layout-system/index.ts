/**
 * layout-system/index.ts
 *
 * Multi-Layout Workbench / Live Operations Surface
 *
 * page-per-feature → work-mode-based layout system 전환.
 * 5가지 작업 모드 레이아웃 + 공통 rail + live surface.
 *
 * @module layout-system
 */

export {
  type WorkMode,
  type WorkModeDefinition,
  type PaneStructure,
  type PaneRole,
  type ScreenMapping,
  WORK_MODE_DEFINITIONS,
  SCREEN_MAPPINGS,
  resolveWorkMode,
} from './work-mode-taxonomy';

export {
  type RailRole,
  type RailDefinition,
  type RailZone,
  type RailComposition,
  type RailState,
  RAIL_DEFINITIONS,
  DEFAULT_RAIL_COMPOSITION,
  INITIAL_RAIL_STATE,
} from './rail-system';

export {
  type FreshnessLevel,
  type FreshnessState,
  type FreshnessDisplay,
  type RefreshCadence,
  type LiveUpdateScope,
  type LiveUpdateRule,
  type StaleWarning,
  classifyFreshness,
  getFreshnessDisplay,
  REFRESH_CADENCE_BY_MODE,
  LIVE_UPDATE_RULES,
  STALE_WARNING_RULES,
} from './live-surface';

export {
  type ShellSlot,
  type ShellTemplate,
  type QueueRowSlots,
  type SummaryPillSlots,
  SHELL_TEMPLATES,
  SLOT_BASE_CLASSES,
  DEFAULT_QUEUE_ROW_SLOTS,
  DEFAULT_SUMMARY_PILL_SLOTS,
} from './layout-shells';

export {
  type InteractionSurface,
  type SurfaceDefinition,
  type ReturnBehavior,
  type ParentRefreshMode,
  SURFACE_DEFINITIONS,
  RIGHT_RAIL_RULES,
  WORK_WINDOW_RULES,
  FULL_DETAIL_RULES,
} from './interaction-surfaces';

export {
  type WorkWindowSlots,
  type WorkWindowPhase,
  type WorkWindowState,
  type ParentContext,
  type LaunchTrigger,
  type LaunchRule,
  type ActionComplexity,
  type TaskSurfaceMapping,
  type PriorityTarget,
  DEFAULT_WORK_WINDOW_SLOTS,
  INITIAL_WORK_WINDOW_STATE,
  LAUNCH_RULES,
  COMPLEXITY_SURFACE_MAP,
  TASK_SURFACE_MAPPINGS,
  RETURN_RULES,
  REFRESH_RULES,
  WORK_WINDOW_LAYOUT,
  PRIORITY_TARGETS,
} from './work-window-system';
