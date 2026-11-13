import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-foreground border border-border hover:border-primary/50 hover:bg-secondary/80",
        cyber:
          "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-[#185843]",
        destructive:
          "bg-verdict-false/15 text-verdict-false border border-verdict-false/40 hover:bg-verdict-false/25",
        outline:
          "border border-border bg-card text-foreground hover:border-primary/45 hover:bg-secondary",
        secondary:
          "bg-secondary text-foreground border border-border hover:bg-secondary/70",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-6 text-sm",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
