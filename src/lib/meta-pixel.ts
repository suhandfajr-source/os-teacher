export type ConversionData = {
  eventId: string;
  params: { content_ids: string[]; content_name: string; value: number; currency: string };
};

export type PaymentState = "CHECKING" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "UNVERIFIED" | "UNAVAILABLE";
export type PaymentStatusResult = { status: PaymentState; live?: boolean; tracking?: ConversionData | null };

declare global {
  interface Window {
    klassaMarketingOptOut?: boolean;
    klassaMeta?: {
      pageView: () => Promise<boolean>;
      track: (event: "Lead" | "Purchase", data: ConversionData) => Promise<boolean>;
      optOut: () => void;
    };
  }
}

export function disableMarketingTracking() {
  window.klassaMarketingOptOut = true;
  try { localStorage.setItem("klassa_marketing_opt_out", "1"); } catch { /* may be unavailable */ }
  window.klassaMeta?.optOut();
}

// The shared browser script owns SDK loading, opt-out checks and deduplication.
export async function trackPaidResult(result: PaymentStatusResult) {
  if (result.live !== true || result.status !== "PAID" || !result.tracking || !window.klassaMeta) return;
  await window.klassaMeta.pageView();
  await window.klassaMeta.track("Purchase", result.tracking);
}
