const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<![A-Z0-9])(?:\+?\d[\d\s().-]{7,}\d)(?![A-Z0-9])/gi;

/** Remove direct contact details before any resume text is sent to an LLM. */
export function sanitizeResumeText(text) {
  return String(text ?? "")
    .replace(EMAIL_PATTERN, "[EMAIL REDACTED]")
    .replace(PHONE_PATTERN, "[PHONE REDACTED]");
}
