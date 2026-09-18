"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or searchParams change, complete and reset progress safely
  useEffect(() => {
    if (loading) {
      const frame = requestAnimationFrame(() => {
        setProgress(100);
      });
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 250);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }
  }, [pathname, searchParams, loading]);

  // Safety fallback: cancel loading if it takes more than 4 seconds
  useEffect(() => {
    if (!loading) return;
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 4000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;

      if (!anchor || !anchor.href) return;

      // Ignore hash links on the same page
      if (anchor.getAttribute("href")?.startsWith("#")) return;

      try {
        const currentOrigin = window.location.origin;
        const targetUrl = new URL(anchor.href, window.location.href);

        // Only trigger for same-origin internal navigations
        if (
          targetUrl.origin === currentOrigin &&
          !anchor.target &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          (targetUrl.pathname !== window.location.pathname ||
            targetUrl.search !== window.location.search)
        ) {
          setLoading(true);
          setProgress(25);

          const step1 = setTimeout(() => setProgress(60), 150);
          const step2 = setTimeout(() => setProgress(85), 400);

          return () => {
            clearTimeout(step1);
            clearTimeout(step2);
          };
        }
      } catch {
        // Safe ignore
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => {
      document.removeEventListener("click", handleAnchorClick);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-purple-500 to-indigo-500 transition-all duration-300 ease-out shadow-sm"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "width 150ms ease-out, opacity 250ms ease-out" : "width 300ms ease-out",
        }}
      />
    </div>
  );
}
