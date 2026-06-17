import { DEFAULT_COURSE_LOCALE, sectionLabelForLocale, type CourseLocale } from "./locale.js";

/** English section labels (default). */
export const SECTION_LABELS: Record<string, string> = {
  "01-welcome": "Welcome",
  "02-get-started": "Get started",
  "03-chat-basics": "Chat basics",
  "04-changes": "Changes",
  "05-generate": "Generate",
  "06-review": "Review",
  "07-everyday": "Everyday",
};

export function sectionIdFromRelPath(relPath: string): string | undefined {
  const parts = relPath.split("/");
  if (parts.length < 2) {
    return undefined;
  }
  return parts[0];
}

export function sectionLabel(sectionId: string, locale: CourseLocale = DEFAULT_COURSE_LOCALE): string {
  return sectionLabelForLocale(sectionId, locale) ?? humanizeSectionId(sectionId);
}

function humanizeSectionId(sectionId: string): string {
  const name = sectionId.replace(/^\d+-/, "").replace(/-/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
