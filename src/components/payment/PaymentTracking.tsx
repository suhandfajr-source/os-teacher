"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { trackPaidResult, type PaymentState, type PaymentStatusResult } from "@/lib/meta-pixel";

export function PaymentTracking({ onStatus, attempt }: { onStatus: (status: PaymentState) => void; attempt: number }) {
  const [result, setResult] = useState<PaymentStatusResult | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    // Callback proofs are already exchanged server-side. Ignore and remove arbitrary
    // query/hash parameters before loading any marketing script on this page.
    if (window.location.search || window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let checks = 0;
    onStatus("CHECKING");
    async function poll() {
      checks++;
      let next: PaymentStatusResult = { status: "UNAVAILABLE" };
      try {
        const response = await fetch("/api/payment/status", {
          cache: "no-store", credentials: "same-origin",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (response.ok || response.status === 401 || response.status === 404) next = await response.json();
      } catch { /* delayed webhook/network failure never counts as a purchase */ }
      if (controller.signal.aborted) return;
      setResult(next);
      onStatus(next.status);
      if ((next.status === "PENDING" || next.status === "UNAVAILABLE") && checks < 15) {
        timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [attempt, onStatus]);

  useEffect(() => {
    if (scriptReady && result) void trackPaidResult(result).catch(() => { /* tracking is optional */ });
  }, [scriptReady, result]);

  // Only a real, server-verified paid result enables Meta. No SDK on forged/mock returns.
  if (!result?.live || result.status !== "PAID") return null;
  return <Script src="/meta-pixel.js?v=1" strategy="afterInteractive" onReady={() => setScriptReady(true)} />;
}
