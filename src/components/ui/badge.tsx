import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#45DDEB]/40 bg-[#45DDEB]/12 text-[#45DDEB]",
        verified: "border-[#34D399]/40 bg-[#34D399]/12 text-[#34D399]",
        threat: "border-[#F87171]/40 bg-[#F87171]/12 text-[#F87171]",
        warning: "border-[#FBBF24]/40 bg-[#FBBF24]/12 text-[#FBBF24]",
        secondary: "border-[#254159] bg-[#112940] text-[#8BA4C0]",
        outline: "border-[#254159] bg-transparent text-[#F3F8FF]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
