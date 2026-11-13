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

  return (
    <div className="space-y-4">
      <div className="max-w-2xl">
        <h2 className="font-heading text-2xl font-semibold">Sumber pada kasus ini</h2>
        <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
          9 tautan dari kasus yang sedang dimuat di browser ini, termasuk
          fixture contoh. Angka ini bukan metrik platform.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-[#2A3238]/70 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#D4FC36]" />
              Daftar tautan
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
                      className="cursor-pointer font-mono text-xs text-[#D4FC36] hover:underline"
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
                      <Globe2 className="size-3.5 text-[#8C989F]" />
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
                    <p className="font-medium text-[#F3F4F5]">{src.title}</p>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-[#D4FC36] hover:underline"
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
