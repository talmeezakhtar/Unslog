import type { AnyNode, Element } from 'domhandler';
import { isTag, isText } from 'domhandler';
import { parseDocument } from 'htmlparser2';
import { textContent } from 'domutils';

/** Collapse whitespace and trim. */
export function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

const BLOCK = new Set(['p', 'div', 'li', 'tr', 'table', 'section', 'article', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'pre', 'blockquote']);
const SKIP = new Set(['script', 'style', 'noscript', 'head', 'title']);

/** Plain text of a DOM subtree, with line breaks between block elements. */
export function nodeText(nodes: AnyNode | AnyNode[]): string {
  const out: string[] = [];
  const walk = (n: AnyNode) => {
    if (isText(n)) {
      out.push(n.data);
      return;
    }
    if (!isTag(n) && !('children' in n)) return;
    const name = isTag(n) ? n.name.toLowerCase() : '';
    if (SKIP.has(name)) return;
    if (name === 'br') {
      out.push('\n');
      return;
    }
    const block = BLOCK.has(name);
    if (block) out.push('\n');
    for (const child of (n as Element).children ?? []) walk(child);
    if (block) out.push('\n');
    if (name === 'td' || name === 'th') out.push(' ');
  };
  (Array.isArray(nodes) ? nodes : [nodes]).forEach(walk);
  return out
    .join('')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** HTML to readable plain text (keeps line breaks between blocks). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return nodeText(parseDocument(html));
}

/** Some APIs return HTML-escaped HTML (e.g. Greenhouse "content": "&lt;p&gt;..."). */
export function decodeEntities(s: string): string {
  return textContent(parseDocument(s));
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word match that also works for terms with symbols like "c#", ".net" or "node.js",
 * where the regex \b boundary does not behave.
 */
export function containsTerm(haystackLower: string, termLower: string): boolean {
  const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(termLower)}(?![a-z0-9])`, 'i');
  return re.test(haystackLower);
}
