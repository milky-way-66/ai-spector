export type CourseLocale = "en" | "vi";

export const DEFAULT_COURSE_LOCALE: CourseLocale = "en";

export const SUPPORTED_COURSE_LOCALES: readonly CourseLocale[] = ["en", "vi"] as const;

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
  langEn: string;
  langVi: string;
}

const UI: Record<CourseLocale, CourseUiStrings> = {
  en: {
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
    langEn: "English",
    langVi: "Tiếng Việt",
  },
  vi: {
    course: "Khóa học",
    courseTitle: "Khóa học AI Spector",
    brandSub: "15 bài · ~10 phút mỗi bài",
    searchPlaceholder: "Tìm bài học…",
    searchAria: "Tìm bài học",
    onThisPage: "Trên trang này",
    previous: "Trước",
    next: "Sau",
    lessonOf: (i, t) => `Bài ${i}/${t}`,
    lessonBadge: (i, t) => `Bài ${i} / ${t}`,
    browse: "Duyệt",
    progressTitle: "Tiến độ khóa học",
    tryInChat: "Thử trong chat ↓",
    openNav: "Mở menu điều hướng",
    copy: "Sao chép",
    copied: "Đã sao chép",
    inEditor: "Trong Cursor / Claude Code:",
    langEn: "English",
    langVi: "Tiếng Việt",
  },
};

export const SECTION_LABELS: Record<CourseLocale, Record<string, string>> = {
  en: {
    "01-get-started": "Get started",
    "02-chat-basics": "Chat basics",
    "03-graph": "Graph & sources",
    "04-generate": "Generate documents",
    "05-prototype": "Design & prototype",
    "06-review": "Review & changes",
    "07-advanced": "Advanced",
  },
  vi: {
    "01-get-started": "Bắt đầu",
    "02-chat-basics": "Chat cơ bản",
    "03-graph": "Graph & sources",
    "04-generate": "Generate",
    "05-prototype": "Prototype",
    "06-review": "Review",
    "07-advanced": "Nâng cao",
  },
};

const CHAT_HINTS: Record<CourseLocale, Record<string, string>> = {
  en: {
    "01-get-started": "Try in chat: <code>setup ai-spector project</code>",
    "02-chat-basics": "Try in chat: <code>help me approve</code> or <code>active tasks</code>",
    "03-graph": "Try in chat: <code>analyze my data source</code> or <code>validate the graph</code>",
    "04-generate": "Try in chat: <code>generate the SRS</code> or <code>generate basic design</code>",
    "05-prototype": "Try in chat: <code>generate prototype</code> or <code>help me pick a theme</code>",
    "06-review": "Try in chat: <code>review documents</code> or <code>resolve comments</code>",
    "07-advanced": "Try in chat: <code>set up template pack</code> or <code>find mentions of rate limiting</code>",
    default:
      "Ask in chat: <code>open the ai-spector course</code> or <code>help me learn ai-spector</code>",
  },
  vi: {
    "01-get-started": "Thử trong chat: <code>setup ai-spector project</code>",
    "02-chat-basics": "Thử trong chat: <code>help me approve</code> hoặc <code>active tasks</code>",
    "03-graph": "Thử trong chat: <code>analyze my data source</code> hoặc <code>validate the graph</code>",
    "04-generate": "Thử trong chat: <code>generate the SRS</code> hoặc <code>generate basic design</code>",
    "05-prototype": "Thử trong chat: <code>generate prototype</code> hoặc <code>help me pick a theme</code>",
    "06-review": "Thử trong chat: <code>review documents</code> hoặc <code>resolve comments</code>",
    "07-advanced": "Thử trong chat: <code>set up template pack</code> hoặc <code>find mentions of rate limiting</code>",
    default:
      "Hỏi trong chat: <code>mở khóa học ai-spector</code> hoặc <code>hướng dẫn tôi dùng ai-spector</code>",
  },
};

export function courseUi(locale: CourseLocale): CourseUiStrings {
  return UI[locale];
}

export function sectionLabelForLocale(sectionId: string, locale: CourseLocale): string {
  return SECTION_LABELS[locale][sectionId] ?? sectionId;
}

export function chatHintForSection(sectionId: string | undefined, locale: CourseLocale): string {
  const hints = CHAT_HINTS[locale];
  if (sectionId && hints[sectionId]) {
    return hints[sectionId];
  }
  return hints.default;
}

export function coursePathPrefix(locale: CourseLocale): string {
  return locale === "vi" ? "/course/vi" : "/course";
}

export function coursePageUrl(locale: CourseLocale, slug: string): string {
  const base = coursePathPrefix(locale);
  return `${base}/${slug === "index" ? "index" : slug}`;
}

export function parseCourseRequest(pathname: string): { locale: CourseLocale; slug: string } {
  const trimmed = pathname.replace(/^\/course\/?/, "").replace(/\/$/, "");
  if (!trimmed || trimmed === "index") {
    return { locale: "en", slug: "index" };
  }
  const parts = trimmed.split("/");
  if (parts[0] === "vi") {
    const rest = parts.slice(1).join("/");
    return { locale: "vi", slug: rest || "index" };
  }
  return { locale: "en", slug: trimmed };
}

export function normalizeCourseLocale(value?: string): CourseLocale {
  return value === "vi" ? "vi" : "en";
}
