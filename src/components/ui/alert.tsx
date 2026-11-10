import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-[#254159] bg-[#0D2133] text-[#F3F8FF]",
        cyber: "border-[#45DDEB]/40 bg-[#45DDEB]/8 text-[#F3F8FF]",
        verified: "border-[#34D399]/40 bg-[#34D399]/8 text-[#F3F8FF]",
        warning: "border-[#FBBF24]/40 bg-[#FBBF24]/8 text-[#F3F8FF]",
        destructive: "border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-heading font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-[#8BA4C0]",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
