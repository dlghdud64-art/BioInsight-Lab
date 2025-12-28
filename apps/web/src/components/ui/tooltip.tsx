"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProviderProps {
  children: React.ReactNode;
}

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const TooltipContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

const TooltipProvider = ({ children }: TooltipProviderProps) => {
  return <>{children}</>;
};

const Tooltip = ({ children }: TooltipProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ isOpen, setIsOpen }}>
      <div
        className="relative"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  TooltipTriggerProps
>(({ asChild, children, ...props }, ref) => {
  const { setIsOpen } = React.useContext(TooltipContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ref,
      onMouseEnter: () => setIsOpen(true),
    } as any);
  }
  return (
    <button ref={ref} {...props}>
      {children}
    </button>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, ...props }, ref) => {
    const { isOpen } = React.useContext(TooltipContext);
    if (!isOpen) return null;
    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 rounded-md border border-slate-200 bg-slate-900 px-3 py-1.5 text-sm text-slate-50 shadow-md",
          "bottom-full left-1/2 -translate-x-1/2 mb-2",
          "before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-slate-900",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = "TooltipContent";

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };

