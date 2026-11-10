import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-[#254159] bg-[#07111E]/90 px-3 py-2 text-sm text-[#F3F8FF] placeholder:text-[#8BA4C0]/60 transition-colors outline-none focus-visible:border-[#45DDEB] focus-visible:ring-2 focus-visible:ring-[#45DDEB]/25 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
