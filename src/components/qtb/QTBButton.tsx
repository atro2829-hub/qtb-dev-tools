"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const qtbButtonVariants = cva(
  "relative z-10 inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors outline-none disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-neutral-950 text-white shadow-md hover:bg-black",
        outline:
          "border border-neutral-200 bg-white text-neutral-900 shadow-xs hover:bg-neutral-100 hover:border-neutral-300",
        ghost: "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
        destructive: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
      },
      size: {
        sm: "h-11 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

type MotionSafeButtonProps = Omit<
  React.ComponentProps<"button">,
  "onAnimationStart" | "onAnimationEnd" | "onDragStart" | "onDrag" | "onDragEnd"
>;

export interface QTBButtonProps
  extends MotionSafeButtonProps,
    VariantProps<typeof qtbButtonVariants> {
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Classes for the glow wrapper span (default variant only). */
  wrapperClassName?: string;
}

/** QTB primary black button with animated rainbow glow border on hover. */
export default function QTBButton({
  variant = "default",
  size = "md",
  loading = false,
  className,
  wrapperClassName,
  children,
  disabled,
  type = "button",
  ...props
}: QTBButtonProps) {
  const button = (
    <motion.button
      type={type}
      whileTap={{ scale: 0.97 }}
      disabled={disabled || loading}
      className={cn(
        qtbButtonVariants({ variant, size }),
        variant === "default" ? "rounded-[inherit]" : "rounded-xl",
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-4 animate-spin"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </motion.button>
  );

  if (variant === "default") {
    return (
      <span className={cn("qtb-glow rounded-xl", wrapperClassName)} aria-busy={loading}>
        {button}
      </span>
    );
  }
  return button;
}

export { qtbButtonVariants };
