const LEGACY_REDIRECTS: Record<string, string> = {
  index: "/course/en/index",
  "01-get-started": "/course/en/02-get-started",
  "01-get-started/01-prerequisites-and-init": "/course/en/02-get-started/01-setup-via-chat",
  "01-get-started/02-setup-and-skills": "/course/en/02-get-started/01-setup-via-chat",
  "02-chat-basics": "/course/en/03-chat-basics",
  "02-chat-basics/01-how-chat-works": "/course/en/03-chat-basics/01-how-chat-works",
  "02-chat-basics/02-workspace-and-tasks": "/course/en/07-everyday/01-tasks-and-workspace",
  "02-chat-basics/03-incremental-changes": "/course/en/04-changes/01-add-or-change-requirement",
  "04-generate/01-generate-srs": "/course/en/05-generate/01-generate-srs",
  "04-generate/02-basic-design": "/course/en/index?migrated=1",
  "06-review/01-document-review": "/course/en/06-review/01-document-review",
  "06-review/02-comment-threads": "/course/en/06-review/02-resolve-comments",
};

export function legacyCourseRedirect(slug: string): string | undefined {
  if (slug.startsWith("en/") || slug.startsWith("vi/")) {
    return undefined;
  }
  if (slug in LEGACY_REDIRECTS) {
    return LEGACY_REDIRECTS[slug];
  }
  if (slug && slug !== "index") {
    return "/course/en/index?migrated=1";
  }
  return undefined;
}

export function isLegacyCoursePath(pathAfterCourse: string): boolean {
  if (!pathAfterCourse || pathAfterCourse === "index") {
    return false;
  }
  return !pathAfterCourse.startsWith("en/") && !pathAfterCourse.startsWith("vi/");
}
