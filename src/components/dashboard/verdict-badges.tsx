import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  MessageSquareQuote,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  ClaimVerdict,
  EvidenceRelation,
  PostStance,
  SourceTier,
} from "@/lib/types";

export function getVerdictStyle(verdict: ClaimVerdict) {
  switch (verdict) {
    case "FALSE":
      return {
        badgeVariant: "threat" as const,
        colorClass: "text-verdict-false",
        borderClass: "border-verdict-false/40",
        bgClass: "bg-verdict-false/10",
        shortCode: "FALSE • HOAKS",
        displayLabel: "FALSE (Hoaks)",
        Icon: ShieldAlert,
      };
    case "TRUE":
      return {
        badgeVariant: "verified" as const,
        colorClass: "text-verdict-true",
        borderClass: "border-verdict-true/40",
        bgClass: "bg-verdict-true/10",
        shortCode: "TRUE • TERVERIFIKASI",
        displayLabel: "TRUE (Terverifikasi)",
        Icon: ShieldCheck,
      };
    case "MISLEADING":
      return {
        badgeVariant: "warning" as const,
        colorClass: "text-verdict-mislead",
        borderClass: "border-verdict-mislead/40",
        bgClass: "bg-verdict-mislead/10",
        shortCode: "MISLEADING • MENYESATKAN",
        displayLabel: "MISLEADING (Menyesatkan)",
        Icon: AlertTriangle,
      };
    case "OUTDATED":
      return {
        badgeVariant: "outdated" as const,
        colorClass: "text-verdict-outdated",
        borderClass: "border-verdict-outdated/40",
        bgClass: "bg-verdict-outdated/10",
        shortCode: "OUTDATED • KEDALUWARSA",
        displayLabel: "OUTDATED (Kedaluwarsa)",
        Icon: Clock3,
      };
    case "UNVERIFIED":
    default:
      return {
        badgeVariant: "unverified" as const,
        colorClass: "text-verdict-open",
        borderClass: "border-verdict-open/40",
        bgClass: "bg-verdict-open/10",
        shortCode: "UNVERIFIED • BELUM TERVERIFIKASI",
        displayLabel: "UNVERIFIED (Belum Terverifikasi)",
        Icon: HelpCircle,
      };
  }
}

export function VerdictBadge({ verdict }: { verdict: ClaimVerdict }) {
  const { badgeVariant, displayLabel, Icon } = getVerdictStyle(verdict);
  return (
    <Badge variant={badgeVariant}>
      <Icon className="size-3.5" />
      <span>{displayLabel}</span>
    </Badge>
  );
}

const CLAIM_READINGS = [
  {
    verdict: "FALSE" as const,
    title: "Hoaks",
    line: "Sumber yang selaras membantah klaim. Status ini tidak dipakai hanya karena bukti belum ditemukan.",
  },
  {
    verdict: "TRUE" as const,
    title: "Valid",
    line: "Sumber yang selaras mendukung klaim yang diuji.",
  },
  {
    verdict: "UNVERIFIED" as const,
    title: "Butuh verifikasi",
    line: "Bukti yang ada belum cukup untuk menyebut klaim ini hoaks atau valid.",
  },
  {
    verdict: "MISLEADING" as const,
    title: "Menyesatkan",
    line: "Sebagian muatan punya jejak, tetapi keseluruhan klaim menyesatkan. Ini bukan hoaks utuh dan bukan valid.",
  },
  {
    verdict: "OUTDATED" as const,
    title: "Kedaluwarsa",
    line: "Klaim merujuk peristiwa atau status yang sudah tidak berlaku. Ini bukan hoaks baru dan bukan valid untuk saat ini.",
  },
];

const PRIMARY_READINGS = CLAIM_READINGS.filter((item) =>
  item.verdict === "FALSE" || item.verdict === "TRUE" || item.verdict === "UNVERIFIED"
);

export function getClaimReading(verdict: ClaimVerdict) {
  return (
    CLAIM_READINGS.find((item) => item.verdict === verdict) ??
    CLAIM_READINGS[2]
  );
}

export function ClaimReading({ verdict }: { verdict: ClaimVerdict }) {
  const reading = getClaimReading(verdict);
  const style = getVerdictStyle(verdict);
  const primary = PRIMARY_READINGS.some((item) => item.verdict === verdict);

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">
          BACAAN KLAIM
        </p>
        <p
          className={`mt-1 font-heading text-4xl font-medium tracking-tight ${style.colorClass}`}
        >
          {reading.title}
        </p>
        <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
          {reading.line}
        </p>
      </div>
      <div
        className="grid grid-cols-3 gap-px border border-border bg-border"
        role="list"
        aria-label="Tiga bacaan utama"
      >
        {PRIMARY_READINGS.map((item) => {
          const active = item.verdict === verdict;
          const lane = getVerdictStyle(item.verdict);
          return (
            <div
              key={item.verdict}
              role="listitem"
              aria-current={active ? "true" : undefined}
              className={`bg-card px-3 py-3 ${active ? lane.colorClass : "text-muted-foreground"}`}
            >
              <p className="font-heading text-lg font-medium leading-none">
                {item.title}
              </p>
              <p className="mt-2 font-mono text-[10px] tracking-[0.12em]">
                {active ? "BACAAN INI" : "—"}
              </p>
            </div>
          );
        })}
      </div>
      {!primary && (
        <p className="font-sans text-sm leading-relaxed text-foreground">
          Bacaan ini berdiri sendiri. Klaim tidak digolongkan sebagai hoaks,
          valid, atau butuh verifikasi.
        </p>
      )}
    </div>
  );
}

export function PostStanceBadge({ stance }: { stance: PostStance }) {
  switch (stance) {
    case "debunking_claim":
      return (
        <Badge variant="verified">
          <CheckCircle2 className="size-3.5" />
          <span>Debunking (Membantah)</span>
        </Badge>
      );
    case "asserting_claim":
      return (
        <Badge variant="threat">
          <AlertTriangle className="size-3.5" />
          <span>Asserting (Mengklaim)</span>
        </Badge>
      );
    case "quoting_claim":
      return (
        <Badge variant="warning">
          <MessageSquareQuote className="size-3.5" />
          <span>Quoting (Mengutip)</span>
        </Badge>
      );
    case "neutral_discussion":
      return (
        <Badge variant="default">
          <Scale className="size-3.5" />
          <span>Neutral Discussion</span>
        </Badge>
      );
    case "unclear_context":
    default:
      return (
        <Badge variant="secondary">
          <HelpCircle className="size-3.5" />
          <span>Unclear Context</span>
        </Badge>
      );
  }
}

export function EvidenceRelationBadge({
  relation,
}: {
  relation: EvidenceRelation;
}) {
  switch (relation) {
    case "supporting":
      return <Badge variant="verified">Supporting (Mendukung)</Badge>;
    case "contradicting":
      return <Badge variant="threat">Contradicting (Membantah)</Badge>;
    case "partial_context":
      return <Badge variant="warning">Partial Context</Badge>;
    case "insufficient":
      return <Badge variant="secondary">Insufficient Evidence (Bukti Belum Cukup)</Badge>;
    case "irrelevant":
    default:
      return <Badge variant="secondary">Irrelevant</Badge>;
  }
}

export function SourceTierBadge({ tier }: { tier: SourceTier }) {
  switch (tier) {
    case "official_government":
      return <Badge variant="verified">Sumber Resmi</Badge>;
    case "fact_checker":
      return <Badge variant="default">Fact-Checker</Badge>;
    case "credible_media":
      return <Badge variant="outline">Media Kredibel</Badge>;
    case "public_source":
    default:
      return <Badge variant="secondary">Sumber Publik</Badge>;
  }
}
