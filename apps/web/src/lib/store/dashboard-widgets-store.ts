/**
 * 대시보드 위젯 설정 및 레이아웃 관리
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
  size: "small" | "medium" | "large";
  position?: { x: number; y: number };
}

export interface DashboardLayout {
  widgets: WidgetConfig[];
  lastUpdated: Date;
}

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
  setEditMode: (enabled: boolean) => void;
  toggleWidgetVisibility: (widgetId: string) => void;
  updateWidgetOrder: (widgetIds: string[]) => void;
  updateWidgetSize: (widgetId: string, size: "small" | "medium" | "large") => void;
  resetLayout: () => void;
  saveLayout: () => Promise<void>;
  loadLayout: () => Promise<void>;
}

export const useDashboardWidgets = create<DashboardWidgetsState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      isEditMode: false,

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

      resetLayout: () => {
        set({ widgets: DEFAULT_WIDGETS });
      },

      saveLayout: async () => {
        try {
          const { widgets } = get();
          const response = await fetch("/api/dashboard/layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              layout: {
                widgets,
                lastUpdated: new Date().toISOString(),
              },
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to save layout");
          }
        } catch (error) {
          console.error("Error saving layout:", error);
        }
      },

      loadLayout: async () => {
        try {
          const response = await fetch("/api/dashboard/layout");
          if (response.ok) {
            const data = await response.json();
            if (data.layout?.widgets) {
              set({ widgets: data.layout.widgets });
            }
          }
        } catch (error) {
          console.error("Error loading layout:", error);
        }
      },
    }),
    {
      name: "dashboard-widgets",
      partialize: (state) => ({ widgets: state.widgets }),
    }
  )
);

