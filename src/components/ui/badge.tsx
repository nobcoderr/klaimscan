import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-primary/10 text-primary",
        verified:
          "border-verdict-true/40 bg-verdict-true/12 text-verdict-true",
        threat:
          "border-verdict-false/40 bg-verdict-false/12 text-verdict-false",
        warning:
          "border-verdict-mislead/40 bg-verdict-mislead/12 text-verdict-mislead",
        outdated:
          "border-verdict-outdated/45 bg-verdict-outdated/12 text-verdict-outdated",
        unverified:
          "border-verdict-open/40 bg-verdict-open/12 text-verdict-open",
        secondary: "border-border bg-secondary text-muted-foreground",
        outline: "border-border bg-transparent text-foreground",
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
