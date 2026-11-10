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
        colorClass: "text-[#F87171]",
        borderClass: "border-[#F87171]/40",
        bgClass: "bg-[#F87171]/10",
        shortCode: "FALSE • HOAKS",
        displayLabel: "FALSE (Hoaks)",
        Icon: ShieldAlert,
      };
    case "TRUE":
      return {
        badgeVariant: "verified" as const,
        colorClass: "text-[#34D399]",
        borderClass: "border-[#34D399]/40",
        bgClass: "bg-[#34D399]/10",
        shortCode: "TRUE • TERVERIFIKASI",
        displayLabel: "TRUE (Terverifikasi)",
        Icon: ShieldCheck,
      };
    case "MISLEADING":
      return {
        badgeVariant: "warning" as const,
        colorClass: "text-[#FBBF24]",
        borderClass: "border-[#FBBF24]/40",
        bgClass: "bg-[#FBBF24]/10",
        shortCode: "MISLEADING • MENYESATKAN",
        displayLabel: "MISLEADING (Menyesatkan)",
        Icon: AlertTriangle,
      };
    case "OUTDATED":
      return {
        badgeVariant: "warning" as const,
        colorClass: "text-[#FBBF24]",
        borderClass: "border-[#FBBF24]/40",
        bgClass: "bg-[#FBBF24]/10",
        shortCode: "OUTDATED • KEDALUWARSA",
        displayLabel: "OUTDATED (Kedaluwarsa)",
        Icon: Clock3,
      };
    case "UNVERIFIED":
    default:
      return {
        badgeVariant: "default" as const,
        colorClass: "text-[#45DDEB]",
        borderClass: "border-[#45DDEB]/40",
        bgClass: "bg-[#45DDEB]/10",
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
