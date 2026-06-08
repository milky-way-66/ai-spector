import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Blockquote, Heading, Node, Paragraph, Parent, Root } from "mdast";

const processor = unified().use(remarkParse).use(remarkGfm);

export function parseMarkdown(content: string): Root {
  return processor.parse(content) as Root;
}

export function textContent(node: Node): string {
  if ("value" in node) return (node as unknown as { value: string }).value;
  if ("children" in node) {
    return ((node as unknown as Parent).children as Node[]).map(textContent).join("");
  }
  return "";
}

/**
 * From a paragraph, extract the value following a bold label.
 * `**Label:** value` → `"value"`
 * Stops at a hard break node, the next bold label, or a soft-break newline in text.
 */
export function extractBoldFieldInParagraph(
  para: Paragraph,
  labelPattern: RegExp,
): string | undefined {
  const { children } = para;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.type !== "strong") continue;
    const label = textContent(child).replace(/:$/, "").trim();
    if (!labelPattern.test(label)) continue;
    let value = "";
    for (let j = i + 1; j < children.length; j++) {
      const next = children[j]!;
      if (next.type === "break" || next.type === "strong") break;
      const t = textContent(next);
      const nl = t.indexOf("\n");
      if (nl !== -1) {
        value += t.slice(0, nl);
        break;
      }
      value += t;
    }
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/**
 * Search all paragraphs recursively (including inside list items) for a bold label.
 * Returns the first match found in document order.
 */
export function extractBoldFieldDeep(
  root: Root,
  labelPattern: RegExp,
): string | undefined {
  let found: string | undefined;
  visit(root, "paragraph", (para: Paragraph) => {
    if (found !== undefined) return;
    const val = extractBoldFieldInParagraph(para, labelPattern);
    if (val !== undefined) found = val;
  });
  return found;
}

/**
 * Find the blockquote that immediately follows a top-level paragraph
 * containing a bold label matching the pattern. Returns the text content.
 */
export function extractBlockquoteAfterBoldField(
  root: Root,
  labelPattern: RegExp,
): string | undefined {
  const { children } = root;
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!;
    if (node.type !== "paragraph") continue;
    const para = node as Paragraph;
    const hasLabel = para.children.some(
      (c) =>
        c.type === "strong" &&
        labelPattern.test(textContent(c).replace(/:$/, "").trim()),
    );
    if (!hasLabel) continue;
    const next = children[i + 1];
    if (next?.type === "blockquote") {
      return textContent(next as Blockquote).trim() || undefined;
    }
  }
  return undefined;
}

/**
 * Return the text of the first top-level heading whose content matches the pattern.
 */
export function findHeadingText(root: Root, pattern: RegExp): string | null {
  for (const node of root.children) {
    if (node.type !== "heading") continue;
    const text = textContent(node as Heading);
    if (pattern.test(text)) return text;
  }
  return null;
}

export type { Root, Paragraph, Heading };
