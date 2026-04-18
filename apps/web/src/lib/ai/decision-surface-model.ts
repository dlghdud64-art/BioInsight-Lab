/**
 * Decision Surface Model — 3-option UI view-model + interaction state
 *
 * UI 규칙:
 * - option 클릭 = preview/focus only. 실제 commit은 별도 버튼.
 * - right rail = rationale/risk reference. chat 금지.
 * - bottom dock = operator commit. 자동 실행 금지.
 * - 3안이 성립 안 되면 surface 자체를 숨김. 1안만 남기기 금지.
 */

import type { DecisionOption, DecisionOptionSet, DecisionOptionFrame } from "./decision-option-set";

// ── Interaction state ──

export interface DecisionSurfaceInteraction {
  /** 현재 focus/preview 중인 option (선택 아님) */
  focusedOptionId: string | null;
  /** 운영자가 실제 commit한 option (기준안 설정 / 초안 반영) */
  committedOptionId: string | null;
  /** surface 자체 visible 여부 */
  visible: boolean;
  /** hidden 이유 */
  hiddenReason: DecisionSurfaceHiddenReason | null;
}

export type DecisionSurfaceHiddenReason =
  | "no_option_set"
  | "stale_context"
  | "insufficient_data" // 3안 불가
  | "sent"
  | "conflicted"
  | "dismissed";

// ── Surface model (component가 소비하는 단일 묶음) ──

export interface DecisionSurfaceModel {
  optionSet: DecisionOptionSet | null;
  options: DecisionOption[];
  focusedOption: DecisionOption | null;
  interaction: DecisionSurfaceInteraction;

  /** right rail에 보여줄 focused option의 rationale/risk */
  railContent: DecisionRailContent | null;

  /** bottom dock commit actions */
  dockActions: DecisionDockAction[];
}

export interface DecisionRailContent {
  optionTitle: string;
  rationale: string;
  strengths: string[];
  risks: Array<{ label: string; severity: string }>;
  bestFor: string;
}

export interface DecisionDockAction {
  id: string;
  label: string;
  type: "commit" | "keep" | "next_step";
  disabled: boolean;
  optionId: string | null;
}

// ── Build surface model ──

export function buildDecisionSurfaceModel(input: {
  optionSet: DecisionOptionSet | null;
  interaction: DecisionSurfaceInteraction;
}): DecisionSurfaceModel {
  const { optionSet, interaction } = input;

  if (!optionSet || !interaction.visible) {
    return {
      optionSet: null,
      options: [],
      focusedOption: null,
      interaction,
      railContent: null,
      dockActions: [],
    };
  }

  const options = optionSet.options;
  const focusedOption = interaction.focusedOptionId
    ? options.find(o => o.id === interaction.focusedOptionId) ?? options.find(o => o.frame === optionSet.defaultHighlight) ?? null
    : options.find(o => o.frame === optionSet.defaultHighlight) ?? null;

  const railContent: DecisionRailContent | null = focusedOption
    ? {
        optionTitle: focusedOption.title,
        rationale: focusedOption.rationale,
        strengths: focusedOption.strengths,
        risks: focusedOption.risks.map(r => ({ label: r.label, severity: r.severity })),
        bestFor: focusedOption.recommendedUseCase,
      }
    : null;

  const dockActions: DecisionDockAction[] = focusedOption
    ? [
        {
          id: `commit_${focusedOption.id}`,
          label: focusedOption.nextAction,
          type: "commit",
          disabled: false,
          optionId: focusedOption.id,
        },
        {
          id: "keep_comparing",
          label: "비교에 유지",
          type: "keep",
          disabled: false,
          optionId: null,
        },
      ]
    : [];

  return {
    optionSet,
    options,
    focusedOption,
    interaction,
    railContent,
    dockActions,
  };
}

// ── Interaction reducers ──

export function focusOption(
  interaction: DecisionSurfaceInteraction,
  optionId: string
): DecisionSurfaceInteraction {
  // focus만 바뀜. commit은 아님.
  return { ...interaction, focusedOptionId: optionId };
}

export function commitOption(
  interaction: DecisionSurfaceInteraction,
  optionId: string
): DecisionSurfaceInteraction {
  // 실제 commit. selectedDecisionItemId / draft patch는 호출자가 처리.
  return { ...interaction, committedOptionId: optionId };
}

export function dismissSurface(
  interaction: DecisionSurfaceInteraction
): DecisionSurfaceInteraction {
  return { ...interaction, visible: false, hiddenReason: "dismissed" };
}

export function createInitialInteraction(visible: boolean): DecisionSurfaceInteraction {
  return {
    focusedOptionId: null,
    committedOptionId: null,
    visible,
    hiddenReason: visible ? null : "no_option_set",
  };
}
