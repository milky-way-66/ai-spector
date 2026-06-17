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
  localeFallback: string;
}

const UI_EN: CourseUiStrings = {
  course: "Course",
  courseTitle: "AI Spector Course",
  brandSub: "9 lessons · ~10 min each",
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
  localeFallback: "Vietnamese translation not available yet — showing English.",
};

const UI_VI: CourseUiStrings = {
  course: "Khóa học",
  courseTitle: "Khóa học AI Spector",
  brandSub: "9 bài · ~10 phút mỗi bài",
  searchPlaceholder: "Tìm bài học…",
  searchAria: "Tìm bài học",
  onThisPage: "Trong trang này",
  previous: "Trước",
  next: "Tiếp",
  lessonOf: (i, t) => `Bài ${i}/${t}`,
  lessonBadge: (i, t) => `Bài ${i} / ${t}`,
  browse: "Duyệt",
  progressTitle: "Tiến độ khóa học",
  tryInChat: "Thử trong chat ↓",
  openNav: "Mở menu",
  copy: "Sao chép",
  copied: "Đã sao chép",
  inEditor: "Trong Cursor / Claude Code:",
  localeFallback: "Bản dịch tiếng Việt chưa có — hiển thị tiếng Anh.",
};

export const SECTION_LABELS: Record<string, string> = {
  "01-welcome": "Welcome",
  "02-get-started": "Get started",
  "03-chat-basics": "Chat basics",
  "04-changes": "Changes",
  "05-generate": "Generate",
  "06-review": "Review",
  "07-everyday": "Everyday",
};

export const SECTION_LABELS_VI: Record<string, string> = {
  "01-welcome": "Giới thiệu",
  "02-get-started": "Bắt đầu",
  "03-chat-basics": "Chat cơ bản",
  "04-changes": "Thay đổi",
  "05-generate": "Tạo tài liệu",
  "06-review": "Rà soát",
  "07-everyday": "Hàng ngày",
};

const CHAT_HINTS: Record<string, string> = {
  "01-welcome": "Try in chat: <code>open the course</code>",
  "02-get-started": "Try in chat: <code>setup ai-spector project</code>",
  "03-chat-basics": "Try in chat: <code>help me approve</code>",
  "04-changes": "Try in chat: <code>I want to add login with Google</code>",
  "05-generate": "Try in chat: <code>generate the SRS</code>",
  "06-review": "Try in chat: <code>review documents</code> or <code>resolve comments</code>",
  "07-everyday": "Try in chat: <code>active tasks</code> or <code>check my workspace</code>",
  default:
    "Ask in chat: <code>open the ai-spector course</code> or <code>help me learn ai-spector</code>",
};

const CHAT_HINTS_VI: Record<string, string> = {
  "01-welcome": "Thử trong chat: <code>open the course</code>",
  "02-get-started": "Thử trong chat: <code>setup ai-spector project</code>",
  "03-chat-basics": "Thử trong chat: <code>help me approve</code>",
  "04-changes": "Thử trong chat: <code>I want to add login with Google</code>",
  "05-generate": "Thử trong chat: <code>generate the SRS</code>",
  "06-review":
    "Thử trong chat: <code>review documents</code> hoặc <code>resolve comments</code>",
  "07-everyday": "Thử trong chat: <code>active tasks</code> hoặc <code>check my workspace</code>",
  default:
    "Hỏi trong chat: <code>open the ai-spector course</code> hoặc <code>help me learn ai-spector</code>",
};

export function courseUi(locale: CourseLocale = DEFAULT_COURSE_LOCALE): CourseUiStrings {
  return locale === "vi" ? UI_VI : UI_EN;
}

export function sectionLabelForLocale(
  sectionId: string,
  locale: CourseLocale = DEFAULT_COURSE_LOCALE,
): string {
  const labels = locale === "vi" ? SECTION_LABELS_VI : SECTION_LABELS;
  return labels[sectionId] ?? sectionId;
}

export function chatHintForSection(
  sectionId: string | undefined,
  locale: CourseLocale = DEFAULT_COURSE_LOCALE,
): string {
  const hints = locale === "vi" ? CHAT_HINTS_VI : CHAT_HINTS;
  if (sectionId && hints[sectionId]) {
    return hints[sectionId];
  }
  return hints.default;
}

export function coursePathPrefix(locale: CourseLocale = DEFAULT_COURSE_LOCALE): string {
  return `/course/${locale}`;
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
  const [first, ...rest] = trimmed.split("/");
  if (first === "en" || first === "vi") {
    const slugRest = rest.join("/");
    return { locale: first, slug: slugRest || "index" };
  }
  return { locale: "en", slug: trimmed };
}

export function normalizeCourseLocale(value?: string): CourseLocale {
  return value === "vi" ? "vi" : "en";
}
