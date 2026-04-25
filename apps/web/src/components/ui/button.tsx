import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// 중복 정의 제거
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
        secondary:
          "bg-el text-slate-900 hover:bg-st",
        ghost: "hover:bg-el hover:text-slate-900",
        link: "text-blue-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // #P02-button-type (ADR-002 §11.8 follow-up, 2026-04-25): default to
    // type="button" for native <button> renders. The HTML default is
    // "submit", which silently triggers form submission when a Button is
    // dropped inside a <form> without an explicit type. The §11.8 probe
    // discovered every Button on /dashboard/inventory rendered with
    // type="submit" — inert at the time because none sat inside a <form>,
    // but a real foot-gun for any future surface that gets form-wrapped.
    //
    // Caller can still pass type="submit" explicitly (all 6 existing form
    // sites already do — verified before this change). asChild renders
    // into the child element via Slot, so we don't force a type there
    // (anchors / divs / etc. shouldn't receive a button type).
    const buttonType = asChild ? undefined : (type ?? "button");
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={buttonType}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
