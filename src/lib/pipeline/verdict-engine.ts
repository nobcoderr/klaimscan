import type {
  AtomicClaimAssessment,
  AtomicClaimItem,
  ClaimVerdict,
  EvidenceSource,
  PostStance,
  VerdictAssessment,
} from "@/lib/types";
import { extractRegistrableRoot } from "@/lib/utils";

export { extractRegistrableRoot } from "@/lib/utils";

export function formatPostClassificationLabel(postStance: PostStance): string {
  switch (postStance) {
    case "debunking_claim":
      return "Postingan Membantah Klaim (Debunking)";
    case "asserting_claim":
      return "Postingan Mengklaim / Menyebarkan (Asserting)";
    case "quoting_claim":
      return "Postingan Mengutip Klaim (Quoting)";
    case "neutral_discussion":
      return "Diskusi / Informasi Netral (Neutral)";
    case "unclear_context":
    default:
      return "Konteks Postingan Tidak Jelas (Unclear)";
  }
}

export function verdictToIndonesianLabel(verdict: ClaimVerdict): string {
  switch (verdict) {
    case "FALSE":
      return "Hoaks";
    case "TRUE":
      return "Valid";
    case "MISLEADING":
      return "Menyesatkan";
    case "OUTDATED":
      return "Kedaluwarsa";
    case "UNVERIFIED":
    default:
      return "Butuh verifikasi";
  }
}

function weightForSource(source: EvidenceSource): number {
  switch (source.evidenceNature) {
    case "primary_record":
    case "original_research":
    case "institutional_data":
      return 2.5;
    case "fact_check":
    case "independent_reporting":
    case "direct_statement":
      return 1.5;
    case "commentary":
      return 0.75;
    case "unknown":
    default:
      return 1;
  }
}

export function getPublisherCorroborationKey(source: EvidenceSource): string {
  const rootDomain = extractRegistrableRoot(source.url || source.domain);
  if (rootDomain) {
    return `domain:${rootDomain}`;
  }
  const normalizedPub = source.publisher
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `pub:${normalizedPub || source.id}`;
}

export function deduplicateByPublisher(
  sources: EvidenceSource[]
): EvidenceSource[] {
  const byPublisher = new Map<string, EvidenceSource>();

  for (const source of sources) {
    const key = getPublisherCorroborationKey(source);
    const existing = byPublisher.get(key);
    const sourceHasDirectContent =
      source.excerptBasis === "direct_source_content";
    const existingHasDirectContent =
      existing?.excerptBasis === "direct_source_content";
    if (
      !existing ||
      weightForSource(source) > weightForSource(existing) ||
      (sourceHasDirectContent && !existingHasDirectContent)
    ) {
      byPublisher.set(key, source);
    }
  }

  return Array.from(byPublisher.values());
}

function hasSubstantiveEvidence(sources: EvidenceSource[]): boolean {
  return sources.some(
    (source) =>
      source.evidenceNature !== "unknown" &&
      source.evidenceNature !== "commentary" &&
      source.excerptBasis !== "url_only" &&
      source.excerptBasis !== "fact_check_api_metadata"
  );
}

function hasIndependentCorroboration(sources: EvidenceSource[]): boolean {
  const nonSyndicated = deduplicateByPublisher(
    sources.filter((source) => source.independence !== "syndicated")
  );
  const decisivePrimaryEvidence = nonSyndicated.some(
    (source) =>
      source.excerptBasis === "direct_source_content" &&
      (source.evidenceNature === "primary_record" ||
        source.evidenceNature === "original_research" ||
        source.evidenceNature === "institutional_data" ||
        (source.relation === "supporting" &&
          source.evidenceNature === "direct_statement" &&
          (source.targetAspect === "event_occurrence" ||
            source.targetAspect === "status_or_stage" ||
            source.targetAspect === "plan_or_target" ||
            source.targetAspect === "implementation_or_outcome")))
  );
  const independentlyCorroborating = nonSyndicated.filter(
    (source) =>
      source.independence === "independent" &&
      source.sourceTier !== "public_source" &&
      source.evidenceNature !== "commentary" &&
      source.evidenceNature !== "unknown" &&
      source.excerptBasis !== "url_only" &&
      source.excerptBasis !== "fact_check_api_metadata"
  );
  return decisivePrimaryEvidence || independentlyCorroborating.length >= 2;
}

function resolveVerdictFromBucket(params: {
  relevantSources: EvidenceSource[];
  outdatedSignalDetected: boolean;
}): {
  status: ClaimVerdict;
  supportPubsCount: number;
  contradictPubsCount: number;
  supportingTotalCount: number;
  contradictingTotalCount: number;
} {
  const supporting = params.relevantSources.filter(
    (s) => s.relation === "supporting"
  );
  const contradicting = params.relevantSources.filter(
    (s) => s.relation === "contradicting"
  );
  const partialContext = params.relevantSources.filter(
    (s) => s.relation === "partial_context"
  );

  const supportPubs = deduplicateByPublisher(supporting);
  const contradictPubs = deduplicateByPublisher(contradicting);
  const partialPubs = deduplicateByPublisher(partialContext);

  const supportScore = supportPubs.reduce(
    (sum, s) => sum + weightForSource(s),
    0
  );
  const contradictScore = contradictPubs.reduce(
    (sum, s) => sum + weightForSource(s),
    0
  );
  const partialScore = partialPubs.reduce(
    (sum, s) => sum + weightForSource(s),
    0
  );
  const relevantNonPublicCount = params.relevantSources.filter(
    (s) => s.sourceTier !== "public_source"
  ).length;

  let status: ClaimVerdict = "UNVERIFIED";

  if (params.relevantSources.length === 0) {
    status = "UNVERIFIED";
  } else if (
    params.outdatedSignalDetected &&
    relevantNonPublicCount > 0 &&
    contradictScore <= partialScore &&
    supportScore === 0
  ) {
    status = "OUTDATED";
  } else if (
    contradictScore > 0 &&
    contradictScore >= supportScore * 1.5 &&
    contradictScore >= partialScore &&
    hasIndependentCorroboration(contradictPubs)
  ) {
    status = "FALSE";
  } else if (
    partialScore > 0 &&
    hasSubstantiveEvidence(partialPubs) &&
    partialScore >= supportScore &&
    partialScore >= contradictScore
  ) {
    status = params.outdatedSignalDetected ? "OUTDATED" : "MISLEADING";
  } else if (
    contradictScore > 0 &&
    supportScore > 0 &&
    hasSubstantiveEvidence(supportPubs) &&
    hasSubstantiveEvidence(contradictPubs)
  ) {
    status = "MISLEADING";
  } else if (
    supportScore > 0 &&
    (contradictScore === 0 ||
      (hasSubstantiveEvidence(supportPubs) &&
        !hasSubstantiveEvidence(contradictPubs) &&
        supportScore >= contradictScore * 2)) &&
    hasIndependentCorroboration(supportPubs)
  ) {
    status = "TRUE";
  } else {
    status = "UNVERIFIED";
  }

  return {
    status,
    supportPubsCount: supportPubs.length,
    contradictPubsCount: contradictPubs.length,
    supportingTotalCount: supporting.length,
    contradictingTotalCount: contradicting.length,
  };
}

function selectSourcesForAtomicClaim(
  item: AtomicClaimItem,
  relevantSources: EvidenceSource[],
  strictAtomicAlignment: boolean
): EvidenceSource[] {
  const textScoped = relevantSources.filter(
    (s) => s.targetAspect !== "image_authenticity"
  );

  const explicitlyAssigned = textScoped.filter(
    (s) =>
      s.evaluatedAtomicClaimId === item.id ||
      s.evaluatedAtomicClaimIds?.includes(item.id)
  );

  if (explicitlyAssigned.length > 0) {
    return explicitlyAssigned;
  }
  return strictAtomicAlignment ? [] : textScoped;
}

function formatAtomicStatusLabel(
  item: AtomicClaimItem,
  status: ClaimVerdict
): string {
  const suffix: Record<ClaimVerdict, string> = {
    TRUE: "TERKONFIRMASI",
    FALSE: "DIBANTAH",
    MISLEADING: "KONTEKS MENYESATKAN / PARSIAL",
    OUTDATED: "KEDALUWARSA",
    UNVERIFIED: "BELUM TERVERIFIKASI",
  };
  return `${item.label.toUpperCase()}: ${suffix[status]}`;
}

function aggregateRequiredAtomicClaims(
  assessments: AtomicClaimAssessment[],
  fallback: ClaimVerdict
): { status: ClaimVerdict; explanation: string } {
  const required = assessments.filter(
    (assessment) => assessment.requiredForFullConfirmation !== false
  );
  if (required.length === 0) {
    return {
      status: fallback,
      explanation: "Tidak ada proposisi wajib terpisah; verdict mengikuti bukti klaim utama.",
    };
  }

  const confirmed = required.filter((assessment) => assessment.status === "TRUE");
  const contradicted = required.filter((assessment) => assessment.status === "FALSE");
  const misleading = required.filter(
    (assessment) => assessment.status === "MISLEADING"
  );
  const outdated = required.filter((assessment) => assessment.status === "OUTDATED");
  const unresolved = required.filter(
    (assessment) => assessment.status === "UNVERIFIED"
  );

  if (confirmed.length > 0 && contradicted.length > 0) {
    return {
      status: "MISLEADING",
      explanation: `Sebagian proposisi wajib terkonfirmasi (${confirmed.map((item) => item.label).join(", ")}), sementara proposisi lain dibantah (${contradicted.map((item) => item.label).join(", ")}).`,
    };
  }
  if (
    (confirmed.length > 0 || contradicted.length > 0) &&
    outdated.length > 0
  ) {
    return {
      status: "MISLEADING",
      explanation: `Proposisi wajib memiliki status temporal atau faktual yang berbeda (${[...confirmed, ...contradicted, ...outdated].map((item) => item.label).join(", ")}); hasilnya tidak diringkas sebagai konfirmasi tunggal.`,
    };
  }
  if (contradicted.length === required.length) {
    return {
      status: "FALSE",
      explanation: `Seluruh proposisi wajib yang diuji dibantah oleh bukti yang selaras (${contradicted.map((item) => item.label).join(", ")}).`,
    };
  }
  if (misleading.length > 0) {
    return {
      status: "MISLEADING",
      explanation: `Bukti mendukung sebagian konteks tetapi tidak sepenuhnya mendukung proposisi wajib (${misleading.map((item) => item.label).join(", ")}).`,
    };
  }
  if (outdated.length > 0 && confirmed.length === 0) {
    return {
      status: "OUTDATED",
      explanation: `Bukti yang sesuai menunjukkan konteks peristiwa pada proposisi wajib telah kedaluwarsa (${outdated.map((item) => item.label).join(", ")}).`,
    };
  }
  if (unresolved.length > 0) {
    return {
      status: "UNVERIFIED",
      explanation: `Aspek wajib belum semuanya dapat diverifikasi (${unresolved.map((item) => item.label).join(", ")}); bagian yang telah terbukti tidak digunakan untuk mengasumsikan sisanya.`,
    };
  }
  if (confirmed.length === required.length) {
    return {
      status: "TRUE",
      explanation: `Seluruh proposisi wajib terkonfirmasi secara terpisah (${confirmed.map((item) => item.label).join(", ")}).`,
    };
  }

  return {
    status: fallback,
    explanation: "Bukti pada proposisi atomik belum cukup untuk mengubah verdict agregat.",
  };
}

export function computeVerdictFromEvidence(params: {
  primaryClaim: string;
  postStance: PostStance;
  postStanceSummary: string;
  sources: EvidenceSource[];
  atomicClaims?: AtomicClaimItem[];
  outdatedSignalDetected?: boolean;
  containsCheckableClaim?: boolean;
  unresolvedTimeContext?: boolean;
}): VerdictAssessment {
  const {
    primaryClaim,
    postStance,
    postStanceSummary,
    sources,
    atomicClaims = [],
    outdatedSignalDetected = false,
    containsCheckableClaim = true,
    unresolvedTimeContext = false,
  } = params;

  const relevant = sources.filter((s) => s.relation !== "irrelevant");

  const primaryScopedRelevant = relevant.filter(
    (s) => s.targetAspect !== "image_authenticity"
  );

  const officialOrFactCheckCount = primaryScopedRelevant.filter(
    (s) =>
      s.sourceTier === "official_government" || s.sourceTier === "fact_checker"
  ).length;

  const supporting = primaryScopedRelevant.filter(
    (s) => s.relation === "supporting"
  );
  const contradicting = primaryScopedRelevant.filter(
    (s) => s.relation === "contradicting"
  );
  const partialContext = primaryScopedRelevant.filter(
    (s) => s.relation === "partial_context"
  );
  const insufficient = primaryScopedRelevant.filter(
    (s) => s.relation === "insufficient"
  );

  // Evaluate decomposed text atomic claims independently when provided
  const atomicAssessments: AtomicClaimAssessment[] = atomicClaims.map((item) => {
    const scoped = selectSourcesForAtomicClaim(
      item,
      primaryScopedRelevant,
      atomicClaims.length > 1 ||
        primaryScopedRelevant.some(
          (source) =>
            Boolean(source.evaluatedAtomicClaimId) ||
            (source.evaluatedAtomicClaimIds?.length ?? 0) > 0
        )
    );
    const evaluated = resolveVerdictFromBucket({
      relevantSources: scoped,
      outdatedSignalDetected,
    });

    const temporalUnconfirmedForAtom =
      unresolvedTimeContext &&
      item.category === "time_and_location" &&
      evaluated.status === "TRUE";
    const status =
      !containsCheckableClaim || temporalUnconfirmedForAtom
        ? "UNVERIFIED"
        : evaluated.status;
    const statusLabel = formatAtomicStatusLabel(item, status);
    let rationale = "Belum terdapat bukti terindeks yang cukup untuk aspek ini.";

    if (temporalUnconfirmedForAtom) {
      rationale =
        "Tanggal publikasi asli postingan tidak diketahui sehingga konteks waktu relatif belum dapat dipastikan.";
    } else if (status === "TRUE") {
      rationale = `Terkonfirmasi oleh ${evaluated.supportPubsCount} penerbit independen.`;
    } else if (status === "FALSE") {
      rationale = `Dibantah oleh ${evaluated.contradictPubsCount} penerbit independen pada aspek tekstual ini.`;
    } else if (status === "MISLEADING") {
      rationale = "Bukti yang tersedia masih menyisakan konteks parsial atau bertentangan.";
    } else if (status === "OUTDATED") {
      rationale = "Merujuk pada peristiwa atau rekaman masa lalu.";
    }

    return {
      ...item,
      status,
      statusLabel,
      evidenceIds: scoped.map((s) => s.id),
      rationale,
    };
  });

  const baseResolution = resolveVerdictFromBucket({
    relevantSources: primaryScopedRelevant,
    outdatedSignalDetected,
  });

  let claimVerdict: ClaimVerdict = "UNVERIFIED";
  let explanation = "";

  const aggregate = aggregateRequiredAtomicClaims(
    atomicAssessments,
    baseResolution.status
  );
  const optionalUnresolved = atomicAssessments.filter(
    (assessment) =>
      assessment.requiredForFullConfirmation === false &&
      assessment.status !== "TRUE"
  );
  if (!containsCheckableClaim) {
    claimVerdict = "UNVERIFIED";
    explanation =
      "Screenshot tidak memuat klaim faktual berbasis teks yang cukup jelas untuk diuji silang.";
  } else if (primaryScopedRelevant.length === 0) {
    claimVerdict = "UNVERIFIED";
    explanation =
      "Tidak ada sumber yang lolos penyelarasan relevansi untuk proposisi yang diuji.";
  } else {
    claimVerdict = aggregate.status;
    explanation =
      optionalUnresolved.length > 0 && aggregate.status === "TRUE"
        ? `${aggregate.explanation} Aspek tambahan yang tidak menjadi inti klaim masih belum terverifikasi: ${optionalUnresolved.map((assessment) => assessment.label).join(", ")}.`
        : aggregate.explanation;
  }

  if (unresolvedTimeContext && containsCheckableClaim) {
    if (claimVerdict === "TRUE") {
      claimVerdict = "UNVERIFIED";
      explanation =
        "Klaim memuat keterangan waktu relatif ('hari ini'/'kemarin'/dll.), namun tanggal kalender publikasi asli postingan tidak diketahui atau hanya relatif sehingga tidak disamakan otomatis dengan tanggal unggah; konteks waktunya belum dapat dipastikan dan status dijaga tetap UNVERIFIED.";
    } else {
      explanation = `${explanation} Catatan konteks waktu: Tanggal publikasi asli postingan tidak diketahui atau hanya relatif sehingga konteks waktu relatif pada klaim belum dapat dipastikan.`;
    }
  }

  const qualifiedStatusLabels =
    atomicAssessments.length > 0
      ? Array.from(new Set(atomicAssessments.map((a) => a.statusLabel)))
      : undefined;

  const postClassification = formatPostClassificationLabel(postStance);
  const stanceNote =
    postStance === "debunking_claim"
      ? "Pemisahan peran: Unggahan pada screenshot sedang membantah/mengklarifikasi klaim, bukan pembuat hoaks."
      : postStanceSummary;

  const verdictLabelId = verdictToIndonesianLabel(claimVerdict);

  return {
    claimVerdict,
    verdictLabelId,
    postClassification,
    postStance,
    summary: `${claimVerdict} (${verdictLabelId}): ${primaryClaim}`,
    explanation: `${explanation} ${stanceNote}`.trim(),
    ...(qualifiedStatusLabels ? { qualifiedStatusLabels } : {}),
    ...(atomicAssessments.length > 0 ? { atomicAssessments } : {}),
    evidenceMetrics: {
      totalRetrieved: sources.length,
      relevantSources: relevant.length,
      insufficientCount: insufficient.length,
      supportingCount: supporting.length,
      contradictingCount: contradicting.length,
      partialContextCount: partialContext.length,
      officialOrFactCheckCount,
    },
  };
}
