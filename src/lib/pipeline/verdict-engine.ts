import type {
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

export function computeVerdictFromEvidence(params: {
  primaryClaim: string;
  postStance: PostStance;
  postStanceSummary: string;
  sources: EvidenceSource[];
  outdatedSignalDetected?: boolean;
  containsCheckableClaim?: boolean;
}): VerdictAssessment {
  const {
    primaryClaim,
    postStance,
    postStanceSummary,
    sources,
    outdatedSignalDetected = false,
    containsCheckableClaim = true,
  } = params;

  const relevant = sources.filter((s) => s.relation !== "irrelevant");
  const supporting = relevant.filter((s) => s.relation === "supporting");
  const contradicting = relevant.filter((s) => s.relation === "contradicting");
  const partialContext = relevant.filter(
    (s) => s.relation === "partial_context"
  );

  const officialOrFactCheckCount = relevant.filter(
    (s) =>
      s.sourceTier === "official_government" || s.sourceTier === "fact_checker"
  ).length;

  const supportScore = supporting.reduce((sum, s) => sum + weightForSource(s), 0);
  const contradictScore = contradicting.reduce(
    (sum, s) => sum + weightForSource(s),
    0
  );
  const partialScore = partialContext.reduce(
    (sum, s) => sum + weightForSource(s),
    0
  );

  let claimVerdict: ClaimVerdict = "UNVERIFIED";
  let explanation = "";

  if (!containsCheckableClaim) {
    claimVerdict = "UNVERIFIED";
    explanation =
      "Screenshot tidak memuat klaim faktual spesifik yang dapat diuji silang dengan sumber resmi.";
  } else if (relevant.length === 0) {
    claimVerdict = "UNVERIFIED";
    explanation =
      "Tidak ditemukan sumber resmi, artikel pemeriksa fakta, atau bukti terverifikasi yang memadai untuk memastikan kebenaran klaim.";
  } else if (
    outdatedSignalDetected &&
    contradictScore <= partialScore &&
    supportScore === 0
  ) {
    claimVerdict = "OUTDATED";
    explanation =
      "Bukti yang ditemukan menunjukkan informasi, foto, atau peristiwa berasal dari kejadian lama yang diunggah ulang seolah baru terjadi.";
  } else if (
    contradictScore > 0 &&
    contradictScore >= supportScore * 1.5 &&
    (contradicting.some(
      (s) =>
        s.sourceTier === "official_government" ||
        s.sourceTier === "fact_checker"
    ) ||
      contradicting.length >= 2)
  ) {
    claimVerdict = "FALSE";
    explanation = `Ditemukan ${contradicting.length} sumber bukti yang membantah klaim "${primaryClaim}", termasuk klarifikasi resmi atau pemeriksa fakta terverifikasi.`;
  } else if (
    partialScore > 0 &&
    partialScore >= supportScore &&
    partialScore >= contradictScore
  ) {
    claimVerdict = outdatedSignalDetected ? "OUTDATED" : "MISLEADING";
    explanation = outdatedSignalDetected
      ? "Klaim memelintir konteks waktu dari peristiwa lama yang tidak lagi berlaku saat ini."
      : "Bukti menunjukkan klaim mengandung sebagian fakta yang dipotong atau diberi konteks yang menyesatkan.";
  } else if (contradictScore > 0 && supportScore > 0) {
    claimVerdict = "MISLEADING";
    explanation =
      "Terdapat bukti yang saling bertentangan atau memerlukan konteks tambahan sehingga narasi klaim berpotensi menyesatkan.";
  } else if (
    supportScore > 0 &&
    contradictScore === 0 &&
    (supporting.some(
      (s) =>
        s.sourceTier === "official_government" ||
        s.sourceTier === "fact_checker" ||
        s.sourceTier === "credible_media"
    ) ||
      supporting.length >= 2)
  ) {
    claimVerdict = "TRUE";
    explanation = `Klaim "${primaryClaim}" terkonfirmasi oleh ${supporting.length} sumber kredibel tanpa adanya bantahan resmi.`;
  } else {
    claimVerdict = "UNVERIFIED";
    explanation =
      "Sumber yang ditemukan belum cukup otoritatif atau belum spesifik untuk menyimpulkan kebenaran klaim.";
  }

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
