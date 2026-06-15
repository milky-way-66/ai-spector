export type CourseLocale = "en";

export const DEFAULT_COURSE_LOCALE: CourseLocale = "en";

export const SUPPORTED_COURSE_LOCALES: readonly CourseLocale[] = ["en"] as const;

export interface CourseUiStrings {
  course: string;
  courseTitle: string;
  brandSub: string;
  searchPlaceholder: string;
  searchAria: string;
  onThisPage: string;
  previous: string;
  next: string;
  lessonOf: (index: number, total: number) => string;
  lessonBadge: (index: number, total: number) => string;
  browse: string;
  progressTitle: string;
  tryInChat: string;
  openNav: string;
  copy: string;
  copied: string;
  inEditor: string;
}

const UI: CourseUiStrings = {
  course: "Course",
  courseTitle: "AI Spector Course",
  brandSub: "15 lessons · ~10 min each",
  searchPlaceholder: "Search lessons…",
  searchAria: "Search lessons",
  onThisPage: "On this page",
  previous: "Previous",
  next: "Next",
  lessonOf: (i, t) => `Lesson ${i}/${t}`,
  lessonBadge: (i, t) => `Lesson ${i} of ${t}`,
  browse: "Browse",
  progressTitle: "Course progress",
  tryInChat: "Try in chat ↓",
  openNav: "Open navigation",
  copy: "Copy",
  copied: "Copied",
  inEditor: "In Cursor / Claude Code:",
};

export const SECTION_LABELS: Record<string, string> = {
  "01-get-started": "Get started",
  "02-chat-basics": "Chat basics",
  "03-graph": "Graph & sources",
  "04-generate": "Generate documents",
  "05-prototype": "Design & prototype",
  "06-review": "Review & changes",
  "07-advanced": "Advanced",
};

const CHAT_HINTS: Record<string, string> = {
  "01-get-started": "Try in chat: <code>setup ai-spector project</code>",
  "02-chat-basics": "Try in chat: <code>help me approve</code> or <code>active tasks</code>",
  "03-graph": "Try in chat: <code>analyze my data source</code> or <code>validate the graph</code>",
  "04-generate": "Try in chat: <code>generate the SRS</code> or <code>generate basic design</code>",
  "05-prototype": "Try in chat: <code>generate prototype</code> or <code>help me pick a theme</code>",
  "06-review": "Try in chat: <code>review documents</code> or <code>resolve comments</code>",
  "07-advanced": "Try in chat: <code>set up template pack</code> or <code>find mentions of rate limiting</code>",
  default:
    "Ask in chat: <code>open the ai-spector course</code> or <code>help me learn ai-spector</code>",
};

export function courseUi(_locale: CourseLocale = DEFAULT_COURSE_LOCALE): CourseUiStrings {
  return UI;
}

export function sectionLabelForLocale(sectionId: string, _locale: CourseLocale = DEFAULT_COURSE_LOCALE): string {
  return SECTION_LABELS[sectionId] ?? sectionId;
}

export function chatHintForSection(
  sectionId: string | undefined,
  _locale: CourseLocale = DEFAULT_COURSE_LOCALE,
): string {
  if (sectionId && CHAT_HINTS[sectionId]) {
    return CHAT_HINTS[sectionId];
  }
  return CHAT_HINTS.default;
}

export function coursePathPrefix(_locale: CourseLocale = DEFAULT_COURSE_LOCALE): string {
  return "/course";
}

export function coursePageUrl(_locale: CourseLocale, slug: string): string {
  const base = coursePathPrefix();
  return `${base}/${slug === "index" ? "index" : slug}`;
}

export function parseCourseRequest(pathname: string): { locale: CourseLocale; slug: string } {
  const trimmed = pathname.replace(/^\/course\/?/, "").replace(/\/$/, "");
  if (!trimmed || trimmed === "index") {
    return { locale: "en", slug: "index" };
  }
  return { locale: "en", slug: trimmed };
}

export function normalizeCourseLocale(_value?: string): CourseLocale {
  return "en";
}
