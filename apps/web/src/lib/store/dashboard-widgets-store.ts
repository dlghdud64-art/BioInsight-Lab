/**
 * 대시보드 위젯 설정 및 레이아웃 관리
 *
 * localStorage 키: dashboard-layout-settings
 */

import { create } from "zustand";

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
  size: "small" | "medium" | "large";
  position?: { x: number; y: number };
}

export interface DashboardLayout {
  widgets: WidgetConfig[];
  lastUpdated: string;
}

const STORAGE_KEY = "dashboard-layout-settings";

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "reorder-recommendations", visible: true, order: 0, size: "medium" },
  { id: "quote-status", visible: true, order: 1, size: "medium" },
  { id: "purchase-summary", visible: true, order: 2, size: "large" },
  { id: "activity-stats", visible: true, order: 3, size: "large" },
  { id: "recent-activity", visible: true, order: 4, size: "medium" },
];

interface DashboardWidgetsState {
  widgets: WidgetConfig[];
  isEditMode: boolean;
  isLayoutLoaded: boolean;
  setEditMode: (enabled: boolean) => void;
  toggleWidgetVisibility: (widgetId: string) => void;
  updateWidgetOrder: (widgetIds: string[]) => void;
  updateWidgetSize: (widgetId: string, size: "small" | "medium" | "large") => void;
  resetLayout: () => void;
  saveLayout: () => boolean;
  loadLayout: () => void;
}

export const useDashboardWidgets = create<DashboardWidgetsState>()((set, get) => ({
  widgets: DEFAULT_WIDGETS,
  isEditMode: false,
  isLayoutLoaded: false,

  setEditMode: (enabled: boolean) => {
    set({ isEditMode: enabled });
  },

  toggleWidgetVisibility: (widgetId: string) => {
    set((state) => ({
      widgets: state.widgets.map((widget) =>
        widget.id === widgetId
          ? { ...widget, visible: !widget.visible }
          : widget
      ),
    }));
  },

  updateWidgetOrder: (widgetIds: string[]) => {
    set((state) => {
      const widgetMap = new Map(state.widgets.map((w) => [w.id, w]));
      const newWidgets = widgetIds
        .map((id, index) => {
          const widget = widgetMap.get(id);
          return widget ? { ...widget, order: index } : null;
        })
        .filter((w): w is WidgetConfig => w !== null);

      // 보이지 않는 위젯들도 유지
      const hiddenWidgets = state.widgets.filter(
        (w) => !widgetIds.includes(w.id)
      );

      return {
        widgets: [...newWidgets, ...hiddenWidgets].sort(
          (a, b) => a.order - b.order
        ),
      };
    });
  },

  updateWidgetSize: (widgetId: string, size: "small" | "medium" | "large") => {
    set((state) => ({
      widgets: state.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, size } : widget
      ),
    }));
  },

  /**
   * 레이아웃을 기본값으로 초기화하고 localStorage에서 삭제
   */
  resetLayout: () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("[Dashboard] Error removing layout from localStorage:", error);
    }
    set({ widgets: DEFAULT_WIDGETS });
  },

  /**
   * 현재 레이아웃을 localStorage에 저장
   * @returns 저장 성공 여부
   */
  saveLayout: (): boolean => {
    try {
      if (typeof window === "undefined") {
        return false;
      }

      const { widgets } = get();
      const layout: DashboardLayout = {
        widgets,
        lastUpdated: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      console.log("[Dashboard] Layout saved to localStorage");
      return true;
    } catch (error) {
      console.error("[Dashboard] Error saving layout to localStorage:", error);
      return false;
    }
  },

  /**
   * localStorage에서 레이아웃 불러오기
   * 값이 없으면 기본값 유지
   */
  loadLayout: () => {
    try {
      if (typeof window === "undefined") {
        set({ isLayoutLoaded: true });
        return;
      }

      const savedData = localStorage.getItem(STORAGE_KEY);

      if (savedData) {
        const layout: DashboardLayout = JSON.parse(savedData);
        if (layout.widgets && Array.isArray(layout.widgets)) {
          console.log("[Dashboard] Layout loaded from localStorage:", layout.lastUpdated);
          set({ widgets: layout.widgets, isLayoutLoaded: true });
          return;
        }
      }

      // 저장된 값이 없으면 기본값 유지
      console.log("[Dashboard] No saved layout found, using defaults");
      set({ isLayoutLoaded: true });
    } catch (error) {
      console.error("[Dashboard] Error loading layout from localStorage:", error);
      set({ isLayoutLoaded: true });
    }
  },
}));

