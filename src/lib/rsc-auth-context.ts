import { cache } from "react";
import { verifyActiveSchoolMembership } from "@/lib/authorization";

/**
 * RSC-scoped memoized authorization context.
 * 
 * Uses React.cache() strictly for request-scoped deduplication across Server Components (RSC)
 * during a single HTTP render pass.
 * 
 * Invariants:
 * - NO cross-request caching
 * - NO cross-user caching
 * - NO global Map or module-level persistent cache
 * - NO unstable_cache authorization caching
 * - Garbage collected immediately at the conclusion of the RSC render lifecycle
 * - Fail-closed: rejections bubble up identically to uncached authorization calls
 */
export const getRscAuthContext = cache(async () => {
  return await verifyActiveSchoolMembership();
});
