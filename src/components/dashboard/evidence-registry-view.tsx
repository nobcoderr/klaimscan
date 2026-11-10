"use client";

import { ExternalLink, Globe2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvestigationReport } from "@/lib/types";
import { EvidenceRelationBadge, SourceTierBadge } from "./verdict-badges";

interface EvidenceRegistryViewProps {
  cases: InvestigationReport[];
  onSelectCase: (caseId: string) => void;
}

export function EvidenceRegistryView({
  cases,
  onSelectCase,
}: EvidenceRegistryViewProps) {
  const rows = cases.flatMap((c) =>
    c.evidenceSources.map((src) => ({
      caseId: c.caseId,
      isDemo: c.isDemo,
      src,
    }))
  );

  const officialCount = rows.filter(
    (r) => r.src.sourceTier === "official_government"
  ).length;
  const factCheckCount = rows.filter(
    (r) => r.src.sourceTier === "fact_checker"
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-xs uppercase text-[#8BA4C0]">
              Total Tautan Bukti
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-[#F3F8FF]">
              {String(rows.length).padStart(3, "0")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-xs uppercase text-[#8BA4C0]">
              Lembaga Pemerintah (.go.id)
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-[#34D399]">
              {String(officialCount).padStart(3, "0")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-xs uppercase text-[#8BA4C0]">
              Penerbit Fact-Check
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-[#45DDEB]">
              {String(factCheckCount).padStart(3, "0")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-[#254159]/70 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#45DDEB]" />
              Evidence Sources Registry
            </CardTitle>
            <Badge variant="default">URL Tervalidasi</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kasus</TableHead>
                <TableHead>Penerbit</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Posisi Bukti</TableHead>
                <TableHead>Judul &amp; URL Sumber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ caseId, isDemo, src }) => (
                <TableRow key={`${caseId}-${src.id}-${src.url}`}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onSelectCase(caseId)}
                      className="cursor-pointer font-mono text-xs text-[#45DDEB] hover:underline"
                    >
                      {caseId}
                    </button>
                    {isDemo && (
                      <div className="font-mono text-[10px] text-[#FBBF24]">
                        DEMO
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <Globe2 className="size-3.5 text-[#8BA4C0]" />
                      {src.publisher}
                    </div>
                  </TableCell>
                  <TableCell>
                    <SourceTierBadge tier={src.sourceTier} />
                  </TableCell>
                  <TableCell>
                    <EvidenceRelationBadge relation={src.relation} />
                  </TableCell>
                  <TableCell className="max-w-md text-xs">
                    <p className="font-medium text-[#F3F8FF]">{src.title}</p>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-[#45DDEB] hover:underline"
                    >
                      {src.url}
                      <ExternalLink className="size-3" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
