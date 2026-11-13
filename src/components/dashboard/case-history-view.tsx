"use client";

import * as React from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClaimVerdict, InvestigationReport } from "@/lib/types";
import { formatWibTimestamp } from "@/lib/utils";
import { PostStanceBadge, VerdictBadge } from "./verdict-badges";

interface CaseHistoryViewProps {
  cases: InvestigationReport[];
  activeCaseId: string;
  onSelectCase: (caseId: string) => void;
}

const FILTER_OPTIONS: Array<"ALL" | ClaimVerdict> = [
  "ALL",
  "FALSE",
  "TRUE",
  "MISLEADING",
  "OUTDATED",
  "UNVERIFIED",
];

export function CaseHistoryView({
  cases,
  activeCaseId,
  onSelectCase,
}: CaseHistoryViewProps) {
  const [query, setQuery] = React.useState("");
  const [verdictFilter, setVerdictFilter] = React.useState<"ALL" | ClaimVerdict>(
    "ALL"
  );

  const filtered = cases.filter((item) => {
    const matchesVerdict =
      verdictFilter === "ALL" || item.verdict.claimVerdict === verdictFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.caseId.toLowerCase().includes(q) ||
      item.claimExtraction.primaryClaim.toLowerCase().includes(q) ||
      (item.claimExtraction.visibleAccountHandle ?? "")
        .toLowerCase()
        .includes(q) ||
      item.claimExtraction.platform.toLowerCase().includes(q);
    return matchesVerdict && matchesQuery;
  });

  return (
    <Card>
      <CardHeader className="border-b border-[#2A3238]/70 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-2xl font-medium">
              Daftar kasus
            </CardTitle>
          </div>
          <Badge variant="secondary">{filtered.length} Kasus</Badge>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[#8C989F]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari Case ID, klaim, @akun, atau platform..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt}
                type="button"
                size="sm"
                variant={verdictFilter === opt ? "cyber" : "outline"}
                onClick={() => setVerdictFilter(opt)}
              >
                {opt}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case ID</TableHead>
              <TableHead>Klaim Utama</TableHead>
              <TableHead>Platform &amp; Akun</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Post Stance</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-muted-foreground">
                  Tidak ada kasus yang cocok dengan pencarian ini.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((item) => (
              <TableRow
                key={item.caseId}
                className={
                  item.caseId === activeCaseId ? "bg-[#1C2226]/80" : undefined
                }
              >
                <TableCell className="font-mono text-xs text-[#D4FC36]">
                  <div>{item.caseId}</div>
                  {item.isDemo && (
                    <span className="text-[10px] text-[#FBBF24]">
                      DEMO FIXTURE
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-[300px] text-xs leading-relaxed">
                  {item.claimExtraction.primaryClaim}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">
                    {item.claimExtraction.platform}
                  </div>
                  <div className="font-mono text-[11px] text-[#8C989F]">
                    {item.claimExtraction.visibleAccountHandle || "Anonim/N/A"}
                  </div>
                </TableCell>
                <TableCell>
                  <VerdictBadge verdict={item.verdict.claimVerdict} />
                </TableCell>
                <TableCell>
                  <PostStanceBadge stance={item.verdict.postStance} />
                </TableCell>
                <TableCell className="font-mono text-[11px] text-[#8C989F]">
                  {formatWibTimestamp(item.checkedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Buka ${item.caseId}`}
                    onClick={() => onSelectCase(item.caseId)}
                  >
                    Buka
                    <ArrowUpRight className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
