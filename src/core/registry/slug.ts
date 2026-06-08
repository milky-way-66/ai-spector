/** Stable slug from heading text for section id suffix. */
export function headingSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function sectionIdFromHeading(
  documentId: string,
  heading: string,
  level: number,
  order: number,
): string {
  const slug = headingSlug(heading);
  const docKey = documentId.replace(/^doc\./, "");
  return `sec.${docKey}.l${level}.${order}.${slug}`;
}
