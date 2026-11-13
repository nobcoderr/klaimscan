"use client";

import { DEMO_CASES } from "@/data/demo-cases";
import { cn } from "@/lib/utils";

interface DemoFixtureSwitchProps {
  activeCaseId: string;
  onSelect: (caseId: string) => void;
}

export function DemoFixtureSwitch({
  activeCaseId,
  onSelect,
}: DemoFixtureSwitchProps) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground">
        KASUS CONTOH
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Pilih kasus contoh">
        {DEMO_CASES.map((demo, index) => {
          const selected = demo.caseId === activeCaseId;
          return (
            <button
              key={demo.caseId}
              type="button"
              title={demo.demoCategoryLabel || demo.title}
              aria-pressed={selected}
              onClick={() => onSelect(demo.caseId)}
              className={cn(
                "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center border px-3 font-mono text-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              D-{index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
