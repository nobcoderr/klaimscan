export function sanitizeApiErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : "Terjadi kesalahan saat menjalankan pipeline analisis.";

  return raw
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/AIza[0-9A-Za-z_-]{15,}/g, "[REDACTED_API_KEY]")
    .slice(0, 400);
}
