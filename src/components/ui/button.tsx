import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#45DDEB]/60 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#165E6F] text-[#F3F8FF] border border-[#45DDEB]/40 hover:bg-[#1C778C] hover:border-[#45DDEB]/70 shadow-sm",
        cyber:
          "bg-[#45DDEB] text-[#07111E] font-semibold hover:bg-[#6BE7F3] shadow-[0_0_20px_rgba(69,221,235,0.2)]",
        destructive:
          "bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/40 hover:bg-[#F87171]/25",
        outline:
          "border border-[#254159] bg-[#0D2133]/80 text-[#F3F8FF] hover:bg-[#132E47] hover:border-[#45DDEB]/45",
        secondary:
          "bg-[#112940] text-[#F3F8FF] border border-[#254159] hover:bg-[#173654]",
        ghost:
          "text-[#8BA4C0] hover:bg-[#112940] hover:text-[#F3F8FF]",
        link: "text-[#45DDEB] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-6 text-sm",
        icon: "size-9",
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
