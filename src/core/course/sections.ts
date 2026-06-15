/** Human labels for course section folders (`01-get-started` → "Get started"). */
export const SECTION_LABELS: Record<string, string> = {
  "01-get-started": "Get started",
  "02-chat-basics": "Chat basics",
  "03-graph": "Graph & sources",
  "04-generate": "Generate documents",
  "05-prototype": "Design & prototype",
  "06-review": "Review & changes",
  "07-advanced": "Advanced",
};

export function sectionIdFromRelPath(relPath: string): string | undefined {
  const parts = relPath.split("/");
  if (parts.length < 2) {
    return undefined;
  }
  return parts[0];
}

export function sectionLabel(sectionId: string): string {
  return SECTION_LABELS[sectionId] ?? humanizeSectionId(sectionId);
}

function humanizeSectionId(sectionId: string): string {
  const name = sectionId.replace(/^\d+-/, "").replace(/-/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
