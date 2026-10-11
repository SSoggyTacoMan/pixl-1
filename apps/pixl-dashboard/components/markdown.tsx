// Safe Markdown subset for player-written text (journals, descriptions),
// ported from pixl.js's markdown()/mdInline() but rendered straight to React
// elements: there is no HTML string anywhere, so nothing a player types can
// become markup. Links and images only render for http(s) URLs.
import type { ReactNode } from "react";
import { safeHttpUrl, safeImageSrc } from "@/lib/safe-url";

type Tok = { re: RegExp; render: (m: RegExpExecArray, key: string) => ReactNode };

const INLINE: Tok[] = [
  { re: /`([^`]+)`/, render: (m, k) => <code key={k}>{m[1]}</code> },
  {
    re: /!\[([^[\]]*)\]\((https?:\/\/[^)\s[\]]+)\)/,
    render: (m, k) => {
      const src = safeImageSrc(m[2]);
      // eslint-disable-next-line @next/next/no-img-element
      return src ? <img key={k} src={src} alt={m[1]} loading="lazy" referrerPolicy="no-referrer" /> : null;
    },
  },
  {
    re: /\[([^[\]]+)\]\((https?:\/\/[^)\s[\]]+)\)/,
    render: (m, k) => {
      const href = safeHttpUrl(m[2]);
      return href ? (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">
          {inline(m[1], k)}
        </a>
      ) : (
        m[1]
      );
    },
  },
  { re: /\*\*([^*]+)\*\*/, render: (m, k) => <strong key={k}>{inline(m[1], k)}</strong> },
  { re: /__([^_]+)__/, render: (m, k) => <strong key={k}>{inline(m[1], k)}</strong> },
  { re: /~~([^~]+)~~/, render: (m, k) => <s key={k}>{inline(m[1], k)}</s> },
  { re: /\*([^*\s][^*]*?)\*/, render: (m, k) => <em key={k}>{inline(m[1], k)}</em> },
];

/** Inline markdown -> React nodes. Earliest match wins; text between is plain. */
export function inline(src: string, keyBase = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = src;
  let n = 0;
  while (rest.length) {
    let best: { idx: number; m: RegExpExecArray; tok: Tok } | null = null;
    for (const tok of INLINE) {
      const m = tok.re.exec(rest);
      if (m && (best === null || m.index < best.idx)) best = { idx: m.index, m, tok };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    out.push(best.tok.render(best.m, `${keyBase}.${n++}`));
    rest = rest.slice(best.idx + best.m[0].length);
  }
  return out;
}

const BLOCK_START = /^(#{1,6}\s|```|>\s?|\s*[-*+]\s+|\s*\d+\.\s+)/;
const HR = /^\s*([-*_])\1\1+\s*$/;

export function renderMarkdown(src: string): ReactNode[] {
  const lines = String(src ?? "").split(/\r?\n/);
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const key = () => `b${k++}`;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(
        <pre key={key()}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const Tag = `h${Math.min(h[1].length + 1, 6)}` as "h2";
      const kk = key();
      out.push(<Tag key={kk}>{inline(h[2], kk)}</Tag>);
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push(<hr key={key()} />);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      const kk = key();
      out.push(<blockquote key={kk}>{inline(q.join(" "), kk)}</blockquote>);
      continue;
    }
    const ul = /^\s*[-*+]\s+/;
    const ol = /^\s*\d+\.\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items: ReactNode[] = [];
      while (i < lines.length && re.test(lines[i])) {
        const kk = key();
        items.push(<li key={kk}>{inline(lines[i++].replace(re, ""), kk)}</li>);
      }
      out.push(ordered ? <ol key={key()}>{items}</ol> : <ul key={key()}>{items}</ul>);
      continue;
    }
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const para = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !BLOCK_START.test(lines[i]) && !HR.test(lines[i])) {
      para.push(lines[i++]);
    }
    const kk = key();
    out.push(
      <p key={kk}>
        {para.flatMap((l, j) => (j === 0 ? inline(l, `${kk}.${j}`) : [<br key={`${kk}br${j}`} />, ...inline(l, `${kk}.${j}`)]))}
      </p>,
    );
  }
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={`md${className ? ` ${className}` : ""}`}>{renderMarkdown(source)}</div>;
}

/** Strips Godot BBCode tags to plain text (quests/news copy authored for the game). */
export function bbstrip(src: unknown): string {
  return String(src ?? "")
    .replace(/\[\/?(?!lb\]|rb\])[a-zA-Z][^\]]*\]/g, "")
    .replace(/\[lb\]/g, "[")
    .replace(/\[rb\]/g, "]");
}
