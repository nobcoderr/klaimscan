import { sanitizePublicEvidenceUrl } from "@/lib/security/url-guard";
import type {
  ClaimExtractionResult,
  EvidenceSource,
  OriginTimelineEvent,
  PublicOriginTrace,
} from "@/lib/types";

export function buildPublicOriginTrace(params: {
  extraction: ClaimExtractionResult;
  sources: EvidenceSource[];
  checkedAt: string;
}): PublicOriginTrace {
  const { extraction, sources, checkedAt } = params;

  const safeVisiblePostUrl = sanitizePublicEvidenceUrl(
    extraction.visiblePostUrl
  );

  const clarificationSources = sources
    .filter(
      (s) =>
        s.relation !== "irrelevant" &&
        (s.sourceTier === "official_government" ||
          s.sourceTier === "fact_checker")
    )
    .slice(0, 6)
    .map((s) => ({
      publisher: s.publisher,
      url: s.url,
      tier: s.sourceTier,
      publishedAt: s.publishedAt,
    }));

  const timeline: OriginTimelineEvent[] = [
    {
      id: "tl-observed",
      timestampLabel: extraction.visibleTimestamp || "Terlihat pada screenshot",
      eventType: "post_observed",
      title: `Unggahan teramati di ${extraction.platform}`,
      description: [
        extraction.visibleAccountHandle
          ? `Username publik terlihat: ${extraction.visibleAccountHandle}`
          : "Tidak ada username publik yang terbaca jelas pada screenshot",
        `Sikap postingan: ${extraction.postStanceSummary}`,
      ].join(" · "),
      sourceUrl: safeVisiblePostUrl,
    },
  ];

  for (const src of sources
    .filter((s) => s.relation !== "irrelevant")
    .slice(0, 6)) {
    timeline.push({
      id: `tl-${src.id}`,
      timestampLabel: src.publishedAt
        ? src.publicationDateBasis === "verified"
          ? `Terbit terverifikasi: ${src.publishedAt}`
          : `Tanggal terbit belum diverifikasi: ${src.publishedAt}`
        : src.inferredPublishedAt
          ? `Tanggal terbit perkiraan dari URL: ${src.inferredPublishedAt}`
          : src.sourceEventDate
            ? `Tanggal peristiwa (${src.sourceEventDateBasis ?? "unknown"}): ${src.sourceEventDate}`
            : "Tanggal terbit/peristiwa tidak diketahui",
      eventType:
        src.sourceTier === "official_government"
          ? "official_statement"
          : "fact_check_prior",
      title: `${src.publisher} (${src.relation})`,
      description: src.title,
      sourceUrl: src.url,
      verifiedDate:
        src.publicationDateBasis === "verified" ? src.publishedAt : null,
    });
  }

  timeline.push({
    id: "tl-verified-now",
    timestampLabel: checkedAt,
    eventType: "verification_run",
    title: "Verifikasi KLAIMSCAN AI selesai",
    description:
      "Pemeriksaan silang sumber terbuka dan penyusunan laporan investigasi selesai.",
    sourceUrl: null,
    verifiedDate: checkedAt,
  });

  return {
    platform: extraction.platform,
    visibleAccountHandle: extraction.visibleAccountHandle,
    visibleAccountName: extraction.visibleAccountName,
    visiblePostUrl: safeVisiblePostUrl,
    visibleTimestamp: extraction.visibleTimestamp,
    clarificationSources,
    timeline,
    privacyGuarantee:
      "Hanya mengekstrak username dan URL publik yang terlihat pada screenshot serta sumber terbuka (OSINT). Sistem tidak pernah mengklaim menemukan IP pribadi, alamat rumah, lokasi GPS presisi, atau identitas hukum pengunggah.",
    attributionCaveat:
      "Postingan publik paling awal yang teramati tidak boleh disimpulkan sebagai penulis asli atau pembuat pertama klaim.",
  };
}
