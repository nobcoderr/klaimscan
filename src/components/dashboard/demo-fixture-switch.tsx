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
        SATU KASUS CONTOH
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Pilih kasus contoh">
        {DEMO_CASES.map((demo, index) => {
          const selected = demo.caseId === activeCaseId;
          return (
            <button
              key={demo.caseId}
              type="button"
              title={demo.claimExtraction.primaryClaim}
              aria-pressed={selected}
              onClick={() => onSelect(demo.caseId)}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-1 border px-3 py-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="font-mono text-xs">{`D-${index + 1} · ${demo.caseId}`}</span>
              <span className="line-clamp-2 font-sans text-xs leading-relaxed normal-case tracking-normal">
                {demo.claimExtraction.primaryClaim}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
