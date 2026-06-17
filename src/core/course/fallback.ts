import type { CoursePage } from "./catalog.js";
import { pageBySlug } from "./catalog.js";
import type { CourseLocale } from "./locale.js";

export interface PageResolveResult {
  page?: CoursePage;
  fallback: boolean;
  bodyLocale: CourseLocale;
}

export function resolvePageWithFallback(
  locale: CourseLocale,
  slug: string,
  localePages: CoursePage[],
  enPages: CoursePage[],
): PageResolveResult {
  const page = pageBySlug(localePages, slug);
  if (page) {
    return { page, fallback: false, bodyLocale: locale };
  }
  if (locale === "vi") {
    const enPage = pageBySlug(enPages, slug);
    if (enPage) {
      return { page: enPage, fallback: true, bodyLocale: "en" };
    }
  }
  return { fallback: false, bodyLocale: locale };
}
