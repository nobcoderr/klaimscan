import type { PipelineStepState } from "@/lib/types";

export function createInitialPipelineSteps(): PipelineStepState[] {
  return [
    {
      id: "image_processing",
      code: "01",
      label: "Image Processing",
      description:
        "Validasi signature PNG/JPG/WebP (maks. 5 MB) & hapus metadata EXIF/XMP",
      status: "pending",
    },
    {
      id: "claim_extraction",
      code: "02",
      label: "Text-First OCR & Claim Extraction",
      description:
        "Stage A: OCR teks berita/overlay/caption · Stage B: normalisasi klaim berbasis teks",
      status: "pending",
    },
    {
      id: "evidence_retrieval",
      code: "03",
      label: "Web Evidence Search",
      description:
        "Penelusuran langsung via OpenAI web_search & Google Fact Check API",
      status: "pending",
    },
    {
      id: "evidence_comparison",
      code: "04",
      label: "Evidence Verification",
      description:
        "Petakan bukti mendukung vs membantah dengan proteksi prompt injection",
      status: "pending",
    },
    {
      id: "verdict_engine",
      code: "05",
      label: "Verdict Engine",
      description:
        "Tetapkan verdict berbasis bukti tanpa skor probabilitas buatan",
      status: "pending",
    },
    {
      id: "report_generator",
      code: "06",
      label: "Case Report & Trace",
      description:
        "Susun Public Source Trace, limitasi eksplisit, & laporan siap PDF",
      status: "pending",
    },
  ];
}
