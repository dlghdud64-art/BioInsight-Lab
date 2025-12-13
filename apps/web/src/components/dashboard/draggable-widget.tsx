"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff, Maximize2, Minimize2, Square } from "lucide-react";
import { useDashboardWidgets } from "@/lib/store/dashboard-widgets-store";
import { cn } from "@/lib/utils";

interface DraggableWidgetProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultSize?: "small" | "medium" | "large";
  className?: string;
}

export function DraggableWidget({
  id,
  title,
  description,
  children,
  defaultSize = "medium",
  className,
}: DraggableWidgetProps) {
  const { widgets, isEditMode, toggleWidgetVisibility, updateWidgetSize } = useDashboardWidgets();
  const widget = widgets.find((w) => w.id === id);
  const visible = widget?.visible ?? true;
  const size = widget?.size ?? defaultSize;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!visible && !isEditMode) {
    return null;
  }

  const sizeClasses = {
    small: "col-span-1",
    medium: "col-span-1 md:col-span-2",
    large: "col-span-1 md:col-span-2 lg:col-span-3",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        sizeClasses[size],
        isEditMode && "relative",
        className
      )}
    >
      <Card className={cn("h-full", isDragging && "ring-2 ring-blue-500")}>
        {isEditMode && (
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              {...attributes}
              {...listeners}
              title="드래그하여 이동"
            >
              <GripVertical className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggleWidgetVisibility(id)}
              title={visible ? "숨기기" : "보이기"}
            >
              {visible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-3 w-6 p-0"
                onClick={() => {
                  const sizes: ("small" | "medium" | "large")[] = ["small", "medium", "large"];
                  const currentIndex = sizes.indexOf(size);
                  const nextSize = sizes[(currentIndex + 1) % sizes.length];
                  updateWidgetSize(id, nextSize);
                }}
                title="크기 변경"
              >
                <Square className="h-2 w-2" />
              </Button>
            </div>
          </div>
        )}
        <CardHeader className={cn(isEditMode && "pr-20")}>
          <CardTitle className="text-sm md:text-base">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs md:text-sm">{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

