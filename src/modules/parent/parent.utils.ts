export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) return "***" + normalized.slice(atIndex);
  const name = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex);
  const firstChar = name.charAt(0);
  return `${firstChar}***${domain}`;
}

export function validateSafeInternalPath(url: string | null | undefined, fallback: string = "/parent"): string {
  if (!url) return fallback;
  const trimmed = url.trim();
  // Allow only relative internal paths starting with /parent/
  if (trimmed.startsWith("/parent") && !trimmed.startsWith("//") && !trimmed.includes("://")) {
    return trimmed;
  }
  return fallback;
}
