import type { PrototypeScreenMap, PrototypeScreenMapEntry } from "./types.js";

/**
 * Inputs for constructed review URLs.
 * Segments are appended in order: `{reviewHost}/{projectId?}/{deployVersion?}/{prototypePath}`.
 * `projectId` and `deployVersion` are both optional.
 */
export interface ReviewUrlContext {
  reviewHost?: string;
  projectId?: string;
  deployVersion?: string;
  /** When true, `reviewUrl` is copied from `prototypePath` (full URL) — no URL construction. */
  directReviewUrl?: boolean;
}

export function buildReviewUrl(
  ctx: ReviewUrlContext,
  prototypePath: string,
): string | undefined {
  const host = ctx.reviewHost?.trim();
  if (!host) {
    return undefined;
  }
  const normalizedHost = host.replace(/\/$/, "");
  const path = prototypePath.replace(/^\//, "");
  const segments: string[] = [];
  if (ctx.projectId?.trim()) {
    segments.push(encodeURIComponent(ctx.projectId.trim()));
  }
  if (ctx.deployVersion?.trim()) {
    segments.push(encodeURIComponent(ctx.deployVersion.trim()));
  }
  segments.push(path);
  return `${normalizedHost}/${segments.join("/")}`;
}

export function resolveReviewUrlContext(
  sources: Array<ReviewUrlContext | undefined>,
): ReviewUrlContext {
  const merged: ReviewUrlContext = {};
  for (const source of sources) {
    if (!source) continue;
    if (source.reviewHost?.trim()) merged.reviewHost = source.reviewHost.trim();
    if (source.projectId?.trim()) merged.projectId = source.projectId.trim();
    if (source.deployVersion?.trim()) merged.deployVersion = source.deployVersion.trim();
    if (source.directReviewUrl !== undefined) {
      merged.directReviewUrl = source.directReviewUrl;
    }
  }
  return merged;
}

export function attachReviewUrls(
  screens: PrototypeScreenMapEntry[],
  ctx: ReviewUrlContext,
): PrototypeScreenMapEntry[] {
  if (ctx.directReviewUrl) {
    return screens.map((screen) => ({
      ...screen,
      reviewUrl: screen.prototypePath.trim(),
    }));
  }
  if (!ctx.reviewHost?.trim()) {
    return screens;
  }
  return screens.map((screen) => {
    const reviewUrl = buildReviewUrl(ctx, screen.prototypePath);
    return reviewUrl ? { ...screen, reviewUrl } : screen;
  });
}

export function reviewUrlFields(ctx: ReviewUrlContext): Partial<ReviewUrlContext> {
  const out: Partial<ReviewUrlContext> = {};
  if (ctx.reviewHost?.trim()) out.reviewHost = ctx.reviewHost.trim();
  if (ctx.projectId?.trim()) out.projectId = ctx.projectId.trim();
  if (ctx.deployVersion?.trim()) out.deployVersion = ctx.deployVersion.trim();
  if (ctx.directReviewUrl !== undefined) out.directReviewUrl = ctx.directReviewUrl;
  return out;
}

export function canConstructReviewUrls(ctx: ReviewUrlContext): boolean {
  return Boolean(ctx.directReviewUrl || ctx.reviewHost?.trim());
}

export function enrichScreenMapWithReviewUrls(
  screenMap: PrototypeScreenMap,
  sources: Array<ReviewUrlContext | undefined>,
): PrototypeScreenMap {
  const ctx = resolveReviewUrlContext(sources);
  const fields = reviewUrlFields(ctx);

  if (ctx.directReviewUrl) {
    return {
      ...screenMap,
      directReviewUrl: true,
      screens: attachReviewUrls(screenMap.screens, ctx),
    };
  }

  if (!canConstructReviewUrls(ctx)) {
    return screenMap;
  }

  return {
    ...screenMap,
    directReviewUrl: false,
    ...fields,
    screens: attachReviewUrls(screenMap.screens, ctx),
  };
}
