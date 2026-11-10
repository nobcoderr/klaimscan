import type {
  AtomicClaimAssessment,
  AtomicClaimItem,
  ClaimVerdict,
  EvidenceSource,
  PostStance,
  VerdictAssessment,
} from "@/lib/types";

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
      return "Hoaks / Salah";
    case "TRUE":
      return "Terverifikasi / Benar";
    case "MISLEADING":
      return "Menyesatkan";
    case "OUTDATED":
      return "Kedaluwarsa";
    case "UNVERIFIED":
    default:
      return "Belum Terverifikasi";
  }
}

const MULTI_LEVEL_SUFFIXES = [
  ".go.id",
  ".co.id",
  ".or.id",
  ".ac.id",
  ".mil.id",
  ".sch.id",
  ".web.id",
  ".my.id",
  ".biz.id",
  ".gov.uk",
  ".co.uk",
  ".org.uk",
  ".gov.au",
  ".com.au",
  ".gov.sg",
  ".gc.ca",
];

function weightForSource(source: EvidenceSource): number {
  switch (source.sourceTier) {
    case "official_government":
      return 3;
    case "fact_checker":
      return 2.5;
    case "credible_media":
      return 1.5;
    case "public_source":
    default:
      return 1;
  }
}

export function extractRegistrableRoot(domainOrUrl: string): string {
  const raw = domainOrUrl.trim().toLowerCase();
  if (!raw) return "";

  let host = raw;
  if (raw.includes("://")) {
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      host = raw;
    }
  } else {
    host = raw.split("/")[0]?.split(":")[0] ?? "";
  }

  host = host.replace(/\.+$/, "").replace(/^www\./, "");
  if (!host) return "";

  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;

  if (MULTI_LEVEL_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return labels.slice(-Math.min(3, labels.length)).join(".");
  }

  return labels.slice(-2).join(".");
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
    if (!existing || weightForSource(source) > weightForSource(existing)) {
      byPublisher.set(key, source);
    }
  }

  return Array.from(byPublisher.values());
}

function hasOfficialOrFactCheck(sources: EvidenceSource[]): boolean {
  return sources.some(
    (s) =>
      s.sourceTier === "official_government" || s.sourceTier === "fact_checker"
  );
}

function hasNonPublicSource(sources: EvidenceSource[]): boolean {
  return sources.some((s) => s.sourceTier !== "public_source");
}

function countCredibleMedia(sources: EvidenceSource[]): number {
  return sources.filter((s) => s.sourceTier === "credible_media").length;
}

function hasIndependentCorroboration(sources: EvidenceSource[]): boolean {
  return hasOfficialOrFactCheck(sources) || countCredibleMedia(sources) >= 2;
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
    hasNonPublicSource(partialPubs) &&
    partialScore >= supportScore &&
    partialScore >= contradictScore
  ) {
    status = params.outdatedSignalDetected ? "OUTDATED" : "MISLEADING";
  } else if (
    contradictScore > 0 &&
    supportScore > 0 &&
    hasNonPublicSource(supportPubs) &&
    hasNonPublicSource(contradictPubs)
  ) {
    status = "MISLEADING";
  } else if (
    supportScore > 0 &&
    (contradictScore === 0 ||
      (hasOfficialOrFactCheck(supportPubs) &&
        !hasNonPublicSource(contradictPubs) &&
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
  relevantSources: EvidenceSource[]
): EvidenceSource[] {
  const textScoped = relevantSources.filter(
    (s) => s.targetAspect !== "image_authenticity"
  );

  if (item.category === "formal_legal_status") {
    const explicitLegal = textScoped.filter(
      (s) =>
        s.evaluatedAtomicClaimId === item.id ||
        s.targetAspect === "official_legal_status"
    );
    if (explicitLegal.length > 0) {
      return explicitLegal;
    }

    // Fallback when sources didn't tag official_legal_status explicitly:
    // ONLY accept sources confirming a finalized formal/legal status (never preliminary intention reports!)
    return textScoped.filter((s) => {
      const corpus =
        `${s.title} ${s.snippet} ${s.claimEvaluated} ${s.rationale}`.toLowerCase();
      const mentionsFormalStep =
        /(ditetapkan\s+sebagai\s+tersangka|penetapan\s+tersangka|status\s+tersangka|resmi\s+menjadi\s+tersangka|surat\s+pengunduran\s+diri\s+telah\s+diserahkan|disahkan|diterbitkan)/.test(
          corpus
        );
      const preliminaryIntentionOnly =
        /\b(niat|berniat|keinginan|menghendaki|wacana|rencana|belum\s+mengajukan|belum\s+resmi|belum\s+menyerahkan)\b/.test(
          corpus
        );
      return mentionsFormalStep && !preliminaryIntentionOnly;
    });
  }

  const explicitlyAssigned = textScoped.filter(
    (s) => s.evaluatedAtomicClaimId === item.id
  );

  if (item.category === "main_event" || item.category === "caption_context") {
    const eventPool = textScoped.filter(
      (s) =>
        s.evaluatedAtomicClaimId === item.id ||
        !s.evaluatedAtomicClaimId ||
        s.targetAspect === "event_occurrence" ||
        s.targetAspect === "text_claim" ||
        (s.targetAspect === "official_legal_status" &&
          s.relation === "supporting")
    );
    return Array.from(new Set(eventPool));
  }

  if (explicitlyAssigned.length > 0) {
    return explicitlyAssigned;
  }

  // Fallback for person_and_role / time_and_location when sources weren't explicitly tagged with this ID
  return textScoped.filter(
    (s) =>
      !s.evaluatedAtomicClaimId ||
      s.targetAspect === "event_occurrence" ||
      s.targetAspect === "text_claim"
  );
}

function formatAtomicStatusLabel(
  item: AtomicClaimItem,
  status: ClaimVerdict
): string {
  const lower = item.proposition.toLowerCase();
  if (item.category === "formal_legal_status") {
    if (status === "TRUE") return "OFFICIAL STATUS CONFIRMED";
    if (status === "FALSE") return "OFFICIAL STATUS FALSE";
    return "FORMAL STATUS UNVERIFIED";
  }
  if (item.category === "caption_context") {
    if (status === "TRUE") return "CAPTION CONTEXT CONFIRMED";
    if (status === "FALSE") return "CAPTION CONTEXT FALSE";
    return "CAPTION CONTEXT UNVERIFIED";
  }
  if (item.category === "main_event" && /(niat|intention|keinginan|permohonan)/.test(lower)) {
    if (status === "TRUE") return "INTENTION CONFIRMED";
    if (status === "FALSE") return "INTENTION FALSE";
    return "INTENTION UNVERIFIED";
  }
  if (status === "TRUE") return "EVENT CONFIRMED";
  if (status === "FALSE") return "EVENT FALSE";
  if (status === "MISLEADING") return "EVENT MISLEADING";
  if (status === "OUTDATED") return "EVENT OUTDATED";
  return "EVENT UNVERIFIED";
}

export function computeVerdictFromEvidence(params: {
  primaryClaim: string;
  postStance: PostStance;
  postStanceSummary: string;
  sources: EvidenceSource[];
  atomicClaims?: AtomicClaimItem[];
  outdatedSignalDetected?: boolean;
  containsCheckableClaim?: boolean;
}): VerdictAssessment {
  const {
    primaryClaim,
    postStance,
    postStanceSummary,
    sources,
    atomicClaims = [],
    outdatedSignalDetected = false,
    containsCheckableClaim = true,
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

  // Evaluate decomposed text atomic claims independently when provided
  const atomicAssessments: AtomicClaimAssessment[] = atomicClaims.map((item) => {
    const scoped = selectSourcesForAtomicClaim(item, primaryScopedRelevant);
    const evaluated = resolveVerdictFromBucket({
      relevantSources: scoped,
      outdatedSignalDetected,
    });

    const status = containsCheckableClaim ? evaluated.status : "UNVERIFIED";
    const statusLabel = formatAtomicStatusLabel(item, status);
    let rationale = "Belum terdapat bukti terindeks yang cukup untuk aspek ini.";

    if (status === "TRUE") {
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

  const confirmedMainEvent = atomicAssessments.find(
    (a) => a.category === "main_event" && a.status === "TRUE"
  );
  const unresolvedRequiredFormal = atomicAssessments.find(
    (a) =>
      a.requiredForFullConfirmation !== false &&
      a.category === "formal_legal_status" &&
      (a.status === "UNVERIFIED" || a.status === "MISLEADING")
  );
  const rejectedRequiredFormal = atomicAssessments.find(
    (a) =>
      a.requiredForFullConfirmation !== false &&
      a.category === "formal_legal_status" &&
      a.status === "FALSE"
  );

  if (!containsCheckableClaim) {
    claimVerdict = "UNVERIFIED";
    explanation =
      "Screenshot tidak memuat klaim faktual berbasis teks yang cukup jelas untuk diuji silang dengan sumber resmi.";
  } else if (primaryScopedRelevant.length === 0 && !confirmedMainEvent) {
    claimVerdict = "UNVERIFIED";
    explanation =
      "Tidak ditemukan sumber resmi, artikel pemeriksa fakta, atau bukti teks relevan yang memadai (setelah memisahkan arsip kedaluwarsa atau klarifikasi foto sampul) untuk memastikan kebenaran klaim.";
  } else if (confirmedMainEvent && rejectedRequiredFormal) {
    claimVerdict = "MISLEADING";
    explanation = `Klaim atomik peristiwa/niat telah terkonfirmasi (${confirmedMainEvent.proposition}), namun aspek formal/hukum resmi (${rejectedRequiredFormal.proposition}) dibantah oleh bukti resmi sehingga klaim utuh bersifat sebagian benar / menyesatkan.`;
  } else if (
    confirmedMainEvent &&
    unresolvedRequiredFormal &&
    baseResolution.status !== "FALSE"
  ) {
    // Safe qualified assessment when primary event/intention is confirmed but formal legal step lacks verification
    claimVerdict = "UNVERIFIED";
    explanation = `Klaim atomik peristiwa/niat telah terkonfirmasi (${confirmedMainEvent.proposition}), namun aspek formal/hukum (${unresolvedRequiredFormal.proposition}) belum terbukti oleh dokumen atau konfirmasi resmi. Status keseluruhan dijaga konservatif agar tidak melebih-lebihkan kepastian.`;
  } else {
    claimVerdict = baseResolution.status;

    if (claimVerdict === "OUTDATED") {
      explanation =
        "Bukti terverifikasi menunjukkan informasi atau klaim teks berasal dari kejadian lama yang diunggah ulang seolah baru terjadi.";
    } else if (claimVerdict === "FALSE") {
      explanation = `Ditemukan ${baseResolution.contradictPubsCount} penerbit independen (${baseResolution.contradictingTotalCount} rujukan) yang membantah klaim teks "${primaryClaim}", termasuk klarifikasi resmi, pemeriksa fakta terakreditasi, atau koroborasi multi-media.`;
    } else if (claimVerdict === "MISLEADING") {
      explanation =
        "Bukti kredibel menunjukkan klaim teks hanya benar sebagian, memerlukan konteks tambahan, atau memiliki sumber kredibel yang saling bertentangan.";
    } else if (claimVerdict === "TRUE") {
      explanation = `Klaim teks "${primaryClaim}" terkonfirmasi oleh ${baseResolution.supportPubsCount} penerbit independen otoritatif/kredibel tanpa bantahan terhadap peristiwa utamanya.`;
    } else {
      explanation =
        "Bukti relevan yang ditemukan belum memenuhi ambang koroborasi independen untuk menyimpulkan klaim teks secara utuh; verdict dijaga tetap UNVERIFIED.";
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
      supportingCount: supporting.length,
      contradictingCount: contradicting.length,
      partialContextCount: partialContext.length,
      officialOrFactCheckCount,
    },
  };
}
