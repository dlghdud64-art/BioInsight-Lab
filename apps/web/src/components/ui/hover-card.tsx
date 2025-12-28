"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface HoverCardProps {
  children: React.ReactNode;
}

interface HoverCardTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

interface HoverCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const HoverCardContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

const HoverCard = ({ children }: HoverCardProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <HoverCardContext.Provider value={{ isOpen, setIsOpen }}>
      <div
        className="relative"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children}
      </div>
    </HoverCardContext.Provider>
  );
};

const HoverCardTrigger = React.forwardRef<
  HTMLButtonElement,
  HoverCardTriggerProps
>(({ asChild, children, ...props }, ref) => {
  const { setIsOpen } = React.useContext(HoverCardContext);
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
HoverCardTrigger.displayName = "HoverCardTrigger";

const HoverCardContent = React.forwardRef<HTMLDivElement, HoverCardContentProps>(
  ({ className, children, ...props }, ref) => {
    const { isOpen } = React.useContext(HoverCardContext);
    if (!isOpen) return null;
    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 w-80 rounded-md border border-slate-200 bg-white p-4 text-slate-950 shadow-lg",
          "top-full left-0 mt-2",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
HoverCardContent.displayName = "HoverCardContent";

export { HoverCard, HoverCardTrigger, HoverCardContent };

